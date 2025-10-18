import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('ScopeResolverHelpers Integration - Positioning Registration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:scoot_closer',
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
      'positioning:furniture_actor_sitting_on',
      'positioning:actors_sitting_on_same_furniture',
      'positioning:closest_leftmost_occupant',
      'positioning:furniture_allowing_sitting_at_location',
      'positioning:standing_actors_at_location',
      'positioning:sitting_actors',
      'positioning:kneeling_actors',
      'positioning:furniture_actor_behind',
    ];

    expectedScopes.forEach((scopeName) => {
      expect(testFixture.testEnv._registeredResolvers.has(scopeName)).toBe(true);
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
      'items:pick_up_item',
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
      'items:actors_at_location',
      'items:containers_at_location',
    ];

    expectedScopes.forEach((scopeName) => {
      expect(testFixture.testEnv._registeredResolvers.has(scopeName)).toBe(true);
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
    // Use positioning mod since anatomy mod has no actions
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:scoot_closer',
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
      expect(testFixture.testEnv._registeredResolvers.has(scopeName)).toBe(true);
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
      'positioning',
      'positioning:scoot_closer',
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
    expect(testFixture.testEnv._registeredResolvers.has('positioning:sitting_actors')).toBe(true);
    expect(testFixture.testEnv._registeredResolvers.has('items:portable_items_at_location')).toBe(true);
    expect(testFixture.testEnv._registeredResolvers.has('anatomy:actors_at_location')).toBe(true);

    // Verify total count is the sum of all categories (8 + 5 + 2 = 15)
    expect(testFixture.testEnv._registeredResolvers.size).toBe(15);
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
