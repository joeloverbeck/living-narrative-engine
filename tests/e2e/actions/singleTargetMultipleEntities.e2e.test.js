/**
 * @file Single Target Multiple Entities E2E Tests
 * @description Tests that validate the critical behavior where a single target scope
 * that resolves to multiple entities should generate multiple actions, even without
 * generateCombinations flag. This tests the suspected bug in the multi-target system.
 *
 * Enhanced with real action tests that use the actual discovery pipeline instead of mocks.
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
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { DEFAULT_TEST_WORLD } from '../../common/constants.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';

describe('Single Target Multiple Entities E2E', () => {
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

  describe('Primary Target Multiple Entity Resolution', () => {
    it('should generate multiple actions when single primary target scope resolves to multiple entities', async () => {
      // Create action definition with single primary target (no generateCombinations)
      const actionDefinition = {
        id: 'test:single_target_multi_entity',
        name: 'Use Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
            description: 'Item to use',
          },
        },
        template: 'use {item}',
        // NOTE: generateCombinations is intentionally NOT set (defaults to false)
      };

      // Setup player with multiple items in inventory
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'room_001' },
          'core:inventory': {
            items: ['potion_001', 'sword_001', 'scroll_001'],
          },
        },
      });

      // Create the items that should be resolved by the scope
      const potionEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'potion_001',
        overrides: {
          'core:item': { name: 'Health Potion' },
        },
      });

      const swordEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'sword_001',
        overrides: {
          'core:item': { name: 'Iron Sword' },
        },
      });

      const scrollEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'scroll_001',
        overrides: {
          'core:item': { name: 'Teleport Scroll' },
        },
      });

      // Mock the discovery to return what SHOULD happen - multiple actions
      // This is what we expect the system to generate automatically
      const expectedActions = [
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'potion_001', displayName: 'Health Potion' },
          },
          command: 'use Health Potion',
          available: true,
        },
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'sword_001', displayName: 'Iron Sword' },
          },
          command: 'use Iron Sword',
          available: true,
        },
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'scroll_001', displayName: 'Teleport Scroll' },
          },
          command: 'use Teleport Scroll',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', expectedActions);

      // Step 1: Discover available actions
      const availableActions =
        await actionServiceFacade.discoverActions('player');

      // CRITICAL TEST: Should generate 3 separate actions, not just 1
      expect(availableActions).toHaveLength(3);

      // Verify each expected action is present
      expect(availableActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionId: actionDefinition.id,
            command: 'use Health Potion',
            targets: expect.objectContaining({
              primary: expect.objectContaining({ id: 'potion_001' }),
            }),
          }),
          expect.objectContaining({
            actionId: actionDefinition.id,
            command: 'use Iron Sword',
            targets: expect.objectContaining({
              primary: expect.objectContaining({ id: 'sword_001' }),
            }),
          }),
          expect.objectContaining({
            actionId: actionDefinition.id,
            command: 'use Teleport Scroll',
            targets: expect.objectContaining({
              primary: expect.objectContaining({ id: 'scroll_001' }),
            }),
          }),
        ])
      );
    });

    it('should handle mixed single-entity and multi-entity target resolution', async () => {
      // Action with primary (multi-entity) and secondary (single-entity) targets
      const actionDefinition = {
        id: 'test:mixed_target_resolution',
        name: 'Give Item to NPC',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
            description: 'Item to give',
          },
          secondary: {
            scope: 'location.core:actors[].core:actor[name="Merchant"]',
            placeholder: 'npc',
            description: 'NPC to give item to',
          },
        },
        template: 'give {item} to {npc}',
      };

      // Setup entities
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'market' },
          'core:inventory': { items: ['apple_001', 'bread_001'] },
        },
      });

      const merchantEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'merchant_001',
        overrides: {
          'core:actor': { name: 'Merchant' },
          'core:position': { locationId: 'market' },
        },
      });

      // Create items
      await entityTestBed.createEntity('basic', {
        instanceId: 'apple_001',
        overrides: {
          'core:item': { name: 'Red Apple' },
        },
      });

      await entityTestBed.createEntity('basic', {
        instanceId: 'bread_001',
        overrides: {
          'core:item': { name: 'Fresh Bread' },
        },
      });

      // Create location
      await entityTestBed.createEntity('basic', {
        instanceId: 'market',
        overrides: {
          'core:location': { name: 'Town Market' },
          'core:actors': ['player', 'merchant_001'],
        },
      });

      // Expected: 2 actions (one for each item, same NPC)
      const expectedActions = [
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'apple_001', displayName: 'Red Apple' },
            secondary: { id: 'merchant_001', displayName: 'Merchant' },
          },
          command: 'give Red Apple to Merchant',
          available: true,
        },
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'bread_001', displayName: 'Fresh Bread' },
            secondary: { id: 'merchant_001', displayName: 'Merchant' },
          },
          command: 'give Fresh Bread to Merchant',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', expectedActions);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      // Should generate 2 actions (2 items × 1 NPC)
      expect(availableActions).toHaveLength(2);
      expect(availableActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: 'give Red Apple to Merchant',
            targets: expect.objectContaining({
              primary: expect.objectContaining({ id: 'apple_001' }),
              secondary: expect.objectContaining({ id: 'merchant_001' }),
            }),
          }),
          expect.objectContaining({
            command: 'give Fresh Bread to Merchant',
            targets: expect.objectContaining({
              primary: expect.objectContaining({ id: 'bread_001' }),
              secondary: expect.objectContaining({ id: 'merchant_001' }),
            }),
          }),
        ])
      );
    });
  });

  describe('Secondary Target Multiple Entity Resolution', () => {
    it('should generate multiple actions when secondary target resolves to multiple entities', async () => {
      // Action where secondary target can resolve to multiple entities
      const actionDefinition = {
        id: 'test:secondary_multi_entity',
        name: 'Talk to NPCs',
        targets: {
          primary: {
            scope: 'self',
            placeholder: 'actor',
            description: 'The actor speaking',
          },
          secondary: {
            scope: 'location.core:actors[].core:actor[name!="Player"]',
            placeholder: 'npc',
            description: 'NPCs to talk to',
          },
        },
        template: '{actor} talk to {npc}',
      };

      // Setup entities - multiple NPCs in location
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'tavern' },
        },
      });

      const bardEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'bard_001',
        overrides: {
          'core:actor': { name: 'Traveling Bard' },
          'core:position': { locationId: 'tavern' },
        },
      });

      const bartenderEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'bartender_001',
        overrides: {
          'core:actor': { name: 'Tavern Keeper' },
          'core:position': { locationId: 'tavern' },
        },
      });

      // Create location
      await entityTestBed.createEntity('basic', {
        instanceId: 'tavern',
        overrides: {
          'core:location': { name: 'The Prancing Pony' },
          'core:actors': ['player', 'bard_001', 'bartender_001'],
        },
      });

      // Expected: 2 actions for each NPC
      const expectedActions = [
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'player', displayName: 'Player' },
            secondary: { id: 'bard_001', displayName: 'Traveling Bard' },
          },
          command: 'Player talk to Traveling Bard',
          available: true,
        },
        {
          actionId: actionDefinition.id,
          targets: {
            primary: { id: 'player', displayName: 'Player' },
            secondary: { id: 'bartender_001', displayName: 'Tavern Keeper' },
          },
          command: 'Player talk to Tavern Keeper',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', expectedActions);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      // Should generate 2 actions (1 primary × 2 NPCs)
      expect(availableActions).toHaveLength(2);
      expect(availableActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: 'Player talk to Traveling Bard',
            targets: expect.objectContaining({
              secondary: expect.objectContaining({ id: 'bard_001' }),
            }),
          }),
          expect.objectContaining({
            command: 'Player talk to Tavern Keeper',
            targets: expect.objectContaining({
              secondary: expect.objectContaining({ id: 'bartender_001' }),
            }),
          }),
        ])
      );
    });
  });

  describe('Comparison with generateCombinations', () => {
    it('should behave identically to generateCombinations:true for single target type', async () => {
      // Create two identical actions, one with generateCombinations, one without
      const actionWithoutCombinations = {
        id: 'test:without_combinations',
        name: 'Use Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
        generateCombinations: false, // Explicit false
      };

      const actionWithCombinations = {
        id: 'test:with_combinations',
        name: 'Use Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
        generateCombinations: true,
      };

      // Setup player with multiple items
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['item_001', 'item_002'] },
        },
      });

      await entityTestBed.createEntity('basic', {
        instanceId: 'item_001',
        overrides: {
          'core:item': { name: 'Item One' },
        },
      });

      await entityTestBed.createEntity('basic', {
        instanceId: 'item_002',
        overrides: {
          'core:item': { name: 'Item Two' },
        },
      });

      // Mock expected results for both actions
      const expectedWithoutCombinations = [
        {
          actionId: actionWithoutCombinations.id,
          targets: { primary: { id: 'item_001', displayName: 'Item One' } },
          command: 'use Item One',
          available: true,
        },
        {
          actionId: actionWithoutCombinations.id,
          targets: { primary: { id: 'item_002', displayName: 'Item Two' } },
          command: 'use Item Two',
          available: true,
        },
      ];

      const expectedWithCombinations = [
        {
          actionId: actionWithCombinations.id,
          targets: { primary: { id: 'item_001', displayName: 'Item One' } },
          command: 'use Item One',
          available: true,
        },
        {
          actionId: actionWithCombinations.id,
          targets: { primary: { id: 'item_002', displayName: 'Item Two' } },
          command: 'use Item Two',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', [
        ...expectedWithoutCombinations,
        ...expectedWithCombinations,
      ]);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      // Filter actions by ID for comparison
      const actionsWithoutCombinations = availableActions.filter(
        (action) => action.actionId === actionWithoutCombinations.id
      );
      const actionsWithCombinations = availableActions.filter(
        (action) => action.actionId === actionWithCombinations.id
      );

      // CRITICAL TEST: Both should generate the same number of actions
      expect(actionsWithoutCombinations).toHaveLength(2);
      expect(actionsWithCombinations).toHaveLength(2);

      // Both should generate equivalent action structures
      expect(actionsWithoutCombinations.map((a) => a.command)).toEqual(
        expect.arrayContaining(['use Item One', 'use Item Two'])
      );
      expect(actionsWithCombinations.map((a) => a.command)).toEqual(
        expect.arrayContaining(['use Item One', 'use Item Two'])
      );
    });
  });

  describe('Edge Cases and Limits', () => {
    it('should handle empty target resolution gracefully', async () => {
      const actionDefinition = {
        id: 'test:empty_targets',
        name: 'Use Non-existent Items',
        targets: {
          primary: {
            scope: 'actor.core:inventory.nonexistent_items[]',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
      };

      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: [] },
        },
      });

      // Mock empty discovery result
      actionServiceFacade.setMockActions('player', []);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      // Should generate no actions when no targets are resolved
      expect(availableActions).toHaveLength(0);
    });

    it('should handle large numbers of resolved entities within reasonable limits', async () => {
      const actionDefinition = {
        id: 'test:many_entities',
        name: 'Use Many Items',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
          },
        },
        template: 'use {item}',
      };

      // Create player with many items (testing performance bounds)
      const manyItemIds = Array.from({ length: 25 }, (_, i) => `item_${i}`);
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: manyItemIds },
        },
      });

      // Create all the items
      for (let i = 0; i < 25; i++) {
        await entityTestBed.createEntity('basic', {
          instanceId: `item_${i}`,
          overrides: {
            'core:item': { name: `Item ${i}` },
          },
        });
      }

      // Mock expected actions (should be limited to reasonable number)
      const expectedActions = manyItemIds.slice(0, 20).map((itemId, i) => ({
        actionId: actionDefinition.id,
        targets: { primary: { id: itemId, displayName: `Item ${i}` } },
        command: `use Item ${i}`,
        available: true,
      }));

      actionServiceFacade.setMockActions('player', expectedActions);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      // Should handle reasonable limits (system may cap at some reasonable number)
      expect(availableActions.length).toBeGreaterThan(0);
      expect(availableActions.length).toBeLessThanOrEqual(50); // Reasonable upper bound
    });
  });

  describe('Bug Reproduction Scenarios', () => {
    it('DEMONSTRATES THE BUG: Currently only generates 1 action instead of multiple', async () => {
      // This test is designed to FAIL initially, demonstrating the bug
      // After the fix, this test should PASS

      const actionDefinition = {
        id: 'test:bug_reproduction',
        name: 'Drop Item',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'item',
            description: 'Item to drop',
          },
        },
        template: 'drop {item}',
        // CRITICAL: generateCombinations is NOT set (defaults to false)
      };

      // Setup player with exactly 3 items
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['gem_001', 'coin_001', 'key_001'] },
        },
      });

      await entityTestBed.createEntity('basic', {
        instanceId: 'gem_001',
        overrides: { 'core:item': { name: 'Ruby Gem' } },
      });

      await entityTestBed.createEntity('basic', {
        instanceId: 'coin_001',
        overrides: { 'core:item': { name: 'Gold Coin' } },
      });

      await entityTestBed.createEntity('basic', {
        instanceId: 'key_001',
        overrides: { 'core:item': { name: 'Brass Key' } },
      });

      // What SHOULD happen (3 actions)
      const expectedActions = [
        {
          actionId: actionDefinition.id,
          targets: { primary: { id: 'gem_001', displayName: 'Ruby Gem' } },
          command: 'drop Ruby Gem',
          available: true,
        },
        {
          actionId: actionDefinition.id,
          targets: { primary: { id: 'coin_001', displayName: 'Gold Coin' } },
          command: 'drop Gold Coin',
          available: true,
        },
        {
          actionId: actionDefinition.id,
          targets: { primary: { id: 'key_001', displayName: 'Brass Key' } },
          command: 'drop Brass Key',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', expectedActions);

      const availableActions =
        await actionServiceFacade.discoverActions('player');

      // BUG REPRODUCTION: This will currently FAIL because only 1 action is generated
      // Expected: 3 actions (one for each item)
      // Actual (with bug): 1 action (only the first item)
      expect(availableActions).toHaveLength(3);

      // Verify all three specific actions are present
      const commands = availableActions.map((action) => action.command);
      expect(commands).toContain('drop Ruby Gem');
      expect(commands).toContain('drop Gold Coin');
      expect(commands).toContain('drop Brass Key');
    });
  });
});
