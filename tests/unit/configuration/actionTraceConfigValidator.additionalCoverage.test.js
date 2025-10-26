/**
 * @file Additional coverage tests for ActionTraceConfigValidator
 */

import { describe, it, expect, jest } from '@jest/globals';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';

function createSchemaValidator() {
  return {
    validate: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
    addSchema: jest.fn(),
    removeSchema: jest.fn(),
  };
}

function createLogger(overrides = {}) {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
  };
}

describe('ActionTraceConfigValidator additional coverage', () => {
  describe('initialize', () => {
    it('wraps initialization failures with contextual error information', async () => {
      const schemaValidator = createSchemaValidator();
      const debugError = new Error('debug failure');
      const logger = createLogger({
        debug: jest.fn(() => {
          throw debugError;
        }),
      });

      const validator = new ActionTraceConfigValidator({
        schemaValidator,
        logger,
      });

      await expect(validator.initialize()).rejects.toThrow(
        'Validator initialization failed: debug failure'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize config validator',
        debugError
      );
    });
  });

  describe('validateProperty', () => {
    it('returns structured error information when custom validator throws', () => {
      const schemaValidator = createSchemaValidator();
      const logger = createLogger();
      const validator = new ActionTraceConfigValidator({
        schemaValidator,
        logger,
      });

      const tracedActionsProxy = new Proxy(['mod:action'], {
        get(target, prop, receiver) {
          if (prop === 'length') {
            throw new Error('length access blocked');
          }

          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });

      const result = validator.validateProperty('tracedActions', tracedActionsProxy);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('length access blocked');
      expect(logger.error).toHaveBeenCalledWith(
        'Property validation failed for tracedActions',
        expect.any(Error)
      );
    });

    it('reports warnings for uppercase mod names and errors for invalid bare actions', async () => {
      const schemaValidator = createSchemaValidator();
      const logger = createLogger();
      const validator = new ActionTraceConfigValidator({
        schemaValidator,
        logger,
      });

      const originalTest = RegExp.prototype.test;
      RegExp.prototype.test = function patchedTest(value) {
        if (this.source === '^[a-z0-9_:\\-*]+$' && value === 'Mod:action') {
          return true;
        }
        return originalTest.call(this, value);
      };

      try {
        const result = await validator.validateConfiguration({
          actionTracing: {
            tracedActions: ['Mod:action', 'invalidaction'],
          },
        });

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('invalidaction');
        expect(result.warnings).toEqual(
          expect.arrayContaining([
            expect.stringContaining('Mod name should be lowercase'),
          ])
        );
      } finally {
        RegExp.prototype.test = originalTest;
      }
    });

    it('identifies wildcard-only patterns without namespaces as invalid', () => {
      const schemaValidator = createSchemaValidator();
      const logger = createLogger();
      const validator = new ActionTraceConfigValidator({
        schemaValidator,
        logger,
      });

      const result = validator.validateProperty('tracedActions', [
        'prefix*',
        '*',
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Invalid action ID patterns: prefix*"),
        ])
      );
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          "Wildcard '*' will trace all actions, making other specific actions redundant.",
        ])
      );
    });

    it('formats non-array schema validation errors consistently', async () => {
      const schemaValidator = createSchemaValidator();
      const logger = createLogger();
      schemaValidator.validate.mockResolvedValue({
        valid: false,
        errors: {
          keyword: 'type',
          instancePath: '/actionTracing/enabled',
          message: 'must be boolean',
          data: 'yes',
          params: { type: 'boolean' },
        },
      });

      const validator = new ActionTraceConfigValidator({
        schemaValidator,
        logger,
      });

      const result = await validator.validateConfiguration({
        actionTracing: {},
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "Property enabled must be of type boolean, got string",
        ])
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Action tracing configuration validation failed',
        expect.objectContaining({ errorCount: expect.any(Number) })
      );
    });
  });
});

