// src/persistence/componentCleaningService.js

import { deepClone } from '../utils/objectUtils.js';
import { setupService } from '../utils/serviceInitializer.js';
/** @typedef {import('../interfaces/IComponentCleaningService.js').IComponentCleaningService} IComponentCleaningService */
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
} from '../constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * @class ComponentCleaningService
 * @implements {IComponentCleaningService}
 * @description Provides registration and execution of component data cleaners.
 */
class ComponentCleaningService {
  /** @type {Map<string, (data: any) => any>} */
  #cleaners;

  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #safeEventDispatcher;

  /**
   * Creates a new ComponentCleaningService.
   *
   * @param {object} dependencies - The dependencies for the service.
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - Logging service.
   * @param dependencies.safeEventDispatcher
   */
  constructor({ logger, safeEventDispatcher }) {
    this.#logger = setupService('ComponentCleaningService', logger, {
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#cleaners = new Map();

    this.registerCleaner(
      NOTES_COMPONENT_ID,
      this.#cleanNotesComponent.bind(this)
    );
    this.registerCleaner(
      SHORT_TERM_MEMORY_COMPONENT_ID,
      this.#cleanShortTermMemoryComponent.bind(this)
    );
    this.registerCleaner(
      PERCEPTION_LOG_COMPONENT_ID,
      this.#cleanPerceptionLogComponent.bind(this)
    );

    this.#logger.debug('ComponentCleaningService: Instance created.');
  }

  /**
   * Registers a cleaner function for a component type.
   *
   * @param {string} componentId - The component identifier.
   * @param {(data: any) => any} cleanerFn - The function to clean the data.
   * @returns {void}
   */
  registerCleaner(componentId, cleanerFn) {
    if (this.#cleaners.has(componentId)) {
      this.#logger.warn(
        `Cleaner for component '${componentId}' already registered. Overwriting.`
      );
    }
    this.#cleaners.set(componentId, cleanerFn);
  }

  /**
   * Deep clones and cleans the provided component data.
   *
   * @param {string} componentId - The component identifier.
   * @param {any} componentData - Raw component data.
   * @returns {any} The cleaned data.
   */
  clean(componentId, componentData) {
    let dataToSave;
    try {
      dataToSave = deepClone(componentData);
    } catch (e) {
      this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: 'ComponentCleaningService.clean deepClone failed',
        details: {
          componentId,
          error: e.message,
          stack: e.stack,
        },
      });
      throw new Error('Failed to deep clone object data.');
    }

    const cleaner = this.#cleaners.get(componentId);
    if (cleaner) {
      dataToSave = cleaner(dataToSave);
    }
    return dataToSave;
  }

  /**
   * Removes empty notes arrays from notes components.
   *
   * @param {any} data - Component data.
   * @returns {any} Cleaned data.
   * @private
   */
  #cleanNotesComponent(data) {
    if (data.notes && Array.isArray(data.notes) && data.notes.length === 0) {
      this.#logger.debug(
        `Omitting empty 'notes' array from component '${NOTES_COMPONENT_ID}'.`
      );
      delete data.notes;
    }
    return data;
  }

  /**
   * Removes blank thoughts from short-term memory components.
   *
   * @param {any} data - Component data.
   * @returns {any} Cleaned data.
   * @private
   */
  #cleanShortTermMemoryComponent(data) {
    if (
      data.thoughts &&
      typeof data.thoughts === 'string' &&
      !data.thoughts.trim()
    ) {
      this.#logger.debug(
        `Omitting blank 'thoughts' from component '${SHORT_TERM_MEMORY_COMPONENT_ID}'.`
      );
      delete data.thoughts;
    }
    return data;
  }

  /**
   * Cleans perception log entries of blank speech fields.
   *
   * @param {any} data - Component data.
   * @returns {any} Cleaned data.
   * @private
   */
  #cleanPerceptionLogComponent(data) {
    if (data.log && Array.isArray(data.log)) {
      data.log.forEach((entry) => {
        if (
          entry?.action?.speech &&
          typeof entry.action.speech === 'string' &&
          !entry.action.speech.trim()
        ) {
          this.#logger.debug(
            "Omitting blank 'speech' from a perception log entry."
          );
          delete entry.action.speech;
        }
      });
    }
    return data;
  }
}

export default ComponentCleaningService;
