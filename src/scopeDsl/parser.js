/**
 * @file Parser re-export for backward compatibility
 * @description Re-exports parser functionality from the new location
 */

export {
  parseScopeFile,
  parseDslExpression,
  ScopeSyntaxError,
} from './parser/parser.js';
export { Tokenizer } from './parser/tokenizer.js';
