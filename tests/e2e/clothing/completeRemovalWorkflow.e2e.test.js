import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import removeClothingAction from '../../../data/mods/clothing/actions/remove_clothing.action.json';

describe('Complete Clothing Removal Workflow - E2E', () => {
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
    // Register the action for discovery
    fixture.testEnv.actionIndex.buildIndex([removeClothingAction]);
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should enforce removal order in full outfit', async () => {
    // Arrange: Create room
    const room = new ModEntityBuilder('room1')
      .withName('Test Room')
      .withComponent('core:location', { description: 'A test room' })
      .build();

    // Create actor with clothing equipment
    const actor = new ModEntityBuilder('actor1')
      .withName('John')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('clothing:equipment', { equipped: {} })
      .build();

    // Create clothing items with proper components
    const jacket = new ModEntityBuilder('jacket')
      .withName('Leather Jacket')
      .atLocation('room1')
      .withComponent('clothing:item', {
        name: 'Leather Jacket',
        slot: 'torso_upper',
        layer: 'outer',
      })
      .withComponent('clothing:coverage_mapping', {
        covers: ['torso_upper'],
        coveragePriority: 'outer',
      })
      .build();

    const shirt = new ModEntityBuilder('shirt')
      .withName('T-Shirt')
      .atLocation('room1')
      .withComponent('clothing:item', {
        name: 'T-Shirt',
        slot: 'torso_upper',
        layer: 'base',
      })
      .withComponent('clothing:coverage_mapping', {
        covers: ['torso_upper'],
        coveragePriority: 'base',
      })
      .build();

    const belt = new ModEntityBuilder('belt')
      .withName('Leather Belt')
      .atLocation('room1')
      .withComponent('clothing:item', {
        name: 'Leather Belt',
        slot: 'torso_lower',
        layer: 'accessories',
      })
      .withComponent('clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'accessories',
      })
      .withComponent('clothing:blocks_removal', {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      })
      .build();

    const pants = new ModEntityBuilder('pants')
      .withName('Jeans')
      .atLocation('room1')
      .withComponent('clothing:item', {
        name: 'Jeans',
        slot: 'legs',
        layer: 'base',
      })
      .withComponent('clothing:coverage_mapping', {
        covers: ['legs'],
        coveragePriority: 'base',
      })
      .build();

    // Reset fixture with all entities
    fixture.reset([room, actor, jacket, shirt, belt, pants]);

    // Set up equipment state - actor wearing all items
    await fixture.modifyComponent('actor1', 'clothing:equipment', {
      equipped: {
        torso_upper: {
          outer: 'jacket',
          base: 'shirt',
        },
        torso_lower: {
          accessories: 'belt',
        },
        legs: {
          base: 'pants',
        },
      },
    });

    // Act & Assert: Validate removal sequence
    // Test scope behavior by resolving the scope directly
    let context = { actor: { id: 'actor1' } };
    let scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', context);
    let removableItems = Array.from(scopeResult.value);

    // Also verify action is discoverable
    let actions = fixture.discoverActions('actor1');
    let removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    expect(removeActions.length).toBeGreaterThan(0);

    // Initially: jacket (topmost in torso_upper), belt (topmost in torso_lower) removable
    // Pants should be blocked by belt
    // Shirt is NOT in topmost_clothing because jacket covers it
    expect(removableItems).toContain('jacket');
    expect(removableItems).toContain('belt');
    expect(removableItems).not.toContain('shirt'); // Hidden under jacket
    expect(removableItems).not.toContain('pants'); // Blocked by belt

    // Remove jacket
    await fixture.executeAction('actor1', 'jacket');

    // Verify action succeeded via component state
    const equipmentAfterJacket = fixture.getComponent('actor1', 'clothing:equipment');
    expect(equipmentAfterJacket.equipped.torso_upper.outer).toBeUndefined();

    scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', context);
    removableItems = Array.from(scopeResult.value);

    // Now: shirt (now topmost in torso_upper), belt removable (pants still blocked)
    expect(removableItems).not.toContain('jacket'); // Already removed
    expect(removableItems).toContain('shirt'); // Now exposed
    expect(removableItems).toContain('belt');
    expect(removableItems).not.toContain('pants'); // Still blocked by belt

    // Remove belt
    await fixture.executeAction('actor1', 'belt');

    // Verify belt removal
    const equipmentAfterBelt = fixture.getComponent('actor1', 'clothing:equipment');
    expect(equipmentAfterBelt.equipped.torso_lower.accessories).toBeUndefined();

    scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', context);
    removableItems = Array.from(scopeResult.value);

    // Now: shirt, pants removable (belt removed)
    expect(removableItems).not.toContain('jacket');
    expect(removableItems).toContain('shirt');
    expect(removableItems).not.toContain('belt');
    expect(removableItems).toContain('pants');

    // Remove pants
    await fixture.executeAction('actor1', 'pants');

    // Verify pants removal
    const equipmentAfterPants = fixture.getComponent('actor1', 'clothing:equipment');
    expect(equipmentAfterPants.equipped.legs.base).toBeUndefined();

    scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', context);
    removableItems = Array.from(scopeResult.value);

    // Now: only shirt removable
    expect(removableItems).not.toContain('jacket');
    expect(removableItems).toContain('shirt');
    expect(removableItems).not.toContain('belt');
    expect(removableItems).not.toContain('pants');
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

    // Act: Check scope resolution to verify blocking
    const context = { actor: { id: actor.id } };
    const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', context);
    const removableItems = Array.from(scopeResult.value);

    // Also verify action is discoverable
    const actions = fixture.discoverActions(actor.id);
    const removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    expect(removeActions.length).toBeGreaterThan(0);

    // Assert: Pants removal should not be available (blocked by belt)
    expect(removableItems).not.toContain(pants.id);

    // Belt removal should be available
    expect(removableItems).toContain(belt.id);
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
    const context = { actor: { id: actor.id } };
    let scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', context);
    let removableItems = Array.from(scopeResult.value);

    // Should have belt available but not pants (blocked)
    expect(removableItems).toContain(belt.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Verify belt removal
    const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower.accessories).toBeUndefined();

    // Get available actions after removal
    scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', context);
    removableItems = Array.from(scopeResult.value);

    // Should now have pants available (no longer blocked)
    expect(removableItems).toContain(pants.id);
    expect(removableItems).not.toContain(belt.id);
  });
});

describe('Multi-Actor Clothing Removal - E2E', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_others_clothing',
      null,  // ruleFile - auto-loaded
      null,  // conditionFile - auto-loaded
      {
        autoRegisterScopes: true,
        scopeCategories: ['clothing', 'positioning']  // positioning for close_actors scope
      }
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

    // Act: Check what clothing items are removable from target
    // Use target's context to resolve scope
    const targetContext = { actor: { id: target.id } };
    let scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', targetContext);
    let removableItems = Array.from(scopeResult.value);

    // Assert: Pants should not be removable (blocked by belt)
    expect(removableItems).not.toContain(pants.id);

    // Belt should be removable
    expect(removableItems).toContain(belt.id);

    // Act: John removes Jane's belt first
    // For remove_others_clothing: actor -> target (person) -> item
    await fixture.executeAction(actor.id, target.id, { itemId: belt.id });

    // Verify belt removal
    const equipment = fixture.getComponent(target.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower.accessories).toBeUndefined();

    // Check what's removable after belt removal
    scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync('clothing:topmost_clothing', targetContext);
    removableItems = Array.from(scopeResult.value);

    // Assert: Pants should now be removable (no longer blocked)
    expect(removableItems).toContain(pants.id);
    expect(removableItems).not.toContain(belt.id);
  });
});
