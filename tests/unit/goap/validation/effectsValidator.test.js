/**
 * @file Unit tests for EffectsValidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EffectsValidator from '../../../../src/goap/validation/effectsValidator.js';

describe('EffectsValidator', () => {
  let validator;
  let mockLogger;
  let mockEffectsAnalyzer;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockEffectsAnalyzer = {
      analyzeRule: jest.fn()
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn()
    };

    validator = new EffectsValidator({
      logger: mockLogger,
      effectsAnalyzer: mockEffectsAnalyzer,
      dataRegistry: mockDataRegistry
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(validator).toBeDefined();
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new EffectsValidator({
          logger: null,
          effectsAnalyzer: mockEffectsAnalyzer,
          dataRegistry: mockDataRegistry
        });
      }).toThrow();
    });

    it('should throw error with invalid effectsAnalyzer', () => {
      expect(() => {
        new EffectsValidator({
          logger: mockLogger,
          effectsAnalyzer: null,
          dataRegistry: mockDataRegistry
        });
      }).toThrow();
    });

    it('should throw error with invalid dataRegistry', () => {
      expect(() => {
        new EffectsValidator({
          logger: mockLogger,
          effectsAnalyzer: mockEffectsAnalyzer,
          dataRegistry: null
        });
      }).toThrow();
    });
  });

  describe('validateAction - valid action', () => {
    it('should validate action with matching effects', async () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'test:component'
            }
          ]
        }
      };

      const rule = {
        id: 'test:handle_action',
        operations: []
      };

      mockDataRegistry.get.mockReturnValueOnce(action);
      mockDataRegistry.get.mockReturnValueOnce(rule);
      mockEffectsAnalyzer.analyzeRule.mockReturnValue({
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ]
      });

      const result = await validator.validateAction('test:action');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return warning when action has no planning effects', async () => {
      const action = {
        id: 'test:action'
      };

      mockDataRegistry.get.mockReturnValueOnce(action);

      const result = await validator.validateAction('test:action');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('No planning effects defined');
    });

    it('should return warning when no rules found', async () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: []
        }
      };

      mockDataRegistry.get.mockReturnValueOnce(action);
      mockDataRegistry.get.mockReturnValueOnce(null);

      const result = await validator.validateAction('test:action');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('No rules found for action');
    });
  });

  describe('validateAction - invalid action', () => {
    it('should return error when action not found', async () => {
      mockDataRegistry.get.mockReturnValueOnce(null);

      const result = await validator.validateAction('test:action');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Action not found');
    });

    it('should detect missing effects', async () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: []
        }
      };

      const rule = {
        id: 'test:handle_action',
        operations: []
      };

      mockDataRegistry.get.mockReturnValueOnce(action);
      mockDataRegistry.get.mockReturnValueOnce(rule);
      mockEffectsAnalyzer.analyzeRule.mockReturnValue({
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ]
      });

      const result = await validator.validateAction('test:action');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect unexpected effects', async () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'REMOVE_COMPONENT',
              entity: 'actor',
              component: 'test:other'
            }
          ]
        }
      };

      const rule = {
        id: 'test:handle_action',
        operations: []
      };

      mockDataRegistry.get.mockReturnValueOnce(action);
      mockDataRegistry.get.mockReturnValueOnce(rule);
      mockEffectsAnalyzer.analyzeRule.mockReturnValue({
        effects: []
      });

      const result = await validator.validateAction('test:action');

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle validation errors gracefully', async () => {
      mockDataRegistry.get.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const result = await validator.validateAction('test:action');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateMod', () => {
    it('should validate all actions in a mod', async () => {
      const actions = [
        {
          id: 'test:action1',
          planningEffects: { effects: [] }
        },
        {
          id: 'test:action2',
          planningEffects: { effects: [] }
        }
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions') {
          return actions.find(a => a.id === id);
        }
        return { id, operations: [] };
      });
      mockEffectsAnalyzer.analyzeRule.mockReturnValue({ effects: [] });

      const results = await validator.validateMod('test');

      expect(results.summary.total).toBe(2);
    });

    it('should filter actions by mod ID', async () => {
      const actions = [
        { id: 'test:action1', planningEffects: { effects: [] } },
        { id: 'other:action2', planningEffects: { effects: [] } }
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockImplementation(() => ({ operations: [] }));
      mockEffectsAnalyzer.analyzeRule.mockReturnValue({ effects: [] });

      const results = await validator.validateMod('test');

      expect(results.summary.total).toBe(1);
      expect(results.actions[0].actionId).toBe('test:action1');
    });

    it('should throw error with blank modId', async () => {
      await expect(validator.validateMod('')).rejects.toThrow();
    });
  });

  describe('validateAllMods', () => {
    it('should validate all actions', async () => {
      const actions = [
        { id: 'mod1:action1', planningEffects: { effects: [] } },
        { id: 'mod2:action2', planningEffects: { effects: [] } }
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockImplementation(() => ({ operations: [] }));
      mockEffectsAnalyzer.analyzeRule.mockReturnValue({ effects: [] });

      const results = await validator.validateAllMods();

      expect(results.summary.total).toBe(2);
    });

    it('should calculate correct summary statistics', async () => {
      const actions = [
        { id: 'test:action1', planningEffects: { effects: [] } }
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockImplementation(() => null);

      const results = await validator.validateAllMods();

      expect(results.summary.total).toBe(1);
      expect(results.summary.valid).toBe(0);
      expect(results.summary.errors).toBe(1);
    });
  });
});
