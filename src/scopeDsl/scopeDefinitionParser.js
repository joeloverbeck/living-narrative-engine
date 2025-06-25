/**
 * @file Scope Definition Parser
 * @description Provides a common utility to parse the content of .scope files.
 */

import { parseDslExpression } from './parser.js';
import { ScopeDefinitionError } from './errors/scopeDefinitionError.js';

/**
 * Parses the text content of a .scope file into a map of scope names to their
 * DSL expressions. It validates both the `name := expression` format and the
 * syntax of the DSL expression itself.
 *
 * @param {string} content - The raw string content from a .scope file.
 * @param {string} filePath - The original path to the file, used for error reporting.
 * @returns {Map<string, string>} A map where keys are scope names and values are the DSL expression strings.
 * @throws {ScopeDefinitionError} If the file is empty, a line has an invalid format, or the DSL expression is invalid.
 */
export function parseScopeDefinitions(content, filePath) {
  // First, split into lines and filter out comments
  const rawLines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));

  if (rawLines.length === 0) {
    throw new ScopeDefinitionError(
      'File is empty or contains only comments.',
      filePath
    );
  }

  // Process lines to handle multi-line scope definitions
  const processedLines = [];
  let currentScope = null;

  for (const line of rawLines) {
    // Check if this line starts a new scope definition
    const scopeMatch = line.match(/^(\w+:\w+)\s*:=\s*(.*)$/);

    if (scopeMatch) {
      // If we were building a previous scope, finalize it
      if (currentScope) {
        processedLines.push(currentScope);
      }

      // Start a new scope definition
      const [, scopeName, expressionStart] = scopeMatch;
      currentScope = {
        name: scopeName,
        expression: expressionStart,
        line: line, // Keep original line for error reporting
      };
    } else {
      // This is a continuation line
      if (!currentScope) {
        throw new ScopeDefinitionError(
          'Invalid line format. Expected "name := dsl_expression".',
          filePath,
          line
        );
      }

      // Append to the current scope's expression
      currentScope.expression += ' ' + line;
    }
  }

  // Don't forget the last scope if there is one
  if (currentScope) {
    processedLines.push(currentScope);
  }

  const scopeDefinitions = new Map();

  for (const scope of processedLines) {
    try {
      // Validate the DSL expression by parsing it.
      parseDslExpression(scope.expression.trim());
      scopeDefinitions.set(scope.name, scope.expression.trim());
    } catch (parseError) {
      // Augment the parser's error with more context.
      throw new ScopeDefinitionError(
        `Invalid DSL expression for scope "${scope.name}": ${parseError.message}`,
        filePath
      );
    }
  }

  return scopeDefinitions;
}
