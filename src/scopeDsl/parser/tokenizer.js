/**
 * @file Tokenizer for Scope-DSL Parser
 * @description Lexical analyzer that converts DSL expression strings into tokens
 */

//────────────────────────────────────────────────────────────────────────────
// Type annotations
//────────────────────────────────────────────────────────────────────────────
/** @typedef {{type:string,value:string,line:number,column:number}} Token */

export class ScopeSyntaxError extends Error {
  /**
   * @param {string} message
   * @param {number} line
   * @param {number} column
   * @param {string} snippet
   */
  constructor(message, line, column, snippet) {
    super(`${message} at line ${line}, column ${column}\n\n${snippet}`);
    this.name = 'ScopeSyntaxError';
    this.line = line;
    this.column = column;
    this.snippet = snippet;
  }
}

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

export class Tokenizer {
  /** @param {string} input */
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    /** @type {Token[]} */
    this.tokens = [];
    this.tokenize();
  }

  tokenize() {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      // Whitespace
      if (/\s/.test(ch)) {
        this.advance();
        continue;
      }
      // Comment (// ...\n)
      if (this.input.startsWith('//', this.pos)) {
        this.skipComment();
        continue;
      }
      // Identifier / keyword
      if (/[A-Za-z_]/.test(ch)) {
        this.readIdentifier();
        continue;
      }
      // One‑char tokens & string
      switch (ch) {
        case '(':
          this.push('LPAREN', '(');
          break;
        case ')':
          this.push('RPAREN', ')');
          break;
        case '[':
          this.push('LBRACKET', '[');
          break;
        case ']':
          this.push('RBRACKET', ']');
          break;
        case '{':
          this.push('LBRACE', '{');
          break;
        case '}':
          this.push('RBRACE', '}');
          break;
        case ',':
          this.push('COMMA', ',');
          break;
        case '+':
          this.push('PLUS', '+');
          break;
        case '.':
          this.push('DOT', '.');
          break;
        case ':':
          this.push('COLON', ':');
          break;
        case '!':
          this.push('BANG', '!');
          break;
        case '"':
          this.readString();
          continue; // consumes internally
        default:
          throw new ScopeSyntaxError(
            `Unexpected character: '${ch}'`,
            this.line,
            this.col,
            this.snippet()
          );
      }
      this.advance(); // consumed one‑char token
    }
    this.push('EOF', '');
  }

  //────────── helpers ──────────
  skipComment() {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n')
      this.advance();
  }

  readIdentifier() {
    const startLine = this.line,
      startCol = this.col,
      startPos = this.pos;
    while (
      this.pos < this.input.length &&
      /[A-Za-z0-9_]/.test(this.input[this.pos])
    )
      this.advance();
    const value = this.input.slice(startPos, this.pos);
    this.tokens.push({
      type: 'IDENTIFIER',
      value,
      line: startLine,
      column: startCol,
    });
  }

  readString() {
    const startLine = this.line,
      startCol = this.col;
    this.advance(); // skip opening quote
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\') {
        this.advance(); /* escape */
      }
      value += this.input[this.pos];
      this.advance();
    }
    if (this.pos >= this.input.length)
      throw new ScopeSyntaxError(
        'Unterminated string',
        startLine,
        startCol,
        this.snippet(startLine)
      );
    this.advance(); // skip closing quote
    this.tokens.push({
      type: 'STRING',
      value,
      line: startLine,
      column: startCol,
    });
  }

  push(type, value) {
    this.tokens.push({ type, value, line: this.line, column: this.col });
  }

  advance() {
    if (this.input[this.pos] === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    this.pos++;
  }

  snippet(line = this.line, col = this.col) {
    return generateErrorSnippet(this.input, line, col);
  }

  /** @returns {Token[]} */ getTokens() {
    return this.tokens;
  }
}
