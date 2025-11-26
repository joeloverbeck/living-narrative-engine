import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

describe('Complex Blocking Scenarios', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_clothing',
      null,  // ruleFile - auto-loaded
      null,  // conditionFile - auto-loaded
      {
        autoRegisterScopes: true,
        scopeCategories: ['clothing']
      }
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  // Helper to get removable items via scope resolution
  const getRemovableItems = (actorId) => {
    const testContext = { actor: { id: actorId, components: {} } };
    const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', testContext);
    return Array.from(scopeResult.value);
  };

  it('should handle multiple items blocking the same target', async () => {
    // Arrange: Belt AND suspenders both block pants
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

    const suspenders = fixture.createEntity({
      id: 'suspenders',
      name: 'Suspenders',
      components: {
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_upper' },
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

    // Set up equipment state with all items equipped
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          accessories: suspenders,
        },
        torso_lower: {
          accessories: belt,
        },
        legs: {
          base: pants,
        },
      },
    });

    // Act: Verify action is discovered
    let actions = fixture.discoverActions(actor.id);
    let removeAction = actions.find((a) => a.id === 'clothing:remove_clothing');
    expect(removeAction).toBeDefined();

    // Check removable items via scope resolution
    let removableItems = getRemovableItems(actor.id);

    // Assert: Pants blocked by both items
    expect(removableItems).toContain(belt);
    expect(removableItems).toContain(suspenders);
    expect(removableItems).not.toContain(pants);

    // Remove only belt (simulate removal by updating equipment)
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          accessories: suspenders,
        },
        legs: {
          base: pants,
        },
        // torso_lower removed (belt unequipped)
      },
    });

    removableItems = getRemovableItems(actor.id);

    // Assert: Pants still blocked by suspenders
    expect(removableItems).not.toContain(belt);
    expect(removableItems).toContain(suspenders);
    expect(removableItems).not.toContain(pants);

    // Remove suspenders (simulate removal by updating equipment)
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        legs: {
          base: pants,
        },
        // torso_lower and torso_upper removed (both accessories unequipped)
      },
    });

    removableItems = getRemovableItems(actor.id);

    // Assert: Pants now unblocked
    expect(removableItems).not.toContain(belt);
    expect(removableItems).not.toContain(suspenders);
    expect(removableItems).toContain(pants);
  });

  it('should handle armor blocking multiple layers', async () => {
    // Arrange: Armor blocks both base and underwear layers
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

    const armor = fixture.createEntity({
      id: 'cuirass',
      name: 'Steel Cuirass',
      components: {
        'clothing:wearable': {
          layer: 'outer',
          equipmentSlots: { primary: 'torso_upper' },
        },
        'clothing:blocks_removal': {
          blockedSlots: [
            {
              slot: 'torso_upper',
              layers: ['base', 'underwear'],
              blockType: 'full_block',
            },
          ],
        },
      },
    });

    const shirt = fixture.createEntity({
      id: 'shirt',
      name: 'Cotton Shirt',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

    const undershirt = fixture.createEntity({
      id: 'undershirt',
      name: 'Undershirt',
      components: {
        'clothing:wearable': {
          layer: 'underwear',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

    // Set up equipment state with layered clothing
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          outer: armor,
          base: shirt,
          underwear: undershirt,
        },
      },
    });

    // Act: Verify action is discovered
    const actions = fixture.discoverActions(actor.id);
    const removeAction = actions.find((a) => a.id === 'clothing:remove_clothing');
    expect(removeAction).toBeDefined();

    // Check removable items via scope resolution
    const removableItems = getRemovableItems(actor.id);

    // Assert: Only armor removable
    expect(removableItems).toContain(armor);
    expect(removableItems).not.toContain(shirt);
    expect(removableItems).not.toContain(undershirt);
  });

  it('should handle explicit item ID blocking', async () => {
    // Arrange: Cursed ring blocks specific artifact
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

    const cursedRing = fixture.createEntity({
      id: 'cursed_ring',
      name: 'Cursed Ring',
      components: {
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'hands' },
        },
        'clothing:blocks_removal': {
          blocksRemovalOf: ['artifact_glove'],
        },
      },
    });

    const artifactGlove = fixture.createEntity({
      id: 'artifact_glove',
      name: 'Artifact Glove',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'hands' },
        },
      },
    });

    const regularGlove = fixture.createEntity({
      id: 'regular_glove',
      name: 'Regular Glove',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'hands' },
        },
      },
    });

    // Set up equipment state with ring and artifact glove
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        hands: {
          accessories: cursedRing,
          base: artifactGlove,
        },
      },
    });

    // Act: Verify action is discovered
    let actions = fixture.discoverActions(actor.id);
    let removeAction = actions.find((a) => a.id === 'clothing:remove_clothing');
    expect(removeAction).toBeDefined();

    // Check removable items via scope resolution
    let removableItems = getRemovableItems(actor.id);

    // Assert: Artifact glove blocked by cursed ring
    expect(removableItems).toContain(cursedRing);
    expect(removableItems).not.toContain(artifactGlove);

    // Add regular glove to equipment (different hand or slot)
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        hands: {
          accessories: cursedRing,
          base: artifactGlove,
          // Note: In real implementation, regular glove might be in different slot
          // This is conceptual - adjust based on actual equipment slot structure
        },
        hands_left: {
          base: regularGlove,
        },
      },
    });

    removableItems = getRemovableItems(actor.id);

    // Regular glove not blocked (not in blocksRemovalOf list)
    expect(removableItems).toContain(regularGlove);
    expect(removableItems).not.toContain(artifactGlove);
  });
});
