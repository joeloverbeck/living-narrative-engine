/**
 * @file This modules handles resolving available action composites by index.
 * @see src/turns/services/actionIndexingService.js
 */

import { TurnScopedCache } from '../../utils/turnScopedCache.js';
import { createActionComposite } from '../dtos/actionComposite.js';
import { MAX_ACTIONS_PER_TURN } from '../../constants/core.js';

/**
 * Stable JSON stringify with deterministic key ordering.
 * @param {*} value - The value to stringify.
 * @returns {string}
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
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

/**
 * Service for indexing raw actions into ActionComposite arrays per actor turn.
 * @class
 */
export class ActionIndexingService {
  /**
   * @param {{ warn(message: string): void }} [logger] - Optional logger for warnings.
   */
  constructor(logger) {
    /** @private */
    this.logger = logger || console;

    /** @private @type {Map<string, TurnScopedCache>} */
    this.caches = new Map();

    /** @private @type {Map<string, Array>} */
    this.indexedLists = new Map();
  }

  /**
   * Assigns sequential indices to the given raw actions for the specified actor.
   * Idempotent within the same turn: repeated calls return the same list.
   * @param {string} actorId - The ID of the actor whose turn it is.
   * @param {Array<DiscoveredActionInfo>} rawActions - Array of raw actions to index.
   * @returns {ActionComposite[]} The list of indexed action composites.
   */
  indexActions(actorId, rawActions) {
    if (this.indexedLists.has(actorId)) {
      return this.indexedLists.get(actorId);
    }

    // Deduplicate by actionId and params.
    const seen = new Set();
    const uniqueActions = [];
    for (const action of rawActions) {
      const actionId = action.actionId ?? action.id;
      const params = action.params;
      const key = `${actionId}|${stableStringify(params)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueActions.push(action);
    }

    // Handle overflow
    let capped = uniqueActions;
    if (uniqueActions.length > MAX_ACTIONS_PER_TURN) {
      this.logger.warn(
        `ActionIndexingService: Capping actions from ${uniqueActions.length} to ${MAX_ACTIONS_PER_TURN}`
      );
      capped = uniqueActions.slice(0, MAX_ACTIONS_PER_TURN);
    }

    const cache = new TurnScopedCache(this.logger);
    const composites = capped.map((action, idx) => {
      const index = idx + 1;
      const actionId = action.actionId ?? action.id;
      const commandString = action.commandString ?? action.command;
      const description = action.description;
      const params = action.params;
      const composite = createActionComposite(
        index,
        actionId,
        commandString,
        params,
        description
      );
      cache.add(composite);
      return composite;
    });

    this.caches.set(actorId, cache);
    this.indexedLists.set(actorId, composites);
    return composites;
  }

  /**
   * Retrieves the previously indexed list for the given actor.
   * @param {string} actorId - The ID of the actor.
   * @returns {ActionComposite[]} The indexed action composites, or an empty array if none.
   */
  getIndexedList(actorId) {
    return this.indexedLists.get(actorId) || [];
  }

  /**
   * Resolves a composite by actor ID and index.
   * @param {string} actorId - The ID of the actor.
   * @param {number} index - The 1-based index of the action.
   * @returns {ActionComposite} The resolved action composite.
   * @throws {Error} If no composite is found for the index.
   */
  resolve(actorId, index) {
    const cache = this.caches.get(actorId);
    if (!cache) {
      throw new Error(`No actions indexed for actor "${actorId}"`);
    }
    const composite = cache.get(index);
    if (!composite) {
      throw new Error(
        `No action found at index ${index} for actor "${actorId}"`
      );
    }
    return composite;
  }
}
