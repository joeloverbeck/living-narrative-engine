/**
 * @file Unit tests for EffectsGenerator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EffectsGenerator from '../../../../src/goap/generation/effectsGenerator.js';

describe('EffectsGenerator', () => {
  let generator;
  let mockLogger;
  let mockEffectsAnalyzer;
  let mockDataRegistry;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockEffectsAnalyzer = {
      analyzeRule: jest.fn(),
      isWorldStateChanging: jest.fn()
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn()
    };

    mockSchemaValidator = {
      validate: jest.fn()
    };

    generator = new EffectsGenerator({
      logger: mockLogger,
      effectsAnalyzer: mockEffectsAnalyzer,
      dataRegistry: mockDataRegistry,
      schemaValidator: mockSchemaValidator
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(generator).toBeInstanceOf(EffectsGenerator);
    });

    it('should throw error if logger is missing required methods', () => {
      expect(() => {
        new EffectsGenerator({
          logger: {},
          effectsAnalyzer: mockEffectsAnalyzer,
          dataRegistry: mockDataRegistry,
          schemaValidator: mockSchemaValidator
        });
      }).toThrow();
    });

    it('should throw error if effectsAnalyzer is missing required methods', () => {
      expect(() => {
        new EffectsGenerator({
          logger: mockLogger,
          effectsAnalyzer: {},
          dataRegistry: mockDataRegistry,
          schemaValidator: mockSchemaValidator
        });
      }).toThrow();
    });

    it('should throw error if dataRegistry is missing required methods', () => {
      expect(() => {
        new EffectsGenerator({
          logger: mockLogger,
          effectsAnalyzer: mockEffectsAnalyzer,
          dataRegistry: {},
          schemaValidator: mockSchemaValidator
        });
      }).toThrow();
    });

    it('should throw error if schemaValidator is missing required methods', () => {
      expect(() => {
        new EffectsGenerator({
          logger: mockLogger,
          effectsAnalyzer: mockEffectsAnalyzer,
          dataRegistry: mockDataRegistry,
          schemaValidator: {}
        });
      }).toThrow();
    });
  });

  describe('generateForAction', () => {
    it('should throw error if actionId is empty', () => {
      expect(() => generator.generateForAction('')).toThrow();
    });

    it('should throw error if action not found', () => {
      mockDataRegistry.get.mockReturnValue(undefined);

      expect(() => generator.generateForAction('test:action')).toThrow('Action not found: test:action');
    });

    it('should return null if no rules found for action', () => {
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action') return { id: 'test:action' };
        return undefined;
      });
      mockDataRegistry.getAll.mockReturnValue([]);

      const result = generator.generateForAction('test:action');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No rules found for action: test:action');
    });

    it('should generate effects for action with single rule', () => {
      const action = { id: 'positioning:sit_down' };
      const rule = { id: 'positioning:handle_sit_down' };
      const analyzedEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
            data: {}
          }
        ],
        cost: 1.1
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'positioning:sit_down') return action;
        if (type === 'rules' && id === 'positioning:handle_sit_down') return rule;
        return undefined;
      });

      mockEffectsAnalyzer.analyzeRule.mockReturnValue(analyzedEffects);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.generateForAction('positioning:sit_down');

      expect(result).toEqual({
        effects: analyzedEffects.effects,
        cost: 1.1
      });
      expect(mockEffectsAnalyzer.analyzeRule).toHaveBeenCalledWith('positioning:handle_sit_down');
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/planning-effects.schema.json',
        expect.any(Object)
      );
    });

    it('should generate effects with abstract preconditions', () => {
      const action = { id: 'items:give_item' };
      const rule = { id: 'items:handle_give_item' };
      const analyzedEffects = {
        effects: [
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'actor',
            component: 'items:in_inventory'
          }
        ],
        cost: 1.1,
        abstractPreconditions: {
          targetHasInventorySpace: {
            description: 'Checks if target has inventory space',
            parameters: ['target'],
            simulationFunction: 'assumeTrue'
          }
        }
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'items:give_item') return action;
        if (type === 'rules' && id === 'items:handle_give_item') return rule;
        return undefined;
      });

      mockEffectsAnalyzer.analyzeRule.mockReturnValue(analyzedEffects);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.generateForAction('items:give_item');

      expect(result.abstractPreconditions).toEqual(analyzedEffects.abstractPreconditions);
    });

    it('should handle multiple rules for single action', () => {
      const action = { id: 'test:action' };
      const rule1 = {
        id: 'test:rule1',
        event: { type: 'ACTION_DECIDED' },
        conditions: [{ type: 'event-is-action', actionId: 'test:action' }]
      };
      const rule2 = {
        id: 'test:rule2',
        event: { type: 'ACTION_DECIDED' },
        conditions: [{ type: 'event-is-action', actionId: 'test:action' }]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action') return action;
        return undefined;
      });

      mockDataRegistry.getAll.mockImplementation((type) => {
        if (type === 'rules') return [rule1, rule2];
        return [];
      });

      mockEffectsAnalyzer.analyzeRule
        .mockReturnValueOnce({
          effects: [{ operation: 'ADD_COMPONENT', entity: 'actor', component: 'test:component1' }],
          cost: 1.1
        })
        .mockReturnValueOnce({
          effects: [{ operation: 'ADD_COMPONENT', entity: 'actor', component: 'test:component2' }],
          cost: 1.2
        });

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.generateForAction('test:action');

      expect(result.effects).toHaveLength(2);
      expect(mockEffectsAnalyzer.analyzeRule).toHaveBeenCalledTimes(2);
    });

    it('should throw error if rule analysis fails', () => {
      const action = { id: 'test:action' };
      const rule = { id: 'test:handle_action' };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action') return action;
        if (type === 'rules' && id === 'test:handle_action') return rule;
        return undefined;
      });

      mockEffectsAnalyzer.analyzeRule.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      expect(() => generator.generateForAction('test:action')).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to analyze rule test:handle_action',
        expect.any(Error)
      );
    });

    it('should throw error if validation fails', () => {
      const action = { id: 'test:action' };
      const rule = { id: 'test:handle_action' };
      const analyzedEffects = {
        effects: [{ operation: 'INVALID', entity: 'actor' }],
        cost: 1.0
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action') return action;
        if (type === 'rules' && id === 'test:handle_action') return rule;
        return undefined;
      });

      mockEffectsAnalyzer.analyzeRule.mockReturnValue(analyzedEffects);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Invalid operation type']
      });

      expect(() => generator.generateForAction('test:action')).toThrow('Invalid planning effects for test:action');
    });
  });

  describe('generateForMod', () => {
    it('should throw error if modId is empty', () => {
      expect(() => generator.generateForMod('')).toThrow();
    });

    it('should generate effects for all actions in mod', () => {
      const actions = [
        { id: 'positioning:sit_down' },
        { id: 'positioning:stand_up' },
        { id: 'items:pick_up' }  // Different mod, should be filtered out
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions') {
          return actions.find(a => a.id === id);
        }
        if (type === 'rules') {
          const actionName = id.split(':')[1].replace('handle_', '');
          const modId = id.split(':')[0];
          return { id: `${modId}:handle_${actionName}` };
        }
        return undefined;
      });

      mockEffectsAnalyzer.analyzeRule.mockReturnValue({
        effects: [{ operation: 'ADD_COMPONENT', entity: 'actor', component: 'test:component' }],
        cost: 1.0
      });

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.generateForMod('positioning');

      expect(result.size).toBe(2);
      expect(result.has('positioning:sit_down')).toBe(true);
      expect(result.has('positioning:stand_up')).toBe(true);
      expect(result.has('items:pick_up')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 success')
      );
    });

    it('should handle actions with no effects (skipped)', () => {
      const actions = [
        { id: 'test:action1' },
        { id: 'test:action2' }
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions') return actions.find(a => a.id === id);
        return undefined;
      });

      const result = generator.generateForMod('test');

      expect(result.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('0 success, 2 skipped')
      );
    });

    it('should handle errors in individual action generation', () => {
      const actions = [
        { id: 'test:action1' },
        { id: 'test:action2' }
      ];

      mockDataRegistry.getAll.mockReturnValue(actions);
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions') return actions.find(a => a.id === id);
        if (type === 'rules' && id === 'test:handle_action1') {
          return { id: 'test:handle_action1' };
        }
        return undefined;
      });

      mockEffectsAnalyzer.analyzeRule.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const result = generator.generateForMod('test');

      expect(result.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('0 success, 1 skipped, 1 failed')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate effects'),
        expect.any(Error)
      );
    });
  });

  describe('validateEffects', () => {
    it('should throw error if actionId is empty', () => {
      expect(() => generator.validateEffects('', {})).toThrow();
    });

    it('should throw error if effects are null', () => {
      expect(() => generator.validateEffects('test:action', null)).toThrow();
    });

    it('should validate effects successfully', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
            data: {}
          }
        ],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect schema validation errors', () => {
      const effects = {
        effects: [{ invalid: 'effect' }],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Invalid effect structure']
      });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('schema');
    });

    it('should warn about empty effects', () => {
      const effects = {
        effects: [],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('empty');
    });

    it('should detect invalid component references', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'invalid_component',  // Missing colon separator
            data: {}
          }
        ],
        cost: 1.0
      };

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_component')).toBe(true);
    });

    it('should detect invalid abstract preconditions', () => {
      const effects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component'
          }
        ],
        cost: 1.0,
        abstractPreconditions: {
          invalidPrecondition: {
            description: 'Missing parameters and simulationFunction'
          }
        }
      };

      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      const result = generator.validateEffects('test:action', effects);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_precondition')).toBe(true);
    });

    it('should handle validation exceptions', () => {
      mockSchemaValidator.validate.mockImplementation(() => {
        throw new Error('Validation crashed');
      });

      const result = generator.validateEffects('test:action', { effects: [], cost: 1.0 });

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('exception');
    });
  });

  describe('injectEffects', () => {
    it('should throw error if effectsMap is null', () => {
      expect(() => generator.injectEffects(null)).toThrow();
    });

    it('should inject effects into actions', () => {
      const effectsMap = new Map([
        ['test:action1', { effects: [], cost: 1.0 }],
        ['test:action2', { effects: [], cost: 1.0 }]
      ]);

      const action1 = { id: 'test:action1' };
      const action2 = { id: 'test:action2' };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action1') return action1;
        if (type === 'actions' && id === 'test:action2') return action2;
        return undefined;
      });

      const count = generator.injectEffects(effectsMap);

      expect(count).toBe(2);
      expect(action1.planningEffects).toBeDefined();
      expect(action2.planningEffects).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Injected effects into 2 actions');
    });

    it('should handle missing actions gracefully', () => {
      const effectsMap = new Map([
        ['test:missing', { effects: [], cost: 1.0 }]
      ]);

      mockDataRegistry.get.mockReturnValue(undefined);

      const count = generator.injectEffects(effectsMap);

      expect(count).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Action not found for injection: test:missing');
    });

    it('should handle injection errors', () => {
      const effectsMap = new Map([
        ['test:action', { effects: [], cost: 1.0 }]
      ]);

      mockDataRegistry.get.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const count = generator.injectEffects(effectsMap);

      expect(count).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
