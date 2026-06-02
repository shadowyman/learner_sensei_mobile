const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const entry = process.argv[2];

if (!entry) {
  console.error('Usage: node scripts/runTs.cjs <entry.ts> [...args]');
  process.exit(1);
}

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  resolveJsonModule: true,
  jsx: ts.JsxEmit.ReactJSX,
  skipLibCheck: true,
  sourceMap: false,
  declaration: false,
  declarationMap: false
};

function register(ext) {
  require.extensions[ext] = function loadTypeScript(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions,
      fileName: filename,
      reportDiagnostics: true
    });
    const diagnostics = (result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error);
    if (diagnostics.length > 0) {
      const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: name => name,
        getCurrentDirectory: process.cwd,
        getNewLine: () => '\n'
      });
      throw new Error(formatted);
    }
    module._compile(result.outputText, filename);
  };
}

for (const ext of ['.ts', '.tsx', '.mts', '.cts']) {
  register(ext);
}

const entryAbs = path.resolve(process.cwd(), entry);
process.argv = [process.execPath, entryAbs, ...process.argv.slice(3)];
require(entryAbs);
