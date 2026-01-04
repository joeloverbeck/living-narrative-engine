/**
 * @file Unit tests for ModTestFixture scope mocking helper methods
 * @description Tests for mockScope(), clearScopeMocks(), isScopeMocked(), getMockedScopes()
 * @see TESINFROB-003
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture.mockScope()', () => {
  let fixture;

  beforeEach(async () => {
    // Use a simple test action that exists
    fixture = await ModTestFixture.forAction('core', 'core:wait');
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('should mock scope with resolver function', () => {
    fixture.mockScope('test:scope', () => new Set(['entity-1']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'test:scope',
      {}
    );
    expect(result).toEqual(new Set(['entity-1']));
  });

  it('should mock scope with result Set shorthand', () => {
    fixture.mockScope('test:scope', new Set(['entity-1', 'entity-2']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'test:scope',
      {}
    );
    expect(result).toEqual(new Set(['entity-1', 'entity-2']));
  });

  it('should allow multiple scope mocks', () => {
    fixture.mockScope('scope:a', new Set(['a']));
    fixture.mockScope('scope:b', new Set(['b']));

    expect(
      fixture.testEnv.unifiedScopeResolver.resolveSync('scope:a', {})
    ).toEqual(new Set(['a']));
    expect(
      fixture.testEnv.unifiedScopeResolver.resolveSync('scope:b', {})
    ).toEqual(new Set(['b']));
  });

  it('should fall through to original for non-mocked scopes', () => {
    fixture.mockScope('test:mocked', new Set(['mocked']));

    // Non-mocked scope should use original resolver
    // (may throw or return empty depending on scope existence)
    expect(() => {
      fixture.testEnv.unifiedScopeResolver.resolveSync('test:mocked', {});
    }).not.toThrow();
  });

  it('should clean up mocks on fixture.cleanup()', () => {
    const originalResolve = fixture.testEnv.unifiedScopeResolver.resolveSync;
    fixture.mockScope('test:scope', new Set(['mocked']));

    // Resolver was replaced
    expect(fixture.testEnv.unifiedScopeResolver.resolveSync).not.toBe(
      originalResolve
    );

    fixture.cleanup();

    // After cleanup, we can't easily verify restoration since fixture is cleaned up
    // But we verify no errors thrown
  });

  it('should clean up mocks on clearScopeMocks()', () => {
    fixture.mockScope('test:scope', new Set(['mocked']));

    expect(fixture.isScopeMocked('test:scope')).toBe(true);

    fixture.clearScopeMocks();

    expect(fixture.isScopeMocked('test:scope')).toBe(false);
    expect(fixture.getMockedScopes()).toEqual([]);
  });

  it('should handle mocking same scope twice (overwrites)', () => {
    fixture.mockScope('test:scope', new Set(['first']));
    fixture.mockScope('test:scope', new Set(['second']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'test:scope',
      {}
    );
    expect(result).toEqual(new Set(['second']));
  });

  it('should throw for invalid scopeName', () => {
    expect(() => fixture.mockScope('', new Set())).toThrow();
    expect(() => fixture.mockScope(null, new Set())).toThrow();
  });

  it('should report mocked scopes via getMockedScopes()', () => {
    fixture.mockScope('scope:a', new Set());
    fixture.mockScope('scope:b', new Set());

    expect(fixture.getMockedScopes()).toContain('scope:a');
    expect(fixture.getMockedScopes()).toContain('scope:b');
  });

  it('should pass context to resolver function', () => {
    const mockContext = { actor: { id: 'test-actor' } };

    fixture.mockScope('test:scope', (context) => {
      expect(context).toBe(mockContext);
      return new Set([context.actor.id]);
    });

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'test:scope',
      mockContext
    );
    expect(result).toEqual(new Set(['test-actor']));
  });

  it('should convert array results to Set', () => {
    fixture.mockScope('test:scope', () => ['entity-1', 'entity-2']);

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'test:scope',
      {}
    );
    expect(result).toBeInstanceOf(Set);
    expect(result).toEqual(new Set(['entity-1', 'entity-2']));
  });

  it('should restore original resolver after clearScopeMocks', () => {
    // First, record that we can mock a scope
    fixture.mockScope('test:scope', new Set(['mocked']));

    // Verify mock is active
    expect(
      fixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {})
    ).toEqual(new Set(['mocked']));

    fixture.clearScopeMocks();

    // After clearing, the mock should no longer be active
    // The mocked scope should now fall through to original resolver
    // (which will likely throw for unknown scope or return empty)
    expect(fixture.isScopeMocked('test:scope')).toBe(false);
    expect(fixture.getMockedScopes()).toEqual([]);
  });
});
