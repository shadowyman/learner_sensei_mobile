import json
import re
import sys
from pathlib import Path


def extract_title_version(raw_title: str) -> tuple[str, str]:
    match = re.search(r'\(([^)]*Version[^)]*)\)\s*$', raw_title)
    if match:
        title = raw_title[:match.start()].rstrip()
        version = match.group(1).strip()
        return title, version
    return raw_title, ""


def extract_section(block: str, start_pattern: str, end_pattern: str) -> str:
    pattern = re.compile(start_pattern + r'([\s\S]*?)(?=' + end_pattern + r')')
    match = pattern.search(block)
    return match.group(1).strip() if match else ""


def extract_concepts(block: str) -> list[dict[str, str]]:
    section_match = re.search(r'\nConcepts:\s*([\s\S]*?)(?=\nMethodology:|\nModule|$)', block)
    if not section_match:
        return []
    section = section_match.group(1)
    header_pattern = re.compile(r'(?:^|\n)\s*(\d+)\.\s+([^\n]+)')
    header_matches = list(header_pattern.finditer(section))
    concepts: list[dict[str, str]] = []
    for index, match in enumerate(header_matches):
        if not match:
            continue
        raw_title = match.group(2).strip()
        title = raw_title[:-1].strip() if raw_title.endswith(':') else raw_title
        start = match.end()
        end = header_matches[index + 1].start() if index + 1 < len(header_matches) else len(section)
        text = section[start:end].strip()
        if title and text:
            concepts.append({"title": title, "text": text})
    return concepts


def extract_methodology(block: str) -> list[dict[str, str]]:
    section_match = re.search(r'\nMethodology:\s*([\s\S]*?)(?=\nSocratic|\nSolidify|\nModule|$)', block)
    if not section_match:
        return []
    section = section_match.group(1)
    pattern = re.compile(r'(?:^|\n)\s*(\d+\.[ \t]*[^:\n]+?):\s*([\s\S]*?)(?=\n\s*\d+\.[ \t]*[^:\n]+?:|\n\s*Socratic:|\n\s*Solidify & Prepare|\nModule|$)')
    steps: list[dict[str, str]] = []
    for match in pattern.finditer(section):
        title = match.group(1).strip()
        text = match.group(2).strip()
        if title and text:
            steps.append({"title": title, "text": text})
        if len(steps) >= 2:
            break
    return steps


def parse_modules(text: str) -> dict[str, object]:
    header_pattern = re.compile(r'^Module (\d+(?:\.\d+)?):\s*(.*?)$', re.MULTILINE)
    headers = list(header_pattern.finditer(text))
    modules: list[dict[str, object]] = []
    for index, header in enumerate(headers):
        start = header.start()
        end = headers[index + 1].start() if index + 1 < len(headers) else len(text)
        block = text[start:end]
        raw_title = header.group(2).strip()
        title, version = extract_title_version(raw_title)
        summary = extract_section(block, r'\nSummary:\s*', r'\nGoal:|\nConcepts:|\nMethodology:|\nModule|$')
        goal = extract_section(block, r'\nGoal:\s*', r'\nConcepts:|\nModule|$')
        concepts = extract_concepts(block)
        methodology = extract_methodology(block)
        socratic = extract_section(block, r'\nSocratic:\s*', r'\n\s*Solidify & Prepare|\nModule|$')
        solidify = extract_section(block, r'\n\s*Solidify & Prepare:\s*', r'\nModule|$')
        modules.append({
            "id": f"Module{header.group(1).replace('.', '_')}",
            "title": title,
            "version": version,
            "summary": summary,
            "goal": goal,
            "concepts": concepts,
            "methodology": methodology,
            "socratic": socratic,
            "solidify": solidify
        })
    return {"modules": modules}


def main() -> None:
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("src/Modules.txt")
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else input_path.with_suffix(".json")
    text = input_path.read_text(encoding="utf-8")
    data = parse_modules(text)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
