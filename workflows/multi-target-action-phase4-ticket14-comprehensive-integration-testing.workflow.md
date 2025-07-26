# Ticket: Comprehensive Integration Testing

## Ticket ID: PHASE4-TICKET14
## Priority: Medium
## Estimated Time: 8-10 hours
## Dependencies: PHASE4-TICKET13
## Blocks: PHASE5-TICKET15

## Overview

Create comprehensive integration tests that validate the entire multi-target action system works correctly end-to-end. These tests ensure that all components work together properly, validate performance requirements, and provide confidence that the system is ready for production use.

## Goals

1. **End-to-End Validation**: Complete system testing from action definition to execution
2. **Component Integration**: Verify all pipeline stages work together correctly
3. **Performance Validation**: Ensure system meets performance requirements
4. **Edge Case Coverage**: Test boundary conditions and error scenarios
5. **Backward Compatibility**: Validate legacy actions continue to work
6. **Real-World Scenarios**: Test complex realistic gameplay situations

## Test Categories

1. **Full Pipeline Integration**: Complete action processing pipeline
2. **Context Resolution**: Complex dependency chains and edge cases
3. **Performance Testing**: Large-scale scenarios and optimization validation
4. **Error Handling**: Graceful failure and recovery testing
5. **Backward Compatibility**: Legacy action compatibility verification
6. **Cross-Component**: Integration between different system components

## Implementation Steps

### Step 1: Full Pipeline Integration Tests

Create file: `tests/integration/multiTargetActions/fullPipelineIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Multi-Target Action Full Pipeline Integration', () => {
  let testBed;
  let gameEngine;
  let actionCandidateProcessor;
  let eventBus;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    gameEngine = testBed.getService('gameEngine');
    actionCandidateProcessor = testBed.getService('actionCandidateProcessor');
    eventBus = testBed.getService('eventBus');

    // Load all multi-target system components
    testBed.loadMultiTargetSystem();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Complete Processing Pipeline', () => {
    it('should process simple multi-target action from definition to execution', async () => {
      // Setup entities and action definition
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' },
        'core:position': { locationId: 'room_001' },
        'core:stats': { dexterity: 20 },
        'core:inventory': { items: ['rock_001'] }
      });

      const target = testBed.createEntity('guard_001', {
        'core:actor': { name: 'Guard', conscious: true },
        'core:position': { locationId: 'room_001' }
      });

      const rock = testBed.createEntity('rock_001', {
        'core:item': { name: 'Small Rock', throwable: true }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Training Room' },
        'core:actors': ['player', 'guard_001'],
        'core:contents': { items: [] }
      });

      const actionDefinition = {
        id: 'test:throw_item_at_target',
        name: 'throw {item} at {target}',
        category: 'interaction',
        targetDefinitions: {
          item: {
            name: 'item',
            scope: 'actor.core:inventory.items[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'core:item': {
                      type: 'object',
                      properties: {
                        throwable: { type: 'boolean', const: true }
                      },
                      required: ['throwable']
                    }
                  },
                  required: ['core:item']
                }
              }
            }
          },
          target: {
            name: 'target',
            scope: 'location.core:actors[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  not: { const: 'actor.id' }
                }
              }
            }
          }
        },
        conditions: [
          {
            description: 'Actor must have good aim',
            condition: {
              '>=': [{ var: 'actor.components.core:stats.dexterity' }, 15]
            }
          }
        ],
        effects: [
          {
            description: 'Remove item from actor inventory',
            operation: {
              type: 'modifyComponent',
              entityId: 'actor.id',
              componentId: 'core:inventory',
              modifications: {
                items: {
                  operation: 'remove',
                  value: 'item.id'
                }
              }
            }
          },
          {
            description: 'Dispatch throw event',
            operation: {
              type: 'dispatchEvent',
              eventType: 'ITEM_THROWN_AT_TARGET',
              payload: {
                actorId: 'actor.id',
                itemId: 'item.id',
                targetId: 'target.id'
              }
            }
          }
        ],
        command: 'throw {item.components.core:item.name} at {target.components.core:actor.name}',
        result: 'You throw {item.components.core:item.name} at {target.components.core:actor.name}.'
      };

      testBed.loadActionDefinition(actionDefinition);

      // Step 1: Process action candidates
      const candidateResult = await actionCandidateProcessor.process(
        'test:throw_item_at_target',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room_001' },
          game: { turnNumber: 1 }
        }
      );

      expect(candidateResult.success).toBe(true);
      expect(candidateResult.value.actions).toHaveLength(1);

      const action = candidateResult.value.actions[0];
      expect(action.targets.item.id).toBe('rock_001');
      expect(action.targets.target.id).toBe('guard_001');
      expect(action.command).toBe('throw Small Rock at Guard');

      // Step 2: Execute the action
      const eventsSpy = testBed.createEventSpy('ITEM_THROWN_AT_TARGET');
      
      const executionResult = await gameEngine.executeAction(action, 'player');

      expect(executionResult.success).toBe(true);
      expect(executionResult.value.command).toBe('throw Small Rock at Guard');
      expect(executionResult.value.result).toBe('You throw Small Rock at Guard.');

      // Step 3: Verify effects were applied
      const updatedPlayer = testBed.getEntity('player');
      expect(updatedPlayer.getComponent('core:inventory').items).not.toContain('rock_001');

      // Step 4: Verify events were dispatched
      expect(eventsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ITEM_THROWN_AT_TARGET',
          payload: expect.objectContaining({
            actorId: 'player',
            itemId: 'rock_001',
            targetId: 'guard_001'
          })
        })
      );
    });

    it('should process context-dependent action through complete pipeline', async () => {
      // Setup for unlock container with key action
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' },
        'core:position': { locationId: 'dungeon_001' },
        'core:inventory': { items: ['brass_key_001'] }
      });

      const chest = testBed.createEntity('chest_001', {
        'core:object': { name: 'Treasure Chest' },
        'core:position': { locationId: 'dungeon_001' },
        'core:container': {
          locked: true,
          lock_type: 'brass',
          contents: { items: ['treasure_001'] }
        }
      });

      const key = testBed.createEntity('brass_key_001', {
        'core:item': { name: 'Brass Key', durability: 100 },
        'core:key': { types: ['brass', 'iron'] }
      });

      const treasure = testBed.createEntity('treasure_001', {
        'core:item': { name: 'Gold Coin', value: 100 }
      });

      const room = testBed.createEntity('dungeon_001', {
        'core:location': { name: 'Dungeon Room' },
        'core:actors': ['player'],
        'core:objects': ['chest_001']
      });

      const actionDefinition = {
        id: 'test:unlock_container_with_key',
        name: 'unlock {container} with {key}',
        category: 'interaction',
        targetDefinitions: {
          container: {
            name: 'container',
            scope: 'location.core:objects[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'core:container': {
                      type: 'object',
                      properties: {
                        locked: { type: 'boolean', const: true }
                      },
                      required: ['locked']
                    }
                  },
                  required: ['core:container']
                }
              }
            }
          },
          key: {
            name: 'key',
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'container',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'core:key': {
                      type: 'object',
                      properties: {
                        types: {
                          type: 'array',
                          contains: {
                            const: { var: 'target.components.core:container.lock_type' }
                          }
                        }
                      },
                      required: ['types']
                    }
                  },
                  required: ['core:key']
                }
              }
            }
          }
        },
        conditions: [
          {
            description: 'Key must match container lock',
            condition: {
              in: [
                { var: 'container.components.core:container.lock_type' },
                { var: 'key.components.core:key.types' }
              ]
            }
          }
        ],
        effects: [
          {
            description: 'Unlock the container',
            operation: {
              type: 'modifyComponent',
              entityId: 'container.id',
              componentId: 'core:container',
              modifications: {
                locked: false
              }
            }
          },
          {
            description: 'Dispatch unlock event',
            operation: {
              type: 'dispatchEvent',
              eventType: 'CONTAINER_UNLOCKED',
              payload: {
                actorId: 'actor.id',
                containerId: 'container.id',
                keyId: 'key.id'
              }
            }
          }
        ],
        command: 'unlock {container.components.core:object.name} with {key.components.core:item.name}',
        result: 'You successfully unlock {container.components.core:object.name} with {key.components.core:item.name}.'
      };

      testBed.loadActionDefinition(actionDefinition);

      // Process and execute
      const candidateResult = await actionCandidateProcessor.process(
        'test:unlock_container_with_key',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'dungeon_001' },
          game: { turnNumber: 1 }
        }
      );

      expect(candidateResult.success).toBe(true);
      expect(candidateResult.value.actions).toHaveLength(1);

      const action = candidateResult.value.actions[0];
      expect(action.targets.container.id).toBe('chest_001');
      expect(action.targets.key.id).toBe('brass_key_001');

      const eventsSpy = testBed.createEventSpy('CONTAINER_UNLOCKED');
      
      const executionResult = await gameEngine.executeAction(action, 'player');

      expect(executionResult.success).toBe(true);

      // Verify container was unlocked
      const updatedChest = testBed.getEntity('chest_001');
      expect(updatedChest.getComponent('core:container').locked).toBe(false);

      // Verify event was dispatched
      expect(eventsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONTAINER_UNLOCKED',
          payload: expect.objectContaining({
            actorId: 'player',
            containerId: 'chest_001',
            keyId: 'brass_key_001'
          })
        })
      );
    });
  });

  describe('Pipeline Stage Integration', () => {
    it('should correctly pass data between all pipeline stages', async () => {
      const actionDefinition = {
        id: 'test:complex_multi_target',
        name: 'test {primary} with {secondary}',
        targetDefinitions: {
          primary: {
            name: 'primary',
            scope: 'actor.core:inventory.items[]',
            required: true
          },
          secondary: {
            name: 'secondary',
            scope: 'target.core:inventory.items[]',
            contextFrom: 'primary',
            required: true
          }
        },
        conditions: [
          {
            condition: { '!=': [{ var: 'primary.id' }, { var: 'secondary.id' }] }
          }
        ],
        effects: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'COMPLEX_ACTION_EXECUTED',
              payload: {
                primaryId: 'primary.id',
                secondaryId: 'secondary.id'
              }
            }
          }
        ],
        command: 'test {primary.components.core:item.name} with {secondary.components.core:item.name}',
        result: 'Test completed successfully.'
      };

      // Create entities with cross-references
      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['item_a'] }
      });

      const itemA = testBed.createEntity('item_a', {
        'core:item': { name: 'Item A' },
        'core:inventory': { items: ['item_b'] }
      });

      const itemB = testBed.createEntity('item_b', {
        'core:item': { name: 'Item B' }
      });

      testBed.loadActionDefinition(actionDefinition);

      // Process through pipeline
      const result = await actionCandidateProcessor.process(
        'test:complex_multi_target',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);

      const action = result.value.actions[0];
      expect(action.targets.primary.id).toBe('item_a');
      expect(action.targets.secondary.id).toBe('item_b');
      expect(action.command).toBe('test Item A with Item B');
    });
  });

  describe('Error Recovery and Validation', () => {
    it('should handle validation failures gracefully', async () => {
      const actionDefinition = {
        id: 'test:strict_validation',
        name: 'strict {item}',
        targetDefinitions: {
          item: {
            name: 'item',
            scope: 'actor.core:inventory.items[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'core:item': {
                      type: 'object',
                      properties: {
                        special_property: { type: 'boolean', const: true }
                      },
                      required: ['special_property']
                    }
                  },
                  required: ['core:item']
                }
              }
            }
          }
        },
        effects: [],
        command: 'use {item.components.core:item.name}',
        result: 'Used item.'
      };

      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['normal_item'] }
      });

      const normalItem = testBed.createEntity('normal_item', {
        'core:item': { name: 'Normal Item' }
        // Missing special_property
      });

      testBed.loadActionDefinition(actionDefinition);

      const result = await actionCandidateProcessor.process(
        'test:strict_validation',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0); // No valid actions due to validation failure
    });

    it('should handle missing context gracefully', async () => {
      const actionDefinition = {
        id: 'test:missing_context',
        name: 'test {container} {key}',
        targetDefinitions: {
          container: {
            name: 'container',
            scope: 'location.core:objects[]',
            required: true
          },
          key: {
            name: 'key',
            scope: 'target.nonexistent_property[]',
            contextFrom: 'container',
            required: true
          }
        },
        effects: [],
        command: 'test action',
        result: 'Test completed.'
      };

      const player = testBed.createEntity('player', {});
      const container = testBed.createEntity('container_001', {
        'core:object': { name: 'Container' }
      });
      const room = testBed.createEntity('room', {
        'core:objects': ['container_001']
      });

      testBed.loadActionDefinition(actionDefinition);

      const result = await actionCandidateProcessor.process(
        'test:missing_context',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0); // No valid actions due to missing context
    });
  });
});
```

### Step 2: Context Resolution Integration Tests

Create file: `tests/integration/multiTargetActions/contextResolutionIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Context Resolution Integration', () => {
  let testBed;
  let actionCandidateProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionCandidateProcessor = testBed.getService('actionCandidateProcessor');
    testBed.loadMultiTargetSystem();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Complex Context Dependency Chains', () => {
    it('should resolve three-level context dependency chain', async () => {
      const actionDefinition = {
        id: 'test:three_level_context',
        name: 'combine {recipe} {tool} {material}',
        targetDefinitions: {
          recipe: {
            name: 'recipe',
            scope: 'game.recipes[]',
            required: true
          },
          tool: {
            name: 'tool',
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'recipe',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'core:tool': {
                      type: 'object',
                      properties: {
                        craft_types: {
                          type: 'array',
                          contains: { var: 'target.required_tool_type' }
                        }
                      },
                      required: ['craft_types']
                    }
                  },
                  required: ['core:tool']
                }
              }
            }
          },
          material: {
            name: 'material',
            scope: 'targets.tool[0].associated_materials[]',
            contextFrom: 'tool',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'core:material': {
                      type: 'object',
                      properties: {
                        type: { var: 'targets.recipe[0].required_material_type' }
                      },
                      required: ['type']
                    }
                  },
                  required: ['core:material']
                }
              }
            }
          }
        },
        effects: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'THREE_LEVEL_CONTEXT_RESOLVED',
              payload: {
                recipeId: 'recipe.id',
                toolId: 'tool.id',
                materialId: 'material.id'
              }
            }
          }
        ],
        command: 'combine using {tool.components.core:item.name}',
        result: 'Successfully combined items.'
      };

      // Create complex entity structure
      const recipe = testBed.createGameData('recipes', 'sword_recipe', {
        id: 'sword_recipe',
        name: 'Iron Sword Recipe',
        required_tool_type: 'hammer',
        required_material_type: 'metal'
      });

      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['hammer_001'] }
      });

      const hammer = testBed.createEntity('hammer_001', {
        'core:item': { name: 'Blacksmith Hammer' },
        'core:tool': { craft_types: ['hammer', 'metalworking'] },
        'associated_materials': ['iron_ingot_001']
      });

      const ironIngot = testBed.createEntity('iron_ingot_001', {
        'core:item': { name: 'Iron Ingot' },
        'core:material': { type: 'metal', quality: 80 }
      });

      testBed.loadActionDefinition(actionDefinition);

      const result = await actionCandidateProcessor.process(
        'test:three_level_context',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'workshop' },
          game: { 
            recipes: [recipe],
            turnNumber: 1 
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);

      const action = result.value.actions[0];
      expect(action.targets.recipe.id).toBe('sword_recipe');
      expect(action.targets.tool.id).toBe('hammer_001');
      expect(action.targets.material.id).toBe('iron_ingot_001');
    });

    it('should handle circular context dependencies safely', async () => {
      const actionDefinition = {
        id: 'test:circular_context',
        name: 'test {first} {second}',
        targetDefinitions: {
          first: {
            name: 'first',
            scope: 'targets.second[0].related_items[]',
            contextFrom: 'second',
            required: true
          },
          second: {
            name: 'second',
            scope: 'targets.first[0].related_items[]',
            contextFrom: 'first',
            required: true
          }
        },
        effects: [],
        command: 'test action',
        result: 'Test completed.'
      };

      const player = testBed.createEntity('player', {});

      testBed.loadActionDefinition(actionDefinition);

      const result = await actionCandidateProcessor.process(
        'test:circular_context',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      // Should handle circular dependency gracefully
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
    });
  });

  describe('Context Variable Access', () => {
    it('should provide correct context variables at each resolution stage', async () => {
      let contextLog = [];

      // Create custom scope interpreter that logs context access
      const mockScopeInterpreter = {
        async evaluate(scopeExpression, context) {
          contextLog.push({
            scope: scopeExpression,
            availableVariables: Object.keys(context),
            targetVariable: context.target?.id,
            targetsVariable: context.targets ? Object.keys(context.targets) : []
          });

          // Return mock results based on scope
          if (scopeExpression === 'actor.core:inventory.items[]') {
            return ['item_001'];
          } else if (scopeExpression === 'target.associated_items[]') {
            return ['item_002'];
          }
          return [];
        }
      };

      testBed.replaceService('scopeInterpreter', mockScopeInterpreter);

      const actionDefinition = {
        id: 'test:context_variables',
        name: 'test {primary} {secondary}',
        targetDefinitions: {
          primary: {
            name: 'primary',
            scope: 'actor.core:inventory.items[]',
            required: true
          },
          secondary: {
            name: 'secondary',
            scope: 'target.associated_items[]',
            contextFrom: 'primary',
            required: true
          }
        },
        effects: [],
        command: 'test action',
        result: 'Test completed.'
      };

      const player = testBed.createEntity('player', {});
      const item1 = testBed.createEntity('item_001', {
        'associated_items': ['item_002']
      });
      const item2 = testBed.createEntity('item_002', {});

      testBed.loadActionDefinition(actionDefinition);

      await actionCandidateProcessor.process(
        'test:context_variables',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      // Verify context variables were provided correctly
      expect(contextLog).toHaveLength(2);
      
      // First scope evaluation (primary target)
      expect(contextLog[0].availableVariables).toContain('actor');
      expect(contextLog[0].availableVariables).toContain('location');
      expect(contextLog[0].availableVariables).toContain('game');
      expect(contextLog[0].targetVariable).toBeUndefined();
      expect(contextLog[0].targetsVariable).toEqual([]);

      // Second scope evaluation (secondary target with context)
      expect(contextLog[1].availableVariables).toContain('actor');
      expect(contextLog[1].availableVariables).toContain('location');
      expect(contextLog[1].availableVariables).toContain('game');
      expect(contextLog[1].availableVariables).toContain('target');
      expect(contextLog[1].availableVariables).toContain('targets');
      expect(contextLog[1].targetVariable).toBe('item_001');
      expect(contextLog[1].targetsVariable).toContain('primary');
    });
  });
});
```

### Step 3: Performance Integration Tests

Create file: `tests/integration/multiTargetActions/performanceIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Multi-Target Action Performance Integration', () => {
  let testBed;
  let actionCandidateProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionCandidateProcessor = testBed.getService('actionCandidateProcessor');
    testBed.loadMultiTargetSystem();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Large-Scale Processing', () => {
    it('should process actions with many potential targets efficiently', async () => {
      // Create action with potential for many combinations
      const actionDefinition = {
        id: 'test:large_scale_processing',
        name: 'process {items}',
        targetDefinitions: {
          items: {
            name: 'items',
            scope: 'actor.core:inventory.items[]',
            required: true,
            multiple: true,
            maxCombinations: 50,
            validation: {
              type: 'array',
              minItems: 1,
              maxItems: 5
            }
          }
        },
        effects: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'LARGE_SCALE_PROCESSED',
              payload: {
                itemCount: 'items.length'
              }
            }
          }
        ],
        command: 'process {items.length} items',
        result: 'Processed items successfully.'
      };

      // Create large inventory
      const itemIds = Array.from({ length: 100 }, (_, i) => `item_${i}`);
      const player = testBed.createEntity('player', {
        'core:inventory': { items: itemIds }
      });

      // Create all items
      itemIds.forEach((itemId, index) => {
        testBed.createEntity(itemId, {
          'core:item': { name: `Item ${index}`, value: index }
        });
      });

      testBed.loadActionDefinition(actionDefinition);

      const startTime = performance.now();
      
      const result = await actionCandidateProcessor.process(
        'test:large_scale_processing',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Performance requirements
      expect(processingTime).toBeLessThan(500); // Should complete within 500ms
      expect(result.success).toBe(true);
      expect(result.value.actions.length).toBeLessThanOrEqual(50); // Respects maxCombinations
      expect(result.value.actions.length).toBeGreaterThan(0); // Should find some valid combinations
    });

    it('should handle complex context resolution efficiently', async () => {
      const actionDefinition = {
        id: 'test:complex_context_performance',
        name: 'craft {recipe} with {materials}',
        targetDefinitions: {
          recipe: {
            name: 'recipe',
            scope: 'game.recipes[]',
            required: true
          },
          materials: {
            name: 'materials',
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'recipe',
            required: true,
            multiple: true,
            maxCombinations: 20,
            validation: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  components: {
                    type: 'object',
                    properties: {
                      'core:material': {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: { var: 'target.required_material_types' }
                          }
                        },
                        required: ['type']
                      }
                    },
                    required: ['core:material']
                  }
                }
              }
            }
          }
        },
        effects: [],
        command: 'craft with materials',
        result: 'Crafting completed.'
      };

      // Create multiple recipes with different requirements
      const recipes = Array.from({ length: 10 }, (_, i) => ({
        id: `recipe_${i}`,
        name: `Recipe ${i}`,
        required_material_types: ['metal', 'wood', 'cloth'][i % 3]
      }));

      // Create large material inventory
      const materialIds = Array.from({ length: 50 }, (_, i) => `material_${i}`);
      const player = testBed.createEntity('player', {
        'core:inventory': { items: materialIds }
      });

      // Create materials of different types
      materialIds.forEach((materialId, index) => {
        const materialType = ['metal', 'wood', 'cloth'][index % 3];
        testBed.createEntity(materialId, {
          'core:item': { name: `${materialType} Material ${index}` },
          'core:material': { type: materialType, quality: 50 + (index % 50) }
        });
      });

      testBed.loadActionDefinition(actionDefinition);

      const startTime = performance.now();
      
      const result = await actionCandidateProcessor.process(
        'test:complex_context_performance',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'workshop' },
          game: { 
            recipes: recipes,
            turnNumber: 1 
          }
        }
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Performance requirements for complex context resolution
      expect(processingTime).toBeLessThan(300); // Should complete within 300ms
      expect(result.success).toBe(true);
      
      if (result.value.actions.length > 0) {
        expect(result.value.actions.length).toBeLessThanOrEqual(200); // 10 recipes * 20 max combinations
      }
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage during large operations', async () => {
      const actionDefinition = {
        id: 'test:memory_usage',
        name: 'memory test {items}',
        targetDefinitions: {
          items: {
            name: 'items',
            scope: 'actor.core:inventory.items[]',
            required: true,
            multiple: true,
            maxCombinations: 30
          }
        },
        effects: [],
        command: 'memory test',
        result: 'Memory test completed.'
      };

      // Create large dataset
      const itemIds = Array.from({ length: 200 }, (_, i) => `mem_item_${i}`);
      const player = testBed.createEntity('player', {
        'core:inventory': { items: itemIds }
      });

      itemIds.forEach((itemId, index) => {
        testBed.createEntity(itemId, {
          'core:item': { 
            name: `Memory Item ${index}`,
            description: `A test item with index ${index} for memory testing purposes.`,
            properties: Array.from({ length: 10 }, (_, i) => `property_${i}`)
          }
        });
      });

      testBed.loadActionDefinition(actionDefinition);

      // Monitor memory usage
      const memBefore = process.memoryUsage();
      
      const result = await actionCandidateProcessor.process(
        'test:memory_usage',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      const memAfter = process.memoryUsage();
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;

      // Memory usage should be reasonable (less than 50MB increase)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      expect(result.success).toBe(true);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple simultaneous action processing requests', async () => {
      const actionDefinition = {
        id: 'test:concurrent_processing',
        name: 'concurrent {item}',
        targetDefinitions: {
          item: {
            name: 'item',
            scope: 'actor.core:inventory.items[]',
            required: true
          }
        },
        effects: [],
        command: 'process concurrently',
        result: 'Concurrent processing completed.'
      };

      // Create multiple players with items
      const players = Array.from({ length: 5 }, (_, i) => {
        const playerId = `player_${i}`;
        const itemId = `item_${i}`;
        
        testBed.createEntity(playerId, {
          'core:inventory': { items: [itemId] }
        });
        
        testBed.createEntity(itemId, {
          'core:item': { name: `Item ${i}` }
        });
        
        return playerId;
      });

      testBed.loadActionDefinition(actionDefinition);

      // Process actions for all players concurrently
      const startTime = performance.now();
      
      const promises = players.map(playerId => 
        actionCandidateProcessor.process(
          'test:concurrent_processing',
          playerId,
          {
            actor: { id: playerId },
            location: { id: 'room' },
            game: { turnNumber: 1 }
          }
        )
      );

      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.value.actions).toHaveLength(1);
      });

      // Concurrent processing should be efficient
      expect(totalTime).toBeLessThan(200); // Should complete within 200ms
    });
  });
});
```

### Step 4: Backward Compatibility Integration Tests

Create file: `tests/integration/multiTargetActions/backwardCompatibilityIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Backward Compatibility Integration', () => {
  let testBed;
  let actionCandidateProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionCandidateProcessor = testBed.getService('actionCandidateProcessor');
    testBed.loadMultiTargetSystem();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Legacy Action Processing', () => {
    it('should process legacy single-target actions without modification', async () => {
      // Legacy action definition (pre-multi-target)
      const legacyActionDefinition = {
        id: 'legacy:examine_item',
        name: 'examine {item}',
        category: 'interaction',
        scope: 'actor.core:inventory.items[]',
        validation: {
          type: 'object',
          properties: {
            components: {
              type: 'object',
              properties: {
                'core:item': {
                  type: 'object',
                  properties: {
                    examinable: { type: 'boolean', const: true }
                  },
                  required: ['examinable']
                }
              },
              required: ['core:item']
            }
          }
        },
        conditions: [
          {
            description: 'Item must be in good condition',
            condition: {
              '>=': [{ var: 'target.components.core:item.durability' }, 50]
            }
          }
        ],
        effects: [
          {
            description: 'Dispatch examine event',
            operation: {
              type: 'dispatchEvent',
              eventType: 'ITEM_EXAMINED',
              payload: {
                actorId: 'actor.id',
                itemId: 'target.id',
                description: 'target.components.core:item.description'
              }
            }
          }
        ],
        command: 'examine {target.components.core:item.name}',
        result: 'You examine {target.components.core:item.name}. {target.components.core:item.description}'
      };

      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' },
        'core:inventory': { items: ['ancient_scroll'] }
      });

      const scroll = testBed.createEntity('ancient_scroll', {
        'core:item': {
          name: 'Ancient Scroll',
          description: 'A scroll covered in mysterious runes.',
          examinable: true,
          durability: 75
        }
      });

      testBed.loadActionDefinition(legacyActionDefinition);

      const result = await actionCandidateProcessor.process(
        'legacy:examine_item',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'library' },
          game: { turnNumber: 1 }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);

      const action = result.value.actions[0];
      expect(action.actionId).toBe('legacy:examine_item');
      expect(action.command).toBe('examine Ancient Scroll');
      expect(action.result).toContain('A scroll covered in mysterious runes.');
      
      // Legacy actions should have target in legacy format
      expect(action.target).toBeDefined();
      expect(action.target.id).toBe('ancient_scroll');
    });

    it('should handle legacy action execution with legacy event payloads', async () => {
      const legacyActionDefinition = {
        id: 'legacy:use_item',
        name: 'use {item}',
        scope: 'actor.core:inventory.items[]',
        validation: {
          type: 'object',
          properties: {
            components: {
              type: 'object',
              properties: {
                'core:item': {
                  type: 'object',
                  properties: {
                    usable: { type: 'boolean', const: true }
                  },
                  required: ['usable']
                }
              },
              required: ['core:item']
            }
          }
        },
        effects: [
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'target.id',
              componentId: 'core:item',
              modifications: {
                uses_remaining: {
                  operation: 'subtract',
                  value: 1
                }
              }
            }
          },
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'ITEM_USED',
              payload: {
                actorId: 'actor.id',
                itemId: 'target.id',
                usesRemaining: 'target.components.core:item.uses_remaining'
              }
            }
          }
        ],
        command: 'use {target.components.core:item.name}',
        result: 'You use {target.components.core:item.name}.'
      };

      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['healing_potion'] }
      });

      const potion = testBed.createEntity('healing_potion', {
        'core:item': {
          name: 'Healing Potion',
          usable: true,
          uses_remaining: 3
        }
      });

      testBed.loadActionDefinition(legacyActionDefinition);

      // Process legacy action
      const candidateResult = await actionCandidateProcessor.process(
        'legacy:use_item',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      expect(candidateResult.success).toBe(true);
      const action = candidateResult.value.actions[0];

      // Execute the action
      const gameEngine = testBed.getService('gameEngine');
      const eventsSpy = testBed.createEventSpy('ITEM_USED');

      const executionResult = await gameEngine.executeAction(action, 'player');

      expect(executionResult.success).toBe(true);

      // Verify legacy effects were applied
      const updatedPotion = testBed.getEntity('healing_potion');
      expect(updatedPotion.getComponent('core:item').uses_remaining).toBe(2);

      // Verify legacy event payload structure
      expect(eventsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ITEM_USED',
          payload: expect.objectContaining({
            actorId: 'player',
            itemId: 'healing_potion',
            usesRemaining: 2
          })
        })
      );
    });
  });

  describe('Mixed Legacy and Multi-Target Actions', () => {
    it('should process both legacy and multi-target actions in the same system', async () => {
      // Legacy action
      const legacyAction = {
        id: 'legacy:drop_item',
        name: 'drop {item}',
        scope: 'actor.core:inventory.items[]',
        effects: [
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'actor.id',
              componentId: 'core:inventory',
              modifications: {
                items: {
                  operation: 'remove',
                  value: 'target.id'
                }
              }
            }
          }
        ],
        command: 'drop {target.components.core:item.name}',
        result: 'You drop {target.components.core:item.name}.'
      };

      // Multi-target action
      const multiTargetAction = {
        id: 'modern:trade_items',
        name: 'trade {my_item} for {their_item}',
        targetDefinitions: {
          my_item: {
            name: 'my_item',
            scope: 'actor.core:inventory.items[]',
            required: true
          },
          their_item: {
            name: 'their_item',
            scope: 'location.core:actors[0].core:inventory.items[]',
            required: true
          }
        },
        effects: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'TRADE_COMPLETED',
              payload: {
                actorId: 'actor.id',
                myItemId: 'my_item.id',
                theirItemId: 'their_item.id'
              }
            }
          }
        ],
        command: 'trade {my_item.components.core:item.name} for {their_item.components.core:item.name}',
        result: 'Trade completed successfully.'
      };

      // Setup entities
      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['player_item'] }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Merchant' },
        'core:inventory': { items: ['npc_item'] }
      });

      const playerItem = testBed.createEntity('player_item', {
        'core:item': { name: 'Player Item' }
      });

      const npcItem = testBed.createEntity('npc_item', {
        'core:item': { name: 'NPC Item' }
      });

      const room = testBed.createEntity('room', {
        'core:actors': ['npc_001']
      });

      testBed.loadActionDefinition(legacyAction);
      testBed.loadActionDefinition(multiTargetAction);

      // Process legacy action
      const legacyResult = await actionCandidateProcessor.process(
        'legacy:drop_item',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      expect(legacyResult.success).toBe(true);
      expect(legacyResult.value.actions).toHaveLength(1);
      expect(legacyResult.value.actions[0].target?.id).toBe('player_item');

      // Process multi-target action
      const multiTargetResult = await actionCandidateProcessor.process(
        'modern:trade_items',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      expect(multiTargetResult.success).toBe(true);
      expect(multiTargetResult.value.actions).toHaveLength(1);
      expect(multiTargetResult.value.actions[0].targets?.my_item?.id).toBe('player_item');
      expect(multiTargetResult.value.actions[0].targets?.their_item?.id).toBe('npc_item');
    });
  });

  describe('Legacy Rule Integration', () => {
    it('should ensure legacy rules receive compatible event payloads', async () => {
      // Multi-target action that should trigger legacy rule
      const multiTargetAction = {
        id: 'modern:give_item_to_person',
        name: 'give {item} to {person}',
        targetDefinitions: {
          item: {
            name: 'item',
            scope: 'actor.core:inventory.items[]',
            required: true
          },
          person: {
            name: 'person',
            scope: 'location.core:actors[]',
            required: true
          }
        },
        effects: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'ITEM_GIVEN',
              payload: {
                actorId: 'actor.id',
                targetId: 'person.id',
                itemId: 'item.id'
              }
            }
          }
        ],
        command: 'give {item.components.core:item.name} to {person.components.core:actor.name}',
        result: 'Gift given successfully.'
      };

      // Legacy rule that expects legacy event format
      const legacyRule = {
        id: 'legacy:gift_received_rule',
        eventType: 'ITEM_GIVEN',
        conditions: [
          {
            condition: {
              '!=': [{ var: 'payload.actorId' }, { var: 'payload.targetId' }]
            }
          }
        ],
        operations: [
          {
            type: 'modifyComponent',
            entityId: 'payload.targetId',
            componentId: 'social:relationships',
            modifications: {
              'actor_opinion': {
                operation: 'add',
                value: 5
              }
            }
          }
        ]
      };

      // Setup entities
      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['gift_item'] }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Friend' },
        'social:relationships': { actor_opinion: 0 }
      });

      const gift = testBed.createEntity('gift_item', {
        'core:item': { name: 'Gift' }
      });

      const room = testBed.createEntity('room', {
        'core:actors': ['npc_001']
      });

      testBed.loadActionDefinition(multiTargetAction);
      testBed.loadRule(legacyRule);

      // Process and execute multi-target action
      const result = await actionCandidateProcessor.process(
        'modern:give_item_to_person',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 }
        }
      );

      const action = result.value.actions[0];
      const gameEngine = testBed.getService('gameEngine');
      
      await gameEngine.executeAction(action, 'player');

      // Verify legacy rule was triggered and executed
      const updatedNpc = testBed.getEntity('npc_001');
      expect(updatedNpc.getComponent('social:relationships').actor_opinion).toBe(5);
    });
  });
});
```

### Step 5: Cross-Component Integration Tests

Create file: `tests/integration/multiTargetActions/crossComponentIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Cross-Component Integration', () => {
  let testBed;
  let actionCandidateProcessor;
  let gameEngine;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionCandidateProcessor = testBed.getService('actionCandidateProcessor');
    gameEngine = testBed.getService('gameEngine');
    testBed.loadMultiTargetSystem();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Action System Integration', () => {
    it('should integrate with AI memory system for multi-target actions', async () => {
      const actionDefinition = {
        id: 'test:ai_memory_integration',
        name: 'interact with {person} about {topic}',
        targetDefinitions: {
          person: {
            name: 'person',
            scope: 'location.core:actors[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'ai:memory': { type: 'object' }
                  },
                  required: ['ai:memory']
                }
              }
            }
          },
          topic: {
            name: 'topic',
            scope: 'target.ai:memory.known_topics[]',
            contextFrom: 'person',
            required: true
          }
        },
        effects: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'AI_INTERACTION',
              payload: {
                actorId: 'actor.id',
                targetId: 'person.id',
                topic: 'topic.id',
                memoryContext: 'person.components.ai:memory'
              }
            }
          }
        ],
        command: 'discuss {topic.name} with {person.components.core:actor.name}',
        result: 'You discuss {topic.name} with {person.components.core:actor.name}.'
      };

      // Setup entities with AI memory components
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' }
      });

      const scholar = testBed.createEntity('scholar_001', {
        'core:actor': { name: 'Scholar' },
        'ai:memory': {
          known_topics: ['ancient_history', 'magic_theory'],
          personality: 'academic',
          knowledge_level: 8
        }
      });

      const ancientHistoryTopic = testBed.createGameData('topics', 'ancient_history', {
        id: 'ancient_history',
        name: 'Ancient History',
        complexity: 6
      });

      const magicTheoryTopic = testBed.createGameData('topics', 'magic_theory', {
        id: 'magic_theory',
        name: 'Magic Theory',
        complexity: 8
      });

      const room = testBed.createEntity('library', {
        'core:actors': ['scholar_001']
      });

      testBed.loadActionDefinition(actionDefinition);

      const result = await actionCandidateProcessor.process(
        'test:ai_memory_integration',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'library' },
          game: { turnNumber: 1 }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(2); // Two topics available

      const actions = result.value.actions;
      expect(actions.some(a => a.targets.topic.id === 'ancient_history')).toBe(true);
      expect(actions.some(a => a.targets.topic.id === 'magic_theory')).toBe(true);

      // Execute one of the actions
      const eventsSpy = testBed.createEventSpy('AI_INTERACTION');
      
      const executionResult = await gameEngine.executeAction(actions[0], 'player');
      
      expect(executionResult.success).toBe(true);
      expect(eventsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AI_INTERACTION',
          payload: expect.objectContaining({
            actorId: 'player',
            targetId: 'scholar_001',
            memoryContext: expect.objectContaining({
              personality: 'academic',
              knowledge_level: 8
            })
          })
        })
      );
    });

    it('should integrate with clothing system for complex multi-target actions', async () => {
      const actionDefinition = {
        id: 'test:clothing_system_integration',
        name: 'tailor {person} {garment} with {materials}',
        targetDefinitions: {
          person: {
            name: 'person',
            scope: 'location.core:actors[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'clothing:equipment': { type: 'object' }
                  },
                  required: ['clothing:equipment']
                }
              }
            }
          },
          garment: {
            name: 'garment',
            scope: 'target.topmost_clothing[]',
            contextFrom: 'person',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'clothing:garment': {
                      type: 'object',
                      properties: {
                        adjustable: { type: 'boolean', const: true }
                      },
                      required: ['adjustable']
                    }
                  },
                  required: ['clothing:garment']
                }
              }
            }
          },
          materials: {
            name: 'materials',
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'garment',
            required: true,
            multiple: true,
            validation: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  components: {
                    type: 'object',
                    properties: {
                      'tailoring:material': {
                        type: 'object',
                        properties: {
                          fabric_type: { var: 'targets.garment[0].components.clothing:garment.fabric_type' }
                        },
                        required: ['fabric_type']
                      }
                    },
                    required: ['tailoring:material']
                  }
                }
              }
            }
          }
        },
        effects: [
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'garment.id',
              componentId: 'clothing:garment',
              modifications: {
                fit_quality: {
                  operation: 'add',
                  value: 'materials.reduce((sum, m) => sum + m.components.tailoring:material.quality, 0)'
                }
              }
            }
          }
        ],
        command: 'tailor {person.components.core:actor.name} garment with materials',
        result: 'Tailoring completed successfully.'
      };

      // Setup complex clothing system entities
      const tailor = testBed.createEntity('tailor', {
        'core:actor': { name: 'Master Tailor' },
        'core:inventory': { items: ['silk_thread', 'cotton_thread'] }
      });

      const customer = testBed.createEntity('customer_001', {
        'core:actor': { name: 'Customer' },
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'silk_dress' }
          }
        }
      });

      const silkDress = testBed.createEntity('silk_dress', {
        'core:item': { name: 'Silk Dress' },
        'clothing:garment': {
          slot: 'torso_upper',
          layer: 'outer',
          fabric_type: 'silk',
          adjustable: true,
          fit_quality: 60
        }
      });

      const silkThread = testBed.createEntity('silk_thread', {
        'core:item': { name: 'Silk Thread' },
        'tailoring:material': {
          fabric_type: 'silk',
          quality: 15
        }
      });

      const cottonThread = testBed.createEntity('cotton_thread', {
        'core:item': { name: 'Cotton Thread' },
        'tailoring:material': {
          fabric_type: 'cotton',
          quality: 10
        }
      });

      // Mock topmost_clothing scope resolution
      const mockScopeInterpreter = {
        async evaluate(scopeExpression, context) {
          if (scopeExpression === 'target.topmost_clothing[]') {
            return ['silk_dress'];
          } else if (scopeExpression === 'location.core:actors[]') {
            return ['customer_001'];
          } else if (scopeExpression === 'actor.core:inventory.items[]') {
            return ['silk_thread', 'cotton_thread'];
          }
          return [];
        }
      };

      testBed.replaceService('scopeInterpreter', mockScopeInterpreter);

      const shop = testBed.createEntity('tailor_shop', {
        'core:actors': ['customer_001']
      });

      testBed.loadActionDefinition(actionDefinition);

      const result = await actionCandidateProcessor.process(
        'test:clothing_system_integration',
        'tailor',
        {
          actor: { id: 'tailor' },
          location: { id: 'tailor_shop' },
          game: { turnNumber: 1 }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1); // Only silk thread matches fabric type

      const action = result.value.actions[0];
      expect(action.targets.person.id).toBe('customer_001');
      expect(action.targets.garment.id).toBe('silk_dress');
      expect(action.targets.materials.some(m => m.id === 'silk_thread')).toBe(true);
      expect(action.targets.materials.some(m => m.id === 'cotton_thread')).toBe(false);
    });
  });

  describe('Event System Integration', () => {
    it('should integrate with complex event chains triggered by multi-target actions', async () => {
      const actionDefinition = {
        id: 'test:event_chain_integration',
        name: 'combine {item1} {item2} to create {result}',
        targetDefinitions: {
          item1: {
            name: 'item1',
            scope: 'actor.core:inventory.items[]',
            required: true
          },
          item2: {
            name: 'item2',
            scope: 'actor.core:inventory.items[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  not: { const: { var: 'targets.item1[0].id' } }
                }
              }
            }
          },
          result: {
            name: 'result',
            scope: 'game.combination_results[]',
            contextFrom: 'item1,item2',
            required: true,
            validation: {
              type: 'object',
              properties: {
                required_items: {
                  type: 'array',
                  contains: { var: 'targets.item1[0].id' },
                  contains: { var: 'targets.item2[0].id' }
                }
              }
            }
          }
        },
        effects: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'COMBINATION_STARTED',
              payload: {
                actorId: 'actor.id',
                item1Id: 'item1.id',
                item2Id: 'item2.id',
                resultId: 'result.id'
              }
            }
          }
        ],
        command: 'combine items to create {result.name}',
        result: 'Combination process initiated.'
      };

      // Setup combination system
      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['fire_essence', 'water_essence'] }
      });

      const fireEssence = testBed.createEntity('fire_essence', {
        'core:item': { name: 'Fire Essence', element: 'fire' }
      });

      const waterEssence = testBed.createEntity('water_essence', {
        'core:item': { name: 'Water Essence', element: 'water' }
      });

      const steamResult = testBed.createGameData('combination_results', 'steam_essence', {
        id: 'steam_essence',
        name: 'Steam Essence',
        required_items: ['fire_essence', 'water_essence'],
        result_type: 'essence'
      });

      // Mock combination results scope
      const mockScopeInterpreter = {
        async evaluate(scopeExpression, context) {
          if (scopeExpression === 'actor.core:inventory.items[]') {
            return ['fire_essence', 'water_essence'];
          } else if (scopeExpression === 'game.combination_results[]') {
            return ['steam_essence'];
          }
          return [];
        }
      };

      testBed.replaceService('scopeInterpreter', mockScopeInterpreter);

      // Setup event chain rules
      const combinationRule = {
        id: 'combination_processing_rule',
        eventType: 'COMBINATION_STARTED',
        operations: [
          {
            type: 'dispatchEvent',
            eventType: 'COMBINATION_PROCESSING',
            payload: {
              combinationId: 'payload.resultId',
              processingTime: 3000
            }
          }
        ]
      };

      const processingRule = {
        id: 'combination_completion_rule',
        eventType: 'COMBINATION_PROCESSING',
        operations: [
          {
            type: 'dispatchEvent',
            eventType: 'COMBINATION_COMPLETED',
            payload: {
              combinationId: 'payload.combinationId',
              success: true
            }
          }
        ]
      };

      testBed.loadActionDefinition(actionDefinition);
      testBed.loadRule(combinationRule);
      testBed.loadRule(processingRule);

      // Process action
      const result = await actionCandidateProcessor.process(
        'test:event_chain_integration',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'workshop' },
          game: { 
            combination_results: [steamResult],
            turnNumber: 1 
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);

      // Execute action and verify event chain
      const startedSpy = testBed.createEventSpy('COMBINATION_STARTED');
      const processingSpy = testBed.createEventSpy('COMBINATION_PROCESSING');
      const completedSpy = testBed.createEventSpy('COMBINATION_COMPLETED');

      const action = result.value.actions[0];
      await gameEngine.executeAction(action, 'player');

      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'COMBINATION_STARTED',
          payload: expect.objectContaining({
            actorId: 'player',
            item1Id: 'fire_essence',
            item2Id: 'water_essence',
            resultId: 'steam_essence'
          })
        })
      );

      // Allow event chain to process
      await testBed.processEventQueue();

      expect(processingSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalled();
    });
  });
});
```

### Step 6: Test Configuration and Utilities

Create file: `tests/integration/multiTargetActions/testConfiguration.js`

```javascript
/**
 * Test configuration and utilities for multi-target action integration tests
 */

export class MultiTargetTestConfiguration {
  constructor(testBed) {
    this.testBed = testBed;
  }

  /**
   * Load all multi-target system components for testing
   */
  loadMultiTargetSystem() {
    // Load all pipeline stages
    this.loadPipelineStages();
    
    // Load example actions
    this.loadExampleActions();
    
    // Load test schemas
    this.loadTestSchemas();
    
    // Configure test environment
    this.configureTestEnvironment();
  }

  loadPipelineStages() {
    // Implementation would load all pipeline stages
    // This would be implemented based on the actual pipeline architecture
  }

  loadExampleActions() {
    const exampleActions = [
      'data/mods/examples/actions/basic_multi_target.action.json',
      'data/mods/examples/actions/context_dependent.action.json',
      'data/mods/examples/actions/complex_multi_target.action.json',
      'data/mods/examples/actions/performance_optimized.action.json',
      'data/mods/examples/actions/error_safe.action.json'
    ];

    exampleActions.forEach(actionPath => {
      try {
        this.testBed.loadAction(actionPath);
      } catch (error) {
        console.warn(`Failed to load example action: ${actionPath}`, error);
      }
    });
  }

  loadTestSchemas() {
    // Load updated schemas for multi-target support
    this.testBed.loadSchema('data/schemas/action.schema.json');
    this.testBed.loadSchema('data/schemas/target-context.schema.json');
  }

  configureTestEnvironment() {
    // Set test-specific configuration
    const config = this.testBed.getService('configuration');
    config.set('multiTarget.maxCombinations', 100);
    config.set('multiTarget.enablePerformanceLogging', true);
    config.set('multiTarget.contextResolutionTimeout', 5000);
  }

  /**
   * Create a performance test scenario with large datasets
   */
  createPerformanceTestScenario(entityCount = 100) {
    const entities = [];
    
    // Create large number of entities for performance testing
    for (let i = 0; i < entityCount; i++) {
      const entityId = `perf_entity_${i}`;
      const entity = this.testBed.createEntity(entityId, {
        'core:item': {
          name: `Performance Item ${i}`,
          value: i * 10,
          category: ['weapon', 'armor', 'consumable'][i % 3]
        },
        'core:material': {
          type: ['metal', 'wood', 'cloth'][i % 3],
          quality: 50 + (i % 50)
        }
      });
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Create a complex context dependency scenario
   */
  createComplexContextScenario() {
    // Create interconnected entities for context testing
    const player = this.testBed.createEntity('context_player', {
      'core:inventory': { items: ['tool_001', 'material_001', 'material_002'] }
    });

    const tool = this.testBed.createEntity('tool_001', {
      'core:item': { name: 'Complex Tool' },
      'core:tool': { 
        craft_types: ['advanced'],
        compatible_materials: ['rare_metal', 'crystal']
      },
      'associated_recipes': ['complex_recipe_001']
    });

    const material1 = this.testBed.createEntity('material_001', {
      'core:item': { name: 'Rare Metal' },
      'core:material': { type: 'rare_metal', quality: 90 }
    });

    const material2 = this.testBed.createEntity('material_002', {
      'core:item': { name: 'Crystal Shard' },
      'core:material': { type: 'crystal', quality: 85 }
    });

    const recipe = this.testBed.createGameData('recipes', 'complex_recipe_001', {
      id: 'complex_recipe_001',
      name: 'Complex Crafting Recipe',
      required_tool_types: ['advanced'],
      required_materials: [
        { type: 'rare_metal', minimum_quality: 80 },
        { type: 'crystal', minimum_quality: 75 }
      ],
      result_item: 'masterwork_item'
    });

    return { player, tool, material1, material2, recipe };
  }

  /**
   * Create event spies for integration testing
   */
  createEventSpies() {
    const eventTypes = [
      'MULTI_TARGET_ACTION_PROCESSED',
      'CONTEXT_RESOLUTION_COMPLETED',
      'TARGET_VALIDATION_FAILED',
      'PERFORMANCE_THRESHOLD_EXCEEDED',
      'BACKWARD_COMPATIBILITY_WARNING'
    ];

    const spies = {};
    eventTypes.forEach(eventType => {
      spies[eventType] = this.testBed.createEventSpy(eventType);
    });

    return spies;
  }

  /**
   * Verify performance metrics meet requirements
   */
  verifyPerformanceMetrics(metrics, requirements = {}) {
    const defaultRequirements = {
      maxProcessingTime: 500, // ms
      maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
      maxCombinations: 100,
      minSuccessRate: 0.95
    };

    const finalRequirements = { ...defaultRequirements, ...requirements };

    const results = {
      processingTime: metrics.processingTime <= finalRequirements.maxProcessingTime,
      memoryUsage: metrics.memoryIncrease <= finalRequirements.maxMemoryIncrease,
      combinationLimit: metrics.combinationsGenerated <= finalRequirements.maxCombinations,
      successRate: metrics.successRate >= finalRequirements.minSuccessRate
    };

    const allPassed = Object.values(results).every(result => result);

    return {
      passed: allPassed,
      results,
      metrics,
      requirements: finalRequirements
    };
  }
}

/**
 * Integration test utilities
 */
export class IntegrationTestUtils {
  static async measurePerformance(testFunction) {
    const memBefore = process.memoryUsage();
    const startTime = performance.now();

    const result = await testFunction();

    const endTime = performance.now();
    const memAfter = process.memoryUsage();

    return {
      result,
      metrics: {
        processingTime: endTime - startTime,
        memoryIncrease: memAfter.heapUsed - memBefore.heapUsed
      }
    };
  }

  static createStressTestScenario(complexity = 'medium') {
    const scenarios = {
      low: { entityCount: 50, maxCombinations: 20, contextDepth: 2 },
      medium: { entityCount: 100, maxCombinations: 50, contextDepth: 3 },
      high: { entityCount: 200, maxCombinations: 100, contextDepth: 4 },
      extreme: { entityCount: 500, maxCombinations: 200, contextDepth: 5 }
    };

    return scenarios[complexity] || scenarios.medium;
  }

  static validateSystemIntegrity(testBed) {
    const services = [
      'actionCandidateProcessor',
      'gameEngine',
      'eventBus',
      'scopeInterpreter',
      'entityManager',
      'schemaValidator'
    ];

    const serviceStatus = {};
    services.forEach(serviceName => {
      try {
        const service = testBed.getService(serviceName);
        serviceStatus[serviceName] = service !== null && service !== undefined;
      } catch (error) {
        serviceStatus[serviceName] = false;
      }
    });

    const allServicesAvailable = Object.values(serviceStatus).every(status => status);

    return {
      healthy: allServicesAvailable,
      services: serviceStatus
    };
  }
}
```

## Acceptance Criteria

1. ✅ Full pipeline integration tests validate end-to-end processing
2. ✅ Context resolution tests verify complex dependency handling
3. ✅ Performance tests ensure system meets speed and memory requirements
4. ✅ Error handling tests verify graceful failure and recovery
5. ✅ Backward compatibility tests ensure legacy actions continue working
6. ✅ Cross-component tests verify integration with other systems
7. ✅ Event system integration tests validate complex event chains
8. ✅ Test utilities provide comprehensive testing infrastructure
9. ✅ All tests have clear performance benchmarks and validation
10. ✅ Test coverage includes edge cases and boundary conditions

## Documentation Requirements

### For Developers
- Test execution guidelines and setup instructions
- Performance benchmarking procedures and thresholds
- Integration testing best practices and patterns
- Debugging guides for test failures and system issues

### For QA Teams
- Test coverage reports and validation procedures
- Performance regression testing protocols
- Cross-browser and environment testing procedures
- User acceptance testing scenarios

## Future Enhancements

1. **Automated Performance Regression Testing**: Continuous monitoring of performance metrics
2. **Load Testing**: Simulate realistic gameplay scenarios with multiple concurrent players
3. **Chaos Engineering**: Test system resilience under failure conditions
4. **Cross-Platform Testing**: Validate behavior across different browsers and devices
5. **Performance Profiling**: Detailed analysis of bottlenecks and optimization opportunities