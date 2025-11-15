/**
 * @file Unit tests targeting getLoadedComponentSchemas for AjvSchemaValidator.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

/**
 * Creates a reusable mock logger that satisfies ILogger.
 *
 * @returns {object} ILogger-compatible mock
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates validator dependencies used in component schema tests.
 *
 * @returns {{ logger: ReturnType<typeof createMockLogger>, validatorGenerator: object, dataRegistry: object }}
 */
function createValidatorDependencies() {
  const logger = createMockLogger();
  const validatorGenerator = { generate: jest.fn() };
  const dataRegistry = {
    getComponentDefinition: jest.fn(),
    getAllComponentDefinitions: jest.fn(),
  };

  return { logger, validatorGenerator, dataRegistry };
}

describe('AjvSchemaValidator.getLoadedComponentSchemas', () => {
  describe('when enhanced validation dependencies are missing', () => {
    it('returns an empty array and logs a debug message', () => {
      const logger = createMockLogger();
      const validator = new AjvSchemaValidator({ logger });

      const result = validator.getLoadedComponentSchemas();

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        'No data registry available for retrieving component schemas'
      );
    });
  });

  describe('when enhanced validation dependencies are provided', () => {
    let logger;
    let validator;
    let dataRegistry;
    let validatorGenerator;

    beforeEach(() => {
      ({ logger, validatorGenerator, dataRegistry } =
        createValidatorDependencies());
      validator = new AjvSchemaValidator({
        logger,
        validatorGenerator,
        dataRegistry,
      });
    });

    it('returns the schemas reported by the data registry', () => {
      const schemas = [
        { id: 'component:alpha', validationRules: {} },
        { id: 'component:beta', validationRules: {} },
      ];
      dataRegistry.getAllComponentDefinitions.mockReturnValue(schemas);

      const result = validator.getLoadedComponentSchemas();

      expect(result).toEqual(schemas);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('falls back to an empty array when the registry returns a non-array value', () => {
      dataRegistry.getAllComponentDefinitions.mockReturnValue({ unexpected: true });

      const result = validator.getLoadedComponentSchemas();

      expect(result).toEqual([]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logs a warning and returns an empty array when the registry throws', () => {
      const failure = new Error('registry offline');
      dataRegistry.getAllComponentDefinitions.mockImplementation(() => {
        throw failure;
      });

      const result = validator.getLoadedComponentSchemas();

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        `Failed to retrieve component schemas: ${failure.message}`,
        failure
      );
    });
  });
});
