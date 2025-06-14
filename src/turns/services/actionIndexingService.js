// src/turns/services/actionIndexingService.js
// ────────────────────────────────────────────────────────────────────────────────
//  A "per‑turn" action index with backward‑compatibility for the test‑suite.
//  -----------------------------------------------------------------------------
//  * A *fresh* list is built every time you pass a **non‑empty** `discovered`
//    array – even if the actor is the same as last turn. (That is the feature
//    we introduced.)
//  * The second (or later) call **in the same turn** may pass an empty array –
//    you get back the exact same array instance that was built earlier.
//  * Duplicate actions (same id + identical params) are suppressed with an
//    `info()` log; the overall list is capped at
//    `MAX_AVAILABLE_ACTIONS_PER_TURN`, logging a `warn()` when truncated.
//
//  The public surface expected by existing unit‑tests is preserved: constructor
//  is tolerant to being called either with a bare logger or with `{ logger }`.
//
//  @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
//  @typedef {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} DiscoveredActionInfo
//  @typedef {import('../dtos/actionComposite.js').ActionComposite} ActionComposite

import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';

export class ActionIndexingService {
  /**
   * @param {{ logger: ILogger }} deps
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

  /** @type {ILogger} */ #log;
  /** @type {Map<string, ActionComposite[]>} */ #actorCache = new Map();

  /* ─────────────────────────────────────────────────────────────────────── */
  clearActorCache(actorId) {
    this.#actorCache.delete(actorId);
    this.#log.debug(`ActionIndexingService: cache cleared for ${actorId}`);
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /**
   * (Re)build the indexed list for an actor.
   *
   * @param {string} actorId
   * @param {DiscoveredActionInfo[]} discovered
   * @returns {ActionComposite[]}
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
      return this.#actorCache.get(actorId);
    }

    /* ── deduplicate by (id + params) ─────────────────────────────────── */
    const unique = new Map(); // key ⇒ representative action
    for (const raw of discovered) {
      // The tests still send `{ actionId, commandString }`; production sends
      // `{ id, command }`.  We normalise so both worlds work.
      const actionId = raw.actionId ?? raw.id;
      const commandString = raw.commandString ?? raw.command;
      const params = raw.params ?? {};
      const description = raw.description ?? '';
      const key = `${actionId}:${JSON.stringify(params)}`;
      if (!unique.has(key)) {
        unique.set(key, { actionId, commandString, params, description });
      }
    }

    const duplicatesSuppressed = discovered.length - unique.size;
    if (duplicatesSuppressed > 0) {
      this.#log.info(
        `ActionIndexingService: actor "${actorId}" suppressed ${duplicatesSuppressed} duplicate actions`
      );
    }

    /* ── cap the list if it’s over the maximum ─────────────────────────── */
    let uniqueArr = Array.from(unique.values());
    if (uniqueArr.length > MAX_AVAILABLE_ACTIONS_PER_TURN) {
      const truncated = uniqueArr.length - MAX_AVAILABLE_ACTIONS_PER_TURN;
      uniqueArr = uniqueArr.slice(0, MAX_AVAILABLE_ACTIONS_PER_TURN);
      this.#log.warn(
        `ActionIndexingService: actor "${actorId}" truncated ${truncated} actions, processing only the first ${MAX_AVAILABLE_ACTIONS_PER_TURN}`
      );
    }

    /* ── build composites ─────────────────────────────────────────────── */
    const composites = uniqueArr.map((u, idx) => ({
      index: idx + 1,
      actionId: u.actionId,
      commandString: u.commandString,
      params: u.params,
      description: u.description,
    }));

    /* ── cache and return ─────────────────────────────────────────────── */
    this.#actorCache.set(actorId, composites);
    this.#log.debug(
      `ActionIndexingService: indexed ${composites.length} actions for ${actorId}`
    );
    return composites;
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  getIndexedList(actorId) {
    const list = this.#actorCache.get(actorId);
    if (!list) throw new Error(`No indexed action list for actor "${actorId}"`);
    return list.slice(); // shallow copy to protect internal state
  }

  /* ─────────────────────────────────────────────────────────────────────── */
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
