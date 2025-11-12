import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

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

  it('should handle multiple items blocking the same target', async () => {
    // Arrange: Belt AND suspenders both block pants
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

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

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          accessories: suspenders.id,
        },
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: Check removable items via action discovery
    let actions = fixture.discoverActions(actor.id);
    let removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    let removableItems = removeActions.map((a) => a.targetId);

    // Assert: Pants blocked by both items
    expect(removableItems).toContain(belt.id);
    expect(removableItems).toContain(suspenders.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove only belt
    await fixture.executeAction(actor.id, belt.id);

    // Verify belt removal
    const equipmentAfterBelt = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterBelt.equipped.torso_lower.accessories).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    removableItems = removeActions.map((a) => a.targetId);

    // Assert: Pants still blocked by suspenders
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).toContain(suspenders.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove suspenders
    await fixture.executeAction(actor.id, suspenders.id);

    // Verify suspenders removal
    const equipmentAfterSuspenders = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterSuspenders.equipped.torso_upper.accessories).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    removableItems = removeActions.map((a) => a.targetId);

    // Assert: Pants now unblocked
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).not.toContain(suspenders.id);
    expect(removableItems).toContain(pants.id);
  });

  it('should handle armor blocking multiple layers', async () => {
    // Arrange: Armor blocks both base and underwear layers
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

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

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          outer: armor.id,
          base: shirt.id,
          underwear: undershirt.id,
        },
      },
    });

    // Act: Check removable items via action discovery
    const actions = fixture.discoverActions(actor.id);
    const removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    const removableItems = removeActions.map((a) => a.targetId);

    // Assert: Only armor removable
    expect(removableItems).toContain(armor.id);
    expect(removableItems).not.toContain(shirt.id);
    expect(removableItems).not.toContain(undershirt.id);
  });

  it('should handle explicit item ID blocking', async () => {
    // Arrange: Cursed ring blocks specific artifact
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

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
          accessories: cursedRing.id,
          base: artifactGlove.id,
        },
      },
    });

    // Act: Check removable items via action discovery
    let actions = fixture.discoverActions(actor.id);
    let removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    let removableItems = removeActions.map((a) => a.targetId);

    // Assert: Artifact glove blocked by cursed ring
    expect(removableItems).toContain(cursedRing.id);
    expect(removableItems).not.toContain(artifactGlove.id);

    // Add regular glove to equipment (different hand or slot)
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        hands: {
          accessories: cursedRing.id,
          base: artifactGlove.id,
          // Note: In real implementation, regular glove might be in different slot
          // This is conceptual - adjust based on actual equipment slot structure
        },
        hands_left: {
          base: regularGlove.id,
        },
      },
    });

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    removableItems = removeActions.map((a) => a.targetId);

    // Regular glove not blocked (not in blocksRemovalOf list)
    expect(removableItems).toContain(regularGlove.id);
    expect(removableItems).not.toContain(artifactGlove.id);
  });
});
