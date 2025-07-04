// src/persistence/componentCleaningService.js

import { safeDeepClone } from '../utils/cloneUtils.js';
import { BaseService } from '../utils/serviceBase.js';
/** @typedef {import('../interfaces/IComponentCleaningService.js').IComponentCleaningService} IComponentCleaningService */
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
} from '../constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * Creates the built-in cleaners using the provided logger.
 *
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logging service.
 * @returns {Record<string, (data: any) => any>} Map of default cleaners.
 */
export function buildDefaultComponentCleaners(logger) {
  return {
    [NOTES_COMPONENT_ID]: (data) => {
      if (data.notes && Array.isArray(data.notes) && data.notes.length === 0) {
        logger.debug(
          `Omitting empty 'notes' array from component '${NOTES_COMPONENT_ID}'.`
        );
        delete data.notes;
      }
      return data;
    },
    [SHORT_TERM_MEMORY_COMPONENT_ID]: (data) => {
      if (
        data.thoughts &&
        typeof data.thoughts === 'string' &&
        !data.thoughts.trim()
      ) {
        logger.debug(
          `Omitting blank 'thoughts' from component '${SHORT_TERM_MEMORY_COMPONENT_ID}'.`
        );
        delete data.thoughts;
      }
      return data;
    },
    [PERCEPTION_LOG_COMPONENT_ID]: (data) => {
      if (data.log && Array.isArray(data.log)) {
        data.log.forEach((entry) => {
          if (
            entry?.action?.speech &&
            typeof entry.action.speech === 'string' &&
            !entry.action.speech.trim()
          ) {
            logger.debug(
              "Omitting blank 'speech' from a perception log entry."
            );
            delete entry.action.speech;
          }
        });
      }
      return data;
    },
  };
}

/**
 * @class ComponentCleaningService
 * @augments BaseService
 * @implements {IComponentCleaningService}
 * @description Provides registration and execution of component data cleaners.
 */
class ComponentCleaningService extends BaseService {
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
  constructor({ logger, safeEventDispatcher, defaultCleaners } = {}) {
    super();
    this.#logger = this._init('ComponentCleaningService', logger, {
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#cleaners = new Map();

    const entries = defaultCleaners
      ? defaultCleaners instanceof Map
        ? defaultCleaners.entries()
        : Object.entries(defaultCleaners)
      : [];

    for (const [componentId, cleanerFn] of entries) {
      this.registerCleaner(componentId, cleanerFn);
    }

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
    if (typeof cleanerFn !== 'function') {
      this.#logger.error(`Cleaner for ${componentId} must be a function.`);
      return;
    }
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
    const cloneResult = safeDeepClone(componentData, this.#logger);
    if (!cloneResult.success || !cloneResult.data) {
      this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: 'ComponentCleaningService.clean deepClone failed',
        details: {
          componentId,
          error: cloneResult.error?.message,
          stack: cloneResult.error?.stack,
        },
      });
      throw new Error('Failed to deep clone object data.');
    }

    let dataToSave = cloneResult.data;

    const cleaner = this.#cleaners.get(componentId);
    if (cleaner) {
      dataToSave = cleaner(dataToSave);
    }
    return dataToSave;
  }
}

export default ComponentCleaningService;
