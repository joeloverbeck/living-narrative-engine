/**
 * @file Integration tests for EffectsAnalyzer exercising production collaborators
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EffectsAnalyzer from '../../../src/goap/analysis/effectsAnalyzer.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('EffectsAnalyzer - Integration', () => {
  let logger;
  let dataRegistry;
  let analyzer;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    dataRegistry = new InMemoryDataRegistry({ logger });
    analyzer = new EffectsAnalyzer({ logger, dataRegistry });
  });

  it('analyzes a complex rule and converts a wide range of operations into planning effects', () => {
    const ruleId = 'integration:complex_effects';
    const operations = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity: 'hero',
          component: 'custom:buff',
          data: { strength: 1 }
        }
      },
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity: 'hero',
          component: 'custom:debuff'
        }
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity: 'hero',
          component: 'custom:stats',
          updates: { agility: 2 }
        }
      },
      {
        type: 'ATOMIC_MODIFY_COMPONENT',
        parameters: {
          entity: 'hero',
          component: 'custom:stats',
          updates: { stamina: 5 }
        }
      },
      {
        type: 'LOCK_MOVEMENT',
        parameters: { entity: 'hero' }
      },
      {
        type: 'UNLOCK_MOVEMENT',
        parameters: { entity: 'hero' }
      },
      {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { entity: 'hero' }
      },
      {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { entity: 'hero' }
      },
      {
        type: 'ESTABLISH_SITTING_CLOSENESS',
        parameters: { entity: 'hero', target_entity: 'companion' }
      },
      {
        type: 'REMOVE_LYING_CLOSENESS',
        parameters: { entity: 'hero' }
      },
      {
        type: 'BREAK_CLOSENESS_WITH_TARGET',
        parameters: { entity: 'hero' }
      },
      {
        type: 'TRANSFER_ITEM',
        parameters: {
          item_id: '{itemId}',
          from_entity: 'hero',
          to_entity: 'companion'
        }
      },
      {
        type: 'DROP_ITEM_AT_LOCATION',
        parameters: {
          item_id: '{itemId}',
          location: '{hero.location}'
        }
      },
      {
        type: 'PICK_UP_ITEM_FROM_LOCATION',
        parameters: {
          item_id: '{itemId}'
        }
      },
      {
        type: 'OPEN_CONTAINER',
        parameters: {
          container_entity: 'treasure_chest'
        }
      },
      {
        type: 'TAKE_FROM_CONTAINER',
        parameters: {
          item_id: '{itemId}'
        }
      },
      {
        type: 'PUT_IN_CONTAINER',
        parameters: {
          container_id: 'treasure_chest',
          item_id: '{itemId}'
        }
      },
      {
        type: 'UNEQUIP_CLOTHING',
        parameters: {
          clothing_id: '{cloakId}'
        }
      },
      {
        type: 'AUTO_MOVE_CLOSENESS_PARTNERS',
        parameters: {}
      }
    ];

    dataRegistry.store('rules', ruleId, {
      id: ruleId,
      modId: 'integration',
      actions: operations
    });

    const warnSpy = jest.spyOn(logger, 'warn');

    const result = analyzer.analyzeRule(ruleId);

    expect(result.effects).toEqual([
      {
        operation: 'ADD_COMPONENT',
        entity: 'hero',
        component: 'custom:buff',
        data: { strength: 1 }
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'hero',
        component: 'custom:debuff'
      },
      {
        operation: 'MODIFY_COMPONENT',
        entity: 'hero',
        component: 'custom:stats',
        updates: { agility: 2 }
      },
      {
        operation: 'MODIFY_COMPONENT',
        entity: 'hero',
        component: 'custom:stats',
        updates: { stamina: 5 }
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'hero',
        component: 'positioning:movement_locked',
        data: {}
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'hero',
        component: 'positioning:movement_locked'
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'hero',
        component: 'positioning:mouth_engagement_locked',
        data: {}
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'hero',
        component: 'positioning:mouth_engagement_locked'
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'hero',
        component: 'positioning:sitting_close_to',
        data: {
          targetId: '{companion.id}'
        }
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'companion',
        component: 'positioning:sitting_close_to',
        data: {
          targetId: '{hero.id}'
        }
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'hero',
        component: 'positioning:lying_close_to'
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'hero',
        component: 'positioning:sitting_close_to'
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'hero',
        component: 'positioning:lying_close_to'
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'hero',
        component: 'items:inventory_item',
        data: { itemId: '{itemId}' }
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'companion',
        component: 'items:inventory_item',
        data: { itemId: '{itemId}' }
      },
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
        data: { location: '{hero.location}' }
      },
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
      },
      {
        operation: 'MODIFY_COMPONENT',
        entity: 'treasure_chest',
        component: 'items:container',
        updates: { isOpen: true }
      },
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
      },
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
        data: { containerId: 'treasure_chest' }
      },
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'clothing:equipped',
        data: { clothingId: '{cloakId}' }
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: '{cloakId}' }
      }
    ]);
    expect(result.cost).toBe(3.6);
    expect(result.abstractPreconditions).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'Unknown or unhandled state-changing operation: AUTO_MOVE_CLOSENESS_PARTNERS'
    );

    warnSpy.mockRestore();
  });

  it('produces conditional effects and abstract preconditions from contextual operations', () => {
    const ruleId = 'integration:conditional_effects';
    const operations = [
      {
        type: 'VALIDATE_INVENTORY_CAPACITY',
        parameters: {
          result_variable: 'inventoryCheck',
          actorId: 'hero',
          itemId: '{itemId}'
        }
      },
      {
        type: 'HAS_COMPONENT',
        parameters: {
          result_variable: 'hasComponent',
          entityId: 'hero',
          componentId: 'items:inventory_item'
        }
      },
      {
        type: 'IF',
        parameters: {
          condition: { var: 'inventoryCheck' },
          then_actions: [
            {
              type: 'IF_CO_LOCATED',
              parameters: {
                entity_a: 'hero',
                entity_b: 'companion',
                then_actions: [
                  {
                    type: 'ESTABLISH_LYING_CLOSENESS',
                    parameters: {
                      entity: 'hero',
                      target_entity: 'companion'
                    }
                  },
                  {
                    type: 'TRANSFER_ITEM',
                    parameters: {
                      item_id: '{itemId}',
                      from_entity: 'hero',
                      to_entity: 'companion'
                    }
                  }
                ],
                else_actions: [
                  {
                    type: 'TAKE_FROM_CONTAINER',
                    parameters: {
                      item_id: '{itemId}'
                    }
                  }
                ]
              }
            }
          ],
          else_actions: [
            {
              type: 'DROP_ITEM_AT_LOCATION',
              parameters: {
                item_id: '{itemId}',
                location: '{hero.location}'
              }
            }
          ]
        }
      }
    ];

    dataRegistry.store('rules', ruleId, {
      id: ruleId,
      modId: 'integration',
      actions: operations
    });

    const result = analyzer.analyzeRule(ruleId);

    expect(result.effects).toEqual([
      {
        operation: 'CONDITIONAL',
        condition: {
          and: [
            { var: 'inventoryCheck' },
            {
              '==': [
                { var: 'hero.location' },
                { var: 'companion.location' }
              ]
            }
          ]
        },
        then: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'hero',
            component: 'positioning:lying_close_to',
            data: {
              targetId: '{companion.id}'
            }
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'companion',
            component: 'positioning:lying_close_to',
            data: {
              targetId: '{hero.id}'
            }
          },
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'hero',
            component: 'items:inventory_item',
            data: { itemId: '{itemId}' }
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'companion',
            component: 'items:inventory_item',
            data: { itemId: '{itemId}' }
          }
        ]
      },
      {
        operation: 'CONDITIONAL',
        condition: {
          and: [
            { var: 'inventoryCheck' },
            {
              not: {
                '==': [
                  { var: 'hero.location' },
                  { var: 'companion.location' }
                ]
              }
            }
          ]
        },
        then: [
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
        ]
      },
      {
        operation: 'CONDITIONAL',
        condition: {
          not: { var: 'inventoryCheck' }
        },
        then: [
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
            data: { location: '{hero.location}' }
          }
        ]
      }
    ]);

    expect(result.cost).toBe(1.6);
    expect(result.abstractPreconditions).toEqual({
      inventoryCheck: {
        description: 'Checks if actor can carry the item',
        parameters: ['actorId', 'itemId'],
        simulationFunction: 'assumeTrue'
      },
      hasComponent: {
        description: 'Checks if entity has component',
        parameters: ['entityId', 'componentId'],
        simulationFunction: 'assumeTrue'
      }
    });
  });

  it('logs and rethrows when a rule contains an invalid operation definition', () => {
    const ruleId = 'integration:invalid_operation';

    dataRegistry.store('rules', ruleId, {
      id: ruleId,
      modId: 'integration',
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity: 'hero',
            component: 'custom:buff',
            data: { strength: 1 }
          }
        },
        {
          parameters: {}
        }
      ]
    });

    const errorSpy = jest.spyOn(logger, 'error');

    expect(() => analyzer.analyzeRule(ruleId)).toThrow('Operation type is required');
    expect(errorSpy).toHaveBeenCalledWith(
      `Failed to analyze rule ${ruleId}`,
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});
