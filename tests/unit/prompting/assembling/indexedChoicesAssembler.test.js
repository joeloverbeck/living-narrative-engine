import { describe, test, expect, jest } from '@jest/globals';
import { IndexedChoicesAssembler } from '../../../../src/prompting/assembling/indexedChoicesAssembler.js';

describe('IndexedChoicesAssembler', () => {
  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };

  test('returns empty string when required params are missing', () => {
    const assembler = new IndexedChoicesAssembler({ logger });
    const result = assembler.assemble({}, {}, undefined);
    expect(result).toBe('');
  });

  test('returns empty string when indexedChoicesArray is empty', () => {
    const assembler = new IndexedChoicesAssembler({ logger });
    const placeholderResolver = { resolve: (s) => s };
    const result = assembler.assemble(
      {},
      { indexedChoicesArray: [] },
      placeholderResolver
    );
    expect(result).toBe('');
    expect(logger.debug).toHaveBeenCalledWith(
      'IndexedChoicesAssembler: No choices to render.'
    );
  });

  test('renders numbered list with prefix and suffix', () => {
    const assembler = new IndexedChoicesAssembler({ logger });
    const placeholderResolver = { resolve: (s) => s.replace('{name}', 'Hero') };
    const elementConfig = { prefix: 'Hello {name}\n', suffix: '\nBye {name}' };
    const promptData = {
      indexedChoicesArray: [
        { index: 1, commandString: 'look', description: 'Look around' },
        { index: 2, commandString: 'run', description: 'Run away' },
      ],
    };

    const result = assembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );
    const expected =
      'Hello Hero\nindex: 1 --> look (Look around)\nindex: 2 --> run (Run away)\nBye Hero';
    expect(result).toBe(expected);
  });
});
