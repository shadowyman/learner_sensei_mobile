// Use require to avoid ESM/CJS interop issues in Jest.
import { execSync } from 'child_process';

describe('Math rendering via KaTeX', () => {
    it('renders inline math with KaTeX markup, even inside parentheses', () => {
        const html = execSync(
            "node -e 'const { marked } = require(\"marked\"); const markedKatex = require(\"marked-katex-extension\"); marked.use(markedKatex({ throwOnError: false, output: \"mathml\", nonStandard: true })); process.stdout.write(marked.parse(\"Big O notation ($O$) example.\"));'",
            { encoding: 'utf8' }
        );
        expect(html).toContain('class="katex"');
        expect(html).toContain('Big O notation (');
    });

    it('renders display math with KaTeX markup', () => {
        const html = execSync(
            "node -e 'const { marked } = require(\"marked\"); const markedKatex = require(\"marked-katex-extension\"); marked.use(markedKatex({ throwOnError: false, output: \"mathml\", nonStandard: true })); process.stdout.write(marked.parse(\"$$\\\\sum_{i=1}^n i$$\"));'",
            { encoding: 'utf8' }
        );
        expect(html).toContain('display="block"');
    });
});
