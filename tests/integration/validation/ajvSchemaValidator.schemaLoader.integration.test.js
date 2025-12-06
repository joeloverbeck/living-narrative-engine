import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ValidatorGenerator from '../../../src/validation/validatorGenerator.js';
import StringSimilarityCalculator from '../../../src/validation/stringSimilarityCalculator.js';

/**
 *
 */
function createTestLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 *
 * @param logger
 * @param root0
 * @param root0.dataRegistry
 */
function createEnhancedValidator(logger, { dataRegistry } = {}) {
  const registry = dataRegistry ?? new InMemoryDataRegistry({ logger });
  const similarityCalculator = new StringSimilarityCalculator({ logger });
  const validatorGenerator = new ValidatorGenerator({
    logger,
    similarityCalculator,
  });

  return {
    registry,
    validator: new AjvSchemaValidator({
      logger,
      validatorGenerator,
      dataRegistry: registry,
    }),
  };
}

describe('AjvSchemaValidator data registry collaboration', () => {
  /** @type {ReturnType<typeof createTestLogger>} */
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
    jest.clearAllMocks();
  });

  test('returns empty component list when no registry is configured', () => {
    const validator = new AjvSchemaValidator({ logger });
    expect(validator.getLoadedComponentSchemas()).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'No data registry available for retrieving component schemas'
    );
  });

  test('retrieves component definitions from the configured registry', () => {
    const { validator, registry } = createEnhancedValidator(logger);

    registry.store('components', 'core:testComponent', {
      id: 'core:testComponent',
      dataSchema: {
        type: 'object',
        properties: { label: { type: 'string' } },
      },
      validationRules: { generateValidator: true },
    });

    expect(validator.getLoadedComponentSchemas()).toEqual([
      expect.objectContaining({ id: 'core:testComponent' }),
    ]);
  });

  test('handles registry failures gracefully when retrieving components', () => {
    class ThrowingRegistry extends InMemoryDataRegistry {
      getAllComponentDefinitions() {
        throw new Error('registry unavailable');
      }
    }

    const { validator } = createEnhancedValidator(logger, {
      dataRegistry: new ThrowingRegistry({ logger }),
    });

    expect(validator.getLoadedComponentSchemas()).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to retrieve component schemas: registry unavailable',
      expect.any(Error)
    );
  });
});
