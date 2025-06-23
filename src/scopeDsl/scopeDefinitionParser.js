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
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));

  if (lines.length === 0) {
    throw new ScopeDefinitionError(
      'File is empty or contains only comments.',
      filePath
    );
  }

  const scopeDefinitions = new Map();

  for (const line of lines) {
    // This regex enforces the `name := expression` syntax.
    const match = line.match(/^(\w+)\s*:=\s*(.+)$/);
    if (!match) {
      throw new ScopeDefinitionError(
        'Invalid line format. Expected "name := dsl_expression".',
        filePath,
        line
      );
    }

    const [, scopeName, dslExpression] = match;

    try {
      // Validate the DSL expression by parsing it.
      parseDslExpression(dslExpression.trim());
      scopeDefinitions.set(scopeName, dslExpression.trim());
    } catch (parseError) {
      // Augment the parser's error with more context.
      throw new ScopeDefinitionError(
        `Invalid DSL expression for scope "${scopeName}": ${parseError.message}`,
        filePath
      );
    }
  }

  return scopeDefinitions;
}
