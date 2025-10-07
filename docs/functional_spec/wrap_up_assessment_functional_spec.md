Functional Specification: Wrap Up Assessment Experience

Purpose
- Replace the existing Solidify/Wrap Up interaction with a structured 15-question assessment that validates mastery in a FAANG-style interview context.

Trigger Conditions
- Automatically launch when the curriculum transitions into the Solidify phase after Socratic completion.
- Automatically launch when the learner directly selects the Wrap Up phase through module selection controls.

Assessment Requirements
- Generate exactly 15 multiple-choice questions spanning all Solidify content; five questions must contain C++ code snippets targeting nuanced understanding.
- Questions must be tricky, covering both stated and implicit topic scope to mirror FAANG interview expectations.
- Each question presents four choices; only one is correct.
- Assessment payload schema (per question): `id`, `prompt`, `choices`, `correct_choice`, `explanation`, `interviewer_insight`.

User Interaction Constraints
- Lock the standard chat input and prevent additional Sensei messages while the assessment overlay is active (Phase 1 behavior).
- Submission occurs once via a single Submit button; no per-question validation is performed.
- Once submitted, selections are final; no retakes are allowed for this session.
- Display the correct answer inline beneath every question after submission so learners can review outcomes.

Timer Behavior (Phase 2)
- Phase 1 does not include timing mechanics; all timer-related features are out of scope for this release.

Overlay Presentation
- Render the full assessment in a centered overlay within the transcript area, visually consistent with but distinct from existing message bubbles.
- Represent each choice as a visually rich button-style element to highlight selection state.
- Display all 15 questions simultaneously in a scrollable overlay; no per-question progress indicator is required.
- Keep the Submit button within the overlay, clearly indicating when it becomes active.

Result Handling
- Upon submission, evaluate every answer and mark questions as correct or incorrect directly beneath the corresponding prompt.
- Summaries (overall score, counts, or other aggregates) remain to be defined; current requirement focuses on per-question feedback.
- Trigger remediation for every incorrectly answered question.
- Keep grading information self-contained within the overlay; no external persistence, logging, or analytics integration is required at this stage.

Remediation Workflow
- After grading, create a “Solidify” remediation bubble positioned beneath the assessment overlay.
- Supply the remediation request to the AI with the full context for each failed question, the learner’s chosen answer, and the combined Solidify context (all concept descriptions for the module, mirroring the item-based prompt educational context).
- AI must respond with actionable teaching per question plus one or two specific LeetCode problems aligned with the knowledge gap, formatted in a parseable JSON structure containing `question_id`, `actionable_teaching`, and `leetcode_problems` (array of strings).
- Display remediation results in a visually appealing layout that highlights actionable steps and recommended practice, clearly separating labeled sections for “Actionable Teaching” and “Recommended LeetCode Practice” for each failed question.
- Prepend the remediation overlay (not the test overlay) with a score card that selects predefined celebratory or supportive copy based on total correct answers (thresholds at 4, 8, 11, 14, and 15).

System Behavior During Assessment
- Suspend curriculum advancement and Sensei response generation until the assessment flow completes (grading and remediation bubble generation delivered).
- Operate independently from existing learner model state, knowledge components, or pedagogical guidance systems; this assessment flow maintains its own state and outcomes.
- Keep both the assessment overlay and remediation bubble visible indefinitely; no dismissal controls are provided in Phase 1.

Dependencies & Integration Notes
- Reuse existing message/overlay infrastructure where it makes sense, but mount the assessment UI outside any message bubble that `displayMessage`/`updateMessageStream` can mutate. The overlay must live in its own DOM container (or be explicitly guarded) so the streaming pipeline never overwrites its markup.
- Ensure timeout handling, answer storage, grading, and remediation orchestration operate independently of streaming Sensei responses and from learner model / KC systems.
- Implement assessment and remediation error handling locally: retry the AI call once on malformed or failed responses. If the second attempt fails, surface a standard Sensei apology bubble explaining that the assessment content is temporarily unavailable.

AI Prompt (Initial Paraphrase)
- "Prepare a 15-question multiple-choice assessment that spans every concept in the provided material. Each question should feel tricky and creative—draw on implied knowledge within scope, not just verbatim details—so the set mirrors the rigor of FAANG-style LeetCode interviews. Include five C++ code-snippet questions that probe different understanding angles, edge cases, and common interview pitfalls. Supply four answer choices per question, clearly mark the correct option, and add a short explanation of why it is correct. Return the explanation and a separate `interviewer_insight` field: the insight should describe how a FAANG interviewer disguises this concept, the trap they set, and the weakness they are screening for, so we can surface it in its own card."

Outstanding Clarifications
- Requirements for aggregate scoring display beyond the score card copy, persistence across sessions, analytics, or export.

Future Work (Phase 2)
- Phase 2 will introduce timed assessments and post-expiry behavior once the timer feature is prioritized.

Reference Mockups
- `docs/functional_spec/wrap_up_assessment_test_overlay.html` — static React mock illustrating the assessment overlay layout, styling, and post-submit feedback blocks.
