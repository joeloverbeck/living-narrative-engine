// src/services/entityDisplayDataProvider.js

import {
  NAME_COMPONENT_ID,
  PORTRAIT_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../constants/componentIds.js';

/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('./entity.js').default} Entity
 * @typedef {import('../interfaces/CommonTypes.js').NamespacedId} NamespacedId
 */

/**
 * @typedef {object} ProcessedExit
 * @property {string} description - The direction or description of the exit (e.g., "north", "a shimmering portal").
 * @property {NamespacedId | string | undefined} target - The identifier of the target location (instance ID or definition ID).
 * @property {NamespacedId | string | undefined} [id] - Alias for target, for compatibility.
 */

/**
 * @typedef {object} PortraitData
 * @property {string} imagePath - The full, resolved path to the portrait image.
 * @property {string | null} altText - The alternative text for the image.
 */

/**
 * Service to centralize common entity data retrieval and preparation logic for UI display.
 * It encapsulates fetching entities and their component data, processing it for display,
 * and handling cases where entities or components are not found.
 */
export class EntityDisplayDataProvider {
  /**
   * @private
   * @type {IEntityManager}
   */
  #entityManager;

  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @readonly
   * @type {string}
   */
  _logPrefix = '[EntityDisplayDataProvider]';

  /**
   * Creates an instance of EntityDisplayDataProvider.
   *
   * @param {object} dependencies - The dependencies for the service.
   * @param {IEntityManager} dependencies.entityManager - The entity manager instance.
   * @param {ILogger} dependencies.logger - The logger instance.
   */
  constructor({ entityManager, logger }) {
    if (
      !entityManager ||
      typeof entityManager.getEntityInstance !== 'function'
    ) {
      const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid.`;
      (logger || console).error(errMsg);
      throw new Error(errMsg);
    }
    if (!logger || typeof logger.debug !== 'function') {
      const errMsg = `${this._logPrefix} 'logger' dependency is missing or invalid.`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#logger.debug(`${this._logPrefix} Service instantiated.`);
  }

  /**
   * Retrieves the display name of an entity.
   * Falls back to entity ID if the name component is missing, then to a default name.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @param {string} [defaultName] - The default name to return if the entity or its name cannot be determined.
   * @returns {string} The entity's display name, its ID, or the default name.
   */
  getEntityName(entityId, defaultName = 'Unknown Entity') {
    if (!entityId) {
      this.#logger.warn(
        `${this._logPrefix} getEntityName called with null or empty entityId.`
      );
      return defaultName;
    }

    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.debug(
        `${this._logPrefix} getEntityName: Entity with ID '${entityId}' not found. Returning default name.`
      );
      return defaultName;
    }

    const nameComponent = entity.getComponentData(NAME_COMPONENT_ID);
    if (
      nameComponent &&
      typeof nameComponent.text === 'string' &&
      nameComponent.text.trim() !== ''
    ) {
      return nameComponent.text;
    }

    this.#logger.debug(
      `${this._logPrefix} getEntityName: Entity '${entityId}' found, but no valid NAME_COMPONENT_ID data. Returning entity ID as name.`
    );
    return entity.id || defaultName;
  }

  /**
   * Retrieves the full image path for an entity's portrait.
   * Constructs the path using the mod ID derived from the entity's definitionId and the imagePath from its PORTRAIT_COMPONENT.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @returns {string | null} The full path to the portrait image (e.g., /data/mods/core/portraits/hero.png), or null if not found or invalid.
   */
  getEntityPortraitPath(entityId) {
    if (!entityId) {
      this.#logger.warn(
        `${this._logPrefix} getEntityPortraitPath called with null or empty entityId.`
      );
      return null;
    }

    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.debug(
        `${this._logPrefix} getEntityPortraitPath: Entity with ID '${entityId}' not found.`
      );
      return null;
    }

    const portraitComponent = entity.getComponentData(PORTRAIT_COMPONENT_ID);
    if (
      !portraitComponent ||
      typeof portraitComponent.imagePath !== 'string' ||
      !portraitComponent.imagePath.trim()
    ) {
      this.#logger.debug(
        `${this._logPrefix} getEntityPortraitPath: Entity '${entityId}' has no valid PORTRAIT_COMPONENT_ID data or imagePath.`
      );
      return null;
    }

    const modId = this._getModIdFromDefinitionId(entity.definitionId);
    if (!modId) {
      this.#logger.warn(
        `${this._logPrefix} getEntityPortraitPath: Could not extract modId from definitionId '${entity.definitionId}' for entity '${entityId}'. Cannot construct portrait path.`
      );
      return null;
    }

    const imagePath = portraitComponent.imagePath.trim();
    // This path construction assumes a specific mod structure.
    // Consider making this more flexible or configurable if mods can have different asset structures.
    const fullPath = `/data/mods/${modId}/${imagePath}`;
    this.#logger.debug(
      `${this._logPrefix} getEntityPortraitPath: Constructed portrait path for '${entityId}': ${fullPath}`
    );
    return fullPath;
  }

  /**
   * Retrieves the description of an entity.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @param {string} [defaultDescription] - The default description to return if the entity or its description component is not found.
   * @returns {string} The entity's description or the default description.
   */
  getEntityDescription(entityId, defaultDescription = '') {
    if (!entityId) {
      this.#logger.warn(
        `${this._logPrefix} getEntityDescription called with null or empty entityId.`
      );
      return defaultDescription;
    }

    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.debug(
        `${this._logPrefix} getEntityDescription: Entity with ID '${entityId}' not found. Returning default description.`
      );
      return defaultDescription;
    }

    const descriptionComponent = entity.getComponentData(
      DESCRIPTION_COMPONENT_ID
    );
    if (descriptionComponent && typeof descriptionComponent.text === 'string') {
      return descriptionComponent.text;
    }

    this.#logger.debug(
      `${this._logPrefix} getEntityDescription: Entity '${entityId}' found, but no valid DESCRIPTION_COMPONENT_ID data. Returning default description.`
    );
    return defaultDescription;
  }

  /**
   * Retrieves the location ID of an entity from its POSITION_COMPONENT.
   *
   * @param {NamespacedId | string} entityId - The ID of the entity.
   * @returns {NamespacedId | string | null} The location ID (which is an entity instance ID) or null if not found.
   */
  getEntityLocationId(entityId) {
    if (!entityId) {
      this.#logger.warn(
        `${this._logPrefix} getEntityLocationId called with null or empty entityId.`
      );
      return null;
    }

    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.debug(
        `${this._logPrefix} getEntityLocationId: Entity with ID '${entityId}' not found.`
      );
      return null;
    }

    const positionComponent = entity.getComponentData(POSITION_COMPONENT_ID);
    if (
      positionComponent &&
      typeof positionComponent.locationId === 'string' &&
      positionComponent.locationId.trim()
    ) {
      return positionComponent.locationId;
    }

    this.#logger.debug(
      `${this._logPrefix} getEntityLocationId: Entity '${entityId}' found, but no valid POSITION_COMPONENT_ID data or locationId.`
    );
    return null;
  }

  /**
   * Compiles a display information object for a character entity.
   * This object includes the entity's ID, name, description, and portrait path.
   *
   * @param {NamespacedId | string} entityId - The ID of the character entity.
   * @returns {{ id: string, name: string, description: string, portraitPath: string | null } | null}
   * An object with character display information, or null if the entity is not found.
   */
  getCharacterDisplayInfo(entityId) {
    if (!entityId) {
      this.#logger.warn(
        `${this._logPrefix} getCharacterDisplayInfo called with null or empty entityId.`
      );
      return null;
    }
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.debug(
        `${this._logPrefix} getCharacterDisplayInfo: Entity with ID '${entityId}' not found.`
      );
      return null;
    }

    return {
      id: entity.id,
      name: this.getEntityName(entityId, entity.id),
      description: this.getEntityDescription(entityId),
      portraitPath: this.getEntityPortraitPath(entityId),
    };
  }

  /**
   * Retrieves detailed display information for a location entity.
   * This includes its name, description, and a processed list of exits.
   *
   * @param {NamespacedId | string} locationEntityId - The instance ID of the location entity.
   * @returns {{ name: string, description: string, exits: Array<ProcessedExit> } | null}
   * An object with location details, or null if the location entity is not found.
   */
  getLocationDetails(locationEntityId) {
    if (!locationEntityId) {
      this.#logger.warn(
        `${this._logPrefix} getLocationDetails called with null or empty locationEntityId.`
      );
      return null;
    }

    const locationEntity =
      this.#entityManager.getEntityInstance(locationEntityId);
    if (!locationEntity) {
      this.#logger.debug(
        `${this._logPrefix} getLocationDetails: Location entity with ID '${locationEntityId}' not found.`
      );
      return null;
    }

    const name = this.getEntityName(locationEntityId, 'Unnamed Location');
    const description = this.getEntityDescription(
      locationEntityId,
      'No description available.'
    );

    const exitsComponentData =
      locationEntity.getComponentData(EXITS_COMPONENT_ID);
    let processedExits = [];

    if (exitsComponentData && Array.isArray(exitsComponentData)) {
      processedExits = exitsComponentData
        .map((exit) => {
          if (typeof exit !== 'object' || exit === null) {
            this.#logger.warn(
              `${this._logPrefix} getLocationDetails: Invalid exit item in exits component for location '${locationEntityId}'. Skipping.`,
              { exit }
            );
            return null;
          }
          const exitDescription =
            typeof exit.direction === 'string' && exit.direction.trim()
              ? exit.direction.trim()
              : 'Unspecified Exit';
          const exitTarget =
            typeof exit.target === 'string' && exit.target.trim()
              ? exit.target.trim()
              : undefined;

          return {
            description: exitDescription,
            target: exitTarget,
            id: exitTarget,
          };
        })
        .filter((exit) => exit !== null);
    } else if (exitsComponentData) {
      this.#logger.warn(
        `${this._logPrefix} getLocationDetails: Exits component data for location '${locationEntityId}' is present but not an array.`,
        { exitsComponentData }
      );
    }

    return {
      name,
      description,
      exits: processedExits,
    };
  }

  /**
   * NEW METHOD
   * Retrieves portrait data (image path and alt text) for a given location entity.
   * A location entity must have a "core:portrait" component for this to return data.
   *
   * @param {NamespacedId | string} locationEntityId - The ID of the location entity.
   * @returns {PortraitData | null} Portrait data { imagePath: string, altText: string | null } or null if not found/applicable.
   */
  getLocationPortraitData(locationEntityId) {
    if (!locationEntityId) {
      this.#logger.warn(
        `${this._logPrefix} getLocationPortraitData called with null or empty locationEntityId.`
      );
      return null;
    }

    const entity = this.#entityManager.getEntityInstance(locationEntityId);
    if (!entity) {
      this.#logger.debug(
        `${this._logPrefix} getLocationPortraitData: Location entity with ID '${locationEntityId}' not found.`
      );
      return null;
    }

    const portraitComponent = entity.getComponentData(PORTRAIT_COMPONENT_ID);
    if (
      !portraitComponent ||
      typeof portraitComponent.imagePath !== 'string' ||
      !portraitComponent.imagePath.trim()
    ) {
      this.#logger.debug(
        `${this._logPrefix} getLocationPortraitData: Location entity '${locationEntityId}' has no valid PORTRAIT_COMPONENT_ID data or imagePath.`
      );
      return null;
    }

    const modId = this._getModIdFromDefinitionId(entity.definitionId);
    if (!modId) {
      this.#logger.warn(
        `${this._logPrefix} getLocationPortraitData: Could not extract modId from definitionId '${entity.definitionId}' for location '${locationEntityId}'. Cannot construct portrait path.`
      );
      return null;
    }

    const imagePath = portraitComponent.imagePath.trim();
    // This path construction assumes a specific mod structure.
    // You might need to adjust this based on your actual asset loading strategy.
    const fullPath = `/data/mods/${modId}/${imagePath}`;
    const altText =
      typeof portraitComponent.altText === 'string' &&
      portraitComponent.altText.trim()
        ? portraitComponent.altText.trim()
        : null; // Return null if altText is not provided or empty

    this.#logger.debug(
      `${this._logPrefix} getLocationPortraitData: Constructed portrait path for location '${locationEntityId}': ${fullPath}`
    );
    return {
      imagePath: fullPath,
      altText: altText,
    };
  }

  /**
   * Extracts the mod ID from an entity's definitionId.
   * For example, 'core:player' -> CORE_MOD_ID.
   *
   * @private
   * @param {NamespacedId | string | undefined | null} definitionId - The definition ID of the entity (e.g., 'myMod:someEntity').
   * @returns {string | null} The mod ID (namespace part) or null if invalid or not found.
   */
  _getModIdFromDefinitionId(definitionId) {
    if (!definitionId || typeof definitionId !== 'string') {
      this.#logger.warn(
        `${this._logPrefix} _getModIdFromDefinitionId: Invalid or missing definitionId. Expected string, got:`,
        definitionId
      );
      return null;
    }
    const parts = definitionId.split(':');
    if (parts.length > 1 && parts[0] && parts[0].trim() !== '') {
      return parts[0];
    }
    this.#logger.warn(
      `${this._logPrefix} _getModIdFromDefinitionId: Could not parse modId from definitionId '${definitionId}'. Expected format 'modId:entityName'.`
    );
    return null;
  }
}
