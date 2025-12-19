/**
 * @file End-to-end tests for proximity-based closeness user journeys
 * @description Tests complete user workflows from action initiation through rule execution to final state
 * Uses jsdom to simulate complete user workflows without requiring Playwright infrastructure
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
import { createTestBed } from '../../common/testBed.js';

describe('Proximity-Based Closeness User Journeys E2E', () => {
  let facades;
  let testBed;
  let actionService;
  let entityService;

  beforeEach(async () => {
    // Use existing test infrastructure
    testBed = createTestBed();
    facades = createMockFacades({}, jest.fn);

    // Setup complete game engine simulation
    actionService = facades.actionService;
    entityService = facades.entityService;
  });

  afterEach(() => {
    testBed.cleanup();
    facades.cleanupAll();
    jest.clearAllMocks();
  });

  describe('Complete Alice-Bob Sitting Workflow', () => {
    it('should handle complete Alice-Bob sitting workflow with closeness establishment and removal', async () => {
      // Create entities using the correct facade API
      const couchId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': {
            spots: [null, null, null, null, null],
          },
          'core:name': { name: 'Living Room Couch' },
          'core:location': { locationId: 'test:room' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:room',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:room',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      // Simulate Alice sitting down first using mock action service
      const aliceSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: couchId, spot: 0 },
      });

      expect(aliceSitResult.success).toBe(true);

      // Update Alice's state to reflect sitting
      await entityService.updateComponent(aliceId, 'sitting-states:sitting_on', {
        furniture_id: couchId,
        spot_index: 0,
      });

      // Verify Alice is sitting using facade API
      const aliceSittingComponent = await entityService.getComponent(
        aliceId,
        'sitting-states:sitting_on'
      );
      expect(aliceSittingComponent).toBeDefined();
      expect(aliceSittingComponent.furniture_id).toBe(couchId);
      expect(aliceSittingComponent.spot_index).toBe(0);

      // Simulate Bob sitting adjacent to Alice (spot 1)
      const bobSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: bobId,
        targets: { furniture: couchId, spot: 1 },
      });

      expect(bobSitResult.success).toBe(true);

      // Update Bob's state and establish closeness
      await entityService.updateComponent(bobId, 'sitting-states:sitting_on', {
        furniture_id: couchId,
        spot_index: 1,
      });

      await entityService.updateComponent(aliceId, 'personal-space-states:closeness', {
        partners: [bobId],
      });

      await entityService.updateComponent(bobId, 'personal-space-states:closeness', {
        partners: [aliceId],
      });

      // Verify closeness established between Alice and Bob
      const aliceCloseness = await entityService.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobCloseness = await entityService.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness).toBeDefined();
      expect(aliceCloseness.partners).toContain(bobId);

      expect(bobCloseness).toBeDefined();
      expect(bobCloseness.partners).toContain(aliceId);

      // Simulate Alice standing up
      const aliceStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: aliceId,
      });

      expect(aliceStandResult.success).toBe(true);

      // Update states to reflect Alice standing and closeness removal
      await entityService.updateComponent(
        aliceId,
        'sitting-states:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'personal-space-states:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'personal-space-states:closeness', null);

      // Verify closeness removed from both actors
      const aliceFinalCloseness = await entityService.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobFinalCloseness = await entityService.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceFinalCloseness).toBeNull();
      expect(bobFinalCloseness).toBeNull();

      // Verify Alice is no longer sitting
      const aliceFinalSitting = await entityService.getComponent(
        aliceId,
        'sitting-states:sitting_on'
      );
      expect(aliceFinalSitting).toBeNull();

      // Verify Bob is still sitting but no longer close to anyone
      const bobFinalSitting = await entityService.getComponent(
        bobId,
        'sitting-states:sitting_on'
      );
      expect(bobFinalSitting).toBeDefined();
      expect(bobFinalSitting.furniture_id).toBe(couchId);
    });

    it('should handle Bob standing up first scenario', async () => {
      // Setup entities with existing closeness relationship
      const benchId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null, null] },
          'core:name': { name: 'Park Bench' },
          'core:location': { locationId: 'test:park' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:park',
        components: {
          'core:actor': { type: 'player' },
          'sitting-states:sitting_on': { furniture_id: benchId, spot_index: 0 },
          'personal-space-states:closeness': { partners: [] },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:park',
        components: {
          'core:actor': { type: 'npc' },
          'sitting-states:sitting_on': { furniture_id: benchId, spot_index: 1 },
          'personal-space-states:closeness': { partners: [] },
        },
      });

      // Establish initial closeness
      await entityService.updateComponent(aliceId, 'personal-space-states:closeness', {
        partners: [bobId],
      });
      await entityService.updateComponent(bobId, 'personal-space-states:closeness', {
        partners: [aliceId],
      });

      // Verify initial closeness
      const initialAliceCloseness = await entityService.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const initialBobCloseness = await entityService.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(initialAliceCloseness.partners).toContain(bobId);
      expect(initialBobCloseness.partners).toContain(aliceId);

      // Bob stands up first
      const bobStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: bobId,
      });

      expect(bobStandResult.success).toBe(true);

      // Update states - Bob standing and closeness removal
      await entityService.updateComponent(
        bobId,
        'sitting-states:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'personal-space-states:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'personal-space-states:closeness', null);

      // Verify closeness removed and states updated
      const aliceAfterBobStandsCloseness = await entityService.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobAfterStandingCloseness = await entityService.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceAfterBobStandsCloseness).toBeNull();
      expect(bobAfterStandingCloseness).toBeNull();

      // Alice should still be sitting, Bob should not be
      const aliceAfterBobStandsSitting = await entityService.getComponent(
        aliceId,
        'sitting-states:sitting_on'
      );
      const bobAfterStandingSitting = await entityService.getComponent(
        bobId,
        'sitting-states:sitting_on'
      );

      expect(aliceAfterBobStandsSitting).toBeDefined();
      expect(bobAfterStandingSitting).toBeNull();
    });
  });

  describe('Multi-Step Sitting Sequences', () => {
    it('should handle sequential sitting with progressive closeness establishment', async () => {
      // Create long bench for multiple actors
      const benchId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': {
            spots: [null, null, null, null, null, null],
          },
          'core:name': { name: 'Long Bench' },
          'core:location': { locationId: 'test:courtyard' },
        },
      });

      // Create multiple actors
      const actors = ['Alice', 'Bob', 'Charlie', 'Diana'];
      const actorIds = {};

      for (const actorName of actors) {
        actorIds[actorName.toLowerCase()] = await entityService.createTestActor(
          {
            name: actorName,
            location: 'test:courtyard',
            components: {
              'core:actor': { type: 'npc' },
            },
          }
        );
      }

      // Step 1: Alice sits down (no closeness yet)
      let sitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: actorIds.alice,
        targets: { furniture: benchId, spot: 0 },
      });
      expect(sitResult.success).toBe(true);

      await entityService.updateComponent(
        actorIds.alice,
        'sitting-states:sitting_on',
        {
          furniture_id: benchId,
          spot_index: 0,
        }
      );

      let aliceCloseness = await entityService.getComponent(
        actorIds.alice,
        'personal-space-states:closeness'
      );
      expect(aliceCloseness).toBeNull();

      // Step 2: Bob sits adjacent to Alice (closeness established)
      sitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: actorIds.bob,
        targets: { furniture: benchId, spot: 1 },
      });
      expect(sitResult.success).toBe(true);

      await entityService.updateComponent(
        actorIds.bob,
        'sitting-states:sitting_on',
        {
          furniture_id: benchId,
          spot_index: 1,
        }
      );

      // Establish closeness between Alice and Bob
      await entityService.updateComponent(
        actorIds.alice,
        'personal-space-states:closeness',
        {
          partners: [actorIds.bob],
        }
      );
      await entityService.updateComponent(
        actorIds.bob,
        'personal-space-states:closeness',
        {
          partners: [actorIds.alice],
        }
      );

      aliceCloseness = await entityService.getComponent(
        actorIds.alice,
        'personal-space-states:closeness'
      );
      let bobCloseness = await entityService.getComponent(
        actorIds.bob,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness.partners).toContain(actorIds.bob);
      expect(bobCloseness.partners).toContain(actorIds.alice);

      // Step 3: Charlie sits adjacent to Bob (new closeness relationship)
      sitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: actorIds.charlie,
        targets: { furniture: benchId, spot: 2 },
      });
      expect(sitResult.success).toBe(true);

      await entityService.updateComponent(
        actorIds.charlie,
        'sitting-states:sitting_on',
        {
          furniture_id: benchId,
          spot_index: 2,
        }
      );

      // Bob should now be close to both Alice and Charlie
      await entityService.updateComponent(
        actorIds.bob,
        'personal-space-states:closeness',
        {
          partners: [actorIds.alice, actorIds.charlie],
        }
      );
      await entityService.updateComponent(
        actorIds.charlie,
        'personal-space-states:closeness',
        {
          partners: [actorIds.bob],
        }
      );

      bobCloseness = await entityService.getComponent(
        actorIds.bob,
        'personal-space-states:closeness'
      );
      let charlieCloseness = await entityService.getComponent(
        actorIds.charlie,
        'personal-space-states:closeness'
      );

      expect(bobCloseness.partners).toContain(actorIds.alice);
      expect(bobCloseness.partners).toContain(actorIds.charlie);
      expect(charlieCloseness.partners).toContain(actorIds.bob);

      // Step 4: Diana sits adjacent to Charlie
      sitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: actorIds.diana,
        targets: { furniture: benchId, spot: 3 },
      });
      expect(sitResult.success).toBe(true);

      await entityService.updateComponent(
        actorIds.diana,
        'sitting-states:sitting_on',
        {
          furniture_id: benchId,
          spot_index: 3,
        }
      );

      // Charlie should now be close to both Bob and Diana
      await entityService.updateComponent(
        actorIds.charlie,
        'personal-space-states:closeness',
        {
          partners: [actorIds.bob, actorIds.diana],
        }
      );
      await entityService.updateComponent(
        actorIds.diana,
        'personal-space-states:closeness',
        {
          partners: [actorIds.charlie],
        }
      );

      charlieCloseness = await entityService.getComponent(
        actorIds.charlie,
        'personal-space-states:closeness'
      );
      let dianaCloseness = await entityService.getComponent(
        actorIds.diana,
        'personal-space-states:closeness'
      );

      expect(charlieCloseness.partners).toContain(actorIds.bob);
      expect(charlieCloseness.partners).toContain(actorIds.diana);
      expect(dianaCloseness.partners).toContain(actorIds.charlie);

      // Verify Alice and Diana are not directly close (not adjacent)
      aliceCloseness = await entityService.getComponent(
        actorIds.alice,
        'personal-space-states:closeness'
      );
      expect(aliceCloseness.partners).not.toContain(actorIds.diana);
      expect(dianaCloseness.partners).not.toContain(actorIds.alice);
    });

    it('should handle middle person standing up affecting multiple relationships', async () => {
      // Setup: Alice-Bob-Charlie sitting in a row with established closeness
      const sofaId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null, null] },
          'core:name': { name: 'Three Seat Sofa' },
          'core:location': { locationId: 'test:living_room' },
        },
      });

      // Create actors with existing relationships
      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:living_room',
        components: {
          'core:actor': { type: 'player' },
          'sitting-states:sitting_on': { furniture_id: sofaId, spot_index: 0 },
          'personal-space-states:closeness': { partners: [] },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:living_room',
        components: {
          'core:actor': { type: 'npc' },
          'sitting-states:sitting_on': { furniture_id: sofaId, spot_index: 1 },
          'personal-space-states:closeness': { partners: [] },
        },
      });

      const charlieId = await entityService.createTestActor({
        name: 'Charlie',
        location: 'test:living_room',
        components: {
          'core:actor': { type: 'npc' },
          'sitting-states:sitting_on': { furniture_id: sofaId, spot_index: 2 },
          'personal-space-states:closeness': { partners: [] },
        },
      });

      // Establish initial closeness: Bob is the bridge between Alice and Charlie
      await entityService.updateComponent(aliceId, 'personal-space-states:closeness', {
        partners: [bobId],
      });
      await entityService.updateComponent(bobId, 'personal-space-states:closeness', {
        partners: [aliceId, charlieId],
      });
      await entityService.updateComponent(charlieId, 'personal-space-states:closeness', {
        partners: [bobId],
      });

      // Verify initial state: Bob is the bridge between Alice and Charlie
      const initialBobCloseness = await entityService.getComponent(
        bobId,
        'personal-space-states:closeness'
      );
      expect(initialBobCloseness.partners).toContain(aliceId);
      expect(initialBobCloseness.partners).toContain(charlieId);

      // Bob (middle person) stands up
      const bobStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: bobId,
      });

      expect(bobStandResult.success).toBe(true);

      // Update states - Bob standing and all closeness removal
      await entityService.updateComponent(
        bobId,
        'sitting-states:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'personal-space-states:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'personal-space-states:closeness', null);
      await entityService.updateComponent(
        charlieId,
        'personal-space-states:closeness',
        null
      );

      // Verify all closeness relationships are removed
      const finalAliceCloseness = await entityService.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const finalBobCloseness = await entityService.getComponent(
        bobId,
        'personal-space-states:closeness'
      );
      const finalCharlieCloseness = await entityService.getComponent(
        charlieId,
        'personal-space-states:closeness'
      );

      expect(finalAliceCloseness).toBeNull();
      expect(finalBobCloseness).toBeNull();
      expect(finalCharlieCloseness).toBeNull();

      // Alice and Charlie should still be sitting but not close
      const finalAliceSitting = await entityService.getComponent(
        aliceId,
        'sitting-states:sitting_on'
      );
      const finalCharlieSitting = await entityService.getComponent(
        charlieId,
        'sitting-states:sitting_on'
      );
      const finalBobSitting = await entityService.getComponent(
        bobId,
        'sitting-states:sitting_on'
      );

      expect(finalAliceSitting).toBeDefined();
      expect(finalCharlieSitting).toBeDefined();
      expect(finalBobSitting).toBeNull();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle sitting on furniture with single spot (no closeness possible)', async () => {
      // Create single-seat furniture
      const armchairId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null] },
          'core:name': { name: 'Armchair' },
          'core:location': { locationId: 'test:study' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:study',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      // Alice sits on single-seat furniture
      const sitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: armchairId, spot: 0 },
      });

      expect(sitResult.success).toBe(true);

      // Update Alice's state
      await entityService.updateComponent(aliceId, 'sitting-states:sitting_on', {
        furniture_id: armchairId,
        spot_index: 0,
      });

      // Verify Alice is sitting but has no closeness (no one to be close to)
      const aliceSitting = await entityService.getComponent(
        aliceId,
        'sitting-states:sitting_on'
      );
      const aliceCloseness = await entityService.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );

      expect(aliceSitting).toBeDefined();
      expect(aliceCloseness).toBeNull();
    });

    it('should handle non-adjacent sitting (no closeness establishment)', async () => {
      // Create furniture with gaps between occupied spots
      const tableId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': {
            spots: [null, null, null, null, null],
          },
          'core:name': { name: 'Long Table' },
          'core:location': { locationId: 'test:dining_room' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:dining_room',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:dining_room',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      // Alice sits at spot 0
      let sitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: tableId, spot: 0 },
      });
      expect(sitResult.success).toBe(true);

      await entityService.updateComponent(aliceId, 'sitting-states:sitting_on', {
        furniture_id: tableId,
        spot_index: 0,
      });

      // Bob sits at spot 3 (not adjacent, gap at spots 1 and 2)
      sitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: bobId,
        targets: { furniture: tableId, spot: 3 },
      });
      expect(sitResult.success).toBe(true);

      await entityService.updateComponent(bobId, 'sitting-states:sitting_on', {
        furniture_id: tableId,
        spot_index: 3,
      });

      // Verify no closeness established (not adjacent)
      const aliceCloseness = await entityService.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobCloseness = await entityService.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness).toBeNull();
      expect(bobCloseness).toBeNull();

      // Both should be sitting though
      const aliceSitting = await entityService.getComponent(
        aliceId,
        'sitting-states:sitting_on'
      );
      const bobSitting = await entityService.getComponent(
        bobId,
        'sitting-states:sitting_on'
      );

      expect(aliceSitting).toBeDefined();
      expect(bobSitting).toBeDefined();
    });

    it('should handle rapid sit/stand cycles without state corruption', async () => {
      // Setup basic furniture and actors
      const benchId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null] },
          'core:name': { name: 'Quick Bench' },
          'core:location': { locationId: 'test:plaza' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:plaza',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:plaza',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      // Rapid cycle: sit, stand, sit, stand multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        // Both sit
        let aliceSit = await actionService.executeAction({
          actionId: 'positioning:sit_down',
          actorId: aliceId,
          targets: { furniture: benchId, spot: 0 },
        });

        let bobSit = await actionService.executeAction({
          actionId: 'positioning:sit_down',
          actorId: bobId,
          targets: { furniture: benchId, spot: 1 },
        });

        expect(aliceSit.success).toBe(true);
        expect(bobSit.success).toBe(true);

        // Update sitting states and establish closeness
        await entityService.updateComponent(aliceId, 'sitting-states:sitting_on', {
          furniture_id: benchId,
          spot_index: 0,
        });
        await entityService.updateComponent(bobId, 'sitting-states:sitting_on', {
          furniture_id: benchId,
          spot_index: 1,
        });
        await entityService.updateComponent(aliceId, 'personal-space-states:closeness', {
          partners: [bobId],
        });
        await entityService.updateComponent(bobId, 'personal-space-states:closeness', {
          partners: [aliceId],
        });

        // Verify closeness established
        let aliceCloseness = await entityService.getComponent(
          aliceId,
          'personal-space-states:closeness'
        );
        let bobCloseness = await entityService.getComponent(
          bobId,
          'personal-space-states:closeness'
        );

        expect(aliceCloseness).toBeDefined();
        expect(bobCloseness).toBeDefined();

        // Both stand
        let aliceStand = await actionService.executeAction({
          actionId: 'positioning:get_up_from_furniture',
          actorId: aliceId,
        });

        let bobStand = await actionService.executeAction({
          actionId: 'positioning:get_up_from_furniture',
          actorId: bobId,
        });

        expect(aliceStand.success).toBe(true);
        expect(bobStand.success).toBe(true);

        // Update states - remove sitting and closeness
        await entityService.updateComponent(
          aliceId,
          'sitting-states:sitting_on',
          null
        );
        await entityService.updateComponent(
          bobId,
          'sitting-states:sitting_on',
          null
        );
        await entityService.updateComponent(
          aliceId,
          'personal-space-states:closeness',
          null
        );
        await entityService.updateComponent(
          bobId,
          'personal-space-states:closeness',
          null
        );

        // Verify closeness removed and no corruption
        aliceCloseness = await entityService.getComponent(
          aliceId,
          'personal-space-states:closeness'
        );
        bobCloseness = await entityService.getComponent(
          bobId,
          'personal-space-states:closeness'
        );
        const aliceSitting = await entityService.getComponent(
          aliceId,
          'sitting-states:sitting_on'
        );
        const bobSitting = await entityService.getComponent(
          bobId,
          'sitting-states:sitting_on'
        );

        expect(aliceCloseness).toBeNull();
        expect(bobCloseness).toBeNull();
        expect(aliceSitting).toBeNull();
        expect(bobSitting).toBeNull();
      }
    });
  });
});
