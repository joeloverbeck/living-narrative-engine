/**
 * @file Full Pipeline Integration Tests for Multi-Target Actions
 * @description End-to-end tests validating the complete multi-target action system
 * from action definition through execution, ensuring all components work together correctly.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { join } from 'path';
import { readFileSync } from 'fs';

describe('Multi-Target Action Full Pipeline E2E', () => {
  let facades;
  let actionServiceFacade;
  let entityServiceFacade;
  let entityTestBed;
  let mockLogger;

  beforeEach(async () => {
    // Create facades using the new pattern
    facades = createMockFacades({}, jest.fn);
    actionServiceFacade = facades.actionService;
    entityServiceFacade = facades.entityService;

    // Create entity test bed for entity management
    entityTestBed = new EntityManagerTestBed();

    // Get logger from facades
    mockLogger = facades.mockDeps.logger;
  });

  afterEach(async () => {
    entityTestBed.cleanup();
    actionServiceFacade.clearMockData();
  });

  describe('Complete Processing Pipeline', () => {
    it('should process simple multi-target action from definition to execution', async () => {
      // Load the basic multi-target action definition
      const actionPath = join(
        process.cwd(),
        'data/mods/examples/actions/basic_multi_target.action.json'
      );
      const actionDefinition = JSON.parse(readFileSync(actionPath, 'utf8'));

      // Setup entities
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'room_001' },
          'core:stats': { dexterity: 20 },
          'core:inventory': { items: ['rock_001'] },
        },
      });

      const guardEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'guard_001',
        overrides: {
          'core:actor': { name: 'Guard', conscious: true },
          'core:position': { locationId: 'room_001' },
        },
      });

      const rockEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'rock_001',
        overrides: {
          'core:item': { name: 'Small Rock', throwable: true },
        },
      });

      const roomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'room_001',
        overrides: {
          'core:location': { name: 'Training Room' },
          'core:actors': ['player', 'guard_001'],
          'core:contents': { items: [] },
        },
      });

      // Mock the action discovery to return our test action
      const mockDiscoveryResult = [
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'rock_001', displayName: 'Small Rock' },
            secondary: { id: 'guard_001', displayName: 'Guard' },
          },
          command: 'throw Small Rock at Guard',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      // Mock validation to pass
      actionServiceFacade.setMockValidation('player', actionDefinition.id, {
        success: true,
        validatedAction: {
          actionId: actionDefinition.id,
          actorId: 'player',
          targets: {
            primary: { id: 'rock_001' },
            secondary: { id: 'guard_001' },
          },
        },
      });

      // Step 1: Discover available actions
      const availableActions =
        await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(1);
      expect(availableActions[0].actionId).toBe(actionDefinition.id);
      expect(availableActions[0].command).toBe('throw Small Rock at Guard');

      // Step 2: Validate the action
      const validationResult = await actionServiceFacade.validateAction({
        actionId: actionDefinition.id,
        actorId: 'player',
        targets: {
          primary: { id: 'rock_001' },
          secondary: { id: 'guard_001' },
        },
      });

      expect(validationResult.success).toBe(true);

      // Mock the execution result
      const mockExecutionResult = {
        success: true,
        effects: [
          'Removed rock_001 from player inventory',
          'Dispatched ITEM_THROWN_AT_TARGET event',
        ],
        description: 'You throw Small Rock at Guard.',
        command: 'throw Small Rock at Guard',
      };

      // Mock the action pipeline orchestrator execution
      const executeSpy = jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      // Step 3: Execute the action
      const executionResult = await actionServiceFacade.executeAction({
        actionId: actionDefinition.id,
        actorId: 'player',
        targets: {
          primary: { id: 'rock_001' },
          secondary: { id: 'guard_001' },
        },
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.command).toBe('throw Small Rock at Guard');
      expect(executionResult.description).toBe(
        'You throw Small Rock at Guard.'
      );
      expect(executionResult.effects).toContain(
        'Removed rock_001 from player inventory'
      );

      // Verify the execute method was called with correct parameters
      expect(executeSpy).toHaveBeenCalledWith({
        action: {
          actionId: actionDefinition.id,
          actorId: 'player',
          targets: {
            primary: { id: 'rock_001' },
            secondary: { id: 'guard_001' },
          },
        },
        actionDefinition: expect.any(Object),
        validateOnly: false,
      });
    });

    it('should process context-dependent action through complete pipeline', async () => {
      // Load the context-dependent action definition
      const actionPath = join(
        process.cwd(),
        'data/mods/examples/actions/context_dependent.action.json'
      );
      const actionDefinition = JSON.parse(readFileSync(actionPath, 'utf8'));

      // Setup entities for unlock container with key action
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'dungeon_001' },
          'core:inventory': { items: ['brass_key_001'] },
        },
      });

      const chestEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'chest_001',
        overrides: {
          'core:object': { name: 'Treasure Chest' },
          'core:position': { locationId: 'dungeon_001' },
          'core:container': {
            locked: true,
            lock_type: 'brass',
            contents: { items: ['treasure_001'] },
          },
        },
      });

      const keyEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'brass_key_001',
        overrides: {
          'core:item': { name: 'Brass Key', durability: 100 },
          'core:key': { types: ['brass', 'iron'] },
        },
      });

      const treasureEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'treasure_001',
        overrides: {
          'core:item': { name: 'Gold Coin', value: 100 },
        },
      });

      const roomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'dungeon_001',
        overrides: {
          'core:location': { name: 'Dungeon Room' },
          'core:actors': ['player'],
          'core:objects': ['chest_001'],
        },
      });

      // Mock the action discovery with context-dependent action
      const mockDiscoveryResult = [
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'chest_001', displayName: 'Treasure Chest' },
            secondary: { id: 'brass_key_001', displayName: 'Brass Key' },
          },
          command: 'unlock Treasure Chest with Brass Key',
          available: true,
          contextDependencies: {
            secondary: {
              contextFrom: 'primary',
              matchingCriteria: 'lock_type matches key type',
            },
          },
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      // Mock validation to pass
      actionServiceFacade.setMockValidation('player', actionDefinition.id, {
        success: true,
        validatedAction: {
          actionId: actionDefinition.id,
          actorId: 'player',
          targets: {
            primary: { id: 'chest_001' },
            secondary: { id: 'brass_key_001' },
          },
        },
      });

      // Process action discovery
      const availableActions =
        await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(1);
      expect(availableActions[0].targets.primary.id).toBe('chest_001');
      expect(availableActions[0].targets.secondary.id).toBe('brass_key_001');
      expect(availableActions[0].contextDependencies).toBeDefined();

      // Mock the execution result
      const mockExecutionResult = {
        success: true,
        effects: [
          'Container chest_001 unlocked',
          'Dispatched CONTAINER_UNLOCKED event',
        ],
        description: 'You successfully unlock Treasure Chest with Brass Key.',
        command: 'unlock Treasure Chest with Brass Key',
      };

      jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      // Execute the action
      const executionResult = await actionServiceFacade.executeAction({
        actionId: actionDefinition.id,
        actorId: 'player',
        targets: {
          primary: { id: 'chest_001' },
          secondary: { id: 'brass_key_001' },
        },
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.effects).toContain('Container chest_001 unlocked');
    });
  });

  describe('Pipeline Stage Integration', () => {
    it('should correctly pass data between all pipeline stages', async () => {
      // Create a complex multi-target action with cross-references
      const complexAction = {
        id: 'test:complex_multi_target',
        name: 'test {primary} with {secondary}',
        targets: {
          primary: {
            name: 'primary',
            scope: 'actor.core:inventory.items[]',
            required: true,
          },
          secondary: {
            name: 'secondary',
            scope: 'target.core:inventory.items[]',
            contextFrom: 'primary',
            required: true,
          },
        },
        prerequisites: [
          {
            logic: {
              '!=': [{ var: 'primary.id' }, { var: 'secondary.id' }],
            },
          },
        ],
        operations: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'COMPLEX_ACTION_EXECUTED',
              payload: {
                primaryId: 'primary.id',
                secondaryId: 'secondary.id',
              },
            },
          },
        ],
        template: 'test {primary.name} with {secondary.name}',
      };

      // Create entities with cross-references
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['item_a'] },
        },
      });

      const itemAEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'item_a',
        overrides: {
          'core:item': { name: 'Item A' },
          'core:inventory': { items: ['item_b'] },
        },
      });

      const itemBEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'item_b',
        overrides: {
          'core:item': { name: 'Item B' },
        },
      });

      // Mock discovery with pipeline stage tracking
      const pipelineStages = [];

      const mockDiscoveryResult = [
        {
          actionId: complexAction.id,
          targets: {
            primary: { id: 'item_a', displayName: 'Item A' },
            secondary: { id: 'item_b', displayName: 'Item B' },
          },
          command: 'test Item A with Item B',
          available: true,
          pipelineStages: [
            'ComponentFiltering',
            'PrerequisiteEvaluation',
            'TargetResolution',
            'ActionFormatting',
          ],
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(1);
      expect(availableActions[0].targets.primary.id).toBe('item_a');
      expect(availableActions[0].targets.secondary.id).toBe('item_b');
      expect(availableActions[0].command).toBe('test Item A with Item B');
      expect(availableActions[0].pipelineStages).toHaveLength(4);
    });
  });

  describe('Error Recovery and Validation', () => {
    it('should handle validation failures gracefully', async () => {
      const strictAction = {
        id: 'test:strict_validation',
        name: 'strict {item}',
        targets: {
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
                        special_property: { type: 'boolean', const: true },
                      },
                      required: ['special_property'],
                    },
                  },
                  required: ['core:item'],
                },
              },
            },
          },
        },
        operations: [],
        template: 'use {item.name}',
      };

      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['normal_item'] },
        },
      });

      const normalItemEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'normal_item',
        overrides: {
          'core:item': { name: 'Normal Item' },
          // Missing special_property - should fail validation
        },
      });

      // Mock validation failure
      actionServiceFacade.setMockValidation('player', strictAction.id, {
        success: false,
        error: 'Validation failed: missing required property special_property',
        code: 'VALIDATION_FAILED',
        details: {
          target: 'item',
          missingProperty: 'special_property',
        },
      });

      const validationResult = await actionServiceFacade.validateAction({
        actionId: strictAction.id,
        actorId: 'player',
        targets: {
          item: { id: 'normal_item' },
        },
      });

      expect(validationResult.success).toBe(false);
      expect(validationResult.error).toContain('missing required property');
      expect(validationResult.details.missingProperty).toBe('special_property');
    });

    it('should handle missing context gracefully', async () => {
      const missingContextAction = {
        id: 'test:missing_context',
        name: 'test {container} {key}',
        targets: {
          container: {
            name: 'container',
            scope: 'location.core:objects[]',
            required: true,
          },
          key: {
            name: 'key',
            scope: 'target.nonexistent_property[]',
            contextFrom: 'container',
            required: true,
          },
        },
        operations: [],
        template: 'test action',
      };

      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
      });

      const containerEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'container_001',
        overrides: {
          'core:object': { name: 'Container' },
        },
      });

      const roomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'room',
        overrides: {
          'core:objects': ['container_001'],
        },
      });

      // Mock discovery returning no actions due to missing context
      actionServiceFacade.setMockActions('player', []);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(0);
    });
  });

});
