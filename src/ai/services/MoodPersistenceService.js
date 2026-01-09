/**
 * @file Service for persisting mood/sexual state updates between two-phase flow.
 */

import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../constants/componentIds.js';
import {
  COMPONENT_ADDED_ID,
  MOOD_STATE_UPDATED_ID,
} from '../../constants/eventIds.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

export class MoodPersistenceService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {{
   *  entityManager: IEntityManager,
   *  safeEventDispatcher: ISafeEventDispatcher,
   *  logger: ILogger,
   * }} deps
   */
  constructor({ entityManager, safeEventDispatcher, logger }) {
    if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
      throw new Error(
        'MoodPersistenceService: entityManager must expose getEntityInstance'
      );
    }
    if (!safeEventDispatcher || typeof safeEventDispatcher.dispatch !== 'function') {
      throw new Error(
        'MoodPersistenceService: safeEventDispatcher must expose dispatch'
      );
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('MoodPersistenceService: logger must expose debug');
    }

    this.#entityManager = entityManager;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger = logger;
  }

  /**
   * Persist mood and sexual state updates to entity components.
   *
   * @param {string} actorId - The actor entity ID.
   * @param {object|null|undefined} moodUpdate - The mood axis values.
   * @param {object|null|undefined} sexualUpdate - The sexual state values.
   * @returns {Promise<void>}
   */
  async persistMoodUpdate(actorId, moodUpdate, sexualUpdate) {
    if (!moodUpdate && !sexualUpdate) {
      return;
    }

    this.#logger.debug(
      `MoodPersistenceService: Persisting mood for ${actorId}`
    );

    let entity;
    try {
      entity = this.#entityManager.getEntityInstance(actorId);
    } catch (error) {
      this.#logger.error(
        `MoodPersistenceService: Error retrieving entity ${actorId}`,
        error
      );
      return;
    }

    if (!entity) {
      this.#logger.warn(
        `MoodPersistenceService: Entity not found: ${actorId}`
      );
      return;
    }

    let updated = false;

    if (moodUpdate) {
      updated = this.#applyMoodUpdate(entity, actorId, moodUpdate) || updated;
    }

    if (sexualUpdate) {
      updated =
        this.#applySexualUpdate(entity, actorId, sexualUpdate) || updated;
    }

    if (updated) {
      this.#safeEventDispatcher.dispatch(MOOD_STATE_UPDATED_ID, {
        actorId,
        moodUpdate: moodUpdate ?? null,
        sexualUpdate: sexualUpdate ?? null,
      });

      this.#logger.info(
        `MoodPersistenceService: Mood state updated for ${actorId}`
      );
    }
  }

  /**
   * @param {import('../../entities/entity.js').default} entity
   * @param {string} actorId
   * @param {object} moodUpdate
   * @returns {boolean}
   */
  #applyMoodUpdate(entity, actorId, moodUpdate) {
    if (!entity.hasComponent(MOOD_COMPONENT_ID)) {
      this.#logger.warn(
        `MoodPersistenceService: Actor ${actorId} lacks ${MOOD_COMPONENT_ID} component`
      );
      return false;
    }

    const oldComponentData = entity.getComponentData(MOOD_COMPONENT_ID);
    entity.modifyComponent(MOOD_COMPONENT_ID, moodUpdate);
    const componentData = entity.getComponentData(MOOD_COMPONENT_ID);

    this.#safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: MOOD_COMPONENT_ID,
      componentData,
      oldComponentData,
    });

    this.#logger.info(
      `MoodPersistenceService: Updated mood for ${actorId}`,
      {
        valence: moodUpdate.valence,
        arousal: moodUpdate.arousal,
        threat: moodUpdate.threat,
      }
    );

    return true;
  }

  /**
   * @param {import('../../entities/entity.js').default} entity
   * @param {string} actorId
   * @param {{ sex_excitation: number, sex_inhibition: number }} sexualUpdate
   * @returns {boolean}
   */
  #applySexualUpdate(entity, actorId, sexualUpdate) {
    if (!entity.hasComponent(SEXUAL_STATE_COMPONENT_ID)) {
      this.#logger.warn(
        `MoodPersistenceService: Actor ${actorId} lacks ${SEXUAL_STATE_COMPONENT_ID} component`
      );
      return false;
    }

    const current = entity.getComponentData(SEXUAL_STATE_COMPONENT_ID);
    const oldComponentData = current ?? null;

    const updatedState = {
      sex_excitation: sexualUpdate.sex_excitation,
      sex_inhibition: sexualUpdate.sex_inhibition,
      baseline_libido: current?.baseline_libido,
    };

    entity.modifyComponent(SEXUAL_STATE_COMPONENT_ID, updatedState);
    const componentData = entity.getComponentData(SEXUAL_STATE_COMPONENT_ID);

    this.#safeEventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId: SEXUAL_STATE_COMPONENT_ID,
      componentData,
      oldComponentData,
    });

    this.#logger.info(
      `MoodPersistenceService: Updated sexual state for ${actorId}`,
      {
        sex_excitation: sexualUpdate.sex_excitation,
        sex_inhibition: sexualUpdate.sex_inhibition,
      }
    );

    return true;
  }
}
