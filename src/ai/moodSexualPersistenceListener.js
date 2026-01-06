// src/ai/moodSexualPersistenceListener.js

import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../constants/componentIds.js';
import { COMPONENT_ADDED_ID } from '../constants/eventIds.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class
 * @description Listens for ACTION_DECIDED_ID events and persists mood/sexual state updates
 * to the actor's components.
 */
export class MoodSexualPersistenceListener {
  /** @type {ILogger} */
  #logger;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;

  /**
   * Creates an instance of the listener.
   *
   * @param {{
   *   logger: ILogger,
   *   entityManager: IEntityManager,
   *   safeEventDispatcher: ISafeEventDispatcher
   * }} deps - Dependencies for the listener.
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    if (!logger) {
      throw new Error(
        'MoodSexualPersistenceListener: logger dependency is required'
      );
    }
    if (!entityManager) {
      throw new Error(
        'MoodSexualPersistenceListener: entityManager dependency is required'
      );
    }
    if (!safeEventDispatcher) {
      throw new Error(
        'MoodSexualPersistenceListener: safeEventDispatcher dependency is required'
      );
    }

    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * Handles ACTION_DECIDED_ID events.
   *
   * @param {{ type: string, payload: { actorId: string, extractedData?: { moodUpdate?: object, sexualUpdate?: object } } }} event
   *   The event containing mood/sexual state data from the LLM response.
   */
  handleEvent(event) {
    if (!event || !event.payload) return;

    const { actorId, extractedData } = event.payload;

    if (!extractedData?.moodUpdate && !extractedData?.sexualUpdate) {
      return;
    }

    this.#logger.info(
      `MoodSexualPersistenceListener → event received for actor ${actorId}`
    );

    try {
      const entity = this.#entityManager.getEntityInstance(actorId);
      if (!entity) {
        this.#logger.warn(
          `MoodSexualPersistenceListener: Entity not found: ${actorId}`
        );
        return;
      }

      if (extractedData.moodUpdate) {
        this.#applyMoodUpdate(entity, actorId, extractedData.moodUpdate);
      }

      if (extractedData.sexualUpdate) {
        this.#applySexualUpdate(entity, actorId, extractedData.sexualUpdate);
      }
    } catch (error) {
      // Graceful error handling - don't throw, just log
      this.#logger.error(
        `MoodSexualPersistenceListener: Error updating state for ${actorId}`,
        error
      );
    }
  }

  /**
   * Apply mood update to the entity's mood component.
   *
   * @param {import('../entities/entity.js').default} entity
   * @param {string} actorId
   * @param {{ valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, self_evaluation: number }} moodUpdate
   */
  #applyMoodUpdate(entity, actorId, moodUpdate) {
    if (!entity.hasComponent(MOOD_COMPONENT_ID)) {
      this.#logger.warn(
        `MoodSexualPersistenceListener: Actor ${actorId} lacks ${MOOD_COMPONENT_ID} component`
      );
      return;
    }

    const oldComponentData = entity.getComponentData(MOOD_COMPONENT_ID);
    entity.modifyComponent(MOOD_COMPONENT_ID, moodUpdate);
    const componentData = entity.getComponentData(MOOD_COMPONENT_ID);

    // Dispatch event so UI panels can re-render
    this.#safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: MOOD_COMPONENT_ID,
      componentData,
      oldComponentData,
    });

    this.#logger.info(
      `MoodSexualPersistenceListener: Updated mood for ${actorId}`,
      {
        valence: moodUpdate.valence,
        arousal: moodUpdate.arousal,
        threat: moodUpdate.threat,
      }
    );
  }

  /**
   * Apply sexual state update to the entity's sexual_state component.
   * Preserves baseline_libido (trait value, not updated by LLM).
   *
   * @param {import('../entities/entity.js').default} entity
   * @param {string} actorId
   * @param {{ sex_excitation: number, sex_inhibition: number }} sexualUpdate
   */
  #applySexualUpdate(entity, actorId, sexualUpdate) {
    if (!entity.hasComponent(SEXUAL_STATE_COMPONENT_ID)) {
      this.#logger.warn(
        `MoodSexualPersistenceListener: Actor ${actorId} lacks ${SEXUAL_STATE_COMPONENT_ID} component`
      );
      return;
    }

    // Get current component to preserve baseline_libido
    const current = entity.getComponentData(SEXUAL_STATE_COMPONENT_ID);
    const oldComponentData = current ?? null;

    // Merge update, preserving baseline_libido (trait, not updated by LLM)
    const updatedState = {
      sex_excitation: sexualUpdate.sex_excitation,
      sex_inhibition: sexualUpdate.sex_inhibition,
      baseline_libido: current.baseline_libido, // Preserve trait value
    };

    entity.modifyComponent(SEXUAL_STATE_COMPONENT_ID, updatedState);
    const componentData = entity.getComponentData(SEXUAL_STATE_COMPONENT_ID);

    // Dispatch event so UI panels can re-render
    this.#safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: SEXUAL_STATE_COMPONENT_ID,
      componentData,
      oldComponentData,
    });

    this.#logger.info(
      `MoodSexualPersistenceListener: Updated sexual state for ${actorId}`,
      {
        sex_excitation: sexualUpdate.sex_excitation,
        sex_inhibition: sexualUpdate.sex_inhibition,
      }
    );
  }
}
