import { GoogleGenAI } from '@google/genai';
import { generateWrapUpAssessment } from '../geminiService';
import { validateWrapUpAssessmentQuestions } from '../wrapUpAssessment';

// Mock UI helpers to avoid pulling in CodeMirror during tests
jest.mock('../ui');

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

        __setMockGenerativeContent({
            result: JSON.stringify({
                questions: [...snippetQuestions, ...conceptQuestions]
            })
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
        expect(snippetCount).toBe(5);

        const validated = validateWrapUpAssessmentQuestions(questions);
        expect(validated).toHaveLength(15);
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

    it('returns null when Gemini payload is invalid JSON', async () => {
        __setMockGenerativeContent({ result: 'not-json' });
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
