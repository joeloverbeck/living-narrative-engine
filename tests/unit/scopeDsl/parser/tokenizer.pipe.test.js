import { describe, it, expect } from '@jest/globals';
import { Tokenizer } from '../../../../src/scopeDsl/parser/tokenizer.js';

describe('Tokenizer - PIPE Token Support', () => {
  it('should tokenize pipe character as PIPE token', () => {
    const tokenizer = new Tokenizer('actor.followers | actor.partners');
    const tokens = tokenizer.getTokens();

    expect(tokens).toMatchObject([
      { type: 'IDENTIFIER', value: 'actor' },
      { type: 'DOT', value: '.' },
      { type: 'IDENTIFIER', value: 'followers' },
      { type: 'PIPE', value: '|' },
      { type: 'IDENTIFIER', value: 'actor' },
      { type: 'DOT', value: '.' },
      { type: 'IDENTIFIER', value: 'partners' },
      { type: 'EOF', value: '' },
    ]);
  });

  it('should handle pipe with whitespace', () => {
    const tokenizer = new Tokenizer('a|b');
    const tokens = tokenizer.getTokens();

    expect(tokens[1]).toMatchObject({ type: 'PIPE', value: '|' });
  });

  it('should track line and column for pipe token', () => {
    const tokenizer = new Tokenizer('foo\n  | bar');
    const tokens = tokenizer.getTokens();
    const pipeToken = tokens.find((t) => t.type === 'PIPE');

    expect(pipeToken).toMatchObject({
      type: 'PIPE',
      value: '|',
      line: 2,
      column: 3,
    });
  });

  it('should handle multiple pipes in expression', () => {
    const tokenizer = new Tokenizer('a | b | c');
    const tokens = tokenizer.getTokens();
    const pipeTokens = tokens.filter((t) => t.type === 'PIPE');

    expect(pipeTokens).toHaveLength(2);
  });
});
