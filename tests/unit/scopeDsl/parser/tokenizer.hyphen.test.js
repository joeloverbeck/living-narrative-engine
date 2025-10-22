import { describe, it, expect } from '@jest/globals';
import { Tokenizer } from '../../../../src/scopeDsl/parser/tokenizer.js';

describe('Tokenizer - hyphenated identifiers', () => {
  it('treats hyphenated mod identifiers as a single token', () => {
    const tokenizer = new Tokenizer('sex-dry-intimacy:actors');
    const tokens = tokenizer.getTokens();

    expect(tokens[0]).toMatchObject({
      type: 'IDENTIFIER',
      value: 'sex-dry-intimacy',
    });
    expect(tokens[1]).toMatchObject({ type: 'COLON', value: ':' });
    expect(tokens[2]).toMatchObject({
      type: 'IDENTIFIER',
      value: 'actors',
    });
  });

  it('supports hyphenated identifiers within chained expressions', () => {
    const tokenizer = new Tokenizer(
      'sex-core:actors_with_penis_in_intimacy[][{"==": [1, 1]}]'
    );
    const tokens = tokenizer.getTokens();

    const firstIdentifier = tokens.find((token) => token.type === 'IDENTIFIER');

    expect(firstIdentifier).toBeDefined();
    expect(firstIdentifier).toMatchObject({
      type: 'IDENTIFIER',
      value: 'sex-core',
    });
  });
});
