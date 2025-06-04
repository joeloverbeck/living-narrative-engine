import ShortTermMemoryService from './shortTermMemoryService.js';
import { SHORT_TERM_MEMORY_COMPONENT_ID } from '../constants/componentIds.js';

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
  if (rawThoughts == null || String(rawThoughts).trim() === '') {
    logger.warn('STM-001 Missing thoughts');
    return;
  }
  const thoughtText = String(rawThoughts).trim();

  /* ── 2. Retrieve STM component via the public API ───────────────────── */
  const hasGetter = typeof actorEntity?.getComponentData === 'function';
  let memoryComp = hasGetter
    ? actorEntity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID)
    : actorEntity?.components?.[SHORT_TERM_MEMORY_COMPONENT_ID];

  if (!memoryComp) {
    logger.warn('STM-002 Missing component');
    return; // nothing to persist
  }

  /* ── 3. Mutate in place using the service ───────────────────────────── */
  const stmService = new ShortTermMemoryService();
  const updatedMem = stmService.addThought(memoryComp, thoughtText, new Date());

  /* ── 4. Push the mutation back to the entity ────────────────────────── */
  if (typeof actorEntity?.addComponent === 'function') {
    // Ensures validation & internal bookkeeping
    actorEntity.addComponent(SHORT_TERM_MEMORY_COMPONENT_ID, updatedMem);
  } else if (actorEntity?.components) {
    // Plain-object pseudo-entity – just re-assign
    actorEntity.components[SHORT_TERM_MEMORY_COMPONENT_ID] = updatedMem;
  }
}

// Convenience default export
export default { processTurnAction: persistThoughts };
