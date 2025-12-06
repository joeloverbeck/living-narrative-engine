import { describe, it, expect } from '@jest/globals';
import { IDslParser } from '../../../src/scopeDsl/IDslParser.js';

describe('IDslParser interface contract', () => {
  it('throws a descriptive error when parse is not overridden', () => {
    const parser = new IDslParser();

    expect(() => parser.parse('actor.name')).toThrow(
      new Error('IDslParser.parse method not implemented.')
    );
  });

  it('can be extended by implementations that override parse', () => {
    class ConcreteParser extends IDslParser {
      parse(expr) {
        return { type: 'MockAst', source: expr };
      }
    }

    const parser = new ConcreteParser();
    expect(parser.parse('world.entities')).toEqual({
      type: 'MockAst',
      source: 'world.entities',
    });
  });
});
