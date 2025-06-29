// src/ai/shortTermMemoryService.js

import { ISafeEventDispatcher } from '../interfaces/ISafeEventDispatcher.js';

/**
 * Short-Term Memory service.
 * Keeps a bounded list of recent thoughts.
 */
export default class ShortTermMemoryService {
  /**
   * Creates a new ShortTermMemoryService.
   *
   * @param {object} [options] Configuration options for the service.
   * @param {ISafeEventDispatcher} [options.eventDispatcher] Safe dispatcher for domain events.
   * @param {number} [options.defaultMaxEntries] Fallback when mem.maxEntries is missing or invalid.
   */
  constructor({ eventDispatcher = null, defaultMaxEntries = 50 } = {}) {
    this.eventDispatcher = eventDispatcher;
    this.defaultMaxEntries = defaultMaxEntries;
  }

  /**
   * Add a thought if it isn’t already present.
   *
   * @param {object} mem The memory object to update.
   * @param {Array<{text:string,timestamp:string}>} mem.thoughts The list of existing thought entries.
   * @param {number} mem.maxEntries The maximum number of entries allowed in the memory.
   * @param {string} mem.entityId The identifier for the entity owning this memory.
   * @param {string} newText The new thought text to add.
   * @param {Date} [now] The current date/time; defaults to new Date().
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
    if (trimmed.length === 0) return { mem, wasAdded: false };
    const lowered = trimmed.toLowerCase();

    // 2. Duplicate check ----------------------------------------------------
    for (const { text } of mem.thoughts ?? []) {
      if (typeof text !== 'string') continue;
      if (text.trim().toLowerCase() === lowered)
        return { mem, wasAdded: false };
    }

    // 3. Append new thought -------------------------------------------------
    if (!Array.isArray(mem.thoughts)) mem.thoughts = [];

    const newEntry = {
      text: newText,
      timestamp: now.toISOString(),
    };

    mem.thoughts.push(newEntry);

    // 4. Trim to capacity ---------------------------------------------------
    const max =
      Number.isInteger(mem.maxEntries) && mem.maxEntries > 0
        ? mem.maxEntries
        : this.defaultMaxEntries;

    while (mem.thoughts.length > max) {
      mem.thoughts.shift();
    }

    return { mem, wasAdded: true, entry: newEntry };
  }

  /**
   * @description Emits a `ThoughtAdded` event using the configured dispatcher.
   * @param {string | null} entityId - ID of the owner entity.
   * @param {string} text - Thought text.
   * @param {string} timestamp - ISO timestamp of the thought.
   */
  emitThoughtAdded(entityId, text, timestamp) {
    if (
      this.eventDispatcher &&
      typeof this.eventDispatcher.dispatch === 'function'
    ) {
      this.eventDispatcher.dispatch('ThoughtAdded', {
        entityId,
        text,
        timestamp,
      });
    }
  }
}
