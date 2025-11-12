import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Complete Clothing Removal Workflow - E2E', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should enforce removal order in full outfit', async () => {
    // Arrange: Actor wearing jacket, shirt, belt, pants
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const jacket = fixture.createEntity({
      id: 'jacket',
      name: 'Leather Jacket',
      components: {
        'clothing:wearable': {
          layer: 'outer',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

    const shirt = fixture.createEntity({
      id: 'shirt',
      name: 'T-Shirt',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

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

    // Set up equipment state via component modification
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          outer: jacket.id,
          base: shirt.id,
        },
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act & Assert: Validate removal sequence
    // Test scope behavior indirectly via action discovery
    let actions = fixture.discoverActions(actor.id);
    let removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    let removableItems = removeActions.map((a) => a.targetId);

    // Initially: jacket, shirt, belt removable (pants blocked)
    expect(removableItems).toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).toContain(belt.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove jacket
    await fixture.executeAction(actor.id, jacket.id);

    // Verify action succeeded via component state
    const equipmentAfterJacket = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterJacket.equipped.torso_upper.outer).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    removableItems = removeActions.map((a) => a.targetId);

    // Now: shirt, belt removable (pants still blocked)
    expect(removableItems).not.toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).toContain(belt.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Verify belt removal
    const equipmentAfterBelt = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterBelt.equipped.torso_lower.accessories).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    removableItems = removeActions.map((a) => a.targetId);

    // Now: shirt, pants removable (belt removed)
    expect(removableItems).not.toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).toContain(pants.id);

    // Remove pants
    await fixture.executeAction(actor.id, pants.id);

    // Verify pants removal
    const equipmentAfterPants = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterPants.equipped.legs.base).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    removableItems = removeActions.map((a) => a.targetId);

    // Now: only shirt removable
    expect(removableItems).not.toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).not.toContain(pants.id);
  });

  it('should prevent removal of blocked items via action discovery', async () => {
    // Arrange
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
              reason: 'Belt secures pants at waist',
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
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: Check action discovery
    const actions = fixture.discoverActions(actor.id);
    const pantsRemovalActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === pants.id
    );

    // Assert: Pants removal should not be available
    expect(pantsRemovalActions).toHaveLength(0);

    // Belt removal should be available
    const beltRemovalActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === belt.id
    );
    expect(beltRemovalActions).toHaveLength(1);
  });

  it('should update available actions after each removal', async () => {
    // Arrange
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
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: Get available actions before removal
    const actionsBefore = fixture.discoverActions(actor.id);

    // Should have remove_clothing action for belt only
    const beltRemovalActions = actionsBefore.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === belt.id
    );
    const pantsRemovalActions = actionsBefore.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === pants.id
    );

    expect(beltRemovalActions).toHaveLength(1);
    expect(pantsRemovalActions).toHaveLength(0);

    // Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Verify belt removal
    const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower.accessories).toBeUndefined();

    // Get available actions after removal
    const actionsAfter = fixture.discoverActions(actor.id);

    // Should now have remove_clothing action for pants
    const pantsRemovalAfter = actionsAfter.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === pants.id
    );

    expect(pantsRemovalAfter).toHaveLength(1);
  });
});

describe('Multi-Actor Clothing Removal - E2E', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_others_clothing'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should enforce blocking when one actor removes anothers clothing', async () => {
    // Arrange
    const { actor, target } = fixture.createStandardActorTarget(['John', 'Jane']);

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

    // Set up target's equipment state
    await fixture.modifyComponent(target.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: John discovers actions (filter for actions targeting Jane)
    const availableActions = fixture.discoverActions(actor.id);
    const actionsForTarget = availableActions.filter(
      (a) =>
        a.id === 'clothing:remove_others_clothing' &&
        (a.primaryId === target.id || a.targetId === pants.id)
    );

    const pantsRemovalActions = actionsForTarget.filter(
      (a) => a.targetId === pants.id || a.secondaryId === pants.id
    );

    // Assert: Pants removal should not be available
    expect(pantsRemovalActions).toHaveLength(0);

    // Belt removal should be available
    const beltRemovalActions = actionsForTarget.filter(
      (a) => a.targetId === belt.id || a.secondaryId === belt.id
    );
    expect(beltRemovalActions.length).toBeGreaterThan(0);

    // Act: John removes Jane's belt first
    // For remove_others_clothing: actor -> target (person) -> item
    await fixture.executeAction(actor.id, target.id, { itemId: belt.id });

    // Verify belt removal
    const equipment = fixture.getComponent(target.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower.accessories).toBeUndefined();

    // Discover actions again
    const actionsAfterBelt = fixture.discoverActions(actor.id);
    const actionsForTargetAfter = actionsAfterBelt.filter(
      (a) =>
        a.id === 'clothing:remove_others_clothing' &&
        (a.primaryId === target.id || a.targetId === pants.id)
    );

    const pantsRemovalAfter = actionsForTargetAfter.filter(
      (a) => a.targetId === pants.id || a.secondaryId === pants.id
    );

    // Assert: Pants removal should now be available
    expect(pantsRemovalAfter).toHaveLength(1);
  });
});
