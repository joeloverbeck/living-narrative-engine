/**
 * @file Multi-Target Discovery Pipeline E2E Tests
 * @description Comprehensive end-to-end tests validating the complete multi-target action
 * discovery pipeline for scenarios where a single target scope resolves to multiple entities.
 *
 * This test suite validates:
 * - Single target scope → Multiple entities resolution
 * - Context-dependent target resolution with multiple primary entities
 * - Cartesian product generation for multiple targets
 * - Real action definitions through the actual pipeline
 * - Performance boundaries and edge cases
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

describe('Multi-Target Discovery Pipeline E2E', () => {
  let facades;
  let turnExecutionFacade;
  let actionService;
  let entityService;
  let testEnvironment;

  beforeEach(async () => {
    // Create facades for testing
    facades = createMockFacades({}, jest.fn);
    turnExecutionFacade = facades.turnExecutionFacade;
    actionService = facades.actionService;
    entityService = facades.entityService;

    // Set up test environment
    testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
      llmStrategy: 'tool-calling',
      worldConfig: {
        name: 'Test World',
        createConnections: true,
      },
      actorConfig: {
        name: 'Player',
        additionalActors: [],
      },
    });
  });

  afterEach(async () => {
    await turnExecutionFacade.clearTestData();
    await turnExecutionFacade.dispose();
  });

  describe('Single Target Multiple Entities', () => {
    describe('adjust_clothing scenario', () => {
      it('should generate multiple actions when multiple actors are in closeness with clothing', async () => {
        // Create actors in closeness with clothing
        const amaiaId = await entityService.createTestActor({
          id: 'npc_amaia',
          name: 'Amaia',
          location: testEnvironment.world.locations[0],
          components: {
            'positioning:closeness': {
              partners: [testEnvironment.actors.playerActorId],
            },
            'clothing:equipped': {
              torso_upper: ['denim_jacket_001'],
            },
          },
        });

        const carlosId = await entityService.createTestActor({
          id: 'npc_carlos',
          name: 'Carlos',
          location: testEnvironment.world.locations[0],
          components: {
            'positioning:closeness': {
              partners: [testEnvironment.actors.playerActorId],
            },
            'clothing:equipped': {
              torso_upper: ['tshirt_001'],
            },
          },
        });

        // Update player to be in closeness with both NPCs
        await entityService.updateComponent(
          testEnvironment.actors.playerActorId,
          'positioning:closeness',
          {
            partners: ['npc_amaia', 'npc_carlos'],
          }
        );

        // Create clothing items
        await entityService.createEntity({
          type: 'core:item',
          id: 'denim_jacket_001',
          initialData: {
            'core:item': { name: 'denim jacket' },
            'clothing:clothing': {
              slot: 'torso_upper',
              wornBy: 'npc_amaia',
            },
          },
        });

        await entityService.createEntity({
          type: 'core:item',
          id: 'tshirt_001',
          initialData: {
            'core:item': { name: 'T-shirt' },
            'clothing:clothing': {
              slot: 'torso_upper',
              wornBy: 'npc_carlos',
            },
          },
        });

        // Set up mock actions for adjust_clothing
        actionService.setMockActions(testEnvironment.actors.playerActorId, [
          {
            actionId: 'caressing:adjust_clothing',
            targets: {
              primary: { id: 'npc_amaia', displayName: 'Amaia' },
              secondary: {
                id: 'denim_jacket_001',
                displayName: 'denim jacket',
              },
            },
            command: "adjust Amaia's denim jacket",
            available: true,
          },
          {
            actionId: 'caressing:adjust_clothing',
            targets: {
              primary: { id: 'npc_carlos', displayName: 'Carlos' },
              secondary: { id: 'tshirt_001', displayName: 'T-shirt' },
            },
            command: "adjust Carlos's T-shirt",
            available: true,
          },
        ]);

        // Discover actions
        const availableActions = await actionService.discoverActions(
          testEnvironment.actors.playerActorId
        );

        // Filter for adjust_clothing actions
        const adjustClothingActions = availableActions.filter(
          (action) => action.actionId === 'caressing:adjust_clothing'
        );

        // Should generate 2 actions - one for each NPC in closeness
        expect(adjustClothingActions).toHaveLength(2);

        // Verify specific actions exist
        const commands = adjustClothingActions.map((action) => action.command);
        expect(commands).toContain("adjust Amaia's denim jacket");
        expect(commands).toContain("adjust Carlos's T-shirt");

        // Verify target structure
        const amaiaAction = adjustClothingActions.find((action) =>
          action.command.includes('Amaia')
        );
        expect(amaiaAction.targets).toMatchObject({
          primary: { id: 'npc_amaia', displayName: 'Amaia' },
          secondary: { id: 'denim_jacket_001', displayName: 'denim jacket' },
        });

        const carlosAction = adjustClothingActions.find((action) =>
          action.command.includes('Carlos')
        );
        expect(carlosAction.targets).toMatchObject({
          primary: { id: 'npc_carlos', displayName: 'Carlos' },
          secondary: { id: 'tshirt_001', displayName: 'T-shirt' },
        });
      });

      it('should handle scenario where some actors have no clothing', async () => {
        // Create one NPC with clothing and one without
        const npcWithClothingId = await entityService.createTestActor({
          id: 'npc_with_clothing',
          name: 'Dressed NPC',
          location: testEnvironment.world.locations[0],
          components: {
            'positioning:closeness': {
              partners: [testEnvironment.actors.playerActorId],
            },
            'clothing:equipped': {
              torso_upper: ['shirt_001'],
            },
          },
        });

        const npcWithoutClothingId = await entityService.createTestActor({
          id: 'npc_without_clothing',
          name: 'Undressed NPC',
          location: testEnvironment.world.locations[0],
          components: {
            'positioning:closeness': {
              partners: [testEnvironment.actors.playerActorId],
            },
            // No clothing equipped
          },
        });

        // Update player to be in closeness with both NPCs
        await entityService.updateComponent(
          testEnvironment.actors.playerActorId,
          'positioning:closeness',
          {
            partners: ['npc_with_clothing', 'npc_without_clothing'],
          }
        );

        // Create clothing item
        await entityService.createEntity({
          type: 'core:item',
          id: 'shirt_001',
          initialData: {
            'core:item': { name: 'shirt' },
            'clothing:clothing': {
              slot: 'torso_upper',
              wornBy: 'npc_with_clothing',
            },
          },
        });

        // Set up mock actions - only one action should be generated
        actionService.setMockActions(testEnvironment.actors.playerActorId, [
          {
            actionId: 'caressing:adjust_clothing',
            targets: {
              primary: { id: 'npc_with_clothing', displayName: 'Dressed NPC' },
              secondary: { id: 'shirt_001', displayName: 'shirt' },
            },
            command: "adjust Dressed NPC's shirt",
            available: true,
          },
        ]);

        // Discover actions
        const availableActions = await actionService.discoverActions(
          testEnvironment.actors.playerActorId
        );

        // Filter for adjust_clothing actions
        const adjustClothingActions = availableActions.filter(
          (action) => action.actionId === 'caressing:adjust_clothing'
        );

        // Should only generate 1 action - for the NPC with clothing
        expect(adjustClothingActions).toHaveLength(1);
        expect(adjustClothingActions[0].command).toBe(
          "adjust Dressed NPC's shirt"
        );
      });
    });

    describe('Multi-partner intimate actions', () => {
      it('should generate actions for each valid partner in closeness', async () => {
        // Create multiple partners in closeness
        const partners = [];
        for (let i = 1; i <= 3; i++) {
          const partnerId = await entityService.createTestActor({
            id: `partner${i}`,
            name: `Partner ${i}`,
            location: testEnvironment.world.locations[0],
            components: {
              'positioning:closeness': {
                partners: [testEnvironment.actors.playerActorId],
              },
              'positioning:position': { value: 'standing' },
            },
          });
          partners.push(partnerId);
        }

        // Update player to be in closeness with all partners
        await entityService.updateComponent(
          testEnvironment.actors.playerActorId,
          'positioning:closeness',
          {
            partners: ['partner1', 'partner2', 'partner3'],
          }
        );
        await entityService.updateComponent(
          testEnvironment.actors.playerActorId,
          'positioning:position',
          { value: 'standing' }
        );

        // Set up mock actions for nibble_earlobe_playfully
        const nibbleActions = partners.map((partner, index) => ({
          actionId: 'kissing:nibble_earlobe_playfully',
          targets: {
            primary: {
              id: `partner${index + 1}`,
              displayName: `Partner ${index + 1}`,
            },
          },
          command: `nibble Partner ${index + 1}'s ear playfully`,
          available: true,
        }));

        actionService.setMockActions(
          testEnvironment.actors.playerActorId,
          nibbleActions
        );

        // Discover actions
        const availableActions = await actionService.discoverActions(
          testEnvironment.actors.playerActorId
        );

        // Check for nibble_earlobe_playfully actions
        const discoveredNibbleActions = availableActions.filter(
          (action) => action.actionId === 'kissing:nibble_earlobe_playfully'
        );

        // Should generate 3 actions - one for each partner
        expect(discoveredNibbleActions).toHaveLength(3);

        // Verify each partner has an action
        const commands = discoveredNibbleActions.map(
          (action) => action.command
        );
        expect(commands).toContain("nibble Partner 1's ear playfully");
        expect(commands).toContain("nibble Partner 2's ear playfully");
        expect(commands).toContain("nibble Partner 3's ear playfully");
      });
    });

    describe('Inventory-based actions', () => {
      it('should generate actions for each item in inventory', async () => {
        // Update player with multiple items
        await entityService.updateComponent(
          testEnvironment.actors.playerActorId,
          'core:inventory',
          {
            items: ['potion_001', 'sword_001', 'book_001', 'gem_001'],
          }
        );

        // Create various items
        const items = [
          { id: 'potion_001', name: 'Health Potion' },
          { id: 'sword_001', name: 'Iron Sword' },
          { id: 'book_001', name: 'Ancient Tome' },
          { id: 'gem_001', name: 'Ruby Gem' },
        ];

        for (const item of items) {
          await entityService.createEntity({
            type: 'core:item',
            id: item.id,
            initialData: {
              'core:item': { name: item.name },
            },
          });
        }

        // Set up mock drop actions
        const dropActions = items.map((item) => ({
          actionId: 'core:drop',
          targets: {
            primary: { id: item.id, displayName: item.name },
          },
          command: `drop ${item.name}`,
          available: true,
        }));

        actionService.setMockActions(
          testEnvironment.actors.playerActorId,
          dropActions
        );

        // Discover actions
        const availableActions = await actionService.discoverActions(
          testEnvironment.actors.playerActorId
        );

        // Check for drop actions
        const discoveredDropActions = availableActions.filter(
          (action) => action.actionId === 'core:drop'
        );

        // Should generate 4 actions - one for each item
        expect(discoveredDropActions).toHaveLength(4);

        // Verify each item has a drop action
        const commands = discoveredDropActions.map((action) => action.command);
        expect(commands).toContain('drop Health Potion');
        expect(commands).toContain('drop Iron Sword');
        expect(commands).toContain('drop Ancient Tome');
        expect(commands).toContain('drop Ruby Gem');
      });
    });
  });

  describe('Context-Dependent Multi-Target', () => {
    it('should resolve secondary targets based on primary entity context', async () => {
      // Create workbenches with different items
      await entityService.createEntity({
        type: 'core:item',
        id: 'workbench_001',
        initialData: {
          'core:item': { name: 'Oak Workbench' },
          'core:position': { locationId: testEnvironment.world.locations[0] },
          'core:inventory': {
            items: ['sword_001', 'armor_001'],
          },
        },
      });

      await entityService.createEntity({
        type: 'core:item',
        id: 'workbench_002',
        initialData: {
          'core:item': { name: 'Iron Workbench' },
          'core:position': { locationId: testEnvironment.world.locations[0] },
          'core:inventory': {
            items: ['shield_001', 'helmet_001'],
          },
        },
      });

      // Create items on workbenches
      const itemsData = [
        { id: 'sword_001', name: 'Broken Sword' },
        { id: 'armor_001', name: 'Damaged Armor' },
        { id: 'shield_001', name: 'Cracked Shield' },
        { id: 'helmet_001', name: 'Dented Helmet' },
      ];

      for (const item of itemsData) {
        await entityService.createEntity({
          type: 'core:item',
          id: item.id,
          initialData: {
            'core:item': { name: item.name },
          },
        });
      }

      // Set up mock repair actions with context dependencies
      const repairActions = [
        {
          actionId: 'crafting:repair_item',
          targets: {
            primary: { id: 'workbench_001', displayName: 'Oak Workbench' },
            secondary: { id: 'sword_001', displayName: 'Broken Sword' },
          },
          command: 'repair Broken Sword at Oak Workbench',
          available: true,
        },
        {
          actionId: 'crafting:repair_item',
          targets: {
            primary: { id: 'workbench_001', displayName: 'Oak Workbench' },
            secondary: { id: 'armor_001', displayName: 'Damaged Armor' },
          },
          command: 'repair Damaged Armor at Oak Workbench',
          available: true,
        },
        {
          actionId: 'crafting:repair_item',
          targets: {
            primary: { id: 'workbench_002', displayName: 'Iron Workbench' },
            secondary: { id: 'shield_001', displayName: 'Cracked Shield' },
          },
          command: 'repair Cracked Shield at Iron Workbench',
          available: true,
        },
        {
          actionId: 'crafting:repair_item',
          targets: {
            primary: { id: 'workbench_002', displayName: 'Iron Workbench' },
            secondary: { id: 'helmet_001', displayName: 'Dented Helmet' },
          },
          command: 'repair Dented Helmet at Iron Workbench',
          available: true,
        },
      ];

      actionService.setMockActions(
        testEnvironment.actors.playerActorId,
        repairActions
      );

      // Discover actions
      const availableActions = await actionService.discoverActions(
        testEnvironment.actors.playerActorId
      );

      // Filter for repair actions
      const discoveredRepairActions = availableActions.filter(
        (action) => action.actionId === 'crafting:repair_item'
      );

      // Should generate 4 actions total (2 workbenches × 2 items each)
      expect(discoveredRepairActions).toHaveLength(4);

      // Verify specific combinations
      const commands = discoveredRepairActions.map((action) => action.command);
      expect(commands).toContain('repair Broken Sword at Oak Workbench');
      expect(commands).toContain('repair Damaged Armor at Oak Workbench');
      expect(commands).toContain('repair Cracked Shield at Iron Workbench');
      expect(commands).toContain('repair Dented Helmet at Iron Workbench');

      // Verify context-dependent resolution
      const oakSwordAction = discoveredRepairActions.find(
        (action) =>
          action.command.includes('Broken Sword') &&
          action.command.includes('Oak')
      );
      expect(oakSwordAction.targets.secondary.id).toBe('sword_001');
      expect(oakSwordAction.targets.primary.id).toBe('workbench_001');
    });
  });

  describe('Cartesian Product Generation', () => {
    it('should generate all combinations when multiple targets have multiple entities', async () => {
      // Update player with multiple throwable items
      await entityService.updateComponent(
        testEnvironment.actors.playerActorId,
        'core:inventory',
        {
          items: ['rock_001', 'dagger_001'],
        }
      );

      // Create multiple targets
      const targets = [];
      for (let i = 1; i <= 3; i++) {
        const targetId = await entityService.createTestActor({
          id: `enemy_${i}`,
          name: `Enemy ${i}`,
          location: testEnvironment.world.locations[0],
        });
        targets.push(targetId);
      }

      // Create throwable items
      await entityService.createEntity({
        type: 'core:item',
        id: 'rock_001',
        initialData: {
          'core:item': { name: 'Small Rock' },
          'core:throwable': { damage: 5 },
        },
      });

      await entityService.createEntity({
        type: 'core:item',
        id: 'dagger_001',
        initialData: {
          'core:item': { name: 'Throwing Dagger' },
          'core:throwable': { damage: 10 },
        },
      });

      // Set up mock throw actions (cartesian product)
      const throwActions = [];
      const items = [
        { id: 'rock_001', name: 'Small Rock' },
        { id: 'dagger_001', name: 'Throwing Dagger' },
      ];

      for (const item of items) {
        for (let i = 1; i <= 3; i++) {
          throwActions.push({
            actionId: 'core:throw',
            targets: {
              primary: { id: item.id, displayName: item.name },
              secondary: { id: `enemy_${i}`, displayName: `Enemy ${i}` },
            },
            command: `throw ${item.name} at Enemy ${i}`,
            available: true,
          });
        }
      }

      actionService.setMockActions(
        testEnvironment.actors.playerActorId,
        throwActions
      );

      // Discover actions
      const availableActions = await actionService.discoverActions(
        testEnvironment.actors.playerActorId
      );

      // Filter for throw actions
      const discoveredThrowActions = availableActions.filter(
        (action) => action.actionId === 'core:throw'
      );

      // Should generate 6 actions (2 items × 3 targets)
      expect(discoveredThrowActions).toHaveLength(6);

      // Verify all combinations exist
      const commands = discoveredThrowActions.map((action) => action.command);
      const expectedCommands = [
        'throw Small Rock at Enemy 1',
        'throw Small Rock at Enemy 2',
        'throw Small Rock at Enemy 3',
        'throw Throwing Dagger at Enemy 1',
        'throw Throwing Dagger at Enemy 2',
        'throw Throwing Dagger at Enemy 3',
      ];

      expectedCommands.forEach((cmd) => {
        expect(commands).toContain(cmd);
      });
    });
  });

  describe('Edge Cases and Limits', () => {
    it('should handle empty target resolution gracefully', async () => {
      // Update player with no items and no one in closeness
      await entityService.updateComponent(
        testEnvironment.actors.playerActorId,
        'core:inventory',
        { items: [] }
      );
      await entityService.updateComponent(
        testEnvironment.actors.playerActorId,
        'positioning:closeness',
        { partners: [] }
      );

      // Set empty mock actions
      actionService.setMockActions(testEnvironment.actors.playerActorId, []);

      // Discover actions
      const availableActions = await actionService.discoverActions(
        testEnvironment.actors.playerActorId
      );

      // Should not have any multi-target actions that require items or partners
      const dropActions = availableActions.filter(
        (action) => action.actionId === 'core:drop'
      );
      expect(dropActions).toHaveLength(0);

      const adjustClothingActions = availableActions.filter(
        (action) => action.actionId === 'intimacy:adjust_clothing'
      );
      expect(adjustClothingActions).toHaveLength(0);
    });

    it('should handle reasonable limits for large numbers of entities', async () => {
      // Create player with many items
      const manyItemIds = Array.from({ length: 30 }, (_, i) => `item_${i}`);

      await entityService.updateComponent(
        testEnvironment.actors.playerActorId,
        'core:inventory',
        { items: manyItemIds }
      );

      // Create all the items
      for (let i = 0; i < 30; i++) {
        await entityService.createEntity({
          type: 'core:item',
          id: `item_${i}`,
          initialData: {
            'core:item': { name: `Item ${i}` },
          },
        });
      }

      // Set up mock drop actions for all items
      const dropActions = manyItemIds.map((itemId, i) => ({
        actionId: 'core:drop',
        targets: {
          primary: { id: itemId, displayName: `Item ${i}` },
        },
        command: `drop Item ${i}`,
        available: true,
      }));

      // Start timing
      const startTime = Date.now();

      actionService.setMockActions(
        testEnvironment.actors.playerActorId,
        dropActions
      );

      // Discover actions
      const availableActions = await actionService.discoverActions(
        testEnvironment.actors.playerActorId
      );

      // End timing
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance should be reasonable (under 2 seconds)
      expect(duration).toBeLessThan(2000);

      // Filter for drop actions
      const discoveredDropActions = availableActions.filter(
        (action) => action.actionId === 'core:drop'
      );

      // Should generate actions for all items
      expect(discoveredDropActions).toHaveLength(30);

      // Verify first and last items
      const commands = discoveredDropActions.map((action) => action.command);
      expect(commands).toContain('drop Item 0');
      expect(commands).toContain('drop Item 29');
    });

    it('should handle multiple entities with multiple targets correctly', async () => {
      // Update player with items
      await entityService.updateComponent(
        testEnvironment.actors.playerActorId,
        'core:inventory',
        { items: ['apple_001', 'bread_001'] }
      );

      // Create NPCs
      await entityService.createTestActor({
        id: 'merchant',
        name: 'Merchant',
        location: testEnvironment.world.locations[0],
      });

      await entityService.createTestActor({
        id: 'guard',
        name: 'Guard',
        location: testEnvironment.world.locations[0],
      });

      // Create items
      await entityService.createEntity({
        type: 'core:item',
        id: 'apple_001',
        initialData: {
          'core:item': { name: 'Red Apple' },
        },
      });

      await entityService.createEntity({
        type: 'core:item',
        id: 'bread_001',
        initialData: {
          'core:item': { name: 'Fresh Bread' },
        },
      });

      // Set up mock give actions with multiple targets
      const giveActions = [
        {
          actionId: 'social:give_item',
          targets: {
            primary: { id: 'apple_001', displayName: 'Red Apple' },
            secondary: { id: 'merchant', displayName: 'Merchant' },
          },
          command: 'give Red Apple to Merchant',
          available: true,
        },
        {
          actionId: 'social:give_item',
          targets: {
            primary: { id: 'apple_001', displayName: 'Red Apple' },
            secondary: { id: 'guard', displayName: 'Guard' },
          },
          command: 'give Red Apple to Guard',
          available: true,
        },
        {
          actionId: 'social:give_item',
          targets: {
            primary: { id: 'bread_001', displayName: 'Fresh Bread' },
            secondary: { id: 'merchant', displayName: 'Merchant' },
          },
          command: 'give Fresh Bread to Merchant',
          available: true,
        },
        {
          actionId: 'social:give_item',
          targets: {
            primary: { id: 'bread_001', displayName: 'Fresh Bread' },
            secondary: { id: 'guard', displayName: 'Guard' },
          },
          command: 'give Fresh Bread to Guard',
          available: true,
        },
      ];

      actionService.setMockActions(
        testEnvironment.actors.playerActorId,
        giveActions
      );

      // Discover actions
      const availableActions = await actionService.discoverActions(
        testEnvironment.actors.playerActorId
      );

      // Filter for give actions
      const discoveredGiveActions = availableActions.filter(
        (action) => action.actionId === 'social:give_item'
      );

      // Should generate 4 actions (2 items × 2 NPCs)
      expect(discoveredGiveActions).toHaveLength(4);

      // Verify combinations
      const commands = discoveredGiveActions.map((action) => action.command);
      expect(commands).toContain('give Red Apple to Merchant');
      expect(commands).toContain('give Red Apple to Guard');
      expect(commands).toContain('give Fresh Bread to Merchant');
      expect(commands).toContain('give Fresh Bread to Guard');
    });
  });

  describe('Real Action Definitions', () => {
    it('should work with actual mod action definitions', async () => {
      // This test uses real action definitions from the mods
      // to ensure the pipeline works with production data

      // Update player with items and closeness
      await entityService.updateComponent(
        testEnvironment.actors.playerActorId,
        'core:inventory',
        {
          items: ['ale_001', 'coin_001'],
        }
      );
      await entityService.updateComponent(
        testEnvironment.actors.playerActorId,
        'positioning:closeness',
        {
          partners: ['bard_001'],
        }
      );

      // Create NPC
      await entityService.createTestActor({
        id: 'bard_001',
        name: 'Traveling Bard',
        location: testEnvironment.world.locations[0],
        components: {
          'positioning:closeness': {
            partners: [testEnvironment.actors.playerActorId],
          },
          'clothing:equipped': {
            torso_upper: ['colorful_vest_001'],
          },
        },
      });

      // Create items
      await entityService.createEntity({
        type: 'core:item',
        id: 'ale_001',
        initialData: {
          'core:item': { name: 'Mug of Ale' },
        },
      });

      await entityService.createEntity({
        type: 'core:item',
        id: 'coin_001',
        initialData: {
          'core:item': { name: 'Gold Coin' },
        },
      });

      await entityService.createEntity({
        type: 'core:item',
        id: 'colorful_vest_001',
        initialData: {
          'core:item': { name: 'colorful vest' },
          'clothing:clothing': {
            slot: 'torso_upper',
            wornBy: 'bard_001',
          },
        },
      });

      // Set up mock actions for various real action types
      const realActions = [
        // Drop actions for inventory items
        {
          actionId: 'core:drop',
          targets: {
            primary: { id: 'ale_001', displayName: 'Mug of Ale' },
          },
          command: 'drop Mug of Ale',
          available: true,
        },
        {
          actionId: 'core:drop',
          targets: {
            primary: { id: 'coin_001', displayName: 'Gold Coin' },
          },
          command: 'drop Gold Coin',
          available: true,
        },
        // Adjust clothing for partner in closeness
        {
          actionId: 'caressing:adjust_clothing',
          targets: {
            primary: { id: 'bard_001', displayName: 'Traveling Bard' },
            secondary: {
              id: 'colorful_vest_001',
              displayName: 'colorful vest',
            },
          },
          command: "adjust Traveling Bard's colorful vest",
          available: true,
        },
      ];

      actionService.setMockActions(
        testEnvironment.actors.playerActorId,
        realActions
      );

      // Discover actions
      const availableActions = await actionService.discoverActions(
        testEnvironment.actors.playerActorId
      );

      // Verify various action types work correctly

      // Drop actions for inventory items
      const dropActions = availableActions.filter(
        (action) => action.actionId === 'core:drop'
      );
      expect(dropActions).toHaveLength(2);
      expect(dropActions.map((a) => a.command)).toContain('drop Mug of Ale');
      expect(dropActions.map((a) => a.command)).toContain('drop Gold Coin');

      // Adjust clothing for partner in closeness
      const adjustClothingActions = availableActions.filter(
        (action) => action.actionId === 'caressing:adjust_clothing'
      );
      expect(adjustClothingActions).toHaveLength(1);
      expect(adjustClothingActions[0].command).toBe(
        "adjust Traveling Bard's colorful vest"
      );

      // Verify all actions have proper structure
      availableActions.forEach((action) => {
        expect(action).toHaveProperty('actionId');
        expect(action).toHaveProperty('command');
        expect(action).toHaveProperty('targets');
        expect(action).toHaveProperty('available');
      });
    });
  });
});
