/**
 * @file Integration tests for mixed action type discovery (single-target + multi-target)
 * @description Tests that both single-target and multi-target actions can be
 * discovered and have correct structure when available simultaneously in the same pipeline.
 *
 * Test Strategy - Uses items mod only:
 * - Single-target actions: open_container
 * - Multi-target actions: take_from_container
 *
 * This tests the action discovery pipeline's ability to handle multiple action types
 * from the same mod with different targeting structures.
 *
 * Bug scenario: When both action types are available, the pipeline may fall back to
 * legacy formatting mode, causing multi-target actions to have unresolved placeholders.
 *
 * Expected behavior after fix:
 * - Single-target: "open {container}" → correct action definition
 * - Multi-target: "take {secondary.name} from {primary.name}" → correct action definition
 * - All action types should have properly structured targets when discovered together
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

describe('Mixed Action Types Discovery - Integration', () => {
  let testFixture;
  let actorId;
  let recipientActorId;
  let containerId;

  beforeEach(async () => {
    // Create a test fixture for the items mod
    // This mod contains both single-target (open_container) and
    // multi-target (take_from_container) actions for testing mixed discovery.
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:take_from_container',
      null,
      null
    );

    // Use specific entity IDs for action discovery
    actorId = 'test:actor';
    recipientActorId = 'test:recipient';
    containerId = 'test:chest';

    // Create room location
    const room = new ModEntityBuilder('room1')
      .withName('Test Room')
      .withComponent('core:location', {})
      .build();

    // Create items for actor's inventory (for examine_owned_item testing)
    const coinId = 'test:coin';
    const coin = new ModEntityBuilder(coinId)
      .withName('gold coin')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.01 })
      .withComponent('core:description', {
        text: 'A shiny gold coin',
      })
      .build();

    const letterId = 'test:letter';
    const letter = new ModEntityBuilder(letterId)
      .withName('sealed letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.02 })
      .withComponent('core:description', {
        text: 'A letter sealed with wax',
      })
      .build();

    // Create actor (the one performing actions) with items in inventory
    const actorBuilder = new ModEntityBuilder(actorId)
      .withName('Alice')
      .asActor()
      .atLocation('room1')
      .withGrabbingHands(1) // Required for take_from_container prerequisite
      .withComponent('positioning:closeness', {
        targetId: recipientActorId,
      })
      .withComponent('items:inventory', {
        items: [coinId, letterId],
        capacity: { maxWeight: 50, maxItems: 10 },
      });
    const actor = actorBuilder.build();
    const actorHandEntities = actorBuilder.getHandEntities();

    // Create another actor (close to actor, for multi-actor scenario tests)
    const recipient = new ModEntityBuilder(recipientActorId)
      .withName('Bob')
      .asActor()
      .atLocation('room1')
      .withComponent('positioning:closeness', {
        targetId: actorId,
      })
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    // Create items inside container (for take_from_container)
    const gemId = 'test:gem';
    const gem = new ModEntityBuilder(gemId)
      .withName('ruby gem')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.1 })
      .withComponent('core:description', {
        text: 'A deep red ruby gem',
      })
      .build();

    const scrollId = 'test:scroll';
    const scroll = new ModEntityBuilder(scrollId)
      .withName('ancient scroll')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .withComponent('core:description', {
        text: 'An ancient scroll with mystical writing',
      })
      .build();

    // Create container at location (open, for take_from_container)
    const chest = new ModEntityBuilder(containerId)
      .withName('wooden chest')
      .atLocation('room1')
      .withComponent('items:item', {})
      .withComponent('items:container', {
        contents: [gemId, scrollId],
        capacity: { maxWeight: 100, maxItems: 20 },
        isOpen: true,
      })
      .build();

    // Create a second container that's closed (for open_container action)
    const closedBoxId = 'test:closed_box';
    const closedBox = new ModEntityBuilder(closedBoxId)
      .withName('metal box')
      .atLocation('room1')
      .withComponent('items:item', {})
      .withComponent('items:container', {
        contents: [],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: false,
      })
      .build();

    // Create examinable items at location (for examine_item)
    const bookId = 'test:book';
    const book = new ModEntityBuilder(bookId)
      .withName('leather journal')
      .atLocation('room1')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:description', {
        text: 'A weathered leather-bound journal',
      })
      .withComponent('core:weight', { weight: 0.5 })
      .build();

    const lampId = 'test:lamp';
    const lamp = new ModEntityBuilder(lampId)
      .withName('brass lamp')
      .atLocation('room1')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:description', {
        text: 'An ornate brass oil lamp',
      })
      .withComponent('core:weight', { weight: 1.2 })
      .build();

    // Load all entities into the test fixture
    testFixture.reset([
      room,
      actor,
      ...actorHandEntities,
      recipient,
      coin,
      letter,
      chest,
      gem,
      scroll,
      closedBox,
      book,
      lamp,
    ]);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Suite 1: Basic Mixed Action Discovery', () => {
    it('should discover single-target and multi-target actions when conditions are met', async () => {
      // Get available actions for the actor
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      // Extract action IDs
      const actionIds = actions.map((a) => a.id);

      console.log('DEBUG discovered actions:', actionIds);

      // Should have both single-target and multi-target action types
      expect(actionIds).toContain('items:open_container'); // Single-target
      expect(actionIds).toContain('items:take_from_container'); // Multi-target

      // Count each action type
      const openActions = actions.filter((a) => a.id === 'items:open_container');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      expect(openActions.length).toBeGreaterThan(0);
      expect(takeActions.length).toBeGreaterThan(0);

      console.log('✅ All action types discovered successfully');
      console.log(`  - open_container (single-target): ${openActions.length}`);
      console.log(
        `  - take_from_container (multi-target): ${takeActions.length}`
      );
    });

    it('should have open_container action definition in mixed action context', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const openActions = actions.filter((a) => a.id === 'items:open_container');

      expect(openActions.length).toBeGreaterThan(0);

      // Check action definition properties (unformatted actions)
      for (const action of openActions) {
        expect(action.id).toBe('items:open_container');
        expect(action.template).toBeDefined();
        expect(action.template).toBe('open {container}');
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined();

        console.log(`  ✅ open_container action definition found`);
      }
    });

    it('should have take_from_container action definition in mixed action context', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      expect(takeActions.length).toBeGreaterThan(0);

      // Check action definition properties (unformatted actions)
      for (const action of takeActions) {
        expect(action.id).toBe('items:take_from_container');
        expect(action.template).toBeDefined();
        expect(action.template).toBe(
          'take {secondary.name} from {primary.name}'
        );
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined(); // container
        expect(action.targets.secondary).toBeDefined(); // item
        expect(action.targets.secondary.contextFrom).toBe('primary');

        console.log(`  ✅ take_from_container action definition found`);
      }
    });

    it('should not create duplicate actions', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      // Check for duplicates in each action type
      const actionTypes = ['items:open_container', 'items:take_from_container'];

      for (const actionType of actionTypes) {
        const typeActions = actions.filter((a) => a.id === actionType);

        // Collect all unique action combinations (id + template)
        const actionKeys = typeActions.map((a) => `${a.id}:${a.template}`);
        const uniqueKeys = new Set(actionKeys);

        // Should not have duplicates
        expect(uniqueKeys.size).toBe(actionKeys.length);

        console.log(
          `  ✅ No duplicate ${actionType} actions (${uniqueKeys.size} unique)`
        );
      }
    });
  });

  describe('Suite 2: Edge Cases', () => {
    it('should handle multiple items in container for take_from_container', async () => {
      // Chest has gem and scroll inside (set up in beforeEach)
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      // There is a single action definition that should generate combinations.
      // Validate that the scope resolver reports both container items.
      expect(takeActions.length).toBeGreaterThan(0);

      const scopeResolver = testFixture.testEnv.unifiedScopeResolver;
      expect(scopeResolver).toBeDefined();

      const containerResult = scopeResolver.resolveSync(
        'items:open_containers_at_location',
        { actor: { id: actorId } }
      );
      expect(containerResult?.success).toBe(true);
      const containers = Array.from(containerResult.value ?? []);
      expect(containers).toContain(containerId);

      const contentsResult = scopeResolver.resolveSync(
        'items:container_contents',
        {
          primary: { id: containerId },
        }
      );
      expect(contentsResult?.success).toBe(true);

      const containerItems = Array.from(contentsResult.value ?? []);

      expect(containerItems.length).toBeGreaterThanOrEqual(2); // gem and scroll
      expect(containerItems).toEqual(
        expect.arrayContaining(['test:gem', 'test:scroll'])
      );

      // All actions should have proper structure
      for (const action of takeActions) {
        expect(action.id).toBe('items:take_from_container');
        expect(action.template).toBe(
          'take {secondary.name} from {primary.name}'
        );
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();
        expect(action.generateCombinations).toBe(true);

        console.log(`  ✅ Multiple container items handled: action found`);
      }
    });

    it('should handle when only single-target actions are available (no open containers)', async () => {
      // Remove the open container so take_from_container is not available
      // but keep closed container for open_container action
      testFixture.entityManager.deleteEntity(containerId);

      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const openActions = actions.filter((a) => a.id === 'items:open_container');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      // Should only have single-target actions (open_container)
      expect(openActions.length).toBeGreaterThan(0);
      expect(takeActions.length).toBe(0);

      // open_container actions should have proper structure
      for (const action of openActions) {
        expect(action.id).toBe('items:open_container');
        expect(action.template).toBe('open {container}');
        console.log(`  ✅ Single-target only: open_container found`);
      }
    });

    it('should handle when only multi-target actions are available (no closed containers)', async () => {
      // Remove the closed container so open_container is not available
      testFixture.entityManager.deleteEntity('test:closed_box');

      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const openActions = actions.filter((a) => a.id === 'items:open_container');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      // Should only have multi-target actions (take_from_container)
      expect(takeActions.length).toBeGreaterThan(0);
      expect(openActions.length).toBe(0);

      // Multi-target actions should have proper structure
      for (const action of takeActions) {
        expect(action.id).toBeDefined();
        expect(action.template).toBeDefined();
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();
        console.log(`  ✅ Multi-target only: ${action.id} found`);
      }
    });
  });

  describe('Suite 3: Pipeline Stage Verification', () => {
    it('should have complete multi-target action structure for take_from_container', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      expect(takeActions.length).toBeGreaterThan(0);

      // Check that multi-target action structure is complete
      for (const action of takeActions) {
        expect(action.id).toBe('items:take_from_container');
        expect(action.template).toBeDefined();
        expect(action.template).toBe(
          'take {secondary.name} from {primary.name}'
        );
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined(); // container
        expect(action.targets.secondary).toBeDefined(); // item
        expect(action.targets.secondary.contextFrom).toBe('primary');

        console.log(`  ✅ Pipeline data structure complete for ${action.id}`);
      }
    });

    it('should have both single-target and multi-target action templates', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const openActions = actions.filter((a) => a.id === 'items:open_container');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      expect(openActions.length).toBeGreaterThan(0);
      expect(takeActions.length).toBeGreaterThan(0);

      // Single-target actions have {container} placeholder
      for (const action of openActions) {
        expect(action.template).toBe('open {container}');
        expect(action.targets.primary).toBeDefined();

        console.log(`  ✅ Single-target template: "${action.template}"`);
      }

      // Multi-target take_from_container has {primary.name} and {secondary.name}
      for (const action of takeActions) {
        expect(action.template).toBe(
          'take {secondary.name} from {primary.name}'
        );
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();

        console.log(`  ✅ Multi-target template: "${action.template}"`);
      }
    });

    it('should maintain correct target definitions in multi-target actions', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const multiTargetActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      expect(multiTargetActions.length).toBeGreaterThan(0);

      // Check that action definitions have target structure
      for (const action of multiTargetActions) {
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();

        // Verify target definitions have required properties
        expect(action.targets.primary.scope).toBeDefined();
        expect(action.targets.secondary.scope).toBeDefined();

        // take_from_container has contextFrom
        expect(action.targets.secondary.contextFrom).toBe('primary');

        console.log('  ✅ Multi-target structure:', {
          id: action.id,
          primaryScope: action.targets.primary.scope,
          secondaryScope: action.targets.secondary.scope,
        });
      }
    });
  });

  describe('Suite 4: Regression Prevention', () => {
    it('should have valid action templates for all action types', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const relevantActions = actions.filter(
        (a) =>
          a.id === 'items:open_container' || a.id === 'items:take_from_container'
      );

      expect(relevantActions.length).toBeGreaterThan(0);

      // Check that all actions have valid templates (not malformed)
      for (const action of relevantActions) {
        expect(action.id).toBeDefined();
        expect(action.template).toBeDefined();

        // Templates should use proper placeholder syntax
        const expectedTemplates = {
          'items:open_container': 'open {container}',
          'items:take_from_container':
            'take {secondary.name} from {primary.name}',
        };
        const expectedTemplate = expectedTemplates[action.id];
        expect(action.template).toBe(expectedTemplate);

        console.log(
          `  ✅ Valid template for ${action.id}: "${action.template}"`
        );
      }
    });

    it('should not produce duplicate action definitions', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const actionTypes = ['items:open_container', 'items:take_from_container'];

      for (const actionType of actionTypes) {
        const typeActions = actions.filter((a) => a.id === actionType);

        if (typeActions.length === 0) continue;

        // Group actions by their unique key (id + template)
        const actionKeys = typeActions.map((a) => `${a.id}:${a.template}`);
        const uniqueKeys = new Set(actionKeys);

        // Check that each action definition appears only once
        expect(uniqueKeys.size).toBe(actionKeys.length);

        if (uniqueKeys.size !== actionKeys.length) {
          console.log(`  ❌ Found duplicate ${actionType} definitions`);
        } else {
          console.log(`  ✅ No duplicate ${actionType} definitions found`);
        }
      }
    });
  });
});
