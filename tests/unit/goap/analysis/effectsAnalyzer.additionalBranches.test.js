/**
 * @file Additional coverage tests for EffectsAnalyzer branching and defaults
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EffectsAnalyzer from '../../../../src/goap/analysis/effectsAnalyzer.js';

describe('EffectsAnalyzer - Additional Branch Coverage', () => {
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

  it('maps context variable names from result_variable, variable, and output_variable', () => {
    const rule = {
      id: 'test:context-vars',
      actions: [
        {
          type: 'VALIDATE_INVENTORY_CAPACITY',
          parameters: { variable: 'inventoryCheck' }
        },
        {
          type: 'VALIDATE_CONTAINER_CAPACITY',
          parameters: { output_variable: 'containerSpace' }
        },
        {
          type: 'HAS_COMPONENT',
          parameters: { result_variable: 'hasComponent' }
        },
        {
          type: 'CHECK_FOLLOW_CYCLE',
          parameters: { result_variable: 'followCycle' }
        }
      ]
    };
    mockDataRegistry.get.mockReturnValue(rule);

    const result = analyzer.analyzeRule('test:context-vars');

    expect(result.effects).toEqual([]);
    expect(result.cost).toBe(1.0);
    expect(result.abstractPreconditions).toEqual({
      inventoryCheck: {
        description: 'Checks if actor can carry the item',
        parameters: ['actorId', 'itemId'],
        simulationFunction: 'assumeTrue'
      },
      containerSpace: {
        description: 'Checks if container has space for item',
        parameters: ['containerId', 'itemId'],
        simulationFunction: 'assumeTrue'
      },
      hasComponent: {
        description: 'Checks if entity has component',
        parameters: ['entityId', 'componentId'],
        simulationFunction: 'assumeTrue'
      },
      followCycle: {
        description: 'Checks if following relationship would create a cycle',
        parameters: ['leaderId', 'followerId'],
        simulationFunction: 'assumeFalse'
      }
    });
  });

  it('handles nested IF_CO_LOCATED branches with default entities and else paths', () => {
    const coLocatedCondition = {
      '==': [
        { var: 'actor.location' },
        { var: 'target.location' }
      ]
    };

    const nestedCondition = {
      '==': [
        { var: 'actor.trust' },
        'high'
      ]
    };

    const rule = {
      id: 'test:conditional-flow',
      actions: [
        {
          type: 'IF_CO_LOCATED',
          parameters: {
            then_actions: [
              {
                type: 'IF',
                parameters: {
                  condition: nestedCondition,
                  then_actions: [
                    {
                      type: 'ADD_COMPONENT',
                      parameters: {
                        component: 'test:cooperative'
                      }
                    }
                  ],
                  else_actions: [
                    {
                      type: 'ADD_COMPONENT',
                      parameters: {
                        component: 'test:guarded'
                      }
                    }
                  ]
                }
              }
            ],
            else_actions: [
              {
                type: 'ADD_COMPONENT',
                parameters: {
                  component: 'test:apart'
                }
              }
            ]
          }
        }
      ]
    };

    mockDataRegistry.get.mockReturnValue(rule);

    const result = analyzer.analyzeRule('test:conditional-flow');

    expect(result.effects).toHaveLength(3);

    const cooperativeEffect = result.effects.find(effect =>
      effect.operation === 'CONDITIONAL' &&
      effect.then.some(e => e.component === 'test:cooperative')
    );
    expect(cooperativeEffect).toBeDefined();
    expect(cooperativeEffect.condition).toEqual({
      and: [coLocatedCondition, nestedCondition]
    });

    const guardedEffect = result.effects.find(effect =>
      effect.operation === 'CONDITIONAL' &&
      effect.then.some(e => e.component === 'test:guarded')
    );
    expect(guardedEffect).toBeDefined();
    expect(guardedEffect.condition).toEqual({
      and: [coLocatedCondition, { not: nestedCondition }]
    });

    const apartEffect = result.effects.find(effect =>
      effect.operation === 'CONDITIONAL' &&
      effect.then.some(e => e.component === 'test:apart')
    );
    expect(apartEffect).toBeDefined();
    expect(apartEffect.condition).toEqual({ not: coLocatedCondition });

    expect(result.cost).toBe(1.6); // 1.0 base + (3 conditional effects * 0.2)
  });

  describe('operation conversion defaults', () => {
    it('applies default entities and placeholders for movement and closeness', () => {
      expect(analyzer.operationToEffect({ type: 'LOCK_MOVEMENT', parameters: {} })).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:movement_locked',
        data: {}
      });

      expect(analyzer.operationToEffect({ type: 'UNLOCK_MOVEMENT', parameters: {} })).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'positioning:movement_locked'
      });

      expect(analyzer.operationToEffect({ type: 'LOCK_MOUTH_ENGAGEMENT', parameters: {} })).toEqual({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'positioning:mouth_engagement_locked',
        data: {}
      });

      expect(analyzer.operationToEffect({ type: 'UNLOCK_MOUTH_ENGAGEMENT', parameters: {} })).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'positioning:mouth_engagement_locked'
      });

      const lyingCloseness = analyzer.operationToEffect({
        type: 'ESTABLISH_LYING_CLOSENESS',
        parameters: {}
      });
      expect(lyingCloseness).toEqual([
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'positioning:lying_close_to',
          data: { targetId: '{target.id}' }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'target',
          component: 'positioning:lying_close_to',
          data: { targetId: '{actor.id}' }
        }
      ]);

      expect(analyzer.operationToEffect({
        type: 'REMOVE_LYING_CLOSENESS',
        parameters: {}
      })).toEqual({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'positioning:lying_close_to'
      });

      expect(analyzer.operationToEffect({
        type: 'BREAK_CLOSENESS_WITH_TARGET',
        parameters: {}
      })).toEqual([
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'positioning:sitting_close_to'
        },
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'positioning:lying_close_to'
        }
      ]);
    });

    it('uses placeholders when item and container parameters are missing', () => {
      const pickUpEffects = analyzer.operationToEffect({
        type: 'PICK_UP_ITEM_FROM_LOCATION',
        parameters: {}
      });
      expect(pickUpEffects).toEqual([
        {
          operation: 'REMOVE_COMPONENT',
          entity: '{itemId}',
          component: 'items:at_location'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: '{itemId}' }
        }
      ]);

      const dropEffects = analyzer.operationToEffect({
        type: 'DROP_ITEM_AT_LOCATION',
        parameters: {}
      });
      expect(dropEffects).toEqual([
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: '{itemId}' }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: '{itemId}',
          component: 'items:at_location',
          data: { location: '{actor.location}' }
        }
      ]);

      const transferEffects = analyzer.operationToEffect({
        type: 'TRANSFER_ITEM',
        parameters: {}
      });
      expect(transferEffects).toEqual([
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: '{itemId}' }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'target',
          component: 'items:inventory_item',
          data: { itemId: '{itemId}' }
        }
      ]);
    });

    it('defaults container and clothing conversions when parameters are omitted', () => {
      expect(analyzer.operationToEffect({
        type: 'OPEN_CONTAINER',
        parameters: {}
      })).toEqual({
        operation: 'MODIFY_COMPONENT',
        entity: 'target',
        component: 'items:container',
        updates: { isOpen: true }
      });

      const takeEffects = analyzer.operationToEffect({
        type: 'TAKE_FROM_CONTAINER',
        parameters: {}
      });
      expect(takeEffects).toEqual([
        {
          operation: 'REMOVE_COMPONENT',
          entity: '{itemId}',
          component: 'items:contained_in'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: '{itemId}' }
        }
      ]);

      const putEffects = analyzer.operationToEffect({
        type: 'PUT_IN_CONTAINER',
        parameters: {}
      });
      expect(putEffects).toEqual([
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: '{itemId}' }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: '{itemId}',
          component: 'items:contained_in',
          data: { containerId: 'target' }
        }
      ]);

      const unequipEffects = analyzer.operationToEffect({
        type: 'UNEQUIP_CLOTHING',
        parameters: {}
      });
      expect(unequipEffects).toEqual([
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'clothing:equipped',
          data: { clothingId: '{clothingId}' }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: '{clothingId}' }
        }
      ]);
    });
  });
});
