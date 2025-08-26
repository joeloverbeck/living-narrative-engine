/**
 * @file Scope Definition Parser
 * @description Provides a common utility to parse the content of .scope files.
 */

import { parseDslExpression } from './parser/parser.js';
import { ScopeDefinitionError } from './errors/scopeDefinitionError.js';

/**
 * Split a `.scope` file into meaningful lines.
 *
 * @description Removes comments and empty lines from the provided content and
 * returns the remaining trimmed lines.
 * @param {string} content - Raw file content.
 * @param {string} filePath - Path for error reporting.
 * @returns {string[]} Array of non-empty, non-comment lines.
 * @throws {ScopeDefinitionError} When no valid lines remain.
 */
function _splitLines(content, filePath) {
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

  return rawLines;
}

/**
 * Concatenate multi-line scope definitions.
 *
 * @description Creates scope objects from raw lines, handling continuation
 * lines and reporting malformed input.
 * @param {string[]} rawLines - Lines returned from {@link _splitLines}.
 * @param {string} filePath - Path for error reporting.
 * @returns {{name:string, expression:string, line:string}[]} Array of scope
 * objects.
 * @throws {ScopeDefinitionError} When a line is not part of a valid scope
 * definition.
 */
function _assembleScopes(rawLines, filePath) {
  const scopes = [];
  let currentScope = null;

  for (const line of rawLines) {
    const scopeMatch = line.match(/^([\w_-]+:[\w_-]+)\s*:=\s*(.*)$/);
    if (scopeMatch) {
      if (currentScope) {
        scopes.push(currentScope);
      }
      const [, scopeName, expressionStart] = scopeMatch;
      currentScope = {
        name: scopeName,
        expression: expressionStart,
        line,
      };
    } else {
      if (!currentScope) {
        throw new ScopeDefinitionError(
          'Invalid line format. Expected "name := dsl_expression".',
          filePath,
          line
        );
      }
      currentScope.expression += ' ' + line;
    }
  }

  if (currentScope) {
    scopes.push(currentScope);
  }

  return scopes;
}

/**
 * Parse a single scope definition.
 *
 * @description Validates the DSL expression for a scope and returns the
 * resulting AST alongside the expression.
 * @param {{name:string, expression:string}} scope - Scope to parse.
 * @param {string} filePath - Path for error reporting.
 * @returns {{expr:string, ast:object}} Parsed scope data.
 * @throws {ScopeDefinitionError} When the DSL expression is invalid.
 */
function _parseScope(scope, filePath) {
  try {
    const trimmedExpression = scope.expression.trim();
    const ast = parseDslExpression(trimmedExpression);
    return { expr: trimmedExpression, ast };
  } catch (parseError) {
    throw new ScopeDefinitionError(
      `Invalid DSL expression for scope "${scope.name}": ${parseError.message}`,
      filePath
    );
  }
}

/**
 * Parses the text content of a .scope file into a map of scope names to their
 * DSL expressions and pre-parsed ASTs. It validates both the `name := expression` format and the
 * syntax of the DSL expression itself.
 *
 * @param {string} content - The raw string content from a .scope file.
 * @param {string} filePath - The original path to the file, used for error reporting.
 * @returns {Map<string, {expr: string, ast: object}>} A map where keys are scope names and values contain the DSL expression string and its parsed AST.
 * @throws {ScopeDefinitionError} If the file is empty, a line has an invalid format, or the DSL expression is invalid.
 */
export function parseScopeDefinitions(content, filePath) {
  const rawLines = _splitLines(content, filePath);
  const scopes = _assembleScopes(rawLines, filePath);

  const scopeDefinitions = new Map();
  for (const scope of scopes) {
    const parsed = _parseScope(scope, filePath);
    scopeDefinitions.set(scope.name, parsed);
  }

  return scopeDefinitions;
}
