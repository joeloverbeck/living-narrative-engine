import { describe, it, expect } from '@jest/globals';
import { Tokenizer, ScopeSyntaxError } from '../../../../src/scopeDsl/parser/tokenizer.js';

describe('Tokenizer additional coverage scenarios', () => {
  it('skips single line comments and continues tokenizing', () => {
    const tokenizer = new Tokenizer('// ignore me\nactor.name');
    const tokens = tokenizer.getTokens();

    expect(tokens[0]).toMatchObject({ type: 'IDENTIFIER', value: 'actor', line: 2, column: 1 });
    expect(tokens[1]).toMatchObject({ type: 'DOT', value: '.' });
    expect(tokens[2]).toMatchObject({ type: 'IDENTIFIER', value: 'name' });
  });

  it('supports escaped characters inside strings', () => {
    const tokenizer = new Tokenizer('"escaped \\" quote"');
    const tokens = tokenizer.getTokens();

    expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'escaped " quote' });
  });

  it('throws a ScopeSyntaxError for unterminated strings', () => {
    expect(() => new Tokenizer('"unterminated')).toThrow(/Unterminated string/);
  });

  it('parses decimal numbers as a single NUMBER token', () => {
    const tokenizer = new Tokenizer('42.5 7');
    const tokens = tokenizer.getTokens();

    expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '42.5' });
    expect(tokens[1]).toMatchObject({ type: 'NUMBER', value: '7' });
  });

  it('emits tokens for punctuation such as parentheses, plus, and bang', () => {
    const tokenizer = new Tokenizer('(!value + other)');
    const tokens = tokenizer.getTokens();

    expect(tokens.map((t) => t.type)).toEqual([
      'LPAREN',
      'BANG',
      'IDENTIFIER',
      'PLUS',
      'IDENTIFIER',
      'RPAREN',
      'EOF',
    ]);
  });

  it('surfaces unexpected characters with precise location information', () => {
    try {
      new Tokenizer('actor @ value');
      throw new Error('Expected tokenizer to throw for unexpected character');
    } catch (error) {
      expect(error).toBeInstanceOf(ScopeSyntaxError);
      expect(error.message).toContain("Unexpected character: '@'");
      expect(error.line).toBe(1);
      expect(error.column).toBe(7);
      expect(error.snippet).toContain('actor @ value');
    }
  });
});
