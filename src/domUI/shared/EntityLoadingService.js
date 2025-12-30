/**
 * @file EntityLoadingService.js
 * @description Service for loading entities with anatomy and coordinating state management.
 * Reusable across visualizers (anatomy-visualizer, damage-simulator, etc.)
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Service for loading entities with anatomy components and coordinating
 * with state controllers for anatomy loading detection.
 */
class EntityLoadingService {
  /** @type {import('../../interfaces/coreServices.js').IEntityManager} */
  #entityManager;

  /** @type {import('../../interfaces/IDataRegistry.js').IDataRegistry} */
  #dataRegistry;

  /** @type {import('../visualizer/VisualizerStateController.js').VisualizerStateController} */
  #stateController;

  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /** @type {string[]} */
  #createdEntities;

  /** @type {string|null} */
  #currentEntityId;

  /**
   * Creates a new EntityLoadingService instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').IEntityManager} dependencies.entityManager - Entity manager for creating/removing instances
   * @param {import('../../interfaces/IDataRegistry.js').IDataRegistry} dependencies.dataRegistry - Registry for entity definitions
   * @param {import('../visualizer/VisualizerStateController.js').VisualizerStateController} dependencies.stateController - State controller for anatomy loading
   * @param {import('../../interfaces/ILogger.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ entityManager, dataRegistry, stateController, logger }) {
    validateDependency(entityManager, 'IEntityManager', console, {
      requiredMethods: ['createEntityInstance', 'removeEntityInstance'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', console, {
      requiredMethods: ['getEntityDefinition'],
    });
    validateDependency(stateController, 'VisualizerStateController', console, {
      requiredMethods: ['getCurrentState', 'reset', 'selectEntity', 'handleError'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#stateController = stateController;
    this.#logger = logger;
    this.#createdEntities = [];
    this.#currentEntityId = null;
  }

  /**
   * Load an entity and wait for its anatomy to be ready.
   * Clears any previously loaded entities before loading the new one.
   *
   * @param {string} definitionId - The entity definition ID to load
   * @returns {Promise<string>} The instance ID of the loaded entity
   * @throws {Error} If definition not found or lacks anatomy:body component
   */
  async loadEntityWithAnatomy(definitionId) {
    this.#logger.info(`EntityLoadingService: Loading entity ${definitionId}`);

    try {
      // Clear any previous entities
      await this.clearCurrentEntity();

      // Reset state to IDLE before selecting new entity to ensure valid state transition
      const currentState = this.#stateController.getCurrentState();
      if (currentState !== 'IDLE') {
        this.#logger.debug(
          `EntityLoadingService: Resetting state from ${currentState} to IDLE`
        );
        this.#stateController.reset();
      }

      // Get entity definition to verify it has anatomy:body
      const definition = this.#dataRegistry.getEntityDefinition(definitionId);
      if (!definition) {
        throw new Error(`Entity definition not found: ${definitionId}`);
      }

      const bodyComponentDef = definition.components?.['anatomy:body'];
      if (!bodyComponentDef) {
        throw new Error(
          `Entity ${definitionId} does not have anatomy:body component`
        );
      }

      // Create the entity instance - this will trigger anatomy generation
      this.#logger.debug(
        `EntityLoadingService: Creating entity instance for ${definitionId}`
      );
      const entityInstance = await this.#entityManager.createEntityInstance(
        definitionId,
        {} // No component overrides
      );

      // Store the created entity ID for cleanup
      this.#createdEntities.push(entityInstance.id);
      this.#currentEntityId = entityInstance.id;

      // Use the state controller to handle entity selection and anatomy detection
      await this.#stateController.selectEntity(entityInstance.id);

      this.#logger.info(
        `EntityLoadingService: Successfully loaded entity ${entityInstance.id}`
      );

      return entityInstance.id;
    } catch (error) {
      this.#logger.error(
        `EntityLoadingService: Failed to load entity ${definitionId}:`,
        error
      );
      this.#stateController.handleError(error);
      throw error;
    }
  }

  /**
   * Clear current entity state.
   * Removes all tracked entity instances in reverse order (children first).
   *
   * @returns {Promise<void>}
   */
  async clearCurrentEntity() {
    if (this.#createdEntities.length === 0) return;

    this.#logger.debug(
      `EntityLoadingService: Cleaning up ${this.#createdEntities.length} entities`
    );

    // Destroy all created entities in reverse order (children first)
    for (let i = this.#createdEntities.length - 1; i >= 0; i--) {
      const entityId = this.#createdEntities[i];
      try {
        await this.#entityManager.removeEntityInstance(entityId);
      } catch (error) {
        this.#logger.warn(
          `EntityLoadingService: Failed to destroy entity ${entityId}:`,
          error
        );
      }
    }

    this.#createdEntities = [];
    this.#currentEntityId = null;
  }

  /**
   * Get the current entity ID, if any.
   *
   * @returns {string|null} The current entity instance ID or null
   */
  getCurrentEntityId() {
    return this.#currentEntityId;
  }

  /**
   * Get the list of created entity IDs.
   *
   * @returns {string[]} Array of created entity instance IDs
   */
  getCreatedEntities() {
    return [...this.#createdEntities];
  }
}

export default EntityLoadingService;
