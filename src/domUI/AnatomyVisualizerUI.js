/**
 * @file AnatomyVisualizerUI.js
 * @description Main UI controller for the anatomy visualization system
 */

import { ENTITY_CREATED_ID } from '../constants/eventIds.js';
import { DomUtils } from '../utils/domUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../anatomy/anatomyDescriptionService.js').default} AnatomyDescriptionService */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./visualizer/VisualizerStateController.js').VisualizerStateController} VisualizerStateController */
/** @typedef {import('./anatomy-renderer/VisualizationComposer.js').default} VisualizationComposer */

class AnatomyVisualizerUI {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IDataRegistry} dependencies.registry
   * @param {IEntityManager} dependencies.entityManager
   * @param {AnatomyDescriptionService} dependencies.anatomyDescriptionService
   * @param {ISafeEventDispatcher} dependencies.eventDispatcher
   * @param {IDocumentContext} dependencies.documentContext
   * @param {VisualizerStateController} dependencies.visualizerStateController
   * @param {VisualizationComposer} dependencies.visualizationComposer
   */
  constructor({
    logger,
    registry,
    entityManager,
    anatomyDescriptionService,
    eventDispatcher,
    documentContext,
    visualizerStateController,
    visualizationComposer,
  }) {
    this._logger = logger;
    this._registry = registry;
    this._entityManager = entityManager;
    this._anatomyDescriptionService = anatomyDescriptionService;
    this._eventDispatcher = eventDispatcher;
    this._document = documentContext.document;
    this._visualizerStateController = visualizerStateController;
    this._visualizationComposer = visualizationComposer;
    this._currentEntityId = null;
    this._createdEntities = [];
    this._stateUnsubscribe = null;
  }

  /**
   * Initialize the UI and populate entity selector
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this._logger.debug('AnatomyVisualizerUI: Initializing...');

    // Initialize visualization composer
    const container = this._document.getElementById('anatomy-graph-container');
    if (container) {
      this._visualizationComposer.initialize(container);
    }

    // Populate entity selector
    await this._populateEntitySelector();

    // Setup event listeners
    this._setupEventListeners();

    // Subscribe to visualizer state changes
    this._subscribeToStateChanges();

    this._logger.debug('AnatomyVisualizerUI: Initialization complete');
  }

  /**
   * Subscribe to visualizer state changes
   *
   * @private
   */
  _subscribeToStateChanges() {
    this._stateUnsubscribe = this._eventDispatcher.subscribe(
      'anatomy:visualizer_state_changed',
      this._handleStateChange.bind(this)
    );
  }

  /**
   * Handle visualizer state changes
   *
   * @private
   * @param {object} event
   */
  _handleStateChange(event) {
    const { currentState, selectedEntity, anatomyData, error } = event.payload;

    this._logger.debug(
      `AnatomyVisualizerUI: State changed to ${currentState}`,
      {
        selectedEntity,
        hasAnatomyData: !!anatomyData,
        hasError: !!error,
      }
    );

    switch (currentState) {
      case 'LOADING':
        this._showMessage('Loading anatomy...');
        break;

      case 'LOADED':
        if (anatomyData && selectedEntity) {
          this._handleAnatomyLoaded(selectedEntity, anatomyData);
        }
        break;

      case 'READY':
        // Anatomy visualization is complete
        this._logger.info('AnatomyVisualizerUI: Visualization ready');
        break;

      case 'ERROR':
        if (error) {
          this._logger.error('AnatomyVisualizerUI: State error:', error);
          this._showMessage(`Error: ${error.message}`);
        }
        break;
    }
  }

  /**
   * Handle anatomy loaded state
   *
   * @private
   * @param {string} entityId
   * @param {object} anatomyData
   */
  async _handleAnatomyLoaded(entityId, anatomyData) {
    try {
      this._currentEntityId = entityId;

      // Get the entity instance for description update
      const entity = await this._entityManager.getEntityInstance(entityId);

      // Update description panel
      this._updateEntityDescription(entity);

      // Start rendering
      this._visualizerStateController.startRendering();

      // Render the anatomy graph
      await this._visualizationComposer.renderGraph(entityId, anatomyData);

      // Complete rendering
      this._visualizerStateController.completeRendering();
    } catch (error) {
      this._logger.error('Failed to handle anatomy loaded state:', error);
      this._visualizerStateController.handleError(error);
    }
  }

  /**
   * Dispose the UI and clean up resources
   */
  dispose() {
    if (this._stateUnsubscribe) {
      this._stateUnsubscribe();
      this._stateUnsubscribe = null;
    }

    // Clear any created entities
    this._clearPreviousEntities().catch((error) => {
      this._logger.warn('Error during cleanup:', error);
    });
  }

  /**
   * Populate the entity selector with entities that have anatomy:body component
   *
   * @private
   * @returns {Promise<void>}
   */
  async _populateEntitySelector() {
    const selector = this._document.getElementById('entity-selector');
    if (!selector) {
      this._logger.error('Entity selector element not found');
      return;
    }

    // Clear existing options
    selector.innerHTML = '';

    // Add default option
    const defaultOption = this._document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select an entity...';
    selector.appendChild(defaultOption);

    try {
      // Get all entity definitions
      const definitions = this._registry.getAllEntityDefinitions();

      // Filter entities with anatomy:body component
      const anatomyEntities = [];
      for (const definition of definitions) {
        if (
          definition &&
          definition.components &&
          definition.components['anatomy:body']
        ) {
          anatomyEntities.push({ id: definition.id, definition });
        }
      }

      // Sort by ID for consistent ordering
      anatomyEntities.sort((a, b) => a.id.localeCompare(b.id));

      // Add options
      for (const { id, definition } of anatomyEntities) {
        const option = this._document.createElement('option');
        option.value = id;

        // Use the entity's name if available, otherwise use ID
        const nameComponent = definition.components['core:name'];
        const displayName = nameComponent?.text || id;
        option.textContent = `${displayName} (${id})`;

        selector.appendChild(option);
      }

      this._logger.info(
        `AnatomyVisualizerUI: Found ${anatomyEntities.length} entities with anatomy:body`
      );
    } catch (error) {
      this._logger.error('Failed to populate entity selector:', error);
      selector.innerHTML = '<option value="">Error loading entities</option>';
    }
  }

  /**
   * Setup event listeners
   *
   * @private
   */
  _setupEventListeners() {
    const selector = this._document.getElementById('entity-selector');
    if (selector) {
      selector.addEventListener('change', (event) => {
        const entityId = event.target.value;
        if (entityId) {
          this._loadEntity(entityId);
        } else {
          this._clearVisualization();
        }
      });
    }
  }

  /**
   * Load and visualize an entity using the new state management system
   *
   * @private
   * @param {string} entityDefId
   */
  async _loadEntity(entityDefId) {
    this._logger.info(`AnatomyVisualizerUI: Loading entity ${entityDefId}`);

    try {
      // Clear any previous entities
      await this._clearPreviousEntities();

      // Get entity definition to verify it has anatomy:body
      const definition = this._registry.getEntityDefinition(entityDefId);
      if (!definition) {
        throw new Error(`Entity definition not found: ${entityDefId}`);
      }

      const bodyComponentDef = definition.components['anatomy:body'];
      if (!bodyComponentDef) {
        throw new Error(
          `Entity ${entityDefId} does not have anatomy:body component`
        );
      }

      // Create the entity instance - this will trigger anatomy generation
      this._logger.debug(`Creating entity instance for ${entityDefId}`);
      const entityInstance = await this._entityManager.createEntityInstance(
        entityDefId,
        {} // No component overrides
      );

      // Store the created entity ID for cleanup
      this._createdEntities.push(entityInstance.id);

      // Use the state controller to handle entity selection and anatomy detection
      // This replaces the problematic 100ms timeout hack with proper state management
      await this._visualizerStateController.selectEntity(entityInstance.id);
    } catch (error) {
      this._logger.error(`Failed to load entity ${entityDefId}:`, error);
      this._visualizerStateController.handleError(error);
    }
  }

  /**
   * Clear previously created entities
   *
   * @private
   */
  async _clearPreviousEntities() {
    if (this._createdEntities.length === 0) return;

    this._logger.debug(`Cleaning up ${this._createdEntities.length} entities`);

    // Destroy all created entities in reverse order (children first)
    for (let i = this._createdEntities.length - 1; i >= 0; i--) {
      const entityId = this._createdEntities[i];
      try {
        await this._entityManager.removeEntityInstance(entityId);
      } catch (error) {
        this._logger.warn(`Failed to destroy entity ${entityId}:`, error);
      }
    }

    this._createdEntities = [];
    this._currentEntityId = null;
  }

  /**
   * Update the entity description panel
   *
   * @private
   * @param {object} entity
   */
  _updateEntityDescription(entity) {
    const descriptionContent = this._document.getElementById(
      'entity-description-content'
    );
    if (!descriptionContent) return;

    const descriptionComponent = entity.getComponentData('core:description');
    if (descriptionComponent && descriptionComponent.text) {
      // Convert newlines to HTML line breaks
      const htmlContent = DomUtils.textToHtml(descriptionComponent.text);
      descriptionContent.innerHTML = `<p>${htmlContent}</p>`;
    } else {
      descriptionContent.innerHTML =
        '<p>No description available for this entity.</p>';
    }
  }

  /**
   * Clear the visualization
   *
   * @private
   */
  async _clearVisualization() {
    // Reset the state controller
    this._visualizerStateController.reset();

    // Clear any created entities
    await this._clearPreviousEntities();

    // Clear graph
    if (this._visualizationComposer) {
      this._visualizationComposer.clear();
    }

    // Clear description
    const descriptionContent = this._document.getElementById(
      'entity-description-content'
    );
    if (descriptionContent) {
      descriptionContent.innerHTML =
        '<p>Select an entity to view its description.</p>';
    }
  }

  /**
   * Show a message in the graph panel
   *
   * @private
   * @param {string} message
   */
  /**
   * Escape HTML characters in a string to prevent XSS
   *
   * @private
   * @param {string} unsafeString
   * @returns {string} Escaped string
   */
  _escapeHtml(unsafeString) {
    return unsafeString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Show a message in the graph panel
   *
   * @private
   * @param {string} message
   */
  _showMessage(message) {
    const graphContainer = this._document.getElementById(
      'anatomy-graph-container'
    );
    if (graphContainer) {
      const escapedMessage = this._escapeHtml(message);
      graphContainer.innerHTML = `<div class="message">${escapedMessage}</div>`;
    }
  }
}

export default AnatomyVisualizerUI;
