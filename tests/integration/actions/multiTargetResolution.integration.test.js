import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { createMultiTargetResolutionStage } from '../../common/actions/multiTargetStageTestUtilities.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('Dependent Target Resolution Integration', () => {
  let testBed;
  let entityManager;
  let multiTargetResolutionStage;
  let unifiedScopeResolver;
  let logger;

  beforeEach(() => {
    // Set up test bed
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    // Create logger
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();

    // Create unified scope resolver with minimal dependencies
    unifiedScopeResolver = {
      resolve: jest.fn(),
    };

    // Create multi-target resolution stage using test utility
    multiTargetResolutionStage = createMultiTargetResolutionStage({
      entityManager,
      logger,
      unifiedScopeResolver,
      targetResolver: {
        resolveTargets: jest.fn(),
      },
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Two-Level Dependencies', () => {
    it('should resolve dependent targets in correct order', async () => {
      // Create entity definitions
      const playerDef = new EntityDefinition('test:player', {
        description: 'Test player',
        components: {
          'core:position': { locationId: 'room' },
          'core:actor': { name: 'Player' },
        },
      });

      const npcDef = new EntityDefinition('test:npc', {
        description: 'Test NPC',
        components: {
          'core:actor': { name: 'Alice' },
          'core:position': { locationId: 'room' },
          'core:inventory': { items: ['sword', 'potion'] },
        },
      });

      // Define the item entities that will be in the inventory
      const swordDef = new EntityDefinition('test:sword', {
        description: 'Test sword',
        components: {
          'core:item': { name: 'Steel Sword', type: 'weapon' },
        },
      });

      const potionDef = new EntityDefinition('test:potion', {
        description: 'Test potion',
        components: {
          'core:item': { name: 'Health Potion', type: 'consumable' },
        },
      });

      const roomDef = new EntityDefinition('test:room', {
        description: 'Test room',
        components: {
          'core:location': { name: 'Test Room' },
          'core:actors': { actors: [] }, // Will be updated after entity creation
        },
      });

      // Setup definitions
      testBed.setupDefinitions(playerDef, npcDef, roomDef, swordDef, potionDef);

      // Create entities
      const player = await entityManager.createEntityInstance('test:player', {
        instanceId: 'player-001',
      });

      const npc = await entityManager.createEntityInstance('test:npc', {
        instanceId: 'npc-001',
      });

      const room = await entityManager.createEntityInstance('test:room', {
        instanceId: 'room-001',
      });

      // Create the item entities that are referenced in the NPC's inventory
      const sword = await entityManager.createEntityInstance('test:sword', {
        instanceId: 'sword', // Use the same ID as referenced in inventory
      });

      const potion = await entityManager.createEntityInstance('test:potion', {
        instanceId: 'potion', // Use the same ID as referenced in inventory
      });

      // Update room with actor references
      await entityManager.addComponent('room-001', 'core:actors', {
        actors: ['player-001', 'npc-001'],
      });

      // Define action with dependent targets
      const actionDef = {
        id: 'test:take_item',
        name: 'Take Item',
        targets: {
          primary: {
            scope: 'location.components["core:actors"].actors',
            placeholder: 'person',
          },
          secondary: {
            scope: 'target.components["core:inventory"].items',
            placeholder: 'item',
            contextFrom: 'primary',
          },
        },
        template: 'take {item} from {person}',
      };

      // Mock scope resolver responses
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc-001']))) // Primary resolution
        .mockResolvedValueOnce(
          ActionResult.success(new Set(['sword', 'potion']))
        ); // Secondary resolution

      // Target context builder is now handled by the test utility

      // Dependent context building is now handled by the test utility

      // Create context for the stage
      const context = {
        candidateActions: [actionDef],
        actor: player,
        actionContext: { location: room },
        data: {},
      };

      // Execute the stage
      const result = await multiTargetResolutionStage.executeInternal(context);

      // Debug the result
      console.log(
        'MultiTargetResolutionStage result:',
        JSON.stringify(result, null, 2)
      );
      console.log(
        'UnifiedScopeResolver call count:',
        unifiedScopeResolver.resolve.mock.calls.length
      );
      console.log(
        'UnifiedScopeResolver calls:',
        unifiedScopeResolver.resolve.mock.calls
      );
      console.log('Resolved targets in result:', result.data.resolvedTargets);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toBeDefined();
      expect(result.data.actionsWithTargets.length).toBeGreaterThan(0);

      // Verify dependent resolution worked
      const processedAction = result.data.actionsWithTargets[0];
      expect(processedAction.actionDef.id).toBe('test:take_item');

      // Verify buildDependentContext was called
      expect(unifiedScopeResolver.resolve).toHaveBeenCalledTimes(2);
    });

    it('should handle empty dependent targets gracefully', async () => {
      // Create entity definitions where secondary target will be empty
      const playerDef = new EntityDefinition('test:player2', {
        description: 'Test player 2',
        components: {
          'core:position': { locationId: 'room' },
          'core:actor': { name: 'Player' },
        },
      });

      const npcDef = new EntityDefinition('test:npc2', {
        description: 'Test NPC 2',
        components: {
          'core:actor': { name: 'Bob' },
          'core:position': { locationId: 'room' },
          // No inventory - secondary target will be empty
        },
      });

      const roomDef = new EntityDefinition('test:room2', {
        description: 'Test room 2',
        components: {
          'core:location': { name: 'Test Room' },
          'core:actors': { actors: [] }, // Will be updated after entity creation
        },
      });

      // Setup definitions
      testBed.setupDefinitions(playerDef, npcDef, roomDef);

      // Create entities
      const player = await entityManager.createEntityInstance('test:player2', {
        instanceId: 'player-002',
      });

      const npc = await entityManager.createEntityInstance('test:npc2', {
        instanceId: 'npc-002',
      });

      const room = await entityManager.createEntityInstance('test:room2', {
        instanceId: 'room-002',
      });

      // Update room with actor references
      await entityManager.addComponent('room-002', 'core:actors', {
        actors: ['player-002', 'npc-002'],
      });

      const actionDef = {
        id: 'test:take_item_empty',
        targets: {
          primary: {
            scope: 'location.components["core:actors"].actors',
            placeholder: 'person',
          },
          secondary: {
            scope: 'target.components["core:inventory"].items',
            placeholder: 'item',
            contextFrom: 'primary',
          },
        },
        template: 'take {item} from {person}',
      };

      // Mock scope resolver responses - secondary returns empty
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc-002']))) // Primary resolution
        .mockResolvedValueOnce(ActionResult.success(new Set())); // Secondary resolution - empty

      // Target context builder is now handled by the test utility

      const context = {
        candidateActions: [actionDef],
        actor: player,
        actionContext: { location: room },
        data: {},
      };

      const result = await multiTargetResolutionStage.executeInternal(context);

      expect(result.success).toBe(true);
      // Should have no actions because secondary targets are empty
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });
  });

  // Note: Three-level dependencies and complex chains are tested in the unit tests above
  // Integration tests focus on realistic two-level scenarios
});
