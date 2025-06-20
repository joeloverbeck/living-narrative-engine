// tests/logic/ruleCacheUtils.test.js

/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { buildRuleCache } from '../../../src/utils/ruleCacheUtils.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

/** @typedef {import('../../../data/schemas/rule.schema.json').SystemRule} SystemRule */

const makeRule = (id, eventType, condition = null) => ({
  rule_id: id,
  event_type: eventType,
  condition,
  actions: [],
});

describe('buildRuleCache (ruleCacheUtils.js)', () => {
  /** @type {ReturnType<jest.fn>} */
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
  });

  test('groups rules by actionId when condition compares event.payload.actionId', () => {
    const rules = [
      makeRule('R1', ATTEMPT_ACTION_ID, {
        '==': [{ var: 'event.payload.actionId' }, 'move'],
      }),
      makeRule('R2', ATTEMPT_ACTION_ID, {
        '==': [{ var: 'event.payload.actionId' }, 'move'],
      }),
    ];

    const cache = buildRuleCache(rules, mockLogger);
    const bucket = cache.get(ATTEMPT_ACTION_ID);

    expect(bucket.byAction.get('move')).toHaveLength(2);
    expect(bucket.catchAll).toHaveLength(0);
  });

  test('places non-matching rules into catchAll buckets', () => {
    const rules = [
      makeRule('R1', ATTEMPT_ACTION_ID, {
        '!=': [{ var: 'event.payload.actionId' }, 'run'],
      }),
      makeRule('R2', 'other:event'),
    ];

    const cache = buildRuleCache(rules, mockLogger);
    const actionBucket = cache.get(ATTEMPT_ACTION_ID);
    const otherBucket = cache.get('other:event');

    expect(actionBucket.catchAll).toHaveLength(1);
    expect(actionBucket.byAction.size).toBe(0);
    expect(otherBucket.catchAll).toHaveLength(1);
  });
});
