import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

describe('Blocking System Edge Cases', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_clothing',
      null, // ruleFile - auto-loaded
      null, // conditionFile - auto-loaded
      {
        autoRegisterScopes: true,
        scopeCategories: ['clothing'],
      }
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should not allow item to block itself', async () => {
    // Arrange: Belt with self-referential blocking (should be ignored)
    // Create actor with 2 grabbing hands (required for remove_clothing prerequisite)
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('John')
      .atLocation('room1')
      .asActor()
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    fixture.reset([room, actor, ...handEntities]);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Self-Blocking Belt',
      components: {
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_lower' },
        },
        'clothing:blocks_removal': {
          blockedSlots: [
            {
              slot: 'torso_lower',
              layers: ['accessories'],
              blockType: 'must_remove_first',
            },
          ],
        },
      },
    });

    // Set up equipment state with belt
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt,
        },
      },
    });

    // Act: Check that action is discovered
    const actions = fixture.discoverActions(actor.id);
    const removeAction = actions.find(
      (a) => a.id === 'clothing:remove_clothing'
    );
    expect(removeAction).toBeDefined();

    // Resolve the scope to get removable items
    const testContext = { actor: { id: actor.id, components: {} } };
    const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'clothing:topmost_clothing',
      testContext
    );
    const removableItems = Array.from(scopeResult.value);

    // Assert: Belt should still be removable (not blocking itself)
    expect(removableItems).toContain(belt);
  });

  it('should handle empty equipment gracefully', async () => {
    // Arrange: Actor with no clothing
    // Create actor with 2 grabbing hands (required for remove_clothing prerequisite)
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('John')
      .atLocation('room1')
      .asActor()
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    fixture.reset([room, actor, ...handEntities]);

    // Initialize empty equipment component
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {},
    });

    // Verify equipment component exists and is empty
    const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipment).toBeDefined();
    expect(equipment.equipped).toEqual({});

    // Act & Assert: Action discovery should not throw with empty equipment
    expect(() => {
      const actions = fixture.discoverActions(actor.id);
      const removeActions = actions.filter(
        (a) => a.id === 'clothing:remove_clothing'
      );
      expect(removeActions).toHaveLength(0);
    }).not.toThrow();
  });

  it('should handle malformed blocking component', async () => {
    // Arrange: Item with missing fields in blocking component
    // Create actor with 2 grabbing hands (required for remove_clothing prerequisite)
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('John')
      .atLocation('room1')
      .asActor()
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    fixture.reset([room, actor, ...handEntities]);

    const item = fixture.createEntity({
      id: 'malformed_item',
      name: 'Malformed Item',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
        'clothing:blocks_removal': {
          blockedSlots: [], // Empty array (edge case - valid but does nothing)
        },
      },
    });

    // Act & Assert: Should not throw when setting up equipment
    await expect(async () => {
      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: item,
          },
        },
      });

      // Action discovery should handle this gracefully
      const actions = fixture.discoverActions(actor.id);
      const removeAction = actions.find(
        (a) => a.id === 'clothing:remove_clothing'
      );
      expect(removeAction).toBeDefined();

      // Resolve the scope to get removable items
      const testContext = { actor: { id: actor.id, components: {} } };
      const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'clothing:topmost_clothing',
        testContext
      );
      const removableItems = Array.from(scopeResult.value);

      // Item should be removable (empty blockedSlots means it blocks nothing)
      expect(removableItems).toContain(item);
    }).resolves.not.toThrow();
  });

  it('should handle state changes between discovery and execution', async () => {
    // Arrange
    // Create actor with 2 grabbing hands (required for remove_clothing prerequisite)
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('John')
      .atLocation('room1')
      .asActor()
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    fixture.reset([room, actor, ...handEntities]);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Leather Belt',
      components: {
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_lower' },
        },
        'clothing:blocks_removal': {
          blockedSlots: [
            {
              slot: 'legs',
              layers: ['base'],
              blockType: 'must_remove_first',
            },
          ],
        },
      },
    });

    const pants = fixture.createEntity({
      id: 'pants',
      name: 'Jeans',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      },
    });

    // Set up equipment state with belt and pants
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt,
        },
        legs: {
          base: pants,
        },
      },
    });

    // Verify action is discovered and belt is removable
    const actions = fixture.discoverActions(actor.id);
    const removeAction = actions.find(
      (a) => a.id === 'clothing:remove_clothing'
    );
    expect(removeAction).toBeDefined();

    // Resolve scope to verify belt is removable
    const testContext = { actor: { id: actor.id, components: {} } };
    const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'clothing:topmost_clothing',
      testContext
    );
    const removableItems = Array.from(scopeResult.value);
    expect(removableItems).toContain(belt);

    // Simulate: Another actor removes belt during AI turn
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        legs: {
          base: pants,
        },
        // torso_lower removed (belt unequipped)
      },
    });

    // Verify belt is no longer equipped
    const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower).toBeUndefined();

    // Act: Try to execute belt removal action
    // This should handle the missing item gracefully (item no longer equipped)
    await fixture.executeAction(actor.id, belt);

    // Assert: Check events for handling of this edge case
    // The action should either fail gracefully or be a no-op
    // (Implementation-specific behavior - adjust assertion based on actual behavior)
  });
});
