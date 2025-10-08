import { GoogleGenAI } from '@google/genai';
import { generateWrapUpAssessment } from '../src/geminiService';
import { validateWrapUpAssessmentQuestions } from '../src/wrapUpAssessment';

// Mock UI helpers to avoid pulling in CodeMirror during tests
jest.mock('../src/ui', () => ({}), { virtual: true });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __setMockGenerativeContent, __resetMockGenerativeContent } = require('@google/genai');

describe('Wrap Up assessment generation', () => {
    afterEach(() => {
        __resetMockGenerativeContent();
    });

    it('generates and validates a 15-question assessment with five snippets', async () => {
        const snippetQuestions = Array.from({ length: 5 }, (_, index) => ({
            id: `snippet-${index + 1}`,
            type: 'snippet',
            prompt: `Snippet prompt ${index + 1}`,
            code: 'int main() { return 0; }',
            choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
            correct_choice: 'Choice A',
            explanation: 'Because the snippet illustrates the intended pattern.',
            interviewer_insight: 'Testing recursion fundamentals.'
        }));
        const conceptQuestions = Array.from({ length: 10 }, (_, index) => ({
            id: `concept-${index + 1}`,
            type: 'concept',
            prompt: `Concept prompt ${index + 1}`,
            choices: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_choice: 'Option B',
            explanation: 'This option reinforces the main takeaway.',
            interviewer_insight: 'Explores nuanced understanding.'
        }));

        const toolCode = `print(submit_wrap_up_assessment(questions=${JSON.stringify([...snippetQuestions, ...conceptQuestions])}))`;
        __setMockGenerativeContent({
            result: JSON.stringify({ tool_code: toolCode }),
            functionCall: null
        });

        const ai = new GoogleGenAI({});
        const result = await generateWrapUpAssessment(ai, 'Module1', {
            moduleTitle: 'Sample Module',
            moduleGoal: 'Master wrap up content.',
            solidifyContent: 'Solidify notes and review material.',
            conceptSummaries: ['Concept 1: Details', 'Concept 2: Details']
        });

        expect(result).not.toBeNull();
        const questions = result!.questions;
        expect(questions).toHaveLength(15);
        const snippetCount = questions.filter(question => question.type === 'snippet').length;
        const concepts = questions.filter(question => question.type === 'concept');
        const snippets = questions.filter(question => question.type === 'snippet');
        expect(snippetCount).toBe(5);
        expect(questions.slice(0, concepts.length).every(question => question.type === 'concept')).toBe(true);
        expect(questions.slice(concepts.length).every(question => question.type === 'snippet')).toBe(true);

        const validated = validateWrapUpAssessmentQuestions(questions);
        expect(validated).toHaveLength(15);
    });

    it('handles function call payloads from Gemini', async () => {
        const snippetQuestions = Array.from({ length: 5 }, (_, index) => ({
            id: `snippet-fc-${index + 1}`,
            type: 'snippet',
            prompt: `Snippet FC prompt ${index + 1}`,
            code: 'int main() { return 1; }',
            choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
            correct_choice: 'Choice B',
            explanation: 'Explanation text.',
            interviewer_insight: 'Insight text.'
        }));
        const conceptQuestions = Array.from({ length: 10 }, (_, index) => ({
            id: `concept-fc-${index + 1}`,
            type: 'concept',
            prompt: `Concept FC prompt ${index + 1}`,
            choices: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_choice: 'Option C',
            explanation: 'Explanation text.',
            interviewer_insight: 'Insight text.'
        }));

        __setMockGenerativeContent({
            result: '',
            functionCall: {
                name: 'submit_wrap_up_assessment',
                args: {
                    questions: [...snippetQuestions, ...conceptQuestions]
                }
            }
        });

        const ai = new GoogleGenAI({});
        const result = await generateWrapUpAssessment(ai, 'ModuleFC', {
            moduleTitle: 'Function Call Module',
            moduleGoal: 'Confirm tool integration.',
            solidifyContent: 'Solidify content.',
            conceptSummaries: ['Concept Tool 1', 'Concept Tool 2']
        });

        expect(result).not.toBeNull();
        const questions = result!.questions;
        expect(questions).toHaveLength(15);
        const snippetCount = questions.filter(question => question.type === 'snippet').length;
        const concepts = questions.filter(question => question.type === 'concept');
        const snippets = questions.filter(question => question.type === 'snippet');
        expect(snippetCount).toBe(5);
        expect(questions.slice(0, concepts.length).every(question => question.type === 'concept')).toBe(true);
        expect(questions.slice(concepts.length).every(question => question.type === 'snippet')).toBe(true);
    });

    it('throws when snippet count is incorrect', () => {
        const invalidQuestions = Array.from({ length: 15 }, (_, index) => ({
            id: `q-${index + 1}`,
            type: 'concept',
            prompt: `Concept prompt ${index + 1}`,
            choices: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_choice: 'Option A',
            explanation: 'Explanation text.',
            interviewer_insight: 'Insight text.'
        }));

        expect(() => validateWrapUpAssessmentQuestions(invalidQuestions as any)).toThrow(/exactly 5 snippet questions/);
    });

    it('returns null when Gemini omits the tool payload', async () => {
        __setMockGenerativeContent({ result: 'plain-text-response', functionCall: null });
        const ai = new GoogleGenAI({});
        const result = await generateWrapUpAssessment(ai, 'Module1', {
            moduleTitle: 'Sample Module',
            moduleGoal: 'Goal',
            solidifyContent: 'Solidify',
            conceptSummaries: ['Concept A']
        });
        expect(result).toBeNull();
    });
});
