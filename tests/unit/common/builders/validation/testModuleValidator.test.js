/**
 * @file testModuleValidator.test.js
 * @description Unit tests for TestModuleValidator
 */

import { describe, it, expect } from '@jest/globals';
import { TestModuleValidator } from '../../../../../tests/common/builders/validation/testModuleValidator.js';

describe('TestModuleValidator', () => {
  describe('validateConfiguration()', () => {
    it('should validate based on module type', () => {
      const config = {
        llm: { strategy: 'tool-calling' },
        actors: [{ id: 'test' }],
        world: { name: 'Test' },
      };

      const result = TestModuleValidator.validateConfiguration(
        config,
        'turnExecution'
      );

      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should throw for unknown module type', () => {
      expect(() =>
        TestModuleValidator.validateConfiguration({}, 'unknownType')
      ).toThrow('Unknown module type: unknownType');
    });
  });

  describe('Turn Execution Validation', () => {
    describe('LLM Configuration', () => {
      it('should require LLM configuration', () => {
        const config = { actors: [], world: {} };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          code: 'MISSING_LLM_CONFIG',
          field: 'llm',
          message: 'LLM configuration is required for turn execution',
        });
      });

      it('should require LLM strategy', () => {
        const config = {
          llm: { temperature: 1.0 },
          actors: [],
          world: {},
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'MISSING_LLM_STRATEGY',
            field: 'llm.strategy',
          })
        );
      });

      it('should validate LLM strategy values', () => {
        const config = {
          llm: { strategy: 'invalid-strategy' },
          actors: [],
          world: {},
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_LLM_STRATEGY',
            field: 'llm.strategy',
          })
        );
      });

      it('should accept valid LLM strategies', () => {
        const strategies = ['tool-calling', 'json-schema'];

        strategies.forEach((strategy) => {
          const config = {
            llm: { strategy },
            actors: [{ id: 'test' }],
            world: {},
          };

          const result = TestModuleValidator.validateConfiguration(
            config,
            'turnExecution'
          );

          expect(
            result.errors.filter((e) => e.field === 'llm.strategy')
          ).toHaveLength(0);
        });
      });

      it('should validate temperature type', () => {
        const config = {
          llm: { strategy: 'tool-calling', temperature: 'hot' },
          actors: [],
          world: {},
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_TEMPERATURE_TYPE',
            field: 'llm.temperature',
          })
        );
      });

      it('should warn about unusual temperature values', () => {
        const config = {
          llm: { strategy: 'tool-calling', temperature: 3.0 },
          actors: [],
          world: {},
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            code: 'UNUSUAL_TEMPERATURE',
            field: 'llm.temperature',
          })
        );
      });
    });

    describe('Actor Configuration', () => {
      it('should warn about no actors', () => {
        const config = {
          llm: { strategy: 'tool-calling' },
          actors: [],
          world: {},
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.warnings).toContainEqual({
          code: 'NO_ACTORS',
          field: 'actors',
          message: 'No actors configured - test environment will be empty',
        });
      });

      it('should validate actor format', () => {
        const config = {
          llm: { strategy: 'tool-calling' },
          actors: [{ type: 'ai' }], // Missing id
          world: {},
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_ACTOR_CONFIG',
            field: 'actors[0]',
          })
        );
      });
    });

    describe('World Configuration', () => {
      it('should warn about missing world config', () => {
        const config = {
          llm: { strategy: 'tool-calling' },
          actors: [],
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            code: 'NO_WORLD_CONFIG',
            field: 'world',
          })
        );
      });

      it('should warn about missing world name', () => {
        const config = {
          llm: { strategy: 'tool-calling' },
          actors: [],
          world: { size: 'large' },
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            code: 'NO_WORLD_NAME',
            field: 'world.name',
          })
        );
      });
    });

    describe('Performance Tracking', () => {
      it('should warn about high turn execution threshold', () => {
        const config = {
          llm: { strategy: 'tool-calling' },
          actors: [],
          world: {},
          monitoring: {
            performance: {
              thresholds: { turnExecution: 2000 },
            },
          },
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            code: 'HIGH_PERFORMANCE_THRESHOLD',
            field: 'monitoring.performance.thresholds.turnExecution',
          })
        );
      });

      it('should warn about high action discovery threshold', () => {
        const config = {
          llm: { strategy: 'tool-calling' },
          actors: [],
          world: {},
          monitoring: {
            performance: {
              thresholds: { actionDiscovery: 1000 },
            },
          },
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            code: 'HIGH_PERFORMANCE_THRESHOLD',
            field: 'monitoring.performance.thresholds.actionDiscovery',
          })
        );
      });
    });

    describe('Event Capture', () => {
      it('should validate event capture configuration', () => {
        const config = {
          llm: { strategy: 'tool-calling' },
          actors: [],
          world: {},
          monitoring: {
            events: 'not-an-array',
          },
        };

        const result = TestModuleValidator.validateConfiguration(
          config,
          'turnExecution'
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_EVENT_CONFIG',
            field: 'monitoring.events',
          })
        );
      });
    });
  });

  describe('Action Processing Validation', () => {
    it('should require actor ID', () => {
      const config = { actions: [] };

      const result = TestModuleValidator.validateConfiguration(
        config,
        'actionProcessing'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        code: 'MISSING_ACTOR_ID',
        field: 'actorId',
        message: 'Actor ID is required for action processing',
      });
    });

    it('should validate actions array', () => {
      const config = {
        actorId: 'test',
        actions: 'not-an-array',
      };

      const result = TestModuleValidator.validateConfiguration(
        config,
        'actionProcessing'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_ACTIONS_CONFIG',
          field: 'actions',
        })
      );
    });

    it('should validate action IDs', () => {
      const config = {
        actorId: 'test',
        actions: [{ name: 'move' }], // Missing id
      };

      const result = TestModuleValidator.validateConfiguration(
        config,
        'actionProcessing'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_ACTION_ID',
          field: 'actions[0].id',
        })
      );
    });

    it('should validate mock discovery config', () => {
      const config = {
        actorId: 'test',
        mockDiscovery: 'not-an-object',
      };

      const result = TestModuleValidator.validateConfiguration(
        config,
        'actionProcessing'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_MOCK_CONFIG',
          field: 'mockDiscovery',
        })
      );
    });
  });

  describe('throwIfInvalid()', () => {
    it('should throw TestModuleValidationError for invalid result', () => {
      const invalidResult = {
        valid: false,
        errors: [{ field: 'test', message: 'Test error' }],
      };

      expect(() => TestModuleValidator.throwIfInvalid(invalidResult)).toThrow();
    });

    it('should not throw for valid result', () => {
      const validResult = {
        valid: true,
        errors: [],
      };

      expect(() =>
        TestModuleValidator.throwIfInvalid(validResult)
      ).not.toThrow();
    });

    it('should use custom error message', () => {
      const invalidResult = {
        valid: false,
        errors: [{ field: 'test', message: 'Test error' }],
      };

      expect(() =>
        TestModuleValidator.throwIfInvalid(invalidResult, 'Custom message')
      ).toThrow('Custom message');
    });
  });

  describe('Utility Methods', () => {
    describe('isNonEmptyString()', () => {
      it('should return true for non-empty strings', () => {
        expect(TestModuleValidator.isNonEmptyString('test')).toBe(true);
        expect(TestModuleValidator.isNonEmptyString(' test ')).toBe(true);
      });

      it('should return false for empty or non-string values', () => {
        expect(TestModuleValidator.isNonEmptyString('')).toBe(false);
        expect(TestModuleValidator.isNonEmptyString('   ')).toBe(false);
        expect(TestModuleValidator.isNonEmptyString(null)).toBe(false);
        expect(TestModuleValidator.isNonEmptyString(123)).toBe(false);
      });
    });

    describe('isValidArray()', () => {
      it('should return true for arrays', () => {
        expect(TestModuleValidator.isValidArray([])).toBe(true);
        expect(TestModuleValidator.isValidArray([1, 2, 3])).toBe(true);
      });

      it('should return false for non-arrays', () => {
        expect(TestModuleValidator.isValidArray(null)).toBe(false);
        expect(TestModuleValidator.isValidArray('array')).toBe(false);
        expect(TestModuleValidator.isValidArray({})).toBe(false);
      });
    });

    describe('isValidObject()', () => {
      it('should return true for valid objects', () => {
        expect(TestModuleValidator.isValidObject({})).toBe(true);
        expect(TestModuleValidator.isValidObject({ key: 'value' })).toBe(true);
      });

      it('should return false for invalid objects', () => {
        expect(TestModuleValidator.isValidObject(null)).toBe(false);
        expect(TestModuleValidator.isValidObject([])).toBe(false);
        expect(TestModuleValidator.isValidObject('object')).toBe(false);
      });
    });
  });
});
