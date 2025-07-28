/**
 * @file Backward Compatibility Integration Tests
 * @description Tests ensuring legacy single-target actions continue to work with the multi-target system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('Backward Compatibility Integration', () => {
  let entityTestBed;
  let facades;
  let actionServiceFacade;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    entityTestBed = new EntityManagerTestBed();
    const testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create facades
    facades = createMockFacades({}, jest.fn);
    actionServiceFacade = facades.actionService;
    mockEventBus = facades.mockDeps.entity.eventBus;
  });

  afterEach(() => {
    entityTestBed.cleanup();
    actionServiceFacade.clearMockData();
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
                    examinable: { type: 'boolean', const: true },
                  },
                  required: ['examinable'],
                },
              },
              required: ['core:item'],
            },
          },
        },
        prerequisites: [
          {
            description: 'Item must be in good condition',
            logic: {
              '>=': [{ var: 'target.components.core:item.durability' }, 50],
            },
          },
        ],
        operations: [
          {
            description: 'Dispatch examine event',
            operation: {
              type: 'dispatchEvent',
              eventType: 'ITEM_EXAMINED',
              payload: {
                actorId: 'actor.id',
                itemId: 'target.id',
                description: 'target.components.core:item.description',
              },
            },
          },
        ],
        template: 'examine {target.components.core:item.name}',
      };

      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:actor': { name: 'Player' },
          'core:inventory': { items: ['ancient_scroll'] },
        },
      });

      const scrollEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'ancient_scroll',
        overrides: {
          'core:item': {
            name: 'Ancient Scroll',
            description: 'A scroll covered in mysterious runes.',
            examinable: true,
            durability: 75,
          },
        },
      });

      // Mock discovery to return legacy format action
      const mockDiscoveryResult = [
        {
          actionId: legacyActionDefinition.id,
          // Legacy format with single target
          target: {
            id: 'ancient_scroll',
            displayName: 'Ancient Scroll',
          },
          command: 'examine Ancient Scroll',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(1);
      expect(availableActions[0].actionId).toBe('legacy:examine_item');
      expect(availableActions[0].command).toBe('examine Ancient Scroll');

      // Legacy actions should have target in legacy format
      expect(availableActions[0].target).toBeDefined();
      expect(availableActions[0].target.id).toBe('ancient_scroll');

      // Should not have multi-target format
      expect(availableActions[0].targets).toBeUndefined();
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
                    usable: { type: 'boolean', const: true },
                  },
                  required: ['usable'],
                },
              },
              required: ['core:item'],
            },
          },
        },
        operations: [
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'target.id',
              componentId: 'core:item',
              modifications: {
                uses_remaining: {
                  operation: 'subtract',
                  value: 1,
                },
              },
            },
          },
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'ITEM_USED',
              payload: {
                actorId: 'actor.id',
                itemId: 'target.id',
                usesRemaining: 'target.components.core:item.uses_remaining',
              },
            },
          },
        ],
        template: 'use {target.components.core:item.name}',
      };

      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['healing_potion'] },
        },
      });

      const potionEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'healing_potion',
        overrides: {
          'core:item': {
            name: 'Healing Potion',
            usable: true,
            uses_remaining: 3,
          },
        },
      });

      // Mock discovery with legacy action
      actionServiceFacade.setMockActions('player', [
        {
          actionId: legacyActionDefinition.id,
          target: { id: 'healing_potion', displayName: 'Healing Potion' },
          command: 'use Healing Potion',
          available: true,
        },
      ]);

      // Mock validation to pass
      actionServiceFacade.setMockValidation(
        'player',
        legacyActionDefinition.id,
        {
          success: true,
          validatedAction: {
            actionId: legacyActionDefinition.id,
            actorId: 'player',
            target: { id: 'healing_potion' },
          },
        }
      );

      // Mock execution result
      const mockExecutionResult = {
        success: true,
        effects: [
          'Item healing_potion uses_remaining reduced by 1',
          'Dispatched ITEM_USED event',
        ],
        description: 'You use Healing Potion.',
        command: 'use Healing Potion',
      };

      jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      // Execute the legacy action
      const executionResult = await actionServiceFacade.executeAction({
        actionId: legacyActionDefinition.id,
        actorId: 'player',
        targets: { target: { id: 'healing_potion' } }, // Legacy format
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.effects).toContain(
        'Item healing_potion uses_remaining reduced by 1'
      );
      expect(executionResult.effects).toContain('Dispatched ITEM_USED event');
    });
  });

  describe('Mixed Legacy and Multi-Target Actions', () => {
    it('should process both legacy and multi-target actions in the same system', async () => {
      // Legacy action
      const legacyAction = {
        id: 'legacy:drop_item',
        name: 'drop {item}',
        scope: 'actor.core:inventory.items[]',
        operations: [
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'actor.id',
              componentId: 'core:inventory',
              modifications: {
                items: {
                  operation: 'remove',
                  value: 'target.id',
                },
              },
            },
          },
        ],
        template: 'drop {target.components.core:item.name}',
      };

      // Multi-target action
      const multiTargetAction = {
        id: 'modern:trade_items',
        name: 'trade {my_item} for {their_item}',
        targets: {
          my_item: {
            name: 'my_item',
            scope: 'actor.core:inventory.items[]',
            required: true,
          },
          their_item: {
            name: 'their_item',
            scope: 'location.core:actors[0].core:inventory.items[]',
            required: true,
          },
        },
        operations: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'TRADE_COMPLETED',
              payload: {
                actorId: 'actor.id',
                myItemId: 'my_item.id',
                theirItemId: 'their_item.id',
              },
            },
          },
        ],
        template:
          'trade {my_item.components.core:item.name} for {their_item.components.core:item.name}',
      };

      // Setup entities
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['player_item'] },
        },
      });

      const npcEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'npc_001',
        overrides: {
          'core:actor': { name: 'Merchant' },
          'core:inventory': { items: ['npc_item'] },
        },
      });

      const playerItemEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'player_item',
        overrides: {
          'core:item': { name: 'Player Item' },
        },
      });

      const npcItemEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'npc_item',
        overrides: {
          'core:item': { name: 'NPC Item' },
        },
      });

      const roomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'room',
        overrides: {
          'core:actors': ['npc_001'],
        },
      });

      // Mock discovery returning both legacy and multi-target actions
      const mockDiscoveryResult = [
        // Legacy action
        {
          actionId: legacyAction.id,
          target: { id: 'player_item', displayName: 'Player Item' },
          command: 'drop Player Item',
          available: true,
        },
        // Multi-target action
        {
          actionId: multiTargetAction.id,
          targets: {
            my_item: { id: 'player_item', displayName: 'Player Item' },
            their_item: { id: 'npc_item', displayName: 'NPC Item' },
          },
          command: 'trade Player Item for NPC Item',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(2);

      // Verify legacy action format
      const legacyActionResult = availableActions.find(
        (a) => a.actionId === 'legacy:drop_item'
      );
      expect(legacyActionResult).toBeDefined();
      expect(legacyActionResult.target).toBeDefined();
      expect(legacyActionResult.target.id).toBe('player_item');
      expect(legacyActionResult.targets).toBeUndefined();

      // Verify multi-target action format
      const multiTargetResult = availableActions.find(
        (a) => a.actionId === 'modern:trade_items'
      );
      expect(multiTargetResult).toBeDefined();
      expect(multiTargetResult.targets).toBeDefined();
      expect(multiTargetResult.targets.my_item.id).toBe('player_item');
      expect(multiTargetResult.targets.their_item.id).toBe('npc_item');
      expect(multiTargetResult.target).toBeUndefined();
    });
  });

  describe('Legacy Rule Integration', () => {
    it('should ensure legacy rules receive compatible event payloads', async () => {
      // Multi-target action that should trigger legacy rule
      const multiTargetAction = {
        id: 'modern:give_item_to_person',
        name: 'give {item} to {person}',
        targets: {
          item: {
            name: 'item',
            scope: 'actor.core:inventory.items[]',
            required: true,
          },
          person: {
            name: 'person',
            scope: 'location.core:actors[]',
            required: true,
          },
        },
        operations: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'ITEM_GIVEN',
              payload: {
                actorId: 'actor.id',
                targetId: 'person.id',
                itemId: 'item.id',
              },
            },
          },
        ],
        template:
          'give {item.components.core:item.name} to {person.components.core:actor.name}',
      };

      // Legacy rule that expects legacy event format
      const legacyRule = {
        id: 'legacy:gift_received_rule',
        eventType: 'ITEM_GIVEN',
        prerequisites: [
          {
            logic: {
              '!=': [{ var: 'payload.actorId' }, { var: 'payload.targetId' }],
            },
          },
        ],
        operations: [
          {
            type: 'modifyComponent',
            entityId: 'payload.targetId',
            componentId: 'social:relationships',
            modifications: {
              actor_opinion: {
                operation: 'add',
                value: 5,
              },
            },
          },
        ],
      };

      // Setup entities
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['gift_item'] },
        },
      });

      const npcEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'npc_001',
        overrides: {
          'core:actor': { name: 'Friend' },
          'social:relationships': { actor_opinion: 0 },
        },
      });

      const giftEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'gift_item',
        overrides: {
          'core:item': { name: 'Gift' },
        },
      });

      const roomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'room',
        overrides: {
          'core:actors': ['npc_001'],
        },
      });

      // Mock discovery
      actionServiceFacade.setMockActions('player', [
        {
          actionId: multiTargetAction.id,
          targets: {
            item: { id: 'gift_item', displayName: 'Gift' },
            person: { id: 'npc_001', displayName: 'Friend' },
          },
          command: 'give Gift to Friend',
          available: true,
        },
      ]);

      // Mock validation
      actionServiceFacade.setMockValidation('player', multiTargetAction.id, {
        success: true,
        validatedAction: {
          actionId: multiTargetAction.id,
          actorId: 'player',
          targets: {
            item: { id: 'gift_item' },
            person: { id: 'npc_001' },
          },
        },
      });

      // Mock execution with event dispatch
      const mockExecutionResult = {
        success: true,
        effects: ['Dispatched ITEM_GIVEN event'],
        description: 'Gift given successfully.',
        command: 'give Gift to Friend',
        events: [
          {
            type: 'ITEM_GIVEN',
            payload: {
              actorId: 'player',
              targetId: 'npc_001',
              itemId: 'gift_item',
            },
          },
        ],
      };

      jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      const executionResult = await actionServiceFacade.executeAction({
        actionId: multiTargetAction.id,
        actorId: 'player',
        targets: {
          item: { id: 'gift_item' },
          person: { id: 'npc_001' },
        },
      });

      expect(executionResult.success).toBe(true);

      // Verify event was dispatched with legacy-compatible format
      expect(executionResult.events).toBeDefined();
      expect(executionResult.events[0].type).toBe('ITEM_GIVEN');
      expect(executionResult.events[0].payload).toEqual({
        actorId: 'player',
        targetId: 'npc_001',
        itemId: 'gift_item',
      });
    });

    it('should support legacy prerequisite format in multi-target actions', async () => {
      // Multi-target action using legacy prerequisite format
      const hybridAction = {
        id: 'hybrid:complex_action',
        name: 'perform {action} on {target}',
        targets: {
          action: {
            name: 'action',
            scope: 'game.actions[]',
            required: true,
          },
          target: {
            name: 'target',
            scope: 'location.core:objects[]',
            required: true,
          },
        },
        // Legacy prerequisite format
        prerequisites: [
          {
            description: 'Actor must have sufficient skill',
            logic: {
              '>=': [{ var: 'actor.components.core:stats.skill' }, 10],
            },
          },
          {
            description: 'Target must be accessible',
            logic: {
              '==': [{ var: 'target.components.core:object.accessible' }, true],
            },
          },
        ],
        operations: [],
        template: 'perform {action.name} on {target.name}',
      };

      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:stats': { skill: 15 },
        },
      });

      const objectEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'object_001',
        overrides: {
          'core:object': { name: 'Test Object', accessible: true },
        },
      });

      // Mock validation that checks legacy prerequisites
      actionServiceFacade.setMockValidation('player', hybridAction.id, {
        success: true,
        validatedAction: {
          actionId: hybridAction.id,
          actorId: 'player',
          targets: {
            action: { id: 'test_action' },
            target: { id: 'object_001' },
          },
        },
        prerequisiteResults: [
          { passed: true, description: 'Actor must have sufficient skill' },
          { passed: true, description: 'Target must be accessible' },
        ],
      });

      const validationResult = await actionServiceFacade.validateAction({
        actionId: hybridAction.id,
        actorId: 'player',
        targets: {
          action: { id: 'test_action' },
          target: { id: 'object_001' },
        },
      });

      expect(validationResult.success).toBe(true);
      expect(validationResult.prerequisiteResults).toHaveLength(2);
      expect(validationResult.prerequisiteResults[0].passed).toBe(true);
      expect(validationResult.prerequisiteResults[1].passed).toBe(true);
    });
  });

  describe('Legacy Format Conversion', () => {
    it('should handle actions with mixed legacy and multi-target formats', async () => {
      // Action that uses both old and new formats
      const mixedFormatAction = {
        id: 'mixed:format_action',
        name: 'mixed format test',
        // Legacy scope property
        scope: 'actor.core:inventory.items[]',
        // New targets property
        targets: {
          primary: {
            name: 'primary',
            scope: 'actor.core:inventory.items[]',
            required: true,
          },
        },
        // Should prioritize targets over scope
        operations: [],
        template: 'test {primary.name}',
      };

      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['test_item'] },
        },
      });

      const itemEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'test_item',
        overrides: {
          'core:item': { name: 'Test Item' },
        },
      });

      // Mock discovery that handles format conversion
      actionServiceFacade.setMockActions('player', [
        {
          actionId: mixedFormatAction.id,
          // Should use multi-target format when targets defined
          targets: {
            primary: { id: 'test_item', displayName: 'Test Item' },
          },
          command: 'test Test Item',
          available: true,
        },
      ]);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(1);
      // Should use targets format, not legacy target
      expect(availableActions[0].targets).toBeDefined();
      expect(availableActions[0].targets.primary.id).toBe('test_item');
      expect(availableActions[0].target).toBeUndefined();
    });
  });
});
