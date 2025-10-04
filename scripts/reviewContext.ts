import { assignFiles, cleanupFiles, resetAssignments, showAssignments } from './reviewContextLib';

type ParsedArgs = {
  feature?: string;
  files: string[];
  append?: boolean;
  root?: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token || !token.startsWith('--')) {
      continue;
    }
    const [flag, inline] = token.split('=');
    switch (flag) {
      case '--feature': {
        if (inline !== undefined) {
          result.feature = inline;
        } else {
          const next = argv[index + 1];
          if (!next || next.startsWith('--')) {
            throw new Error('Missing value for --feature.');
          }
          result.feature = next;
          index += 1;
        }
        break;
      }
      case '--files': {
        if (inline !== undefined) {
          result.files.push(inline);
        } else {
          while (index + 1 < argv.length) {
            const peek = argv[index + 1];
            if (!peek || peek.startsWith('--')) {
              break;
            }
            index += 1;
            result.files.push(peek);
          }
        }
        break;
      }
      case '--append': {
        result.append = true;
        break;
      }
      case '--root': {
        if (inline !== undefined) {
          result.root = inline;
        } else {
          const next = argv[index + 1];
          if (!next || next.startsWith('--')) {
            throw new Error('Missing value for --root.');
          }
          result.root = next;
          index += 1;
        }
        break;
      }
      default: {
        throw new Error(`Unknown option ${flag}.`);
      }
    }
  }
  return result;
}

function run(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: review:context <assign|append|show|reset|cleanup> [options]');
    process.exit(1);
  }
  const command = argv[0];
  const options = parseArgs(argv.slice(1));
  try {
    switch (command) {
      case 'assign': {
        const slug = options.feature;
        if (!slug) {
          throw new Error('assign requires --feature <slug>.');
        }
        const files = options.files;
        const assignOptions: { slug: string; files: string[]; append?: boolean; root?: string } = { slug, files };
        if (options.append) {
          assignOptions.append = true;
        }
        if (options.root) {
          assignOptions.root = options.root;
        }
        assignFiles(assignOptions);
        break;
      }
      case 'append': {
        const slug = options.feature;
        if (!slug) {
          throw new Error('append requires --feature <slug>.');
        }
        const files = options.files;
        const assignOptions: { slug: string; files: string[]; append?: boolean; root?: string } = { slug, files, append: true };
        if (options.root) {
          assignOptions.root = options.root;
        }
        assignFiles(assignOptions);
        break;
      }
      case 'show': {
        const showOptions: { slug?: string; root?: string } = {};
        if (options.feature) {
          showOptions.slug = options.feature;
        }
        if (options.root) {
          showOptions.root = options.root;
        }
        showAssignments(showOptions);
        break;
      }
      case 'reset': {
        const slug = options.feature;
        if (!slug) {
          throw new Error('reset requires --feature <slug>.');
        }
        const resetOptions: { slug: string; files?: string[]; root?: string } = { slug };
        if (options.files.length > 0) {
          resetOptions.files = options.files;
        }
        if (options.root) {
          resetOptions.root = options.root;
        }
        resetAssignments(resetOptions);
        break;
      }
      case 'cleanup': {
        if (options.files.length === 0) {
          throw new Error('cleanup requires --files <path1> <path2> ...');
        }
        const cleanupOptions: { files: string[]; root?: string } = { files: options.files };
        if (options.root) {
          cleanupOptions.root = options.root;
        }
        cleanupFiles(cleanupOptions);
        break;
      }
      default: {
        throw new Error(`Unknown command ${command}.`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

run();
