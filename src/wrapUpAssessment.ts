import { sanitizeCodeFences, addLanguageDisplayToCodeBlocks, addCopyButtonsToCodeBlocks } from './ui';
import { WrapUpAssessmentQuestion } from './geminiService';
import { marked } from 'marked';

declare const hljs: any;

const OVERLAY_ID = 'wrap-up-assessment-overlay';
const CTA_DISABLED_TEXT = 'Select Answers to Reveal';
const CTA_READY_TEXT = 'Reveal Explanations';
const CTA_POST_TEXT = 'Proceed to Remediation';
const PRE_FOOTER_COPY = 'Review every prompt thoroughly, selecting the strongest answer for each. When you are ready, reveal the official explanations to verify your reasoning.';
const POST_FOOTER_COPY = 'Use the explanations and interviewer notes to inform your remediation focus.';
const CHOICE_KEYS = ['A', 'B', 'C', 'D'];

type RenderChoice = {
    key: string;
    text: string;
    value: string;
};

type RenderQuestion = {
    id: string;
    type: WrapUpAssessmentQuestion['type'];
    prompt: string;
    code?: string;
    choices: RenderChoice[];
    correctChoiceKey: string;
    explanation: string;
    interviewerInsight: string;
};

type QuestionElements = {
    card: HTMLElement;
    buttons: Map<string, HTMLButtonElement>;
    statusSpans: Map<string, HTMLElement>;
    feedback: HTMLElement;
    feedbackHeader: HTMLElement;
    feedbackBody: HTMLElement;
};

export interface WrapUpAssessmentOverlayData {
    moduleTitle: string;
    moduleGoal?: string;
    conceptSummaries?: string[];
    questions: WrapUpAssessmentQuestion[];
}

function assertNonEmptyString(value: unknown, message: string): string {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    throw new Error(message);
}

function optionalString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
}

export function validateWrapUpAssessmentQuestions(questions: WrapUpAssessmentQuestion[]): WrapUpAssessmentQuestion[] {
    if (!Array.isArray(questions)) {
        throw new Error('Wrap Up assessment payload is not an array.');
    }

    if (questions.length !== 15) {
        throw new Error(`Wrap Up assessment must contain exactly 15 questions; received ${questions.length}.`);
    }

    const snippetCount = questions.filter(question => question.type === 'snippet').length;
    if (snippetCount !== 5) {
        throw new Error(`Wrap Up assessment must include exactly 5 snippet questions; received ${snippetCount}.`);
    }

    return questions.map((question, index) => {
        const displayIndex = index + 1;
        const id = assertNonEmptyString(question.id, `Question ${displayIndex} is missing an id.`);
        const prompt = assertNonEmptyString(question.prompt, `Question ${displayIndex} prompt is missing.`);
        const explanation = assertNonEmptyString(question.explanation, `Question ${displayIndex} explanation is missing.`);
        const interviewerInsight = assertNonEmptyString(question.interviewer_insight, `Question ${displayIndex} interviewer insight is missing.`);
        const choicesArray = Array.isArray(question.choices) ? question.choices : [];
        if (choicesArray.length !== 4) {
            throw new Error(`Question ${displayIndex} must contain exactly four answer choices.`);
        }
        const normalizedChoices = choicesArray.map((choice, choiceIndex) =>
            assertNonEmptyString(choice, `Question ${displayIndex} choice ${choiceIndex + 1} is empty.`)
        );
        const correctChoice = assertNonEmptyString(question.correct_choice, `Question ${displayIndex} correct choice is missing.`);
        if (!normalizedChoices.includes(correctChoice)) {
            throw new Error(`Question ${displayIndex} correct choice must match one of the provided choices.`);
        }
        const code = optionalString(question.code);
        const type = question.type === 'snippet' ? 'snippet' : 'concept';
        if (type === 'snippet' && !code) {
            throw new Error(`Snippet question ${displayIndex} is missing required C++ code.`);
        }

        return {
            id,
            type,
            prompt,
            code,
            choices: normalizedChoices,
            correct_choice: correctChoice,
            explanation,
            interviewer_insight: interviewerInsight
        } as WrapUpAssessmentQuestion;
    });
}

function prepareRenderQuestions(questions: WrapUpAssessmentQuestion[]): RenderQuestion[] {
    return questions.map(question => {
        const choices: RenderChoice[] = question.choices.map((text, choiceIndex) => {
            const key = CHOICE_KEYS[choiceIndex] ?? String.fromCharCode(65 + choiceIndex);
            return {
                key,
                text,
                value: text
            };
        });

        const correctIndex = question.choices.findIndex(choice => choice === question.correct_choice);
        const correctChoiceKey = choices[correctIndex]?.key ?? choices[0]?.key ?? 'A';

        const renderQuestion: RenderQuestion = {
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            choices,
            correctChoiceKey,
            explanation: question.explanation,
            interviewerInsight: question.interviewer_insight
        };
        if (question.code) {
            renderQuestion.code = question.code;
        }
        return renderQuestion;
    });
}

function buildQuestionSelectionSenseiContext(
    question: RenderQuestion,
    index: number,
    moduleTitle: string,
    moduleGoal: string | undefined
): string {
    const lines: string[] = [];
    lines.push(`Module: ${moduleTitle}`);
    if (moduleGoal) {
        lines.push(`Goal: ${moduleGoal}`);
    }
    lines.push(`Question ${index + 1} (${question.type}): ${question.prompt}`);
    if (question.code) {
        lines.push('Code Snippet:', question.code);
    }
    question.choices.forEach(choice => {
        lines.push(`  ${choice.key}. ${choice.text}`);
    });
    const correct = question.choices.find(choice => choice.key === question.correctChoiceKey);
    if (correct) {
        lines.push(`Correct Answer (${correct.key}): ${correct.text}`);
    }
    lines.push(`Explanation: ${question.explanation}`);
    lines.push(`Interviewer Insight: ${question.interviewerInsight}`);
    return lines.join('\n');
}

export function isWrapUpAssessmentActive(): boolean {
    return !!document.getElementById(OVERLAY_ID);
}

export function showWrapUpAssessmentOverlay(data: WrapUpAssessmentOverlayData): void {
    const messageArea = document.getElementById('message-area');
    if (!messageArea) {
        return;
    }
    if (isWrapUpAssessmentActive()) {
        return;
    }

    const validatedQuestions = validateWrapUpAssessmentQuestions(data.questions);
    const renderQuestions = prepareRenderQuestions(validatedQuestions);

    disableChatControls();

    const wrapper = document.createElement('div');
    wrapper.id = OVERLAY_ID;
    wrapper.className = 'wrap-up-assessment-container';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Wrap Up Assessment');
    wrapper.tabIndex = -1;

    const overlayShell = document.createElement('div');
    overlayShell.className = 'overlay-shell';
    wrapper.appendChild(overlayShell);

    const overlayHeader = document.createElement('div');
    overlayHeader.className = 'overlay-header';
    const overlayHeaderContent = document.createElement('div');
    overlayHeaderContent.className = 'overlay-header-content';

    const moduleHeading = document.createElement('div');
    moduleHeading.className = 'module-heading';
    const moduleTitle = document.createElement('h1');
    moduleTitle.className = 'module-title';
    moduleTitle.textContent = data.moduleTitle;
    moduleHeading.appendChild(moduleTitle);
    overlayHeaderContent.appendChild(moduleHeading);

    if (data.moduleGoal) {
        const goalParagraph = document.createElement('p');
        goalParagraph.className = 'overlay-goal';
        goalParagraph.textContent = `Goal: ${data.moduleGoal}`;
        overlayHeaderContent.appendChild(goalParagraph);
    }

    const overlaySubheading = document.createElement('p');
    overlaySubheading.className = 'overlay-subheading';
    overlaySubheading.textContent = 'Select the strongest answer for each scenario before revealing the official explanations.';
    overlayHeaderContent.appendChild(overlaySubheading);

    overlayHeader.appendChild(overlayHeaderContent);
    overlayShell.appendChild(overlayHeader);

    const overlayBody = document.createElement('div');
    overlayBody.className = 'overlay-body';
    overlayShell.appendChild(overlayBody);

    const assessmentGrid = document.createElement('div');
    assessmentGrid.className = 'assessment-grid';
    overlayBody.appendChild(assessmentGrid);

    const selections = new Map<string, string | null>();
    const questionElements = new Map<string, QuestionElements>();

    renderQuestions.forEach((question, index) => {
        selections.set(question.id, null);

        const card = document.createElement('section');
        card.className = 'question-card';
        card.dataset.questionId = question.id;

        const header = document.createElement('div');
        header.className = 'question-header';

        const stemWrapper = document.createElement('div');
        stemWrapper.className = 'question-stem-wrapper';

        const stemMeta = document.createElement('div');
        stemMeta.className = 'question-stem-meta';

        const questionIndex = document.createElement('span');
        questionIndex.className = 'question-index';
        questionIndex.textContent = `Question ${index + 1}`;
        stemMeta.appendChild(questionIndex);

        const labelChip = document.createElement('span');
        labelChip.className = 'label-chip';
        labelChip.textContent = question.type === 'snippet' ? 'C++ Snippet' : 'Conceptual';
        stemMeta.appendChild(labelChip);

        stemWrapper.appendChild(stemMeta);

        const stem = document.createElement('div');
        stem.className = 'question-stem markdown-content';
        setMarkdown(stem, question.prompt);
        stemWrapper.appendChild(stem);

        header.appendChild(stemWrapper);
        card.appendChild(header);

        if (question.code) {
            const codeWrapper = document.createElement('div');
            codeWrapper.classList.add('question-code', 'markdown-content');
            const fenceLanguage = question.type === 'snippet' ? 'cpp' : '';
            const fenceOpen = fenceLanguage ? '```' + fenceLanguage : '```';
            const codeMarkdown = [fenceOpen, question.code, '```'].join('\n');
            setMarkdown(codeWrapper, codeMarkdown);
            card.appendChild(codeWrapper);
        }

        const choicesContainer = document.createElement('div');
        choicesContainer.className = 'choices';

        const buttonMap = new Map<string, HTMLButtonElement>();
        const statusSpanMap = new Map<string, HTMLElement>();

        question.choices.forEach(choice => {
            const choiceButton = document.createElement('button');
            choiceButton.type = 'button';
            choiceButton.className = 'choice';
            choiceButton.dataset.choiceKey = choice.key;

            const choiceKey = document.createElement('span');
            choiceKey.className = 'choice-key';
            choiceKey.textContent = choice.key;
            choiceButton.appendChild(choiceKey);

            const choiceText = document.createElement('div');
            choiceText.className = 'choice-text markdown-content';
            setMarkdown(choiceText, choice.text);
            choiceButton.appendChild(choiceText);

            const statusSpan = document.createElement('span');
            statusSpan.className = 'choice-status';
            statusSpan.style.display = 'none';
            choiceButton.appendChild(statusSpan);
            statusSpanMap.set(choice.key, statusSpan);

            choiceButton.addEventListener('click', () => {
                toggleSelection(question.id, choice.key);
            });

            choicesContainer.appendChild(choiceButton);
            buttonMap.set(choice.key, choiceButton);
        });

        card.appendChild(choicesContainer);

        const feedback = document.createElement('div');
        feedback.className = 'feedback';
        feedback.style.display = 'none';

        const feedbackHeader = document.createElement('div');
        feedbackHeader.className = 'feedback-header';
        feedback.appendChild(feedbackHeader);

        const feedbackBody = document.createElement('div');
        feedbackBody.className = 'feedback-body';
        feedback.appendChild(feedbackBody);

        card.appendChild(feedback);
        assessmentGrid.appendChild(card);

        card.dataset.selectionSenseiContext = buildQuestionSelectionSenseiContext(
            question,
            index,
            data.moduleTitle,
            data.moduleGoal
        );

        questionElements.set(question.id, {
            card,
            buttons: buttonMap,
            statusSpans: statusSpanMap,
            feedback,
            feedbackHeader,
            feedbackBody
        });
    });

    const overlayFooter = document.createElement('div');
    overlayFooter.className = 'overlay-footer';
    overlayShell.appendChild(overlayFooter);

    const footerCopy = document.createElement('p');
    footerCopy.className = 'footer-copy';
    footerCopy.textContent = PRE_FOOTER_COPY;
    overlayFooter.appendChild(footerCopy);

    const primaryButton = document.createElement('button');
    primaryButton.type = 'button';
    primaryButton.className = 'cta-button';
    primaryButton.textContent = CTA_DISABLED_TEXT;
    primaryButton.disabled = true;
    overlayFooter.appendChild(primaryButton);

    let answersShown = false;

    const toggleSelection = (questionId: string, choiceKey: string): void => {
        if (answersShown) {
            return;
        }
        if (!selections.has(questionId)) {
            return;
        }
        const current = selections.get(questionId) ?? null;
        const next = current === choiceKey ? null : choiceKey;
        selections.set(questionId, next);
        const elements = questionElements.get(questionId);
        if (!elements) {
            return;
        }
        elements.buttons.forEach((button, key) => {
            if (key === next) {
                button.classList.add('is-selected');
                button.setAttribute('aria-pressed', 'true');
            } else {
                button.classList.remove('is-selected');
                button.setAttribute('aria-pressed', 'false');
            }
        });
        updateCtaState();
    };

    const updateCtaState = (): void => {
        const incomplete = Array.from(selections.values()).some(selection => !selection);
        if (incomplete) {
            primaryButton.disabled = true;
            primaryButton.textContent = CTA_DISABLED_TEXT;
        } else {
            primaryButton.disabled = false;
            primaryButton.textContent = CTA_READY_TEXT;
        }
    };

    const revealAnswers = (): void => {
        renderQuestions.forEach(question => {
            const selection = selections.get(question.id);
            const elements = questionElements.get(question.id);
            if (!elements) {
                return;
            }
            elements.buttons.forEach((button, key) => {
                button.disabled = true;
                button.classList.add('revealed');
                button.classList.remove('is-selected-correct');
                button.removeAttribute('data-correct');
                const statusSpan = elements.statusSpans.get(key);
                if (statusSpan) {
                    statusSpan.style.display = 'none';
                    statusSpan.classList.remove('correct');
                    statusSpan.classList.remove('incorrect');
                }
                if (key === question.correctChoiceKey) {
                    button.dataset.correct = 'true';
                    button.classList.add('is-selected-correct');
                    if (statusSpan) {
                        statusSpan.style.display = 'block';
                        statusSpan.classList.add('correct');
                        statusSpan.textContent = selection === key ? 'Your Answer • Correct' : 'Correct Answer';
                    }
                } else if (selection === key && statusSpan) {
                    statusSpan.style.display = 'block';
                    statusSpan.classList.add('incorrect');
                    statusSpan.textContent = 'Your Answer';
                }
            });

            const isCorrect = selection === question.correctChoiceKey;
            elements.feedback.style.display = 'grid';
            elements.feedback.classList.toggle('correct', isCorrect);
            elements.feedback.classList.toggle('incorrect', !isCorrect);
            elements.feedbackHeader.classList.toggle('correct', isCorrect);
            elements.feedbackHeader.classList.toggle('incorrect', !isCorrect);
            elements.feedbackHeader.textContent = isCorrect ? 'Correct • Great instincts' : "Incorrect • Let's tighten the approach";

            elements.feedbackBody.innerHTML = '';
            const explanation = document.createElement('div');
            const explanationLabel = document.createElement('strong');
            explanationLabel.textContent = 'Explanation:';
            explanation.appendChild(explanationLabel);
            explanation.append(' ');
            explanation.append(document.createTextNode(question.explanation));
            elements.feedbackBody.appendChild(explanation);

            const insight = document.createElement('div');
            insight.className = 'insight';
            const insightLabel = document.createElement('strong');
            insightLabel.textContent = 'Interviewer Insight:';
            insight.appendChild(insightLabel);
            insight.append(' ');
            insight.append(document.createTextNode(question.interviewerInsight));
            elements.feedbackBody.appendChild(insight);
        });

        footerCopy.textContent = POST_FOOTER_COPY;
        primaryButton.textContent = CTA_POST_TEXT;
        primaryButton.disabled = false;
        applyCodeBlockEnhancements(overlayShell);
    };

    primaryButton.addEventListener('click', () => {
        if (!answersShown) {
            answersShown = true;
            revealAnswers();
            return;
        }
        wrapper.remove();
        unlockWrapUpChatControls();
    });

    updateCtaState();

    messageArea.appendChild(wrapper);
    requestAnimationFrame(() => {
        const header = wrapper.querySelector<HTMLElement>('.overlay-header');
        if (header) {
            const messageAreaRect = messageArea.getBoundingClientRect();
            const headerRect = header.getBoundingClientRect();
            const offset = headerRect.top - messageAreaRect.top;
            messageArea.scrollTop += offset;
        }
    });
    applyCodeBlockEnhancements(overlayShell);
    wrapper.focus();

    const reinitializeSelectionSensei = (window as any).reinitializeSelectionSensei;
    const aiInstance = (window as any).ai;
    if (typeof reinitializeSelectionSensei === 'function' && aiInstance) {
        try {
            reinitializeSelectionSensei(aiInstance);
        } catch (error) {
            console.warn('Selection Sensei reinitialization failed for wrap-up overlay.', error);
        }
    }
}

function disableChatControls(): void {
    const input = document.getElementById('user-input') as HTMLTextAreaElement | null;
    if (input) {
        input.disabled = true;
        input.setAttribute('data-wrap-up-locked', 'true');
        input.placeholder = 'Wrap Up assessment in progress...';
    }
    const sendButton = document.getElementById('send-button') as HTMLButtonElement | null;
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.setAttribute('data-wrap-up-locked', 'true');
    }
    const codeEditorButton = document.getElementById('code-editor-button') as HTMLButtonElement | null;
    if (codeEditorButton) {
        codeEditorButton.disabled = true;
        codeEditorButton.setAttribute('data-wrap-up-locked', 'true');
    }
}

export function unlockWrapUpChatControls(): void {
    const input = document.getElementById('user-input') as HTMLTextAreaElement | null;
    if (input && input.getAttribute('data-wrap-up-locked') === 'true') {
        input.disabled = false;
        input.removeAttribute('data-wrap-up-locked');
        input.placeholder = '';
    }
    const sendButton = document.getElementById('send-button') as HTMLButtonElement | null;
    if (sendButton && sendButton.getAttribute('data-wrap-up-locked') === 'true') {
        sendButton.disabled = false;
        sendButton.removeAttribute('data-wrap-up-locked');
    }
    const codeEditorButton = document.getElementById('code-editor-button') as HTMLButtonElement | null;
    if (codeEditorButton && codeEditorButton.getAttribute('data-wrap-up-locked') === 'true') {
        codeEditorButton.disabled = false;
        codeEditorButton.removeAttribute('data-wrap-up-locked');
    }
}

function applyCodeBlockEnhancements(root: HTMLElement): void {
    const codeBlocks = root.querySelectorAll<HTMLElement>('pre code');
    codeBlocks.forEach(block => {
        try {
            if (typeof hljs !== 'undefined' && hljs?.highlightElement) {
                hljs.highlightElement(block);
            }
        } catch (error) {
            console.warn('Highlight error in wrap-up overlay', error);
        }
    });
    addLanguageDisplayToCodeBlocks(root);
    addCopyButtonsToCodeBlocks(root, { sender: 'sensei', messageId: OVERLAY_ID });
}

function setMarkdown(target: HTMLElement, markdown: string): void {
    const sanitized = sanitizeCodeFences(markdown ?? '');
    target.innerHTML = marked.parse(sanitized) as string;
}
