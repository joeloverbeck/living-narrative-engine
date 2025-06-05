import { ISafeEventDispatcher } from '../interfaces/ISafeEventDispatcher.js';

/**
 * Short-Term Memory service
 * Keeps a bounded list of recent thoughts.
 */
export default class ShortTermMemoryService {
  /**
   * @param {object} [options]
   * @param {ISafeEventDispatcher} [options.eventDispatcher]  Safe dispatcher for domain events.
   * @param {number}               [options.defaultMaxEntries]  Fallback when mem.maxEntries is missing/invalid.
   */
  constructor({ eventDispatcher = null, defaultMaxEntries = 50 } = {}) {
    this.eventDispatcher = eventDispatcher;
    this.defaultMaxEntries = defaultMaxEntries;
  }

  /**
   * Add a thought if it isn’t already present.
   *
   * @param {object}  mem
   * @param {Array<{text:string,timestamp:string}>} mem.thoughts
   * @param {number} mem.maxEntries
   * @param {string} mem.entityId
   * @param {string} newText
   * @param {Date}   [now]
   * @returns {object} The same mem object, mutated in place.
   */
  addThought(mem, newText, now = new Date()) {
    if (!mem || typeof mem !== 'object') {
      throw new TypeError(
        'mem must be an object conforming to core:short_term_memory schema'
      );
    }

    // 1. Normalise input ----------------------------------------------------
    const trimmed = String(newText).trim();
    if (trimmed.length === 0) return mem; // ignore empty / whitespace-only
    const lowered = trimmed.toLowerCase();

    // 2. Duplicate check ----------------------------------------------------
    for (const { text } of mem.thoughts ?? []) {
      if (typeof text !== 'string') continue;
      if (text.trim().toLowerCase() === lowered) return mem;
    }

    // 3. Append new thought -------------------------------------------------
    if (!Array.isArray(mem.thoughts)) mem.thoughts = [];

    const newEntry = {
      text: newText, // preserve original casing & spacing
      timestamp: now.toISOString(), // ISO-8601 with ms
    };

    mem.thoughts.push(newEntry);

    // 4. Trim to capacity ---------------------------------------------------
    const max =
      Number.isInteger(mem.maxEntries) && mem.maxEntries > 0
        ? mem.maxEntries
        : this.defaultMaxEntries;

    while (mem.thoughts.length > max) {
      mem.thoughts.shift(); // drop oldest
    }

    // 5. Emit domain event --------------------------------------------------
    if (
      this.eventDispatcher &&
      typeof this.eventDispatcher.dispatchSafely === 'function'
    ) {
      // Fire-and-forget so addThought() stays synchronous.
      /* eslint-disable @typescript-eslint/no-floating-promises */
      this.eventDispatcher.dispatchSafely('ThoughtAdded', {
        entityId: mem.entityId ?? null,
        text: newText,
        timestamp: newEntry.timestamp,
      });
    }

    return mem;
  }
}
