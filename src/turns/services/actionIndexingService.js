import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';

/**
 * Remove duplicate actions by id and params.
 *
 * @description Deduplicate discovered actions by id and params.
 * @param {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} discovered - Array of actions discovered for an actor.
 * @returns {{ uniqueArr: { actionId: string, commandString: string, params: any, description: string }[], duplicatesSuppressed: number }} Object containing the unique actions and the number of suppressed duplicates.
 */
function deduplicateActions(discovered) {
  const unique = new Map();
  for (const raw of discovered) {
    const actionId = raw.id;
    const commandString = raw.command;
    const params = raw.params ?? {};
    const description = raw.description ?? '';
    const key = `${actionId}:${JSON.stringify(params)}`;
    if (!unique.has(key)) {
      unique.set(key, { actionId, commandString, params, description });
    }
  }
  return {
    uniqueArr: Array.from(unique.values()),
    duplicatesSuppressed: discovered.length - unique.size,
  };
}

/**
 * Limit the list of unique actions to the configured maximum.
 *
 * @description Truncate the list of unique actions if it exceeds the maximum.
 * @param {{ actionId: string, commandString: string, params: any, description: string }[]} uniqueArr - Unique actions after deduplication.
 * @returns {{ truncatedArr: { actionId: string, commandString: string, params: any, description: string }[], truncatedCount: number }} Object containing the possibly truncated array and count of removed actions.
 */
function truncateActions(uniqueArr) {
  if (uniqueArr.length > MAX_AVAILABLE_ACTIONS_PER_TURN) {
    const truncatedCount = uniqueArr.length - MAX_AVAILABLE_ACTIONS_PER_TURN;
    return {
      truncatedArr: uniqueArr.slice(0, MAX_AVAILABLE_ACTIONS_PER_TURN),
      truncatedCount,
    };
  }
  return { truncatedArr: uniqueArr, truncatedCount: 0 };
}

/**
 * Transform unique actions into indexed composites.
 *
 * @description Convert an array of unique actions into indexed composites.
 * @param {{ actionId: string, commandString: string, params: any, description: string }[]} uniqueArr - List of unique actions after truncation.
 * @returns {import('../dtos/actionComposite.js').ActionComposite[]} Array of composites ready for indexing.
 */
function buildComposites(uniqueArr) {
  return uniqueArr.map((u, idx) => ({
    index: idx + 1,
    actionId: u.actionId,
    commandString: u.commandString,
    params: u.params,
    description: u.description,
  }));
}

export class ActionIndexingService {
  /**
   * @param {{ logger: import('../../interfaces/ILogger.js').ILogger }} deps
   */
  constructor({ logger }) {
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('ActionIndexingService: logger required');
    }

    const noop = /** @type {any} */ (() => {});
    this.#log = {
      debug: logger.debug?.bind(logger) ?? noop,
      info: logger.info?.bind(logger) ?? noop,
      warn: logger.warn?.bind(logger) ?? noop,
      error: logger.error?.bind(logger) ?? noop,
    };
  }

  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #log;
  /** @type {Map<string, import('../dtos/actionComposite.js').ActionComposite[]>} */
  #actorCache = new Map();

  /* ─────────────────────────────────────────────────────────────────────── */

  /**
   * Signals the beginning of an actor's turn, clearing any cached action
   * list for them from the previous turn. This ensures choices are not
   * accidentally carried over.
   *
   * @param {string} actorId The ID of the actor starting their turn.
   */
  beginTurn(actorId) {
    this.#actorCache.delete(actorId);
  }

  /**
   * @deprecated In favor of beginTurn(), which better describes the lifecycle event.
   * @param {string} actorId
   */
  clearActorCache(actorId) {
    this.#actorCache.delete(actorId);
    this.#log.debug(`ActionIndexingService: cache cleared for ${actorId}`);
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /**
   * (Re)build the indexed list for an actor.
   *
   * @param {string} actorId
   * @param {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} discovered
   * @returns {import('../dtos/actionComposite.js').ActionComposite[]}
   */
  indexActions(actorId, discovered) {
    if (typeof actorId !== 'string' || !actorId.trim()) {
      throw new TypeError(
        'ActionIndexingService.indexActions: actorId must be a non-empty string'
      );
    }
    if (!Array.isArray(discovered)) {
      throw new TypeError(
        'ActionIndexingService.indexActions: discovered must be an array'
      );
    }

    // Idempotent shortcut (same turn)
    if (discovered.length === 0 && this.#actorCache.has(actorId)) {
      const cachedList = this.#actorCache.get(actorId);
      if (cachedList) return cachedList; // Type guard
    }

    /* ── deduplicate by (id + params) ─────────────────────────────────── */
    const { uniqueArr, duplicatesSuppressed } = deduplicateActions(discovered);
    if (duplicatesSuppressed > 0) {
      this.#log.info(
        `ActionIndexingService: actor "${actorId}" suppressed ${duplicatesSuppressed} duplicate actions`
      );
    }

    /* ── cap the list if it's over the maximum ─────────────────────────── */
    const { truncatedArr, truncatedCount } = truncateActions(uniqueArr);
    if (truncatedCount > 0) {
      this.#log.warn(
        `ActionIndexingService: actor "${actorId}" truncated ${truncatedCount} actions, processing only the first ${MAX_AVAILABLE_ACTIONS_PER_TURN}`
      );
    }

    /* ── build composites ─────────────────────────────────────────────── */
    const composites = buildComposites(truncatedArr);

    /* ── cache and return ─────────────────────────────────────────────── */
    this.#actorCache.set(actorId, composites);
    this.#log.debug(
      `ActionIndexingService: indexed ${composites.length} actions for ${actorId}`
    );
    return composites;
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /**
   * @param {string} actorId
   * @returns {import('../dtos/actionComposite.js').ActionComposite[]}
   */
  getIndexedList(actorId) {
    const list = this.#actorCache.get(actorId);
    if (!list) throw new Error(`No indexed action list for actor "${actorId}"`);
    return list.slice(); // shallow copy to protect internal state
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /**
   * @param {string} actorId
   * @param {number} chosenIndex
   * @returns {import('../dtos/actionComposite.js').ActionComposite}
   */
  resolve(actorId, chosenIndex) {
    const list = this.#actorCache.get(actorId);
    if (!list) throw new Error(`No actions indexed for actor "${actorId}"`);
    const composite = list.find((c) => c.index === chosenIndex);
    if (!composite) {
      throw new Error(
        `No action found at index ${chosenIndex} for actor "${actorId}"`
      );
    }
    return composite;
  }
}

export default ActionIndexingService;
