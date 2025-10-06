import { sanitizeCodeFences, addLanguageDisplayToCodeBlocks, addCopyButtonsToCodeBlocks } from './ui';
import { marked } from 'marked';

declare const hljs: any;

type WrapUpChoice = {
    key: string;
    text: string;
};

type WrapUpQuestion = {
    id: string;
    label: string;
    type: 'snippet' | 'concept';
    prompt: string;
    code?: string;
    choices: WrapUpChoice[];
    correctChoice: string;
    explanation: string;
    insight: string;
};

type QuestionElements = {
    card: HTMLElement;
    buttons: Map<string, HTMLButtonElement>;
    statusSpans: Map<string, HTMLElement>;
    feedback: HTMLElement;
    feedbackHeader: HTMLElement;
    feedbackBody: HTMLElement;
};

const OVERLAY_ID = 'wrap-up-assessment-overlay';
const CTA_DISABLED_TEXT = 'Select Answers to Reveal';
const CTA_READY_TEXT = 'Reveal Explanations';
const CTA_POST_TEXT = 'Proceed to Remediation';
const PRE_FOOTER_COPY = 'Review every prompt thoroughly, selecting the strongest answer for each. When you are ready, reveal the official explanations to verify your reasoning.';
const POST_FOOTER_COPY = 'Use the explanations and interviewer notes to inform your remediation focus.';

const QUESTIONS: WrapUpQuestion[] = [
    {
        id: 'Q9',
        label: 'Tree Algorithms',
        type: 'snippet',
        prompt: 'C++ Code Snippet: The "Dual Information Challenge" in Practice\n\nThis C++ function attempts to find the diameter of a binary tree. Assume it is used in a single-threaded environment. What is the most accurate assessment of this code?',
        code: `int overall_diameter = 0;

int find_height_and_update_diameter(TreeNode* node) {
    if (!node) return 0;
    int leftHeight = find_height_and_update_diameter(node->left);
    int rightHeight = find_height_and_update_diameter(node->right);
    
    overall_diameter = std::max(overall_diameter, leftHeight + rightHeight);
    
    return 1 + std::max(leftHeight, rightHeight);
}`,
        choices: [
            {
                key: 'A',
                text: 'The overall_diameter calculation is incorrect; it should be leftHeight + rightHeight + 1.',
            },
            {
                key: 'B',
                text: 'The use of a global or member variable for overall_diameter is a fundamentally flawed recursive pattern.',
            },
            {
                key: 'C',
                text: 'The function incorrectly calculates the height; the return value is wrong.',
            },
            {
                key: 'D',
                text: 'The function correctly solves the "Dual Information Challenge" by returning the necessary local information (height) while updating a shared, non-local state with global information (max diameter candidate).',
            },
        ],
        correctChoice: 'D',
        explanation: 'Diameter needs both the local height for parent callers and a global best seen so far. The function returns height and simultaneously updates a shared diameter accumulator—this is the canonical solution and does not require adding 1 to the chord length.',
        insight: 'Interviewers use this pattern to see if you can juggle “dual information.” The trick is keeping the recursion signature narrow while threading a global accumulator. Candidates who insist the answer must be returned upward reveal a rigidity that breaks under real-world tree metrics.',
    },
    {
        id: 'Q10',
        label: 'BST Traversal',
        type: 'concept',
        prompt: 'Propagating Information Upward: Sentinel Values\n\nA recursive function int findKthSmallest(Node* node, int& k) is designed to find the Kth smallest element in a BST. It uses in-order traversal logic. What would be a good sentinel value for this function to return to indicate that the Kth element was found in a deeper recursive call and all parent calls should stop their search and propagate this signal?',
        choices: [
            {
                key: 'A',
                text: 'nullptr, as the node pointer is what we are looking for.',
            },
            {
                key: 'B',
                text: 'INT_MAX (or INT_MIN), a value outside the expected range of node values.',
            },
            {
                key: 'C',
                text: 'The value of the found node itself. This is sufficient to stop the search.',
            },
            {
                key: 'D',
                text: 'Throwing an exception is the only safe way to achieve early termination.',
            },
        ],
        correctChoice: 'C',
        explanation: 'Once the k-th node is discovered, bubbling its value upward lets every ancestor skip further traversal. Using a magic constant risks clashing with valid data, and exceptions are unnecessary overhead when a plain value carries the signal.',
        insight: 'We hide this in BST drills to expose who understands “propagate real data upward.” Interviewers set the trap by nudging candidates toward sentinel constants; the real screen is whether you notice that the desired value itself is the clean termination signal.',
    },
];

export function isWrapUpAssessmentActive(): boolean {
    return !!document.getElementById(OVERLAY_ID);
}

export function showWrapUpAssessmentOverlay(): void {
    const messageArea = document.getElementById('message-area');
    if (!messageArea) {
        return;
    }
    if (isWrapUpAssessmentActive()) {
        return;
    }
    const wrapper = document.createElement('div');
    wrapper.id = OVERLAY_ID;
    wrapper.className = 'wrap-up-assessment-container';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Wrap Up Assessment');

    const overlayShell = document.createElement('div');
    overlayShell.className = 'overlay-shell';
    wrapper.appendChild(overlayShell);

    const overlayBody = document.createElement('div');
    overlayBody.className = 'overlay-body';
    overlayShell.appendChild(overlayBody);

    const assessmentGrid = document.createElement('div');
    assessmentGrid.className = 'assessment-grid';
    overlayBody.appendChild(assessmentGrid);

    const selections = new Map<string, string | null>();
    const questionElements = new Map<string, QuestionElements>();

    QUESTIONS.forEach((question, index) => {
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
        stem.className = 'question-stem';
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

            const choiceText = document.createElement('p');
            choiceText.className = 'choice-text';
            choiceText.textContent = choice.text;
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

        questionElements.set(question.id, {
            card,
            buttons: buttonMap,
            statusSpans: statusSpanMap,
            feedback,
            feedbackHeader,
            feedbackBody,
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

    messageArea.appendChild(wrapper);
    disableChatControls();

    let answersShown = false;

    function toggleSelection(questionId: string, choiceKey: string): void {
        if (answersShown) {
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
    }

    function updateCtaState(): void {
        const incomplete = QUESTIONS.some(question => {
            const value = selections.get(question.id);
            return !value;
        });
        if (incomplete) {
            primaryButton.disabled = true;
            primaryButton.textContent = CTA_DISABLED_TEXT;
        } else {
            primaryButton.disabled = false;
            primaryButton.textContent = CTA_READY_TEXT;
        }
    }

    function revealAnswers(): void {
        QUESTIONS.forEach(question => {
            const selection = selections.get(question.id);
            const elements = questionElements.get(question.id);
            if (!elements) {
                return;
            }
            elements.buttons.forEach((button, key) => {
                button.disabled = true;
                button.classList.add('revealed');
                const statusSpan = elements.statusSpans.get(key);
                if (!statusSpan) {
                    return;
                }
                statusSpan.style.display = 'none';
                statusSpan.classList.remove('correct');
                statusSpan.classList.remove('incorrect');
                if (selection === key) {
                    statusSpan.style.display = 'block';
                    if (key === question.correctChoice) {
                        statusSpan.classList.add('correct');
                        statusSpan.textContent = 'Your Answer • Correct';
                    } else {
                        statusSpan.classList.add('incorrect');
                        statusSpan.textContent = 'Your Answer';
                    }
                }
                if (key === question.correctChoice) {
                    button.dataset.correct = 'true';
                }
            });
            if (selection !== question.correctChoice && elements.buttons.has(question.correctChoice)) {
                const correctButton = elements.buttons.get(question.correctChoice);
                if (correctButton) {
                    correctButton.classList.add('is-selected-correct');
                }
            }
            const isCorrect = selection === question.correctChoice;
            elements.feedback.style.display = 'grid';
            elements.feedback.classList.remove('correct');
            elements.feedback.classList.remove('incorrect');
            elements.feedbackHeader.classList.remove('correct');
            elements.feedbackHeader.classList.remove('incorrect');
            if (isCorrect) {
                elements.feedback.classList.add('correct');
                elements.feedbackHeader.classList.add('correct');
                elements.feedbackHeader.textContent = 'Correct • Great instincts';
            } else {
                elements.feedback.classList.add('incorrect');
                elements.feedbackHeader.classList.add('incorrect');
                elements.feedbackHeader.textContent = "Incorrect • Let's tighten the approach";
            }
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
            insight.append(document.createTextNode(question.insight));
            elements.feedbackBody.appendChild(insight);
        });
        footerCopy.textContent = POST_FOOTER_COPY;
        primaryButton.textContent = CTA_POST_TEXT;
        primaryButton.disabled = false;
        applyCodeBlockEnhancements(overlayShell);
    }

    primaryButton.addEventListener('click', () => {
        if (answersShown) {
            return;
        }
        answersShown = true;
        revealAnswers();
    });

    updateCtaState();
    applyCodeBlockEnhancements(overlayShell);
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
