// src/locations/services/lightingStateService.js
/**
 * @file Service for querying location lighting state.
 *
 * This service uses hardcoded component IDs for the locations mod
 * as it is specifically designed to work with the lighting components.
 */

/* eslint-disable mod-architecture/no-hardcoded-mod-references */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} LightSourcesComponentData
 * @property {string[]} [sources] - Entity IDs of active light sources.
 */

/**
 * @typedef {object} LightingState
 * @property {boolean} isLit - Whether the location has sufficient light to see
 * @property {string[]} lightSources - Entity IDs of active light sources (empty if ambient light)
 */

/**
 * Service for querying location lighting state.
 *
 * Decision matrix:
 * | naturally_dark | light_sources.sources | Result |
 * |----------------|----------------------|--------|
 * | Absent         | Any                  | Lit (ambient) |
 * | Present        | Empty or missing     | Dark |
 * | Present        | Non-empty array      | Lit (artificial) |
 */
class LightingStateService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates a new LightingStateService instance.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {IEntityManager} dependencies.entityManager - Entity manager for component queries.
   * @param {ILogger} dependencies.logger - Logger instance for debug output.
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'entityManager', logger, {
      requiredMethods: ['hasComponent', 'getComponentData'],
    });
    validateDependency(logger, 'logger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;

    this.#logger.debug('LightingStateService initialized.');
  }

  /**
   * Determines if a location is currently lit.
   *
   * @param {string} locationId - Location entity ID.
   * @returns {LightingState} The lighting state with isLit boolean and lightSources array.
   */
  getLocationLightingState(locationId) {
    const isNaturallyDark = this.#entityManager.hasComponent(
      locationId,
      'locations:naturally_dark'
    );

    if (!isNaturallyDark) {
      this.#logger.debug(
        `Location ${locationId} is naturally lit (no naturally_dark marker).`
      );
      return { isLit: true, lightSources: [] };
    }

    /** @type {LightSourcesComponentData | undefined} */
    const lightSourcesData = this.#entityManager.getComponentData(
      locationId,
      'locations:light_sources'
    );

    const sources = lightSourcesData?.sources || [];
    const isLit = sources.length > 0;

    this.#logger.debug(
      `Location ${locationId} naturally_dark=true, light sources=${sources.length}, isLit=${isLit}.`
    );

    return {
      isLit,
      lightSources: sources,
    };
  }

  /**
   * Convenience method for simple boolean check.
   *
   * @param {string} locationId - Location entity ID.
   * @returns {boolean} True if the location is lit, false otherwise.
   */
  isLocationLit(locationId) {
    return this.getLocationLightingState(locationId).isLit;
  }
}

export { LightingStateService };
