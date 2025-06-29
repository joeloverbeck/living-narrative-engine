import { describe, it, expect } from '@jest/globals';
import {
  createDiscoveryError,
  extractTargetId,
} from '../../../src/actions/utils/discoveryErrorUtils.js';

/**
 * @file tests/unit/actions/discoveryErrorUtils.test.js
 * @description Unit tests for discoveryErrorUtils.
 */

describe('discoveryErrorUtils', () => {
  it('creates standardized discovery error objects', () => {
    const err = new Error('bad');
    const result = createDiscoveryError('a1', 't1', err);
    expect(result).toEqual({
      actionId: 'a1',
      targetId: 't1',
      error: err,
      details: null,
    });
  });

  it('extracts targetId from various error shapes', () => {
    expect(extractTargetId({ targetId: 'x' })).toBe('x');
    expect(extractTargetId({ target: { entityId: 'y' } })).toBe('y');
    expect(extractTargetId({ entityId: 'z' })).toBe('z');
    expect(extractTargetId({})).toBeNull();
  });
});
