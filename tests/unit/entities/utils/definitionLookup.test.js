import { describe, it, expect, beforeEach } from '@jest/globals';
import { getDefinition } from '../../../../src/entities/utils/definitionLookup.js';
import {
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../../common/mockFactories.js';
import { DefinitionNotFoundError } from '../../../../src/errors/definitionNotFoundError.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('definitionLookup.getDefinition', () => {
  let registry;
  let logger;

  beforeEach(() => {
    registry = createSimpleMockDataRegistry();
    logger = createMockLogger();
  });

  it('returns the definition when found', () => {
    const def = { id: 'foo' };
    registry.getEntityDefinition.mockReturnValue(def);

    const result = getDefinition('foo', registry, logger);
    expect(result).toBe(def);
  });

  it('throws InvalidArgumentError for invalid ids', () => {
    expect(() => getDefinition('', registry, logger)).toThrow(
      InvalidArgumentError
    );
  });

  it('throws DefinitionNotFoundError when missing', () => {
    registry.getEntityDefinition.mockReturnValue(undefined);
    expect(() => getDefinition('missing', registry, logger)).toThrow(
      DefinitionNotFoundError
    );
  });
});
