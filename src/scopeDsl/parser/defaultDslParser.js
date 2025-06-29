/**
 * @file defaultDslParser.js
 * @description Default implementation of IDslParser using the built-in parser.
 */

import { parseDslExpression } from './parser.js';
import { IDslParser } from '../IDslParser.js';

/**
 * Default DSL parser that delegates to {@link parseDslExpression}.
 *
 * @class DefaultDslParser
 * @augments IDslParser
 */
export class DefaultDslParser extends IDslParser {
  /**
   * @override
   * @param {string} expr - DSL expression string.
   * @returns {object} Parsed AST object.
   */
  parse(expr) {
    return parseDslExpression(expr);
  }
}

export default DefaultDslParser;
