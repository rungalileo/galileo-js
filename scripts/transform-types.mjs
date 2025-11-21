import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine project root - works both when script is executed directly or inline via -e
// Try to get script location, fallback to process.cwd() (which should be project root in CI)
let projectRoot;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // If script is in local-plugins, go up one level to project root
  if (__dirname.endsWith('scripts')) {
    projectRoot = path.resolve(__dirname, '..');
  } else {
    // Fallback: assume we're at project root
    projectRoot = process.cwd();
  }
} catch (error) {
  // Fallback to current working directory (should be project root)
  projectRoot = process.cwd();
}

// Resolve paths relative to the project root
const inputFile = path.join(projectRoot, 'src/types/types.gen.ts');
const outputFilePythonStandard = path.join(
  projectRoot,
  'src/types/openapi.types.ts'
);
const outputFileTypescriptStandard = path.join(
  projectRoot,
  'src/types/new-api.types.ts'
);

function exitWithError(message, code = 1) {
  console.error(`❌ Error: ${message}`);
  process.exit(code);
}

function removeStringIntersections(content) {
  content = content.replace(/\|\s*\(string\s*&\s*\{\}\)/g, '| string');
  content = content.replace(/\(string\s*&\s*\{\}\)\s*\|/g, 'string |');
  content = content.replace(/:\s*\(string\s*&\s*\{\}\)/g, ': string');
  content = content.replace(/string\s*&\s*\{\}/g, 'string');
  return content;
}

function removeConsecutiveDuplicates(content) {
  const lines = content.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];

    // Only add the line if it's not identical to the next line
    // Last line is always added (nextLine will be undefined)
    if (currentLine !== nextLine) {
      result.push(currentLine);
    }
  }

  return result.join('\n');
}

try {
  // Validate input file exists
  if (!fs.existsSync(inputFile)) {
    exitWithError(`Input file not found: ${inputFile}`);
  }

  // Read input file
  let content;
  try {
    content = fs.readFileSync(inputFile, 'utf-8');
  } catch (error) {
    exitWithError(`Failed to read input file ${inputFile}: ${error.message}`);
  }

  // Validate content is not empty
  if (!content || content.trim().length === 0) {
    exitWithError(`Input file is empty: ${inputFile}`);
  }

  // Remove (string & {}) patterns
  content = removeStringIntersections(content);

  // Remove consecutive duplicate lines
  content = removeConsecutiveDuplicates(content);

  // Creating Python friendly types
  try {
    fs.writeFileSync(outputFilePythonStandard, content, 'utf-8');
  } catch (error) {
    exitWithError(
      `Failed to write ${outputFilePythonStandard}: ${error.message}`
    );
  }

  // Updating snake_case to camelCase
  const transformed = content.replace(
    /^(\s+)([a-z][a-z0-9_]*)(\??):\s*(?!['"])/gm,
    (_, indent, name, opt) =>
      name.includes('_')
        ? `${indent}${name.replace(/_([a-z0-9])/g, (_, l) => l.toUpperCase())}${opt}: `
        : _
  );

  // Creating Typescript friendly types
  try {
    fs.writeFileSync(outputFileTypescriptStandard, transformed, 'utf-8');
  } catch (error) {
    exitWithError(
      `Failed to write ${outputFileTypescriptStandard}: ${error.message}`
    );
  }

  // Removing generated types file
  try {
    fs.rmSync(inputFile, { recursive: true, force: true });
  } catch (error) {
    // Log warning but don't fail - the file might have been deleted already
    console.warn(
      `⚠️  Warning: Could not remove ${inputFile}: ${error.message}`
    );
  }

  console.log('✅ Types transformed successfully');
} catch (error) {
  exitWithError(`Unexpected error: ${error.message}`);
}
