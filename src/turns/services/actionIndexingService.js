import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';
import { ActionIndexingError } from './errors/actionIndexingError.js';

/**
 * Remove duplicate actions by id and params.
 *
 * @description Deduplicate discovered actions by id and params.
 * @param {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} discovered - Array of actions discovered for an actor.
 * @returns {{ uniqueArr: { actionId: string, commandString: string, params: any, description: string, visual: any }[], duplicatesSuppressed: number, duplicateDetails: Array<{ actionId: string, commandString: string, params: any, count: number }> }} Object containing the unique actions, the number of suppressed duplicates, and details about the duplicates.
 */
function deduplicateActions(discovered) {
  const unique = new Map();
  const duplicateCounts = new Map();

  for (const raw of discovered) {
    const actionId = raw.id;
    const commandString = raw.command;
    const params = raw.params ?? {};
    const description = raw.description ?? '';
    const visual = raw.visual ?? null;
    const key = createActionKey(actionId, params);

    if (!unique.has(key)) {
      unique.set(key, { actionId, commandString, params, description, visual });
      duplicateCounts.set(key, { actionId, commandString, params, count: 1 });
    } else {
      const existing = duplicateCounts.get(key);
      existing.count += 1;
    }
  }

  // Extract details about duplicates (where count > 1)
  const duplicateDetails = Array.from(duplicateCounts.values())
    .filter((item) => item.count > 1)
    .map(({ actionId, commandString, params, count }) => ({
      actionId,
      commandString,
      params,
      count,
    }));

  return {
    uniqueArr: Array.from(unique.values()),
    duplicatesSuppressed: discovered.length - unique.size,
    duplicateDetails,
  };
}

/**
 * Limit the list of unique actions to the configured maximum.
 *
 * @description Truncate the list of unique actions if it exceeds the maximum.
 * @param {{ actionId: string, commandString: string, params: any, description: string, visual: any }[]} uniqueArr - Unique actions after deduplication.
 * @returns {{ truncatedArr: { actionId: string, commandString: string, params: any, description: string, visual: any }[], truncatedCount: number }} Object containing the possibly truncated array and count of removed actions.
 */
/**
 * @description Produce a deterministic string representation for composite key generation.
 * @param {*} value - The value to serialize in a stable manner.
 * @param {WeakSet<object>} [seen=new WeakSet()] - Tracks objects already visited to prevent cycles.
 * @returns {string} Stable string representation suitable for map keys.
 */
function stableSerializeForKey(value, seen = new WeakSet()) {
  if (value === null) {
    return 'null';
  }

  const valueType = typeof value;
  if (valueType === 'undefined') {
    return 'undefined';
  }
  if (valueType === 'number' || valueType === 'boolean') {
    return JSON.stringify(value);
  }
  if (valueType === 'string') {
    return JSON.stringify(value);
  }
  if (valueType === 'bigint') {
    return `${value.toString()}n`;
  }
  if (valueType === 'symbol') {
    return value.toString();
  }
  if (valueType === 'function') {
    return `[Function:${value.name || 'anonymous'}]`;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    const serialized = `[${value
      .map((item) => stableSerializeForKey(item, seen))
      .join(',')}]`;
    seen.delete(value);
    return serialized;
  }

  if (valueType === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    const keys = Object.keys(value).sort();
    const serialized = `{${keys
      .map((key) =>
        `${JSON.stringify(key)}:${stableSerializeForKey(value[key], seen)}`
      )
      .join(',')}}`;
    seen.delete(value);
    return serialized;
  }

  return JSON.stringify(value);
}

/**
 * @description Build a unique key for an action using its identifier and parameters.
 * @param {string} actionId - The action definition identifier.
 * @param {*} params - Parameters associated with the action.
 * @returns {string} Deterministic composite key for deduplication.
 */
function createActionKey(actionId, params) {
  return `${actionId}:${stableSerializeForKey(params)}`;
}

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
 * @param {{ actionId: string, commandString: string, params: any, description: string, visual: any }[]} uniqueArr - List of unique actions after truncation.
 * @returns {import('../dtos/actionComposite.js').ActionComposite[]} Array of composites ready for indexing.
 */
function buildComposites(uniqueArr) {
  return uniqueArr.map((u, idx) => ({
    index: idx + 1,
    actionId: u.actionId,
    commandString: u.commandString,
    params: u.params,
    description: u.description,
    visual: u.visual,
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
    const { uniqueArr, duplicatesSuppressed, duplicateDetails } =
      deduplicateActions(discovered);
    if (duplicatesSuppressed > 0) {
      const duplicateInfo = duplicateDetails
        .map((dup) => {
          const paramsStr =
            Object.keys(dup.params).length > 0
              ? `, params: ${JSON.stringify(dup.params)}`
              : '';
          return `${dup.actionId} (${dup.commandString}${paramsStr}) x${dup.count}`;
        })
        .join(', ');

      this.#log.info(
        `ActionIndexingService: actor "${actorId}" suppressed ${duplicatesSuppressed} duplicate actions: ${duplicateInfo}`
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

    // Debug logging for visual properties
    const visualActions = composites.filter((c) => c.visual);
    if (visualActions.length > 0) {
      this.#log.debug(
        `ActionIndexingService: ${visualActions.length}/${composites.length} actions have visual properties for ${actorId}`,
        visualActions.map((a) => ({
          actionId: a.actionId,
          visual: a.visual,
        }))
      );
    }

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
    if (!list)
      throw new ActionIndexingError(
        `No indexed action list for actor "${actorId}"`,
        actorId
      );
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
    if (!list)
      throw new ActionIndexingError(
        `No actions indexed for actor "${actorId}"`,
        actorId
      );
    const composite = list.find((c) => c.index === chosenIndex);
    if (!composite) {
      throw new ActionIndexingError(
        `No action found at index ${chosenIndex} for actor "${actorId}"`,
        actorId,
        chosenIndex
      );
    }
    return composite;
  }
}

export default ActionIndexingService;
