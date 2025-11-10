/**
 * @file Integration tests for effects generation workflow
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EffectsGenerator from '../../../src/goap/generation/effectsGenerator.js';
import EffectsAnalyzer from '../../../src/goap/analysis/effectsAnalyzer.js';

describe('EffectsGeneration - Integration', () => {
  let generator;
  let analyzer;
  let mockLogger;
  let mockDataRegistry;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn()
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true })
    };

    analyzer = new EffectsAnalyzer({
      logger: mockLogger,
      dataRegistry: mockDataRegistry
    });

    generator = new EffectsGenerator({
      logger: mockLogger,
      effectsAnalyzer: analyzer,
      dataRegistry: mockDataRegistry,
      schemaValidator: mockSchemaValidator
    });
  });

  describe('complete effects generation workflow', () => {
    it('should generate effects for positioning:sit_down action', () => {
      const action = {
        id: 'positioning:sit_down',
        name: 'Sit Down',
        description: 'Sit down on the ground or furniture'
      };

      const rule = {
        id: 'positioning:handle_sit_down',
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'positioning:standing'
            }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'positioning:sitting',
              data: {}
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'positioning:sit_down') return action;
        if (type === 'rules' && id === 'positioning:handle_sit_down') return rule;
        return undefined;
      });

      const result = generator.generateForAction('positioning:sit_down');

      expect(result).toBeDefined();
      expect(result.effects).toHaveLength(2);
      expect(result.effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'positioning:standing'
      });
      expect(result.effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:sitting',
        data: {}
      });
      expect(result.cost).toBe(1.2);
    });

    it('should generate effects for items:pick_up_item action', () => {
      const action = {
        id: 'items:pick_up_item',
        name: 'Pick Up Item',
        description: 'Pick up an item from the ground'
      };

      const rule = {
        id: 'items:handle_pick_up_item',
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'PICK_UP_ITEM_FROM_LOCATION',
            parameters: {
              entity: 'actor',
              item_id: '{itemId}'
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'items:pick_up_item') return action;
        if (type === 'rules' && id === 'items:handle_pick_up_item') return rule;
        return undefined;
      });

      const result = generator.generateForAction('items:pick_up_item');

      expect(result).toBeDefined();
      expect(result.effects).toHaveLength(2);
      expect(result.effects[0].operation).toBe('REMOVE_COMPONENT');
      expect(result.effects[0].component).toBe('items:at_location');
      expect(result.effects[1].operation).toBe('ADD_COMPONENT');
      expect(result.effects[1].component).toBe('items:inventory_item');
    });

    it('should generate effects with conditionals', () => {
      const action = {
        id: 'items:give_item',
        name: 'Give Item',
        description: 'Give an item to another character'
      };

      const rule = {
        id: 'items:handle_give_item',
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { var: 'targetHasSpace' },
              then_actions: [
                {
                  type: 'TRANSFER_ITEM',
                  parameters: {
                    item_id: '{itemId}',
                    from_entity: 'actor',
                    to_entity: 'target'
                  }
                }
              ],
              else_actions: []
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'items:give_item') return action;
        if (type === 'rules' && id === 'items:handle_give_item') return rule;
        return undefined;
      });

      const result = generator.generateForAction('items:give_item');

      expect(result).toBeDefined();
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('CONDITIONAL');
      expect(result.effects[0].condition).toBeDefined();
      expect(result.effects[0].then).toHaveLength(2);
    });

    it('should generate effects for action with movement locking', () => {
      const action = {
        id: 'positioning:kneel_down',
        name: 'Kneel Down',
        description: 'Kneel down on the ground'
      };

      const rule = {
        id: 'positioning:handle_kneel_down',
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'LOCK_MOVEMENT',
            parameters: {
              entity: 'actor'
            }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'positioning:kneeling',
              data: {}
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'positioning:kneel_down') return action;
        if (type === 'rules' && id === 'positioning:handle_kneel_down') return rule;
        return undefined;
      });

      const result = generator.generateForAction('positioning:kneel_down');

      expect(result).toBeDefined();
      expect(result.effects).toHaveLength(2);
      expect(result.effects[0]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:movement_locked',
        data: {}
      });
      expect(result.effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:kneeling',
        data: {}
      });
    });

    it('should generate effects for container operations', () => {
      const action = {
        id: 'items:open_container',
        name: 'Open Container',
        description: 'Open a container'
      };

      const rule = {
        id: 'items:handle_open_container',
        event: { type: 'ACTION_DECIDED' },
        actions: [
          {
            type: 'OPEN_CONTAINER',
            parameters: {
              container_entity: 'target'
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'items:open_container') return action;
        if (type === 'rules' && id === 'items:handle_open_container') return rule;
        return undefined;
      });

      const result = generator.generateForAction('items:open_container');

      expect(result).toBeDefined();
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]).toEqual({
        operation: 'MODIFY_COMPONENT',
        entity: 'target',
        component: 'items:container',
        updates: { isOpen: true }
      });
    });
  });

  describe('mod-level generation', () => {
    it('should generate effects for all actions in positioning mod', () => {
      const actions = [
        { id: 'positioning:sit_down' },
        { id: 'positioning:stand_up' },
        { id: 'positioning:lie_down' },
        { id: 'items:pick_up' }  // Should be filtered out
      ];

      const sitDownRule = {
        id: 'positioning:handle_sit_down',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: { entity: 'actor', component: 'positioning:sitting' }
          }
        ]
      };

      const standUpRule = {
        id: 'positioning:handle_stand_up',
        actions: [
          {
            type: 'REMOVE_COMPONENT',
            parameters: { entity: 'actor', component: 'positioning:sitting' }
          }
        ]
      };

      const lieDownRule = {
        id: 'positioning:handle_lie_down',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: { entity: 'actor', component: 'positioning:lying' }
          }
        ]
      };

      mockDataRegistry.getAll.mockImplementation((type) => {
        if (type === 'actions') return actions;
        return [];
      });

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions') return actions.find(a => a.id === id);
        if (type === 'rules') {
          if (id === 'positioning:handle_sit_down') return sitDownRule;
          if (id === 'positioning:handle_stand_up') return standUpRule;
          if (id === 'positioning:handle_lie_down') return lieDownRule;
        }
        return undefined;
      });

      const result = generator.generateForMod('positioning');

      expect(result.size).toBe(3);
      expect(result.has('positioning:sit_down')).toBe(true);
      expect(result.has('positioning:stand_up')).toBe(true);
      expect(result.has('positioning:lie_down')).toBe(true);
      expect(result.has('items:pick_up')).toBe(false);
    });

    it('should handle mod with no actions', () => {
      mockDataRegistry.getAll.mockReturnValue([]);

      const result = generator.generateForMod('nonexistent');

      expect(result.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('0 success, 0 skipped, 0 failed')
      );
    });
  });

  describe('effects validation integration', () => {
    it('should validate all generated effects match schema', () => {
      const action = {
        id: 'test:action',
        name: 'Test Action'
      };

      const rule = {
        id: 'test:handle_action',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component',
              data: { value: 42 }
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action') return action;
        if (type === 'rules' && id === 'test:handle_action') return rule;
        return undefined;
      });

      const result = generator.generateForAction('test:action');

      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/planning-effects.schema.json',
        expect.objectContaining({
          effects: expect.any(Array),
          cost: expect.any(Number)
        })
      );
      expect(result).toBeDefined();
    });

    it('should reject effects that fail validation', () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Invalid effect structure']
      });

      const action = {
        id: 'test:invalid',
        name: 'Invalid Action'
      };

      const rule = {
        id: 'test:handle_invalid',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component'
            }
          }
        ]
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:invalid') return action;
        if (type === 'rules' && id === 'test:handle_invalid') return rule;
        return undefined;
      });

      expect(() => generator.generateForAction('test:invalid')).toThrow(
        'Invalid planning effects for test:invalid'
      );
    });
  });

  describe('effects injection workflow', () => {
    it('should inject generated effects into action definitions', () => {
      const action1 = { id: 'test:action1' };
      const action2 = { id: 'test:action2' };

      const effectsMap = new Map([
        ['test:action1', {
          effects: [
            { operation: 'ADD_COMPONENT', entity: 'actor', component: 'test:component1' }
          ],
          cost: 1.0
        }],
        ['test:action2', {
          effects: [
            { operation: 'ADD_COMPONENT', entity: 'actor', component: 'test:component2' }
          ],
          cost: 1.0
        }]
      ]);

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:action1') return action1;
        if (type === 'actions' && id === 'test:action2') return action2;
        return undefined;
      });

      const count = generator.injectEffects(effectsMap);

      expect(count).toBe(2);
      expect(action1.planningEffects).toBeDefined();
      expect(action1.planningEffects.effects).toHaveLength(1);
      expect(action2.planningEffects).toBeDefined();
      expect(action2.planningEffects.effects).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle missing rules gracefully', () => {
      const action = { id: 'test:orphan' };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions' && id === 'test:orphan') return action;
        return undefined;
      });

      mockDataRegistry.getAll.mockReturnValue([]);

      const result = generator.generateForAction('test:orphan');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No rules found for action: test:orphan');
    });

    it('should continue processing other actions when one fails', () => {
      const actions = [
        { id: 'test:good' },
        { id: 'test:bad' },
        { id: 'test:also_good' }
      ];

      const goodRule = {
        id: 'test:handle_good',
        actions: [
          { type: 'ADD_COMPONENT', parameters: { entity: 'actor', component: 'test:component' } }
        ]
      };

      const alsoGoodRule = {
        id: 'test:handle_also_good',
        actions: [
          { type: 'ADD_COMPONENT', parameters: { entity: 'actor', component: 'test:component' } }
        ]
      };

      mockDataRegistry.getAll.mockReturnValue(actions);

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'actions') return actions.find(a => a.id === id);
        if (type === 'rules') {
          if (id === 'test:handle_good') return goodRule;
          if (id === 'test:handle_also_good') return alsoGoodRule;
        }
        return undefined;
      });

      const result = generator.generateForMod('test');

      expect(result.size).toBe(2);
      expect(result.has('test:good')).toBe(true);
      expect(result.has('test:also_good')).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 success, 1 skipped')
      );
    });
  });
});
