// src/utils/ruleCacheUtils.js

import { ATTEMPT_ACTION_ID } from '../constants/eventIds.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/**
 * @typedef {{catchAll:SystemRule[], byAction:Map<string,SystemRule[]>}} RuleBucket
 */

/**
 * Build a lookup Map of rules grouped by event type and action ID.
 *
 * @description For each rule, buckets are created by `event_type`. When the
 *   event type is `ATTEMPT_ACTION_ID` and the rule condition is a simple
 *   equality check against `event.payload.actionId`, the rule is stored under a
 *   sub-map keyed by that constant action ID. All other rules for the event type
 *   are stored in the `catchAll` array.
 * @param {SystemRule[]} rules - Array of system rules to cache.
 * @param {ILogger} logger - Logger used for debug and warning messages.
 * @returns {Map<string, RuleBucket>} Map keyed by event type containing rule
 *   buckets.
 */
export function buildRuleCache(rules, logger) {
  /** @type {Map<string, RuleBucket>} */
  const cache = new Map();

  for (const rule of rules) {
    if (!rule?.event_type) {
      logger?.warn('Skipping rule with missing event_type', rule);
      continue;
    }

    /** @type {RuleBucket | undefined} */
    let bucket = cache.get(rule.event_type);
    if (!bucket) {
      bucket = { catchAll: [], byAction: new Map() };
      cache.set(rule.event_type, bucket);
    }

    // detect `{ "==": [ { "var": "event.payload.actionId" }, "<CONST>" ] }`
    let constId = null;
    const condition = rule.condition;
    if (
      condition &&
      typeof condition === 'object' &&
      '==' in condition &&
      Array.isArray(condition['==']) &&
      condition['=='].length === 2 &&
      typeof condition['=='][1] === 'string' &&
      condition['=='][0]?.var === 'event.payload.actionId'
    ) {
      constId = condition['=='][1];
    }

    if (rule.event_type === ATTEMPT_ACTION_ID && constId) {
      let rulesForId = bucket.byAction.get(constId);
      if (!rulesForId) {
        rulesForId = [];
        bucket.byAction.set(constId, rulesForId);
      }
      rulesForId.push(rule);
    } else {
      bucket.catchAll.push(rule);
    }

    logger?.debug?.(`Cached rule '${rule.rule_id}'`);
  }

  return cache;
}
