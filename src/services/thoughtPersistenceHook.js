/* eslint-disable no-unused-vars */
import ShortTermMemoryService from './shortTermMemoryService.js';

/* eslint-enable no-unused-vars */

/**
 * Persist the “thoughts” produced during an LLM turn into the actor’s
 * short-term-memory component.
 *
 * @param {object}  action       – The structured action returned by the LLM.
 * @param {object}  actorEntity  – The Entity instance (or plain-object pseudo-entity) that generated the action.
 * @param {object}  logger       – Application-wide logger (expects .warn()).
 */
export function processTurnAction(action, actorEntity, logger) {
    // ──────────────────────────────────────────────────────────────
    // STEP 1 – Extract and validate thoughts
    // ──────────────────────────────────────────────────────────────
    const rawThoughts = action?.thoughts;

    if (rawThoughts == null || String(rawThoughts).trim() === '') {
        logger.warn('STM-001 Missing thoughts');
        return;                                     // Nothing worth doing
    }

    const newThoughtText = String(rawThoughts);

    // ──────────────────────────────────────────────────────────────
    // STEP 2 – Persist to short-term memory
    // ──────────────────────────────────────────────────────────────
    const memoryComp = actorEntity?.components?.['core:short_term_memory'];

    // NEW — graceful handling when the component is absent
    if (!memoryComp) {
        logger.warn('STM-002 Missing component');
        return;                                     // Backward compatibility
    }

    // Service is stateless and cheap to construct
    const stmService = new ShortTermMemoryService();

    const updatedMem = stmService.addThought(
        memoryComp,
        newThoughtText,
        new Date()
    );

    // addThought mutates in place, but re-assign for clarity
    actorEntity.components['core:short_term_memory'] = updatedMem;
}

// Convenience default export
export default {processTurnAction};