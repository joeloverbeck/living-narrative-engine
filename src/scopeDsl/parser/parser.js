/**
 * @file Scope-DSL Parser — *stable version*
 * @description Recursive-descent parser for the Scope-DSL that converts DSL expression
 * strings into AST objects. This parser is used to process the expressions defined
 * in `.scope` files.
 *
 * Key design points
 * ──────────────────
 * • **Deterministic token consumption** – every helper consumes exactly the tokens it owns, no
 * duplicate or missing `advance()` calls.
 * • **Unified `[` handling** – decisions about `[]` (array iteration) vs. `[{…}]` (filter) live in
 * **one place**: the loop inside `parseTerm()`. `parseStep()` is concerned solely with parsing a
 * single field name.
 * • **Depth guard** – expressions may nest at most four field/filter/array levels beyond the source
 * node (per the test‑suite requirements).
 * • **Comprehensive error reporting** – detailed line/column/snippet via `ScopeSyntaxError`.
 *
 * Public API
 * ──────────
 * parseScopeFile(content:string, name:string): ScopeDef
 * parseDslExpression(expression:string): AST
 * ScopeSyntaxError class
 */

import { Tokenizer, ScopeSyntaxError } from './tokenizer.js';
import createDepthGuard from '../core/depthGuard.js';

//────────────────────────────────────────────────────────────────────────────
// Type annotations (JSDoc – kept succinct for readability)
//────────────────────────────────────────────────────────────────────────────
/** @typedef {{type: 'ScopeDef', name: string, expr: object}} ScopeDef */
/** @typedef {{type:'Source',kind:'actor'|'location'|'entities',param?:string|null}} Source */
/** @typedef {{type: 'Step', field: string | null, isArray: boolean, parent: object}} Step */
/** @typedef {{type: 'ArrayIterationStep', parent: object}} ArrayIterationStep */
/** @typedef {{type: 'Filter', logic: object, parent: object}} Filter */
/** @typedef {{type: 'Union', left: object, right: object}} Union */
/** @typedef {{type:string,value:string,line:number,column:number}} Token */

export { ScopeSyntaxError };

/**
 * Generates a code snippet with a pointer for error messages.
 *
 * @param {string} input - The full source code string.
 * @param {number} line - The line number (1-based).
 * @param {number} column - The column number (1-based).
 * @returns {string} The formatted code snippet.
 */
function generateErrorSnippet(input, line, column) {
  const lineContent = input.split('\n')[line - 1] || '';
  return `${lineContent}\n${' '.repeat(column - 1)}^`;
}

//────────────────────────────────────────────────────────────────────────────
// PARSER
//────────────────────────────────────────────────────────────────────────────
class Parser {
  /**
   * @param {string} input
   * @param {Tokenizer} [tokenizer] - Optional tokenizer instance
   * @param {object} [depthGuard] - Optional depth guard instance
   */
  constructor(input, tokenizer = null, depthGuard = null) {
    this.input = input;
    this.tokenizer = tokenizer || new Tokenizer(input);
    this.tokens = this.tokenizer.getTokens();
    this.depthGuard = depthGuard || createDepthGuard(4);
    this.current = 0;
  }

  //──────── entry points ────────
  /** @param {string} name @returns {ScopeDef} */
  parseDef(name) {
    const expr = this.parseExpr();
    this.expect('EOF', 'Unexpected tokens after expression');
    return { type: 'ScopeDef', name, expr };
  }

  /** @returns {object} */
  parseExpr() {
    const left = this.parseTerm();
    if (this.match('PLUS')) {
      this.advance();
      const right = this.parseExpr();
      return { type: 'Union', left, right };
    }
    return left;
  }

  //──────── term / chain ────────
  parseTerm() {
    let node = this.parseSource(); // starting point
    let depth = 0; // number of edges consumed so far

    /* Loop over “.field”, bare “[]”, and filter steps */
    while (this.match('DOT') || this.match('LBRACKET')) {
      /* ───── dot-field access ───── */
      if (this.match('DOT')) {
        depth++;
        this.depthGuard.ensure(depth);

        this.advance(); // consume '.'
        const firstTok = this.expect('IDENTIFIER', 'Expected field name');
        let fieldName = firstTok.value;

        // Support identifiers that themselves contain a colon (e.g. core:stats)
        if (this.match('COLON')) {
          this.advance(); // ':'
          const secondTok = this.expect(
            'IDENTIFIER',
            'Expected identifier after colon'
          );
          fieldName = `${fieldName}:${secondTok.value}`;
        }

        // Build the Step node
        const stepNode = {
          type: 'Step',
          field: fieldName,
          isArray: false,
          parent: node,
        };

        // Optional “.entities(core:xyz)” helper directly after a dot-field
        if (fieldName === 'entities' && this.match('LPAREN')) {
          this.advance();
          stepNode.param = this.parseComponentId();
          this.expect('RPAREN', 'Expected closing parenthesis');
        }

        node = stepNode;
        continue;
      }

      /* ───── '[' … either bare array iteration or a filter ───── */
      this.advance(); // we're sitting just after '['

      if (this.match('RBRACKET')) {
        /* bare []  → does *NOT* count toward depth limit */
        this.advance(); // consume ']'

        node = { type: 'ArrayIterationStep', parent: node };

        continue;
      }

      /* otherwise it's a filter: counts as an edge */
      depth++;
      this.depthGuard.ensure(depth);

      const filterNode = this.parseFilter(); // parses JSON-Logic + closing ']'
      filterNode.parent = node;
      node = filterNode;
    }
    return node;
  }

  //──────── source nodes ────────
  parseSource() {
    const idTok = this.expect(
      'IDENTIFIER',
      'Expected source node (actor, location, or entities)'
    );
    switch (idTok.value) {
      case 'actor':
        return { type: 'Source', kind: 'actor' };
      case 'location':
        // MODIFICATION: Return the node directly. No parameter is allowed.
        return { type: 'Source', kind: 'location', param: null };
      case 'entities':
        return this.parseEntitiesSource();
      default:
        this.error(`Unknown source node: '${idTok.value}'`);
    }
  }

  parseEntitiesSource() {
    this.expect('LPAREN', 'Expected opening parenthesis');
    const id = this.parseComponentId();
    this.expect('RPAREN', 'Expected closing parenthesis');
    return { type: 'Source', kind: 'entities', param: id };
  }

  //──────── filter / JSON logic ────────
  parseFilter() {
    const obj = this.parseJsonLogic();
    this.expect('RBRACKET', 'Expected closing bracket for filter');
    return { type: 'Filter', logic: obj };
  }

  parseJsonLogic() {
    this.expect('LBRACE', 'Expected opening brace for JSON Logic object');
    const obj = {};
    while (!this.match('RBRACE')) {
      const keyTok = this.expect(
        'STRING',
        'Expected string key in JSON Logic object'
      );
      this.expect('COLON', 'Expected colon after key');
      obj[keyTok.value] = this.parseJsonValue();
      if (this.match('COMMA')) {
        this.advance();
      } else break;
    }
    this.expect('RBRACE', 'Expected closing brace for JSON Logic object');
    return obj;
  }

  parseJsonValue() {
    if (this.match('STRING')) return this.advance().value;
    if (this.match('IDENTIFIER')) {
      const v = this.advance().value;
      if (v === 'true') return true;
      if (v === 'false') return false;
      return v;
    }
    if (this.match('LBRACKET')) return this.parseJsonArray();
    if (this.match('LBRACE')) return this.parseJsonLogic();
    this.error('Expected JSON value (string, identifier, array, or object)');
  }

  parseJsonArray() {
    this.expect('LBRACKET', 'Expected opening bracket for array');
    const arr = [];
    while (!this.match('RBRACKET')) {
      arr.push(this.parseJsonValue());
      if (this.match('COMMA')) this.advance();
      else break;
    }
    this.expect('RBRACKET', 'Expected closing bracket for array');
    return arr;
  }

  //──────── misc helpers ────────
  parseEntityReference() {
    return this.expect('IDENTIFIER', 'Expected entity reference').value;
  }

  parseComponentId() {
    // Support optional leading '!'
    let negate = false;
    if (this.match('BANG')) {
      this.advance();
      negate = true;
    }
    const first = this.expect(
      'IDENTIFIER',
      'Expected component identifier'
    ).value;
    if (first.includes(':')) return negate ? '!' + first : first; // modern one‑token form
    if (this.match('COLON')) {
      this.advance();
      const second = this.expect('IDENTIFIER', 'Expected component name').value;
      return negate ? `!${first}:${second}` : `${first}:${second}`;
    }
    this.error('Expected colon in component ID');
  }

  //──────── token utility ────────
  peek() {
    return (
      this.tokens[this.current] || {
        type: 'EOF',
        value: '',
        line: 0,
        column: 0,
      }
    );
  }
  previous() {
    return this.tokens[this.current - 1];
  }
  isAtEnd() {
    return this.peek().type === 'EOF';
  }
  match(type) {
    return this.peek().type === type;
  }
  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  expect(type, msg) {
    if (this.match(type)) return this.advance();
    this.error(msg);
  }

  //──────── error helpers ────────
  error(msg) {
    const t = this.peek();
    throw new ScopeSyntaxError(msg, t.line, t.column, this.snippet(t));
  }
  snippet(t) {
    return generateErrorSnippet(this.input, t.line, t.column);
  }
}

//────────────────────────────────────────────────────────────────────────────
// Convenience wrappers (public API)
//────────────────────────────────────────────────────────────────────────────
/**
 *
 * @param content
 * @param name
 */
export function parseScopeFile(content, name) {
  const p = new Parser(content.trim());
  return p.parseDef(name);
}

/**
 * Parses a DSL expression string into an AST.
 *
 * @param {string} expr
 */
export function parseDslExpression(expr) {
  const p = new Parser(expr.trim());
  const e = p.parseExpr();
  p.expect('EOF', 'Unexpected tokens after expression');
  return e;
}
