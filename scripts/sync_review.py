#!/usr/bin/env python3
"""Monitor for new files and trigger a codex command.

On file creation, constructs a review prompt that embeds the detected
file path and invokes `codex exec` with the exact, user‑provided
instructions.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from threading import Event, Lock
from pathlib import Path
from typing import Sequence, Type

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MONITOR_DIRECTORY = PROJECT_ROOT / "code_review"
COMMAND_WORKDIR = PROJECT_ROOT
PROMPT_SOURCE_PATH = PROJECT_ROOT / ".claude" / "agents" / "code-review-analyzer.md"
PROCESSED_CACHE_PATH = Path(__file__).resolve().parent / ".sync_review_processed.json"
_processed_files: set[str] = set()
_cache_dirty = False
SPINNER_INTERVAL = 0.12
SPINNER_TEMPLATE = "[MONITOR] Watching for new files... {}"
SPINNER_COLOR = "\033[96m"
ANSI_RESET = "\033[0m"
_spinner_pause = Event()
_spinner_lock = Lock()


def _generate_spinner_frames(width: int = 9) -> tuple[str, ...]:
    frames: list[str] = []
    for pos in range(width):
        frames.append(f"[{'=' * pos}>{' ' * (width - pos - 1)}]")
    for pos in range(width - 1, -1, -1):
        frames.append(f"[{' ' * (width - pos - 1)}<{('=' * pos)}]")
    return tuple(frames)


SPINNER_FRAMES = _generate_spinner_frames()
_SPINNER_CLEAR_WIDTH = max(len(SPINNER_TEMPLATE.format(frame)) for frame in SPINNER_FRAMES)


def _invoked_via_npm() -> bool:
    """Return True when the script is launched from an npm lifecycle."""
    return bool(os.environ.get("npm_lifecycle_event"))


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Dispatch Codex reviews for artifacts.")
    parser.add_argument(
        "-f",
        "--file",
        help=(
            "Path to a single artifact file. When provided, the watcher is not started "
            "and the script processes only this file."
        ),
    )
    return parser.parse_args(argv)


def _strip_markdown_front_matter(markdown: str) -> str:
    """Remove leading markdown front matter fenced by '---' markers."""
    lines = markdown.splitlines()
    if lines and lines[0].strip() == "---":
        for idx in range(1, len(lines)):
            if lines[idx].strip() == "---":
                return "\n".join(lines[idx + 1:]).lstrip("\n")
    return markdown


DEFAULT_PROMPT_TEMPLATE = (
    '''You are a world-class senior code reviewer with deep expertise in software engineering best practices, security, performance optimization, and maintainability. You specialize in analyzing code changes presented in HTML review artifacts.

**Your Core Responsibilities:**

1. **Understand Context**: Begin by carefully executing review CLI commands defined below to understand the purpose and goals of the code changes.

2. **Analyze Each Code Hunk**: For every code hunk in the CLI command:
   - Examine the surrounding codebase to fully understand the context
   - Evaluate the change against the stated intent
   - Assess correctness, efficiency, security, and maintainability
   - Consider edge cases and potential side effects
   - Verify the change aligns with established patterns in the codebase

3. **Apply Industry Standards**: Your review must adhere to world-class standards including:
   - SOLID principles and clean code practices
   - Security best practices (OWASP guidelines where applicable)
   - Performance considerations and algorithmic efficiency
   - Error handling and resilience patterns
   - Code readability and maintainability
   - Testing requirements and testability

4. **Review Methodology**:
   - First pass: Verify the change achieves its stated intent
   - Second pass: Check for bugs, edge cases, and logical errors
   - Third pass: Evaluate code quality, patterns, and best practices
   - Fourth pass: Consider system-wide impact and integration concerns

5. **Context Analysis Requirements**:
   - Always examine related files and dependencies
   - Understand the broader module or component architecture
   - Consider existing patterns and conventions in the codebase
   - Verify compatibility with interfaces and contracts

6. **Quality Thresholds**:
   - Code must be production-ready to pass
   - No known security vulnerabilities
   - Proper error handling must be present
   - Changes must not degrade performance without justification
   - Code must be maintainable and follow established patterns

7. **Communication Style**:
   - Be constructive and educational in feedback
   - Provide specific examples when suggesting improvements
   - Acknowledge good practices when observed
   - Prioritize critical issues over minor style preferences

8. **Provide Code Review**: Use the review CLI to drive the review.
   - Note: “artifact” refers to the HTML review document. For `--file`, pass either a bare filename or a relative/absolute path.
   - Workflow:
    - List all hunk IDs to review: `npm run review:edit -- list-uuid --file <artifact>`
      - The output ends with a “PR Review Context” section describing the context of changes.
    - Show the diff for a specific hunk: `npm run review:edit -- show-diff --file <artifact> --uuid <uuid>`
    - Submit your analysis for that hunk (you may inline style, color code in div): `npm run review:edit -- remark --file <artifact> --uuid <uuid> --body "<div class="review-remark">…</div>"`
    - Include an overall VERDICT: run a separate command
      `npm run review:edit -- verdict --file <artifact> --body "<div>…</div>|-"` 
   - Mark as **PASS** or **FAIL** with clear formatting
   - For PASS: Explain why the code meets standards and any particular strengths
   - For FAIL: Provide detailed explanation of issues and specific, actionable proposed changes

9. **Output Format**: When editing the HTML, structure your reviews as:
   ```html
   <div class="review-verdict">
     <strong>Verdict: [PASS/FAIL]</strong>
     <p><strong>Analysis:</strong> [Detailed explanation]</p>
     [If FAIL: <p><strong>Proposed Changes:</strong> [Specific improvements]</p>]
     [If relevant: <p><strong>Additional Considerations:</strong> [Edge cases, performance notes, etc.]</p>]
   </div>
   ```

You will maintain the highest standards of code review, ensuring that only robust, secure, and maintainable code passes your review. Your analysis should be thorough enough that any developer can understand both your verdict and reasoning, and implement your suggestions effectively.'''
)

try:
    _PROMPT_SOURCE_RAW = PROMPT_SOURCE_PATH.read_text()
except FileNotFoundError:
    PROMPT_TEMPLATE = DEFAULT_PROMPT_TEMPLATE
except OSError as exc:
    print(f"[PROMPT] Failed to load prompt source {PROMPT_SOURCE_PATH}: {exc}")
    PROMPT_TEMPLATE = DEFAULT_PROMPT_TEMPLATE
else:
    stripped_prompt = _strip_markdown_front_matter(_PROMPT_SOURCE_RAW)
    if stripped_prompt.strip():
        PROMPT_TEMPLATE = stripped_prompt
    else:
        PROMPT_TEMPLATE = DEFAULT_PROMPT_TEMPLATE


def _extend_sys_path_for_watchdog() -> None:
    """Append known virtualenv site-packages directories to sys.path."""
    repo_root = PROJECT_ROOT
    candidates = [
        repo_root / ".venv" / "lib",
        repo_root / "venv" / "lib",
        repo_root.parent / "sync-editor" / "venv" / "lib",
    ]
    for base in candidates:
        for site_packages in base.glob("python*/site-packages"):
            sys.path.append(str(site_packages))


def _load_watchdog() -> tuple[Type[object], type]:
    """Import watchdog dependencies, extending sys.path if needed."""
    try:
        from watchdog.observers.polling import PollingObserver
        from watchdog.events import FileSystemEventHandler
        return PollingObserver, FileSystemEventHandler
    except ModuleNotFoundError:
        _extend_sys_path_for_watchdog()
        try:
            from watchdog.observers.polling import PollingObserver
            from watchdog.events import FileSystemEventHandler
            return PollingObserver, FileSystemEventHandler
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "watchdog is not available. Install it via 'pip install watchdog' "
                "in this repository or point SYNC_REVIEW_PYTHON to an interpreter "
                "that provides it."
            ) from exc


Observer, FileSystemEventHandler = _load_watchdog()


def _load_processed_cache() -> set[str]:
    """Load the set of processed file paths from disk."""
    try:
        data = json.loads(PROCESSED_CACHE_PATH.read_text())
        if isinstance(data, list):
            return {str(Path(entry)) for entry in data}
    except FileNotFoundError:
        return set()
    except json.JSONDecodeError:
        print(f"[CACHE] Failed to parse cache file {PROCESSED_CACHE_PATH}; starting fresh")
    return set()


def _save_processed_cache(force: bool = False) -> None:
    """Persist processed file paths to disk if modified or forced."""
    global _cache_dirty
    if not force and not _cache_dirty:
        return
    try:
        entries = list(_processed_files)
        PROCESSED_CACHE_PATH.write_text(json.dumps(entries, indent=2))
        _cache_dirty = False
    except OSError as exc:
        print(f"[CACHE] Failed to write cache file: {exc}")


def _mark_processed(canonical: str) -> None:
    """Record a processed file path and mark cache dirty."""
    global _cache_dirty
    if canonical in _processed_files:
        return
    _processed_files.add(canonical)
    _cache_dirty = True


def _clear_spinner_line() -> None:
    """Clear the spinner line from stdout."""
    print("\r" + " " * _SPINNER_CLEAR_WIDTH + "\r", end="", flush=True)


def _pause_spinner() -> None:
    """Temporarily pause spinner updates."""
    _spinner_pause.set()
    _clear_spinner_line()


def _resume_spinner() -> None:
    """Resume spinner updates."""
    _spinner_pause.clear()


def _build_prompt(detected_path: str) -> str:
    """Return the exact prompt with <detected_file_path> substituted."""
    # Support both legacy and new placeholders
    return (
        PROMPT_TEMPLATE
        .replace("<detected_file_path>", detected_path)
        .replace("<artifact>", detected_path)
    )


def _resolve_file_argument(argument: str) -> Path:
    """Resolve a --file argument to an absolute path."""
    candidate = Path(argument).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()

    parts = candidate.parts
    if len(parts) == 1:
        if not MONITOR_DIRECTORY.is_dir():
            raise ValueError(f"Monitor directory does not exist: {MONITOR_DIRECTORY}")
        return (MONITOR_DIRECTORY / candidate).resolve()

    return (Path.cwd() / candidate).resolve()


def run_command_with_prompt(prompt: str) -> bool:
    """Execute the codex command in the target directory with the given prompt."""
    try:
        # Call codex directly to avoid shell quoting issues with a long prompt
        subprocess.run(
            [
                "codex",
                "exec",
                "--config",
                "hide_agent_reasoning=true",
                "--model",
                "gpt-5-codex",
                "--sandbox",
                "workspace-write",
                "-c",
                'approval_policy="never"',
                "-c",
                'model_reasoning_effort="high"',
                prompt,
            ],
            cwd=COMMAND_WORKDIR,
            check=True,
        )
        print("[COMMAND] Executed successfully")
        return True
    except subprocess.CalledProcessError as exc:
        print(f"[COMMAND] Failed with exit code {exc.returncode}")
        print(
            "[COMMAND] Re-run this command with elevated permissions: request escalation"
            " (set with_escalated_permissions=true) and supply a one-sentence justification"
            " so Codex can access the necessary resources."
        )
        return False
    except FileNotFoundError:
        print("[COMMAND] 'codex' command not found; ensure it is installed")
        return False


def _ask_to_proceed() -> bool:
    """Prompt the user for confirmation before running the review."""
    try:
        response = input("Proceed with review? [y/N]: ").strip().lower()
    except EOFError:
        print("[MONITOR] Input unavailable; skipping review")
        return False
    return response in {"y", "yes"}


def _process_file(
    path: Path,
    *,
    force: bool = False,
    require_confirmation: bool = True,
) -> None:
    """Handle review execution for a single file if not already processed."""
    if not path.exists() or not path.is_file():
        return
    if path.name == ".DS_Store":
        print("[MONITOR] Ignoring .DS_Store artifact")
        return

    canonical = str(path.resolve())
    if not force and canonical in _processed_files:
        print(f"[MONITOR] Skipping already processed file: {path}")
        return

    with _spinner_lock:
        if require_confirmation:
            _pause_spinner()
        try:
            label = "[MONITOR]" if require_confirmation else "[CLI]"
            action = "New file detected" if require_confirmation else "Processing file"
            print(f"{label} {action}: {path}")
            if require_confirmation and not _ask_to_proceed():
                print("[MONITOR] Review skipped by user")
                _mark_processed(canonical)
                return

            prompt = _build_prompt(canonical)
            if run_command_with_prompt(prompt):
                _mark_processed(canonical)
        finally:
            if require_confirmation:
                _resume_spinner()


class NewFileHandler(FileSystemEventHandler):
    """React to newly created files."""

    def on_created(self, event):  # type: ignore[override]
        if event.is_directory:
            return
        _process_file(Path(event.src_path))


def _run_single_file(argument: str) -> None:
    """Process a single file and exit."""
    if not COMMAND_WORKDIR.is_dir():
        print(f"Command working directory does not exist: {COMMAND_WORKDIR}")
        sys.exit(1)

    global _processed_files
    _processed_files = _load_processed_cache()

    try:
        file_path = _resolve_file_argument(argument)
    except ValueError as exc:
        print(str(exc))
        sys.exit(1)

    if not file_path.is_file():
        print(f"File not found: {file_path}")
        sys.exit(1)

    _process_file(file_path, force=True, require_confirmation=False)
    _save_processed_cache(force=True)
    _show_review_result(file_path)


def _show_review_result(_: Path) -> None:
    """Indicate completion without invoking additional commands."""
    print("Review of the code has been completed.")


def _process_existing_files() -> None:
    """Run the review command for all files in the monitored directory."""
    try:
        files = sorted(MONITOR_DIRECTORY.iterdir())
    except FileNotFoundError:
        return
    for path in files:
        if not path.is_file():
            continue
        canonical = str(path.resolve())
        if canonical in _processed_files:
            print(f"[MONITOR] Ignoring cached file: {path}")
            continue
        _process_file(path)


def _monitor_loop() -> None:
    """Display a simple spinner while the observer runs."""
    frame_index = 0
    total_frames = len(SPINNER_FRAMES)
    while True:
        if _spinner_pause.is_set():
            time.sleep(SPINNER_INTERVAL)
            continue
        frame = SPINNER_FRAMES[frame_index % total_frames]
        raw_line = SPINNER_TEMPLATE.format(frame)
        padding = " " * (_SPINNER_CLEAR_WIDTH - len(raw_line))
        print(
            f"\r{SPINNER_COLOR}{raw_line}{ANSI_RESET}{padding}",
            end="",
            flush=True,
        )
        time.sleep(SPINNER_INTERVAL)
        frame_index += 1


def _validate_directories() -> bool:
    if not MONITOR_DIRECTORY.is_dir():
        print(f"Monitor directory does not exist: {MONITOR_DIRECTORY}")
        return False
    if not COMMAND_WORKDIR.is_dir():
        print(f"Command working directory does not exist: {COMMAND_WORKDIR}")
        return False
    return True


def main(argv: Sequence[str] | None = None) -> None:
    args = _parse_args(argv)

    if _invoked_via_npm() and not args.file:
        lifecycle = os.environ.get("npm_lifecycle_event", "review:dispatch")
        example = f"npm run {lifecycle} -- --file artifact.html"
        print(
            "[CLI] Must supply --file." "\n"
            f"[CLI] Example: {example}"
        )
        sys.exit(1)

    if args.file:
        _run_single_file(args.file)
        return

    if not _validate_directories():
        return

    global _processed_files
    _processed_files = _load_processed_cache()

    handler = NewFileHandler()
    observer = Observer()

    observer.schedule(handler, str(MONITOR_DIRECTORY), recursive=False)
    _process_existing_files()
    observer.start()
    _clear_spinner_line()
    print(
        f"Monitoring {MONITOR_DIRECTORY} for new files using"
        f" {observer.__class__.__name__}. Press Ctrl+C to stop."
    )

    try:
        _monitor_loop()
    except KeyboardInterrupt:
        _clear_spinner_line()
        print("Stopping monitor...")
    finally:
        observer.stop()
        observer.join()
        _save_processed_cache(force=True)
        _clear_spinner_line()
        print("Monitor stopped.")


if __name__ == "__main__":
    main()
