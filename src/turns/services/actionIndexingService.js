// src/turns/services/actionIndexingService.js

/**
 * @file Service for indexing raw actions into ActionComposite arrays per actor turn.
 *       Enforces idempotence, duplicate-suppression, capping, and provides public getters.
 * @module ActionIndexingService
 */

import { TurnScopedCache } from '../../utils/turnScopedCache.js';
import { createActionComposite } from '../dtos/actionComposite.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';

/**
 * @param value
 * @private
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Service for indexing and retrieving available actions by actor per turn.
 *
 * @class
 */
export class ActionIndexingService {
  /**
   * @param {{ warn(message: string): void, info(message: string): void }} [logger]
   *        Optional logger for overflow and duplicate-suppression info.
   */
  constructor(logger) {
    /** @private */
    this.logger = logger || console;
    /** @private @type {Map<string, TurnScopedCache>} */
    this.caches = new Map();
    /** @private @type {Map<string, ActionComposite[]>} */
    this.indexedLists = new Map();
  }

  /**
   * Assigns sequential indices to the given raw actions for the specified actor.
   * - **Idempotent** within the same turn.
   * - Suppresses duplicate (actionId, params) pairs (logs INFO with count).
   * - Caps to MAX_AVAILABLE_ACTIONS_PER_TURN (logs WARN if truncated).
   *
   * @param {string} actorId - The ID of the actor whose turn it is.
   * @param {Array<DiscoveredActionInfo>} rawActions - Array of raw actions to index.
   * @returns {ActionComposite[]} The list of indexed action composites.
   */
  indexActions(actorId, rawActions) {
    if (this.indexedLists.has(actorId)) {
      return this.indexedLists.get(actorId);
    }

    const seen = new Set();
    const unique = [];
    let duplicates = 0;

    for (const action of rawActions) {
      const id = action.actionId ?? action.id;
      const key = `${id}|${stableStringify(action.params)}`;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      unique.push(action);
    }
    if (duplicates > 0) {
      this.logger.info(
        `ActionIndexingService: actor "${actorId}" suppressed ${duplicates} duplicate actions`
      );
    }

    let capped = unique;
    if (unique.length > MAX_AVAILABLE_ACTIONS_PER_TURN) {
      const over = unique.length - MAX_AVAILABLE_ACTIONS_PER_TURN;
      this.logger.warn(
        `ActionIndexingService: actor "${actorId}" truncated ${over} actions, processing only the first ${MAX_AVAILABLE_ACTIONS_PER_TURN}`
      );
      capped = unique.slice(0, MAX_AVAILABLE_ACTIONS_PER_TURN);
    }

    const cache = new TurnScopedCache(this.logger);
    const composites = capped.map((action, i) => {
      const idx = i + 1;
      const comp = createActionComposite(
        idx,
        action.actionId ?? action.id,
        action.commandString ?? action.command,
        action.params,
        action.description
      );
      cache.add(comp);
      return comp;
    });

    this.caches.set(actorId, cache);
    this.indexedLists.set(actorId, composites);
    return composites;
  }

  /**
   * Retrieves the previously indexed list for the given actor.
   *
   * @param {string} actorId - The ID of the actor.
   * @returns {ActionComposite[]} A **new** array of the indexed composites.
   * @throws {Error} If `indexActions` has not been called for this actor.
   */
  getIndexedList(actorId) {
    if (!this.indexedLists.has(actorId)) {
      throw new Error(`No indexed action list for actor "${actorId}"`);
    }
    // Return a shallow copy so external mutation can't affect our internal array
    return this.indexedLists.get(actorId).slice();
  }

  /**
   * Resolves a composite by actor ID and 1-based index in O(1).
   *
   * @param {string} actorId - The ID of the actor.
   * @param {number} index - The 1-based index of the action to retrieve.
   * @returns {ActionComposite}
   * @throws {Error} If no actions are indexed for this actor, or if the index is out of range.
   */
  resolve(actorId, index) {
    const cache = this.caches.get(actorId);
    if (!cache) {
      throw new Error(`No actions indexed for actor "${actorId}"`);
    }
    const comp = cache.get(index);
    if (!comp) {
      throw new Error(
        `No action found at index ${index} for actor "${actorId}"`
      );
    }
    return comp;
  }
}
