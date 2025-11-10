const fs = require('fs');

function sanitizeCodeFences(text) {
  return text.replace(/^\s+(```)/gm, '$1');
}

function sanitizeClosingBackticksOnly(text) {
  const lines = text.split(/\r?\n/);
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inFence) {
      const m = line.match(/^[ \t]*([`~]{3,})([^\r\n]*)$/);
      if (m) {
        inFence = true;
        fenceChar = m[1][0];
        fenceLen = m[1].length;
      }
      continue;
    }
    const close = line.match(/^[ \t]*([`~]{3,})[ \t]*$/);
    if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
      lines[i] = line.replace(/^[ \t]+(?=[`~]{3,}[ \t]*$)/, '');
      inFence = false;
      fenceChar = '';
      fenceLen = 0;
    }
  }
  return lines.join('\n');
}

function readInput() {
  if (process.stdin.isTTY === false) {
    return fs.readFileSync(0, 'utf8');
  }
  const file = process.argv[2];
  if (file) return fs.readFileSync(file, 'utf8');
  return '```cpp\n' +
    '    // Step 2: GATHER all necessary information first.\n' +
    '    int left_subtree_depth = maxDepth(root->left);\n' +
    '    int right_subtree_depth =\n' +
    '  maxDepth(root->right);\n' +
    '    ```\n';
}

const input = readInput();
const step1 = sanitizeClosingBackticksOnly(input);
const output = sanitizeCodeFences(step1);
process.stdout.write(output);
