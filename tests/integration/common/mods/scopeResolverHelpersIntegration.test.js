import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('ScopeResolverHelpers Integration - Positioning Registration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer',
      null,
      null
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should successfully register positioning scopes without errors', () => {
    // This test verifies that registration works without errors
    expect(() => {
      ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
    }).not.toThrow();

    // Verify the registration created the necessary infrastructure
    expect(testFixture.testEnv._registeredResolvers).toBeDefined();
    expect(testFixture.testEnv._originalResolveSync).toBeDefined();

    // Verify all positioning scopes are registered
    const expectedScopes = [
      'personal-space:furniture_actor_sitting_on',
      'positioning:actors_sitting_on_same_furniture',
      'personal-space:closest_leftmost_occupant',
      'personal-space:closest_rightmost_occupant',
      'positioning:furniture_allowing_sitting_at_location',
      'positioning:standing_actors_at_location',
      'positioning:sitting_actors',
      'positioning:kneeling_actors',
      'positioning:furniture_actor_behind',
    ];

    expectedScopes.forEach((scopeName) => {
      expect(testFixture.testEnv._registeredResolvers.has(scopeName)).toBe(
        true
      );
    });
  });

  it('should use registered resolver instead of falling back to original', () => {
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Call a registered scope - should not fall back to original
    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:sitting_actors',
      {}
    );

    expect(result.success).toBe(true);
    expect(result.value).toBeDefined();
    expect(result.value instanceof Set).toBe(true);
  });

  it('should fall back to original resolver for unregistered scopes', () => {
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Call an unregistered scope - should fall back
    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'unknown:scope',
      {}
    );

    // Original resolver behavior varies, but it should complete without error
    expect(result).toBeDefined();
  });
});

describe('ScopeResolverHelpers Integration - Inventory Registration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'item-handling:pick_up_item',
      null,
      null
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should successfully register inventory scopes without errors', () => {
    expect(() => {
      ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
    }).not.toThrow();

    // Verify all inventory scopes are registered
    const expectedScopes = [
      'items:actor_inventory_items',
      'items:items_at_location',
      'items:portable_items_at_location',
      'items:non_portable_items_at_location',
      'items:items_at_actor_location',
      'items:actors_at_location',
      'containers-core:containers_at_location',
    ];

    expectedScopes.forEach((scopeName) => {
      expect(testFixture.testEnv._registeredResolvers.has(scopeName)).toBe(
        true
      );
    });
  });

  it('should use registered resolver for inventory scopes', () => {
    ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);

    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'items:portable_items_at_location',
      { actor: { id: 'actor1' } }
    );

    expect(result.success).toBe(true);
    expect(result.value instanceof Set).toBe(true);
  });
});

describe('ScopeResolverHelpers Integration - Anatomy Registration', () => {
  let testFixture;

  beforeEach(async () => {
    // Use personal-space mod since anatomy mod has no actions
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer',
      null,
      null
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should successfully register anatomy scopes without errors', () => {
    expect(() => {
      ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
    }).not.toThrow();

    // Verify all anatomy scopes are registered
    const expectedScopes = [
      'anatomy:actors_at_location',
      'anatomy:target_body_parts',
    ];

    expectedScopes.forEach((scopeName) => {
      expect(testFixture.testEnv._registeredResolvers.has(scopeName)).toBe(
        true
      );
    });
  });

  it('should use registered resolver for anatomy scopes', () => {
    ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);

    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'anatomy:target_body_parts',
      { target: { id: 'actor1' } }
    );

    expect(result.success).toBe(true);
    expect(result.value instanceof Set).toBe(true);
  });
});

describe('ScopeResolverHelpers Integration - Multiple Category Registration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer',
      null,
      null
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should allow registering multiple scope categories without conflict', () => {
    // Register all three categories
    expect(() => {
      ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
      ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
      ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
    }).not.toThrow();

    // Verify scopes from all categories are present
    expect(
      testFixture.testEnv._registeredResolvers.has('positioning:sitting_actors')
    ).toBe(true);
    expect(
      testFixture.testEnv._registeredResolvers.has(
        'items:portable_items_at_location'
      )
    ).toBe(true);
    expect(
      testFixture.testEnv._registeredResolvers.has('anatomy:actors_at_location')
    ).toBe(true);

    // Verify total count is the sum of all categories (25 + 7 + 2 = 34)
    // Note: actor_biting_my_neck was removed as unused by any mod files
    expect(testFixture.testEnv._registeredResolvers.size).toBe(34);
  });

  it('should preserve original resolver functionality', () => {
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Original resolver should still be called for unregistered scopes
    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'core:some_other_scope',
      {}
    );

    // Should complete without error (original behavior)
    expect(result).toBeDefined();
  });
});

describe('ScopeResolverHelpers Integration - TEAOUTTHR-006 New Scopes', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down',
      null,
      null
    );
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should register all 14 new TEAOUTTHR-006 positioning scopes', () => {
    const newScopes = [
      'positioning:close_actors',
      'positioning:close_actors_facing_each_other',
      'sitting:actors_both_sitting_close',
      'sitting:actors_sitting_close',
      'positioning:close_actors_or_entity_kneeling_before_actor',
      'straddling:actor_im_straddling',
      'positioning:entity_actor_is_kneeling_before',
      'personal-space:actors_sitting_with_space_to_right',
      'sitting:available_furniture',
      'lying:available_lying_furniture',
      'lying:furniture_im_lying_on',
      'sitting:furniture_im_sitting_on',
      'positioning:surface_im_bending_over',
      'positioning:actors_im_facing_away_from',
    ];

    newScopes.forEach((scopeName) => {
      expect(testFixture.testEnv._registeredResolvers.has(scopeName)).toBe(
        true
      );
    });
  });

  it('should verify total count of positioning scopes registered', () => {
    const positioningScopes = Array.from(
      testFixture.testEnv._registeredResolvers.keys()
    ).filter((key) => key.startsWith('positioning:'));

    // 4 scopes migrated to personal-space: furniture_actor_sitting_on, closest_leftmost_occupant,
    // closest_rightmost_occupant, actors_sitting_with_space_to_right
    // 1 scope migrated to straddling: actor_im_straddling
    // 4 scopes migrated to sitting: actors_both_sitting_close, actors_sitting_close,
    //   available_furniture, furniture_im_sitting_on
    // 2 scopes migrated to lying: available_lying_furniture, furniture_im_lying_on
    // 1 scope removed: actor_biting_my_neck (unused by any mod files)
    expect(positioningScopes.length).toBe(14);
  });

  it('should call all new scopes without errors (smoke test)', () => {
    const scenario = testFixture.createStandardActorTarget([
      'Actor',
      'Partner',
    ]);
    testFixture.reset([scenario.actor, scenario.target]);

    const scopesToTest = [
      'positioning:close_actors',
      'positioning:close_actors_facing_each_other',
      'sitting:actors_both_sitting_close',
      'sitting:actors_sitting_close',
      'positioning:close_actors_or_entity_kneeling_before_actor',
      'straddling:actor_im_straddling',
      'positioning:entity_actor_is_kneeling_before',
      'personal-space:actors_sitting_with_space_to_right',
      'sitting:available_furniture',
      'lying:available_lying_furniture',
      'lying:furniture_im_lying_on',
      'sitting:furniture_im_sitting_on',
      'positioning:surface_im_bending_over',
      'positioning:actors_im_facing_away_from',
    ];

    scopesToTest.forEach((scopeName) => {
      expect(() => {
        const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
          scopeName,
          { actor: scenario.actor }
        );
        expect(result.success).toBe(true);
      }).not.toThrow();
    });
  });
});
