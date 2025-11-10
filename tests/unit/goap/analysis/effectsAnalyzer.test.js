/**
 * @file Unit tests for EffectsAnalyzer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EffectsAnalyzer from '../../../../src/goap/analysis/effectsAnalyzer.js';

describe('EffectsAnalyzer', () => {
  let analyzer;
  let mockLogger;
  let mockDataRegistry;

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

    analyzer = new EffectsAnalyzer({
      logger: mockLogger,
      dataRegistry: mockDataRegistry
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(analyzer).toBeInstanceOf(EffectsAnalyzer);
    });

    it('should throw error if logger is missing required methods', () => {
      expect(() => {
        new EffectsAnalyzer({
          logger: {},
          dataRegistry: mockDataRegistry
        });
      }).toThrow();
    });

    it('should throw error if dataRegistry is missing required methods', () => {
      expect(() => {
        new EffectsAnalyzer({
          logger: mockLogger,
          dataRegistry: {}
        });
      }).toThrow();
    });
  });

  describe('analyzeRule', () => {
    it('should throw error if ruleId is empty', () => {
      expect(() => analyzer.analyzeRule('')).toThrow();
    });

    it('should throw error if rule not found in registry', () => {
      mockDataRegistry.get.mockReturnValue(undefined);

      expect(() => analyzer.analyzeRule('test:rule')).toThrow('Rule not found in registry: test:rule');
    });

    it('should analyze rule with no operations', () => {
      const rule = { id: 'test:rule', actions: [] };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result).toEqual({
        effects: [],
        cost: 1.0,
        abstractPreconditions: undefined
      });
    });

    it('should analyze rule with single ADD_COMPONENT operation', () => {
      const rule = {
        id: 'test:rule',
        actions: [
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
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:sitting',
        data: {}
      });
      expect(result.cost).toBe(1.1);
    });

    it('should analyze rule with REMOVE_COMPONENT operation', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity: 'target',
              component: 'positioning:standing'
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'target',
        component: 'positioning:standing'
      });
    });

    it('should analyze rule with MODIFY_COMPONENT operation', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'core:position',
              updates: { location: 'bedroom' }
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]).toEqual({
        operation: 'MODIFY_COMPONENT',
        entity: 'actor',
        component: 'core:position',
        updates: { location: 'bedroom' }
      });
    });

    it('should calculate cost based on number of effects', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'positioning:sitting',
              data: {}
            }
          },
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'positioning:standing'
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(2);
      expect(result.cost).toBe(1.2); // Base 1.0 + (2 * 0.1)
    });
  });

  describe('isWorldStateChanging', () => {
    it('should return true for ADD_COMPONENT', () => {
      const operation = { type: 'ADD_COMPONENT', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(true);
    });

    it('should return true for REMOVE_COMPONENT', () => {
      const operation = { type: 'REMOVE_COMPONENT', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(true);
    });

    it('should return true for MODIFY_COMPONENT', () => {
      const operation = { type: 'MODIFY_COMPONENT', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(true);
    });

    it('should return true for LOCK_MOVEMENT', () => {
      const operation = { type: 'LOCK_MOVEMENT', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(true);
    });

    it('should return true for TRANSFER_ITEM', () => {
      const operation = { type: 'TRANSFER_ITEM', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(true);
    });

    it('should return false for DISPATCH_EVENT', () => {
      const operation = { type: 'DISPATCH_EVENT', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(false);
    });

    it('should return false for LOG', () => {
      const operation = { type: 'LOG', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(false);
    });

    it('should return false for QUERY_COMPONENT', () => {
      const operation = { type: 'QUERY_COMPONENT', parameters: {} };
      expect(analyzer.isWorldStateChanging(operation)).toBe(false);
    });
  });

  describe('isContextProducing', () => {
    it('should return true for QUERY_COMPONENT', () => {
      const operation = { type: 'QUERY_COMPONENT', parameters: {} };
      expect(analyzer.isContextProducing(operation)).toBe(true);
    });

    it('should return true for GET_NAME', () => {
      const operation = { type: 'GET_NAME', parameters: {} };
      expect(analyzer.isContextProducing(operation)).toBe(true);
    });

    it('should return true for VALIDATE_INVENTORY_CAPACITY', () => {
      const operation = { type: 'VALIDATE_INVENTORY_CAPACITY', parameters: {} };
      expect(analyzer.isContextProducing(operation)).toBe(true);
    });

    it('should return false for ADD_COMPONENT', () => {
      const operation = { type: 'ADD_COMPONENT', parameters: {} };
      expect(analyzer.isContextProducing(operation)).toBe(false);
    });
  });

  describe('operationToEffect - component operations', () => {
    it('should convert LOCK_MOVEMENT to ADD_COMPONENT', () => {
      const operation = {
        type: 'LOCK_MOVEMENT',
        parameters: { entity: 'actor' }
      };

      const effect = analyzer.operationToEffect(operation);

      expect(effect).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:movement_locked',
        data: {}
      });
    });

    it('should convert UNLOCK_MOVEMENT to REMOVE_COMPONENT', () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: { entity: 'actor' }
      };

      const effect = analyzer.operationToEffect(operation);

      expect(effect).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'positioning:movement_locked'
      });
    });

    it('should convert LOCK_MOUTH_ENGAGEMENT to ADD_COMPONENT', () => {
      const operation = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { entity: 'actor' }
      };

      const effect = analyzer.operationToEffect(operation);

      expect(effect).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:mouth_engagement_locked',
        data: {}
      });
    });

    it('should convert UNLOCK_MOUTH_ENGAGEMENT to REMOVE_COMPONENT', () => {
      const operation = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { entity: 'actor' }
      };

      const effect = analyzer.operationToEffect(operation);

      expect(effect).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'positioning:mouth_engagement_locked'
      });
    });
  });

  describe('operationToEffect - closeness operations', () => {
    it('should convert ESTABLISH_SITTING_CLOSENESS to bidirectional effects', () => {
      const operation = {
        type: 'ESTABLISH_SITTING_CLOSENESS',
        parameters: {
          entity: 'actor',
          target_entity: 'target'
        }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:sitting_close_to',
        data: { targetId: '{target.id}' }
      });
      expect(effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'target',
        component: 'positioning:sitting_close_to',
        data: { targetId: '{actor.id}' }
      });
    });

    it('should convert REMOVE_SITTING_CLOSENESS to REMOVE_COMPONENT', () => {
      const operation = {
        type: 'REMOVE_SITTING_CLOSENESS',
        parameters: { entity: 'actor' }
      };

      const effect = analyzer.operationToEffect(operation);

      expect(effect).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'positioning:sitting_close_to'
      });
    });

    it('should convert BREAK_CLOSENESS_WITH_TARGET to multiple REMOVE_COMPONENT', () => {
      const operation = {
        type: 'BREAK_CLOSENESS_WITH_TARGET',
        parameters: { entity: 'actor' }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0].operation).toBe('REMOVE_COMPONENT');
      expect(effects[0].component).toBe('positioning:sitting_close_to');
      expect(effects[1].operation).toBe('REMOVE_COMPONENT');
      expect(effects[1].component).toBe('positioning:lying_close_to');
    });
  });

  describe('operationToEffect - item operations', () => {
    it('should convert PICK_UP_ITEM_FROM_LOCATION', () => {
      const operation = {
        type: 'PICK_UP_ITEM_FROM_LOCATION',
        parameters: { item_id: 'sword_123' }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'sword_123',
        component: 'items:at_location'
      });
      expect(effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: 'sword_123' }
      });
    });

    it('should convert DROP_ITEM_AT_LOCATION', () => {
      const operation = {
        type: 'DROP_ITEM_AT_LOCATION',
        parameters: {
          item_id: 'sword_123',
          location: 'bedroom'
        }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: 'sword_123' }
      });
      expect(effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'sword_123',
        component: 'items:at_location',
        data: { location: 'bedroom' }
      });
    });

    it('should convert TRANSFER_ITEM', () => {
      const operation = {
        type: 'TRANSFER_ITEM',
        parameters: {
          item_id: 'sword_123',
          from_entity: 'actor',
          to_entity: 'target'
        }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: 'sword_123' }
      });
      expect(effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'target',
        component: 'items:inventory_item',
        data: { itemId: 'sword_123' }
      });
    });
  });

  describe('operationToEffect - container operations', () => {
    it('should convert OPEN_CONTAINER', () => {
      const operation = {
        type: 'OPEN_CONTAINER',
        parameters: { container_entity: 'chest' }
      };

      const effect = analyzer.operationToEffect(operation);

      expect(effect).toEqual({
        operation: 'MODIFY_COMPONENT',
        entity: 'chest',
        component: 'items:container',
        updates: { isOpen: true }
      });
    });

    it('should convert TAKE_FROM_CONTAINER', () => {
      const operation = {
        type: 'TAKE_FROM_CONTAINER',
        parameters: {
          container_id: 'chest',
          item_id: 'sword_123'
        }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'sword_123',
        component: 'items:contained_in'
      });
      expect(effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: 'sword_123' }
      });
    });

    it('should convert PUT_IN_CONTAINER', () => {
      const operation = {
        type: 'PUT_IN_CONTAINER',
        parameters: {
          container_id: 'chest',
          item_id: 'sword_123'
        }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: 'sword_123' }
      });
      expect(effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'sword_123',
        component: 'items:contained_in',
        data: { containerId: 'chest' }
      });
    });
  });

  describe('operationToEffect - clothing operations', () => {
    it('should convert UNEQUIP_CLOTHING', () => {
      const operation = {
        type: 'UNEQUIP_CLOTHING',
        parameters: { clothing_id: 'shirt_123' }
      };

      const effects = analyzer.operationToEffect(operation);

      expect(Array.isArray(effects)).toBe(true);
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'clothing:equipped',
        data: { clothingId: 'shirt_123' }
      });
      expect(effects[1]).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: 'shirt_123' }
      });
    });
  });

  describe('conditional operations', () => {
    it('should handle IF operation with then branch only', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [{ var: 'x' }, 5] },
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:happy',
                    data: {}
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('CONDITIONAL');
      expect(result.effects[0].condition).toEqual({ '==': [{ var: 'x' }, 5] });
      expect(result.effects[0].then).toHaveLength(1);
      expect(result.cost).toBe(1.2); // Base 1.0 + 0.2 for conditional
    });

    it('should handle IF_CO_LOCATED operation', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'IF_CO_LOCATED',
            parameters: {
              entity_a: 'actor',
              entity_b: 'target',
              then_actions: [
                {
                  type: 'ADD_COMPONENT',
                  parameters: {
                    entity: 'actor',
                    component: 'test:together',
                    data: {}
                  }
                }
              ]
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('CONDITIONAL');
      expect(result.effects[0].condition).toEqual({
        '==': [
          { var: 'actor.location' },
          { var: 'target.location' }
        ]
      });
    });
  });

  describe('non-state-changing operations', () => {
    it('should skip DISPATCH_EVENT operations', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'DISPATCH_EVENT',
            parameters: { eventType: 'TEST_EVENT' }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component',
              data: {}
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('ADD_COMPONENT');
    });

    it('should skip LOG operations', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'LOG',
            parameters: { message: 'Test log' }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component',
              data: {}
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('ADD_COMPONENT');
    });

    it('should skip QUERY_COMPONENT operations', () => {
      const rule = {
        id: 'test:rule',
        actions: [
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component',
              result_variable: 'componentData'
            }
          },
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:component2',
              data: {}
            }
          }
        ]
      };
      mockDataRegistry.get.mockReturnValue(rule);

      const result = analyzer.analyzeRule('test:rule');

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('ADD_COMPONENT');
    });
  });

  describe('unknown operations', () => {
    it('should warn and return null for unknown operations', () => {
      const operation = {
        type: 'UNKNOWN_OPERATION',
        parameters: {}
      };

      const effect = analyzer.operationToEffect(operation);

      expect(effect).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown or unhandled state-changing operation: UNKNOWN_OPERATION')
      );
    });
  });
});
