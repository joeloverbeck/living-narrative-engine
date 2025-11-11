/**
 * @file Integration tests for mixed action type discovery (single-target + multi-target)
 * @description Tests that both single-target and multi-target actions can be
 * discovered and have correct structure when available simultaneously in the same pipeline.
 *
 * Test Strategy - Uses items mod exclusively:
 * - Single-target actions: examine_owned_item, drop_item, pick_up_item, open_container
 * - Multi-target actions: give_item, take_from_container
 *
 * Bug scenario: When both action types are available, the pipeline may fall back to
 * legacy formatting mode, causing multi-target actions to have unresolved placeholders.
 *
 * Expected behavior after fix:
 * - Single-target: "examine {item}" → correct action definition
 * - Multi-target: "give {item} to {recipient}" → correct action definition
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
    // This mod contains both single-target and multi-target actions:
    // - Single-target: examine_owned_item, drop_item, pick_up_item, open_container
    // - Multi-target: give_item, take_from_container
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:examine_owned_item'
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

    // Create items for actor's inventory (to give to recipient)
    const coinId = 'test:coin';
    const coin = new ModEntityBuilder(coinId)
      .withName('gold coin')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.01 })
      .withComponent('core:description', {
        text: 'A shiny gold coin',
      })
      .build();

    const letterId = 'test:letter';
    const letter = new ModEntityBuilder(letterId)
      .withName('sealed letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.02 })
      .withComponent('core:description', {
        text: 'A letter sealed with wax',
      })
      .build();

    // Create actor (the one performing actions) with items in inventory
    const actor = new ModEntityBuilder(actorId)
      .withName('Alice')
      .asActor()
      .atLocation('room1')
      .withComponent('positioning:closeness', {
        targetId: recipientActorId,
      })
      .withComponent('items:inventory', {
        items: [coinId, letterId],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    // Create recipient actor (close to actor, for give_item)
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
      .withComponent('items:weight', { weight: 0.1 })
      .withComponent('core:description', {
        text: 'A deep red ruby gem',
      })
      .build();

    const scrollId = 'test:scroll';
    const scroll = new ModEntityBuilder(scrollId)
      .withName('ancient scroll')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.05 })
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
      .withComponent('items:weight', { weight: 0.5 })
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
      .withComponent('items:weight', { weight: 1.2 })
      .build();

    // Load all entities into the test fixture
    testFixture.reset([
      room,
      actor,
      recipient,
      coin,
      letter,
      chest,
      gem,
      scroll,
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
      // Debug: Check loaded action definitions
      const actionRepository = testFixture.testEnv.actionRepository;
      const examineAction = actionRepository ? actionRepository.getActionDefinition('items:examine_owned_item') : null;

      console.log('\n=== ACTION DEFINITION DEBUG ===');
      console.log('Action repository exists:', !!actionRepository);
      console.log('examine_owned_item definition exists:', !!examineAction);
      if (examineAction) {
        console.log('examine_owned_item targets:', examineAction.targets);
        console.log('examine_owned_item required_components:', examineAction.required_components);
        console.log('examine_owned_item forbidden_components:', examineAction.forbidden_components);
        console.log('examine_owned_item prerequisites:', examineAction.prerequisites);
      } else {
        console.log('examine_owned_item action definition NOT LOADED');
        if (actionRepository) {
          const allActions = actionRepository.getAllActionDefinitions();
          console.log('All loaded actions:', allActions.map(a => a.id));
        }
      }

      // Get available actions for the actor
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      // Extract action IDs
      const actionIds = actions.map((a) => a.id);

      console.log('DEBUG discovered actions:', actionIds);

      // Should have both single-target and multi-target action types
      expect(actionIds).toContain('items:examine_owned_item'); // Single-target
      expect(actionIds).toContain('items:give_item'); // Multi-target
      expect(actionIds).toContain('items:take_from_container'); // Multi-target

      // Count each action type
      const examineActions = actions.filter(
        (a) => a.id === 'items:examine_owned_item'
      );

      // Debug: Check examine_item action structure after discovery
      console.log('\n=== EXAMINE_OWNED_ITEM AFTER DISCOVERY ===');
      console.log('examine_owned_item count:', examineActions.length);
      if (examineActions.length > 0) {
        const examineAction = examineActions[0];
        console.log('Has targets object:', !!examineAction.targets);
        console.log('targets type:', typeof examineAction.targets);
        console.log('Has targets.primary:', !!examineAction.targets?.primary);
        console.log('targets.primary.scope:', examineAction.targets?.primary?.scope);
        console.log('Template:', examineAction.template);
      } else {
        console.log('examine_owned_item NOT FOUND in discovered actions');
      }
      const giveActions = actions.filter((a) => a.id === 'items:give_item');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      expect(examineActions.length).toBeGreaterThan(0);
      expect(giveActions.length).toBeGreaterThan(0);
      expect(takeActions.length).toBeGreaterThan(0);

      console.log('✅ All action types discovered successfully');
      console.log(`  - examine_owned_item (single-target): ${examineActions.length}`);
      console.log(`  - give_item (multi-target): ${giveActions.length}`);
      console.log(
        `  - take_from_container (multi-target): ${takeActions.length}`
      );
    });

    it('should have examine_owned_item action definition in mixed action context', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const examineActions = actions.filter(
        (a) => a.id === 'items:examine_owned_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      // Check action definition properties (unformatted actions)
      for (const action of examineActions) {
        expect(action.id).toBe('items:examine_owned_item');
        expect(action.template).toBeDefined();
        expect(action.template).toBe('examine my {target}');
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined();

        console.log(`  ✅ examine_owned_item action definition found`);
      }
    });

    it('should have give_item action definition in mixed action context', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const giveActions = actions.filter((a) => a.id === 'items:give_item');

      expect(giveActions.length).toBeGreaterThan(0);

      // Check action definition properties (unformatted actions)
      for (const action of giveActions) {
        expect(action.id).toBe('items:give_item');
        expect(action.template).toBeDefined();
        expect(action.template).toBe('give {item} to {recipient}');
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined(); // recipient
        expect(action.targets.secondary).toBeDefined(); // item

        console.log(`  ✅ give_item action definition found`);
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
        expect(action.template).toBe('take {secondary.name} from {primary.name}');
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
      const actionTypes = ['items:examine_owned_item', 'items:give_item', 'items:take_from_container'];

      for (const actionType of actionTypes) {
        const typeActions = actions.filter((a) => a.id === actionType);

        // Collect all unique action combinations (id + template)
        const actionKeys = typeActions.map((a) => `${a.id}:${a.template}`);
        const uniqueKeys = new Set(actionKeys);

        // Should not have duplicates
        expect(uniqueKeys.size).toBe(actionKeys.length);

        console.log(`  ✅ No duplicate ${actionType} actions (${uniqueKeys.size} unique)`);
      }
    });
  });

  describe('Suite 2: Edge Cases', () => {
    it('should handle multiple items in inventory for give_item', async () => {
      // Actor has coin and letter in inventory (set up in beforeEach)
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const giveActions = actions.filter((a) => a.id === 'items:give_item');

      // In the discovery pipeline there is a single give_item definition that
      // generates combinations for all valid targets. We verify that the
      // underlying scope exposes multiple inventory items for that action.
      expect(giveActions.length).toBeGreaterThan(0);

      const scopeResolver = testFixture.testEnv.unifiedScopeResolver;
      expect(scopeResolver).toBeDefined();

      const inventoryResult = scopeResolver.resolveSync('items:actor_inventory_items', {
        actor: { id: actorId },
      });

      expect(inventoryResult?.success).toBe(true);

      const inventoryItems = Array.from(inventoryResult.value ?? []);

      expect(inventoryItems.length).toBeGreaterThanOrEqual(2); // coin and letter
      expect(inventoryItems).toEqual(
        expect.arrayContaining(['test:coin', 'test:letter'])
      );

      // Check action definition properties
      for (const action of giveActions) {
        expect(action.id).toBe('items:give_item');
        expect(action.template).toBe('give {item} to {recipient}');
        expect(action.targets).toBeDefined();
        expect(action.generateCombinations).toBe(true);

        console.log(`  ✅ Multiple inventory items handled: action found`);
      }
    });

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

      const contentsResult = scopeResolver.resolveSync('items:container_contents', {
        primary: { id: containerId },
      });
      expect(contentsResult?.success).toBe(true);

      const containerItems = Array.from(contentsResult.value ?? []);

      expect(containerItems.length).toBeGreaterThanOrEqual(2); // gem and scroll
      expect(containerItems).toEqual(
        expect.arrayContaining(['test:gem', 'test:scroll'])
      );

      // All actions should have proper structure
      for (const action of takeActions) {
        expect(action.id).toBe('items:take_from_container');
        expect(action.template).toBe('take {secondary.name} from {primary.name}');
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();
        expect(action.generateCombinations).toBe(true);

        console.log(`  ✅ Multiple container items handled: action found`);
      }
    });

    it('should handle when only examine_item is available (no recipients or containers)', async () => {
      // Remove the nearby recipient and container so only examinable items remain
      testFixture.entityManager.deleteEntity(recipientActorId);
      testFixture.entityManager.deleteEntity(containerId);

      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const examineActions = actions.filter(
        (a) => a.id === 'items:examine_owned_item'
      );
      const giveActions = actions.filter((a) => a.id === 'items:give_item');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      // Should only have examine actions (single-target)
      expect(examineActions.length).toBeGreaterThan(0);
      expect(giveActions.length).toBe(0);
      expect(takeActions.length).toBe(0);

      // Examine actions should have proper structure
      for (const action of examineActions) {
        expect(action.id).toBe('items:examine_owned_item');
        expect(action.template).toBe('examine my {target}');
        console.log(`  ✅ Single-target only: examine_owned_item found`);
      }
    });

    it('should handle when only multi-target actions are available (no examinable items)', async () => {
      // Remove description components to make all items non-examinable
      const bookId = 'test:book';
      const lampId = 'test:lamp';
      const coinId = 'test:coin';
      const letterId = 'test:letter';
      testFixture.entityManager.removeComponent(bookId, 'core:description');
      testFixture.entityManager.removeComponent(lampId, 'core:description');
      testFixture.entityManager.removeComponent(coinId, 'core:description');
      testFixture.entityManager.removeComponent(letterId, 'core:description');

      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const examineActions = actions.filter(
        (a) => a.id === 'items:examine_owned_item'
      );
      const giveActions = actions.filter((a) => a.id === 'items:give_item');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      // Should only have multi-target actions
      expect(giveActions.length).toBeGreaterThan(0);
      expect(takeActions.length).toBeGreaterThan(0);
      expect(examineActions.length).toBe(0);

      // Multi-target actions should have proper structure
      for (const action of [...giveActions, ...takeActions]) {
        expect(action.id).toBeDefined();
        expect(action.template).toBeDefined();
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();
        console.log(`  ✅ Multi-target only: ${action.id} found`);
      }
    });
  });

  describe('Suite 3: Pipeline Stage Verification', () => {
    it('should have complete multi-target action structure for give_item', async () => {
      // This test verifies that multi-target actions have all required structure
      // even though they're not formatted (unformatted action definitions)

      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const giveActions = actions.filter((a) => a.id === 'items:give_item');

      expect(giveActions.length).toBeGreaterThan(0);

      // Check that multi-target action structure is complete
      for (const action of giveActions) {
        expect(action.id).toBe('items:give_item');
        expect(action.template).toBeDefined();
        expect(action.template).toBe('give {item} to {recipient}');
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined(); // recipient
        expect(action.targets.secondary).toBeDefined(); // item

        console.log(
          `  ✅ Pipeline data structure complete for ${action.id}`
        );
      }
    });

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
        expect(action.template).toBe('take {secondary.name} from {primary.name}');
        expect(action.targets).toBeDefined();
        expect(action.targets.primary).toBeDefined(); // container
        expect(action.targets.secondary).toBeDefined(); // item
        expect(action.targets.secondary.contextFrom).toBe('primary');

        console.log(
          `  ✅ Pipeline data structure complete for ${action.id}`
        );
      }
    });

    it('should have both single-target and multi-target action templates', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const examineActions = actions.filter(
        (a) => a.id === 'items:examine_owned_item'
      );
      const giveActions = actions.filter((a) => a.id === 'items:give_item');
      const takeActions = actions.filter(
        (a) => a.id === 'items:take_from_container'
      );

      expect(examineActions.length).toBeGreaterThan(0);
      expect(giveActions.length).toBeGreaterThan(0);
      expect(takeActions.length).toBeGreaterThan(0);

      // Single-target actions have {target} placeholder
      for (const action of examineActions) {
        expect(action.template).toBe('examine my {target}');
        expect(action.targets.primary).toBeDefined();

        console.log(
          `  ✅ Single-target template: "${action.template}"`
        );
      }

      // Multi-target give_item has {item} and {recipient} placeholders
      for (const action of giveActions) {
        expect(action.template).toBe('give {item} to {recipient}');
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();

        console.log(
          `  ✅ Multi-target template: "${action.template}"`
        );
      }

      // Multi-target take_from_container has {primary.name} and {secondary.name}
      for (const action of takeActions) {
        expect(action.template).toBe('take {secondary.name} from {primary.name}');
        expect(action.targets.primary).toBeDefined();
        expect(action.targets.secondary).toBeDefined();

        console.log(
          `  ✅ Multi-target template: "${action.template}"`
        );
      }
    });

    it('should maintain correct target definitions in multi-target actions', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const multiTargetActions = [
        ...actions.filter((a) => a.id === 'items:give_item'),
        ...actions.filter((a) => a.id === 'items:take_from_container'),
      ];

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
        if (action.id === 'items:take_from_container') {
          expect(action.targets.secondary.contextFrom).toBe('primary');
        }

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
          a.id === 'items:examine_owned_item' ||
          a.id === 'items:give_item' ||
          a.id === 'items:take_from_container'
      );

      expect(relevantActions.length).toBeGreaterThan(0);

      // Check that all actions have valid templates (not malformed)
      for (const action of relevantActions) {
        expect(action.id).toBeDefined();
        expect(action.template).toBeDefined();

        // Templates should use proper placeholder syntax
        if (action.id === 'items:examine_owned_item') {
          expect(action.template).toBe('examine my {target}');
        } else if (action.id === 'items:give_item') {
          expect(action.template).toBe('give {item} to {recipient}');
        } else if (action.id === 'items:take_from_container') {
          expect(action.template).toBe('take {secondary.name} from {primary.name}');
        }

        console.log(`  ✅ Valid template for ${action.id}: "${action.template}"`);
      }
    });

    it('should not produce duplicate action definitions', async () => {
      const actions = testFixture.discoverActions(actorId);

      expect(Array.isArray(actions)).toBe(true);

      const actionTypes = [
        'items:examine_owned_item',
        'items:give_item',
        'items:take_from_container',
      ];

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
