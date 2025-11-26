/**
 * @file validationErrorContext.js
 * @description Provides rich error context for validation failures, including
 * file path, line number extraction from JSON path, and code snippet generation.
 */

/**
 * Extracts line number from JSON path in original content.
 * Uses a heuristic approach to find the approximate line where the error occurred.
 *
 * @param {string} jsonContent - Original JSON file content
 * @param {string} jsonPath - AJV instance path (e.g., "/actions/2/parameters/count")
 * @returns {number} Line number (1-indexed), defaults to 1 if not found
 */
export function extractLineNumber(jsonContent, jsonPath) {
  if (!jsonPath || jsonPath === '') {
    return 1; // Root level
  }

  const pathParts = jsonPath.split('/').filter(Boolean);
  if (pathParts.length === 0) {
    return 1;
  }

  const lines = jsonContent.split('\n');
  const lastPart = pathParts[pathParts.length - 1];
  let lastMatchLine = 1;

  // If it's an array index, we need to track array elements
  if (/^\d+$/.test(lastPart)) {
    const targetIndex = parseInt(lastPart, 10);
    const parentPart = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

    let elementCount = -1;
    let inArray = false;
    let bracketDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if we're entering the target array
      if (parentPart && line.includes(`"${parentPart}"`)) {
        inArray = true;
        bracketDepth = 0;
      }

      if (inArray) {
        // Track bracket depth to count array elements
        for (const char of line) {
          if (char === '[') {
            bracketDepth++;
          } else if (char === ']') {
            bracketDepth--;
            if (bracketDepth === 0) {
              inArray = false;
            }
          } else if (char === '{' && bracketDepth === 1) {
            elementCount++;
            if (elementCount === targetIndex) {
              lastMatchLine = i + 1;
            }
          }
        }
      }
    }
  } else {
    // Look for property name
    const propPattern = new RegExp(`"${lastPart}"\\s*:`);
    for (let i = 0; i < lines.length; i++) {
      if (propPattern.test(lines[i])) {
        lastMatchLine = i + 1;
      }
    }
  }

  return lastMatchLine;
}

/**
 * Generates a code snippet around the error location.
 *
 * @param {string} jsonContent - Original JSON file content
 * @param {number} lineNumber - Line number of error (1-indexed)
 * @param {number} [contextLines] - Number of lines before/after to include
 * @returns {string} Formatted code snippet with line numbers
 */
export function generateCodeSnippet(jsonContent, lineNumber, contextLines = 2) {
  const lines = jsonContent.split('\n');
  const startLine = Math.max(1, lineNumber - contextLines);
  const endLine = Math.min(lines.length, lineNumber + contextLines);

  const snippetLines = [];
  const maxLineNumWidth = String(endLine).length;

  for (let i = startLine; i <= endLine; i++) {
    const lineNum = String(i).padStart(maxLineNumWidth, ' ');
    const prefix = i === lineNumber ? '>' : ' ';
    const content = lines[i - 1]; // 0-indexed array

    snippetLines.push(`${prefix} ${lineNum} | ${content}`);
  }

  return snippetLines.join('\n');
}

/**
 * Creates a rich validation error context object.
 *
 * @param {object} options - Context options
 * @param {string} options.filePath - Path to the file being validated
 * @param {string} options.fileContent - Content of the file
 * @param {string} options.instancePath - AJV error instancePath
 * @param {string} options.message - Error message
 * @param {string} [options.ruleId] - Optional rule/action ID
 * @returns {object} Rich error context with toString() method
 */
export function createValidationErrorContext({
  filePath,
  fileContent,
  instancePath,
  message,
  ruleId = null,
}) {
  const lineNumber = extractLineNumber(fileContent, instancePath);
  const codeSnippet = generateCodeSnippet(fileContent, lineNumber);

  return {
    filePath,
    lineNumber,
    instancePath,
    message,
    ruleId,
    codeSnippet,

    /**
     * Formats the error context as a human-readable string.
     *
     * @returns {string} Formatted error message
     */
    toString() {
      const header = ruleId
        ? `Validation Error in rule "${ruleId}"`
        : 'Validation Error';

      return [
        header,
        `  File: ${filePath}`,
        `  Line: ${lineNumber}`,
        '',
        '  Context:',
        codeSnippet
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n'),
        '',
        `  Error: ${message}`,
        `  Path: ${instancePath}`,
      ].join('\n');
    },
  };
}

/**
 * Formats multiple AJV errors with rich context.
 *
 * @param {object[]} errors - AJV validation errors
 * @param {string} filePath - Path to validated file
 * @param {string} fileContent - Content of validated file
 * @param {string} [ruleId] - Optional rule ID
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(
  errors,
  filePath,
  fileContent,
  ruleId = null
) {
  const contexts = errors.map((error) =>
    createValidationErrorContext({
      filePath,
      fileContent,
      instancePath: error.instancePath || '',
      message: error.message || 'Unknown validation error',
      ruleId,
    })
  );

  return contexts.map((ctx) => ctx.toString()).join('\n\n---\n\n');
}

export default {
  extractLineNumber,
  generateCodeSnippet,
  createValidationErrorContext,
  formatValidationErrors,
};
