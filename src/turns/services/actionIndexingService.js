import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';
import { deepFreeze, freezeMap } from '../../utils/cloneUtils.js';
import { ActionIndexingError } from './errors/actionIndexingError.js';

/**
 * Remove duplicate actions by id, params, and command string.
 *
 * @description Deduplicate discovered actions by combining the action ID,
 * parameter payload, and command string. Including the command string ensures
 * that distinct user-facing commands (for example multi-target variations)
 * are preserved even when they share identical parameter payloads.
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
    const key = createActionKey(actionId, params, commandString);

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
  if (valueType === 'number') {
    if (Object.is(value, -0)) {
      return '-0';
    }
    return String(value);
  }
  if (valueType === 'boolean') {
    return value ? 'true' : 'false';
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

  if (value instanceof Date) {
    const timeValue = value.getTime();
    if (Number.isNaN(timeValue)) {
      return 'Date(Invalid)';
    }
    return `Date(${value.toISOString()})`;
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

  if (value instanceof Map) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    const entries = Array.from(value.entries()).map(([key, val]) => {
      const keyStr = stableSerializeForKey(key, seen);
      const valueStr = stableSerializeForKey(val, seen);
      return `${keyStr}=>${valueStr}`;
    });
    entries.sort();
    seen.delete(value);
    return `Map{${entries.join(',')}}`;
  }

  if (value instanceof Set) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    const values = Array.from(value.values()).map((item) =>
      stableSerializeForKey(item, seen)
    );
    values.sort();
    seen.delete(value);
    return `Set{${values.join(',')}}`;
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
function createActionKey(actionId, params, commandString) {
  return `${actionId}:${stableSerializeForKey(params)}:${stableSerializeForKey(
    commandString ?? ''
  )}`;
}

/**
 * @description Safely format params for logging without risking serialization errors.
 * @param {*} params - Parameters associated with the action.
 * @returns {string} String representation safe for log messages.
 */
function formatParamsForLog(params) {
  try {
    return stableSerializeForKey(params);
  } catch (error) {
    return '[Unserializable params]';
  }
}

/**
 * @description Separates discovered entries into valid actions and invalid diagnostics.
 * @param {unknown[]} discovered - Raw entries returned by the action discovery step.
 * @returns {{
 *   valid: import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[],
 *   invalid: Array<{
 *     index: number;
 *     reason: string;
 *     entryType: string;
 *     actionId?: unknown;
 *     commandType?: string;
 *   }>
 * }} Partitioned discovered entries.
 */
function partitionDiscoveredActions(discovered) {
  /** @type {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo[]} */
  const valid = [];
  const invalid = [];

  discovered.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      invalid.push({
        index,
        reason: 'not-object',
        entryType: raw === null ? 'null' : typeof raw,
      });
      return;
    }

    const candidate = /** @type {Record<string, unknown>} */ (raw);
    const actionId = candidate.id;
    if (typeof actionId !== 'string' || actionId.trim() === '') {
      invalid.push({
        index,
        reason: 'invalid-id',
        entryType: Array.isArray(candidate) ? 'array' : typeof candidate,
        actionId,
      });
      return;
    }

    const command = candidate.command;
    if (command !== undefined && command !== null && typeof command !== 'string') {
      invalid.push({
        index,
        reason: 'invalid-command',
        entryType: Array.isArray(candidate) ? 'array' : typeof candidate,
        actionId,
        commandType: typeof command,
      });
      return;
    }

    valid.push(
      /** @type {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} */ (
        candidate
      )
    );
  });

  return { valid, invalid };
}

/**
 * @description Clones a Set and returns an immutable proxy that blocks mutation methods.
 * @param {Set<unknown>} set - The Set to clone and freeze.
 * @returns {ReadonlySet<unknown>} Frozen clone of the provided Set.
 */
function freezeClonedSet(set) {
  const cloned = new Set();
  for (const item of set.values()) {
    cloned.add(cloneAndFreezeValue(item));
  }
  Object.freeze(cloned);
  return new Proxy(cloned, {
    get(target, prop) {
      if (prop === 'add' || prop === 'delete' || prop === 'clear') {
        return () => {
          throw new TypeError('Cannot modify frozen set');
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * @description Creates an immutable clone of the provided value suitable for caching.
 * @param {*} value - Value to clone and freeze.
 * @returns {*} Immutable clone of the provided value.
 */
function cloneAndFreezeValue(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Map) {
    const cloned = new Map();
    for (const [key, val] of value.entries()) {
      cloned.set(key, cloneAndFreezeValue(val));
    }
    return freezeMap(cloned);
  }
  if (value instanceof Set) {
    return freezeClonedSet(value);
  }
  if (Array.isArray(value)) {
    return deepFreeze(value.map((item) => cloneAndFreezeValue(item)));
  }
  if (typeof value === 'object') {
    const cloned = {};
    for (const [key, val] of Object.entries(value)) {
      cloned[key] = cloneAndFreezeValue(val);
    }
    return deepFreeze(cloned);
  }
  return value;
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
  return uniqueArr.map((u, idx) =>
    deepFreeze({
      index: idx + 1,
      actionId: u.actionId,
      commandString: u.commandString,
      params: cloneAndFreezeValue(u.params),
      description: u.description,
      visual:
        u.visual === null || u.visual === undefined
          ? null
          : cloneAndFreezeValue(u.visual),
    })
  );
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

    /* ── fast path: reuse cached list when discovery returns empty ────── */
    if (discovered.length === 0) {
      const cached = this.#actorCache.get(actorId);
      if (cached) {
        this.#log.debug(
          `ActionIndexingService: discovery returned empty for ${actorId}, reusing cached actions`
        );
        return cached.slice();
      }

      this.#actorCache.set(actorId, []);
      return [];
    }

    /* ── filter invalid entries before deduplication ─────────────────── */
    const { valid: validDiscovered, invalid: invalidEntries } =
      partitionDiscoveredActions(discovered);

    if (invalidEntries.length > 0) {
      this.#log.warn(
        `ActionIndexingService: actor "${actorId}" ignored ${invalidEntries.length} invalid action ${
          invalidEntries.length === 1 ? 'entry' : 'entries'
        }.`,
        {
          examples: invalidEntries.slice(0, 3).map((entry) => ({
            index: entry.index,
            reason: entry.reason,
            entryType: entry.entryType,
            actionId: entry.actionId,
            commandType: entry.commandType,
          })),
        }
      );
    }

    /* ── deduplicate by (id + params) ─────────────────────────────────── */
    const { uniqueArr, duplicatesSuppressed, duplicateDetails } =
      deduplicateActions(validDiscovered);
    if (duplicatesSuppressed > 0) {
      const duplicateInfo = duplicateDetails
        .map((dup) => {
          const paramsStr =
            dup.params && Object.keys(dup.params).length > 0
              ? `, params: ${formatParamsForLog(dup.params)}`
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
    return composites.slice(); // Return copy to prevent accidental cache mutation
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
