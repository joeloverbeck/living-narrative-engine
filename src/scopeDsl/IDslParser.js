/**
 * @file IDslParser.js
 * @description Interface for parsing Scope-DSL expressions into AST objects.
 */

/**
 * @interface IDslParser
 * @description Defines the contract for parsing Scope-DSL expressions.
 */
export class IDslParser {
  /**
   * Parses a DSL expression string into an AST representation.
   *
   * @param {string} expr - The expression to parse.
   * @returns {object} The parsed AST.
   */
  parse(expr) {
    throw new Error('IDslParser.parse method not implemented.');
  }
}

export default IDslParser;
