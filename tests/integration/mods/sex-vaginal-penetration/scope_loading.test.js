/**
 * @file Scope loading validation test for sex-vaginal-penetration mod.
 * @description Validates that scope files are loaded from disk correctly without manual overrides.
 * This test prevents the issue where tests pass with mocked scopes but fail in runtime.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Scope Loading - sex-vaginal-penetration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      'sex-vaginal-penetration:pull_penis_out_of_vagina'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('should load actors_being_fucked_vaginally_by_me scope from disk', () => {
    // DO NOT install scope override - test real loading
    const scopeName =
      'sex-vaginal-penetration:actors_being_fucked_vaginally_by_me';

    // Verify scope is registered in the resolver
    const resolver = testFixture.testEnv.unifiedScopeResolver;
    expect(resolver).toBeDefined();

    // Check if scope exists in data registry
    const dataRegistry = testFixture.testEnv.dataRegistry;
    expect(dataRegistry).toBeDefined();

    const scope = dataRegistry.get(scopeName);
    expect(scope).toBeDefined();
    expect(scope.name).toBe(scopeName);
    expect(scope.expr).toBeDefined();
    expect(scope.ast).toBeDefined();
    expect(scope.source).toBe('file');
  });

  it('should load actors_with_uncovered_penis_facing_each_other_or_target_facing_away scope from disk', () => {
    const scopeName =
      'sex-vaginal-penetration:actors_with_uncovered_penis_facing_each_other_or_target_facing_away';

    const dataRegistry = testFixture.testEnv.dataRegistry;
    const scope = dataRegistry.get(scopeName);

    expect(scope).toBeDefined();
    expect(scope.name).toBe(scopeName);
    expect(scope.source).toBe('file');
  });

  it('should load actors_with_uncovered_vagina_facing_each_other_or_target_facing_away scope from disk', () => {
    const scopeName =
      'sex-vaginal-penetration:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away';

    const dataRegistry = testFixture.testEnv.dataRegistry;
    const scope = dataRegistry.get(scopeName);

    expect(scope).toBeDefined();
    expect(scope.name).toBe(scopeName);
    expect(scope.source).toBe('file');
  });

  it('should have all sex-vaginal-penetration scopes registered', () => {
    const dataRegistry = testFixture.testEnv.dataRegistry;
    const expectedScopes = [
      'sex-vaginal-penetration:actors_being_fucked_vaginally_by_me',
      'sex-vaginal-penetration:actors_with_uncovered_penis_facing_each_other_or_target_facing_away',
      'sex-vaginal-penetration:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away',
    ];

    for (const scopeName of expectedScopes) {
      const scope = dataRegistry.get(scopeName);
      expect(scope).toBeDefined();
      expect(scope.source).toBe('file');
    }
  });

  it('should have valid JSON Logic AST for actors_being_fucked_vaginally_by_me scope', () => {
    const scopeName =
      'sex-vaginal-penetration:actors_being_fucked_vaginally_by_me';
    const dataRegistry = testFixture.testEnv.dataRegistry;
    const scope = dataRegistry.get(scopeName);

    expect(scope.ast).toBeDefined();
    expect(scope.ast.type).toBeDefined();

    // Validate that the scope uses correct JSON Logic (not hasComponent)
    const scopeExpression = scope.expr;
    expect(scopeExpression).not.toContain('hasComponent');
    expect(scopeExpression).toContain('!!'); // Should use double negation instead
  });
});
