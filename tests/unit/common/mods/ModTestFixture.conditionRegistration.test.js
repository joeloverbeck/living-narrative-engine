/**
 * @file Unit tests for ModTestFixture condition registration helper methods
 * @description Tests for registerCondition(), clearRegisteredConditions(), isConditionRegistered(), getRegisteredConditions()
 * @see TESINFROB-004
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture.registerCondition()', () => {
  let fixture;

  beforeEach(async () => {
    // Use a simple test action that exists
    fixture = await ModTestFixture.forAction('core', 'core:wait');
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('should register condition and track it', () => {
    fixture.registerCondition('test:always-true', {
      logic: { '==': [1, 1] },
      description: 'Always returns true',
    });

    expect(fixture.isConditionRegistered('test:always-true')).toBe(true);
    expect(fixture.getRegisteredConditions()).toContain('test:always-true');
    // Verify it's in _loadedConditions
    expect(fixture._loadedConditions.has('test:always-true')).toBe(true);
  });

  it('should throw if definition missing logic property', () => {
    expect(() =>
      fixture.registerCondition('test:no-logic', {
        description: 'Missing logic property',
      })
    ).toThrow("Condition 'test:no-logic' must have a 'logic' property");
  });

  it('should throw for empty conditionId', () => {
    expect(() =>
      fixture.registerCondition('', {
        logic: { '==': [1, 1] },
      })
    ).toThrow('registerCondition: conditionId must be a non-empty string');
  });

  it('should throw for null conditionId', () => {
    expect(() =>
      fixture.registerCondition(null, {
        logic: { '==': [1, 1] },
      })
    ).toThrow('registerCondition: conditionId must be a non-empty string');
  });

  it('should throw for non-object definition', () => {
    expect(() => fixture.registerCondition('test:bad', null)).toThrow(
      "registerCondition: definition for 'test:bad' must be an object"
    );

    expect(() => fixture.registerCondition('test:bad', 'string')).toThrow(
      "registerCondition: definition for 'test:bad' must be an object"
    );
  });

  it('should clean up registered conditions on cleanup()', () => {
    fixture.registerCondition('test:temp', {
      logic: { '==': [1, 1] },
    });

    expect(fixture.isConditionRegistered('test:temp')).toBe(true);
    expect(fixture._loadedConditions.has('test:temp')).toBe(true);

    fixture.cleanup();

    // After cleanup, the condition should be removed from tracking
    // Note: fixture state after cleanup is cleaned up, so we verify tracking is cleared
    expect(fixture.isConditionRegistered('test:temp')).toBe(false);
    expect(fixture._loadedConditions.has('test:temp')).toBe(false);
  });

  it('should clean up on clearRegisteredConditions()', () => {
    fixture.registerCondition('test:cond-a', { logic: { '==': [1, 1] } });
    fixture.registerCondition('test:cond-b', { logic: { '!=': [1, 2] } });

    expect(fixture.getRegisteredConditions()).toHaveLength(2);
    expect(fixture._loadedConditions.has('test:cond-a')).toBe(true);
    expect(fixture._loadedConditions.has('test:cond-b')).toBe(true);

    fixture.clearRegisteredConditions();

    expect(fixture.getRegisteredConditions()).toEqual([]);
    expect(fixture.isConditionRegistered('test:cond-a')).toBe(false);
    expect(fixture.isConditionRegistered('test:cond-b')).toBe(false);
    // Should be removed from _loadedConditions too
    expect(fixture._loadedConditions.has('test:cond-a')).toBe(false);
    expect(fixture._loadedConditions.has('test:cond-b')).toBe(false);
  });

  it('should allow multiple condition registrations', () => {
    fixture.registerCondition('test:cond-1', { logic: { '==': [1, 1] } });
    fixture.registerCondition('test:cond-2', { logic: { '==': [2, 2] } });
    fixture.registerCondition('test:cond-3', { logic: { '==': [3, 3] } });

    const registered = fixture.getRegisteredConditions();
    expect(registered).toHaveLength(3);
    expect(registered).toContain('test:cond-1');
    expect(registered).toContain('test:cond-2');
    expect(registered).toContain('test:cond-3');
  });

  it('should allow re-registering same condition (overwrites)', () => {
    fixture.registerCondition('test:overwrite', {
      logic: { '==': [1, 1] },
      description: 'First version',
    });

    fixture.registerCondition('test:overwrite', {
      logic: { '==': [2, 2] },
      description: 'Second version',
    });

    // Should only be registered once in tracking
    const registered = fixture.getRegisteredConditions();
    expect(registered.filter((c) => c === 'test:overwrite')).toHaveLength(1);

    // Definition should be the second version
    const definition = fixture._loadedConditions.get('test:overwrite');
    expect(definition.description).toBe('Second version');
    expect(definition.logic).toEqual({ '==': [2, 2] });
  });

  it('should include error message with actual keys when missing logic', () => {
    expect(() =>
      fixture.registerCondition('test:no-logic', {
        description: 'Desc',
        other: 'value',
      })
    ).toThrow('Received: ["description","other"]');
  });

  it('should not affect manually added _loadedConditions on clear', () => {
    // Manually add a condition (legacy pattern)
    fixture._loadedConditions.set('manual:condition', {
      logic: { '==': [1, 1] },
    });

    // Register via API
    fixture.registerCondition('test:via-api', {
      logic: { '==': [2, 2] },
    });

    // Clear only API-registered conditions
    fixture.clearRegisteredConditions();

    // API-registered should be cleared
    expect(fixture._loadedConditions.has('test:via-api')).toBe(false);

    // Manually added should remain
    expect(fixture._loadedConditions.has('manual:condition')).toBe(true);
  });
});
