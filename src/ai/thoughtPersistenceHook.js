// src/ai/thoughtPersistenceHook.js

import ShortTermMemoryService from './shortTermMemoryService.js';
import { SHORT_TERM_MEMORY_COMPONENT_ID } from '../constants/componentIds.js';
import {
  readComponent,
  writeComponent,
} from '../utils/componentAccessUtils.js';

/**
 * Persist the “thoughts” produced during an LLM turn into the actor’s
 * short-term-memory component.
 *
 * Works with a full Entity instance *or* a plain-object pseudo-entity.
 *
 * @param {object} action       – The structured action returned by the LLM.
 * @param {object} actorEntity  – Entity instance (or test double) that generated the action.
 * @param {object} logger       – Application-wide logger (expects .warn()).
 */
export function persistThoughts(action, actorEntity, logger) {
  /* ── 1. Validate thoughts ───────────────────────────────────────────── */
  const rawThoughts = action?.thoughts;
  if (
    rawThoughts === null ||
    rawThoughts === undefined ||
    String(rawThoughts).trim() === ''
  ) {
    logger.warn('STM-001 Missing thoughts');
    return;
  }
  const thoughtText = String(rawThoughts).trim();

  /* ── 2. Retrieve STM component via the public API ───────────────────── */
  const memoryComp = readComponent(actorEntity, SHORT_TERM_MEMORY_COMPONENT_ID);

  if (!memoryComp) {
    logger.warn('STM-002 Missing component');
    return; // nothing to persist
  }

  /* ── 3. Mutate in place using the service ───────────────────────────── */
  const stmService = new ShortTermMemoryService();
  const { mem: updatedMem } = stmService.addThought(
    memoryComp,
    thoughtText,
    new Date()
  );

  /* ── 4. Push the mutation back to the entity ────────────────────────── */
  writeComponent(actorEntity, SHORT_TERM_MEMORY_COMPONENT_ID, updatedMem);
}

// Convenience default export
