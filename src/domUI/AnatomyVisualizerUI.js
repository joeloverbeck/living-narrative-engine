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
/** @typedef {import('../clothing/services/clothingManagementService.js').ClothingManagementService} ClothingManagementService */

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
   * @param {ClothingManagementService} [dependencies.clothingManagementService]
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
    clothingManagementService,
  }) {
    this._logger = logger;
    this._registry = registry;
    this._entityManager = entityManager;
    this._anatomyDescriptionService = anatomyDescriptionService;
    this._eventDispatcher = eventDispatcher;
    this._document = documentContext.document;
    this._visualizerStateController = visualizerStateController;
    this._visualizationComposer = visualizationComposer;
    this._clothingManagementService = clothingManagementService;
    this._currentEntityId = null;
    this._createdEntities = [];
    this._stateUnsubscribe = null;
    this._equipmentCache = new Map();
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

    // Subscribe to equipment events if service is available
    if (this._clothingManagementService) {
      this._subscribeToEquipmentEvents();
    }

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
   * Subscribe to equipment-related events
   *
   * @private
   */
  _subscribeToEquipmentEvents() {
    this._equipmentUnsubscribes = [];

    // Subscribe to equipment changes
    const equipmentEvents = [
      'clothing:equipped',
      'clothing:unequipped',
      'clothing:equipment_updated',
    ];

    for (const eventType of equipmentEvents) {
      const unsubscribe = this._eventDispatcher.subscribe(
        eventType,
        this._handleEquipmentChange.bind(this)
      );
      this._equipmentUnsubscribes.push(unsubscribe);
    }
  }

  /**
   * Handle equipment change events
   *
   * @private
   * @param {object} event
   */
  async _handleEquipmentChange(event) {
    const { entityId } = event.payload;

    // Only update if the changed entity is the currently displayed one
    if (entityId !== this._currentEntityId) {
      return;
    }

    this._logger.debug(
      `AnatomyVisualizerUI: Equipment changed for ${entityId}`,
      event
    );

    // Clear cache for this entity
    this._equipmentCache.delete(entityId);

    // Refresh equipment display
    const equipmentResult = await this._retrieveEquipmentData(entityId);
    this._updateEquipmentDisplay(equipmentResult);
  }

  /**
   * Handle visualizer state changes
   *
   * @private
   * @param {object} event
   */
  async _handleStateChange(event) {
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
        this._clearGraphMessage();
        if (anatomyData && selectedEntity) {
          await this._handleAnatomyLoaded(selectedEntity, anatomyData);
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

      // Update equipment panel
      const equipmentResult = await this._retrieveEquipmentData(entityId);
      this._updateEquipmentDisplay(equipmentResult);

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

    // Unsubscribe from equipment events
    if (this._equipmentUnsubscribes) {
      for (const unsubscribe of this._equipmentUnsubscribes) {
        unsubscribe();
      }
      this._equipmentUnsubscribes = [];
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

    // Clear any status messages or previous SVGs
    this._clearGraphMessage();
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

    // Clear equipment
    const equipmentContent = this._document.getElementById('equipment-content');
    if (equipmentContent) {
      equipmentContent.innerHTML =
        '<p class="message">Select an entity to view its equipment.</p>';
    }

    // Clear equipment cache
    this._equipmentCache.clear();
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

  /**
   * Remove any status messages from the graph container
   *
   * @private
   */
  _clearGraphMessage() {
    const graphContainer = this._document.getElementById(
      'anatomy-graph-container'
    );
    if (!graphContainer) return;

    const messageEl = graphContainer.querySelector('.message');
    if (messageEl) {
      messageEl.remove();
    }
  }

  /**
   * Retrieve equipment data for an entity
   *
   * @private
   * @param {string} entityId
   * @returns {Promise<{success: boolean, hasEquipment?: boolean, equipmentData?: Array, message?: string, errors?: string[]}>}
   */
  async _retrieveEquipmentData(entityId) {
    // Check cache first
    const cached = this._equipmentCache.get(entityId);
    if (cached) {
      return cached;
    }

    if (!this._clothingManagementService) {
      return { success: false, message: 'Clothing service not available' };
    }

    try {
      // Check if entity has equipment component
      const hasEquipment = this._entityManager.hasComponent(
        entityId,
        'clothing:equipment'
      );

      if (!hasEquipment) {
        const result = { success: true, hasEquipment: false };
        this._equipmentCache.set(entityId, result);
        return result;
      }

      // Get equipped items
      const equipmentResult =
        await this._clothingManagementService.getEquippedItems(entityId);

      if (!equipmentResult.success) {
        return { success: false, errors: equipmentResult.errors };
      }

      // Process and structure equipment data
      const structuredData = await this._processEquipmentData(
        equipmentResult.equipped,
        entityId
      );

      const result = {
        success: true,
        hasEquipment: true,
        equipmentData: structuredData,
      };

      // Cache the result
      this._equipmentCache.set(entityId, result);

      return result;
    } catch (error) {
      this._logger.error('Failed to retrieve equipment data', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process raw equipment data into structured format
   *
   * @private
   * @param {object} equipped - Raw equipment data from component
   * @param {string} ownerId - Owner entity ID
   * @returns {Promise<Array>} Structured equipment data
   */
  async _processEquipmentData(equipped, ownerId) {
    const processedSlots = [];

    for (const [slotId, layers] of Object.entries(equipped)) {
      const slotData = {
        slotId,
        layers: [],
      };

      for (const [layerName, clothingEntityId] of Object.entries(layers)) {
        const items = Array.isArray(clothingEntityId)
          ? clothingEntityId
          : [clothingEntityId];

        const layerData = {
          layerName,
          items: [],
        };

        for (const entityId of items) {
          const itemData = await this._getClothingItemDetails(entityId);
          if (itemData) {
            layerData.items.push(itemData);
          }
        }

        if (layerData.items.length > 0) {
          slotData.layers.push(layerData);
        }
      }

      if (slotData.layers.length > 0) {
        processedSlots.push(slotData);
      }
    }

    return processedSlots;
  }

  /**
   * Get details for a clothing item entity
   *
   * @private
   * @param {string} entityId - Clothing entity ID
   * @returns {Promise<object|null>} Clothing item details
   */
  async _getClothingItemDetails(entityId) {
    try {
      const entity = await this._entityManager.getEntityInstance(entityId);
      if (!entity) {
        this._logger.warn(`Clothing entity not found: ${entityId}`);
        return null;
      }

      // Get wearable component (contains material, size, etc.)
      const wearableData = entity.getComponentData('clothing:wearable');
      if (!wearableData) {
        this._logger.warn(`No wearable data for entity: ${entityId}`);
        return null;
      }

      // Get name component
      const nameComponent = entity.getComponentData('core:name');
      const name = nameComponent?.text || 'Unknown';

      // Get color from descriptors if available
      const colorDescriptor = entity.getComponentData(
        'descriptors:color_basic'
      );
      const color = colorDescriptor?.color || 'unknown';

      // Get texture from descriptors if available
      const textureDescriptor = entity.getComponentData('descriptors:texture');
      const texture = textureDescriptor?.texture || null;

      return {
        entityId,
        definitionId: entity.definitionId,
        name,
        material:
          entity.getComponentData('core:material')?.material || 'unknown',
        color,
        texture,
      };
    } catch (error) {
      this._logger.error(
        `Failed to get clothing item details for ${entityId}`,
        error
      );
      return null;
    }
  }

  /**
   * Update the equipment display panel
   *
   * @private
   * @param {object} equipmentResult - Result from _retrieveEquipmentData
   */
  _updateEquipmentDisplay(equipmentResult) {
    const container = this._document.getElementById('equipment-content');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    if (!equipmentResult.success) {
      container.innerHTML =
        '<p class="message error">Failed to load equipment data</p>';
      return;
    }

    if (!equipmentResult.hasEquipment) {
      container.innerHTML =
        '<p class="message">This entity has no equipment</p>';
      return;
    }

    if (
      !equipmentResult.equipmentData ||
      equipmentResult.equipmentData.length === 0
    ) {
      container.innerHTML = '<p class="message">No items equipped</p>';
      return;
    }

    // Render equipment data
    const fragment = this._createEquipmentFragment(
      equipmentResult.equipmentData
    );
    container.appendChild(fragment);
  }

  /**
   * Create DOM fragment for equipment display
   *
   * @private
   * @param {Array} equipmentData - Structured equipment data
   * @returns {DocumentFragment} DOM fragment with equipment elements
   */
  _createEquipmentFragment(equipmentData) {
    const fragment = this._document.createDocumentFragment();

    for (const slot of equipmentData) {
      const slotElement = this._createSlotElement(slot);
      fragment.appendChild(slotElement);
    }

    return fragment;
  }

  /**
   * Create DOM element for a single equipment slot
   *
   * @private
   * @param {object} slotData - Slot data with layers and items
   * @returns {HTMLElement} Slot DOM element
   */
  _createSlotElement(slotData) {
    const slotDiv = this._document.createElement('div');
    slotDiv.className = 'equipment-slot';

    // Create slot header
    const header = this._document.createElement('div');
    header.className = 'equipment-slot-header';
    header.textContent = this._formatSlotName(slotData.slotId);
    slotDiv.appendChild(header);

    // Add layers
    for (const layer of slotData.layers) {
      const layerDiv = this._createLayerElement(layer);
      slotDiv.appendChild(layerDiv);
    }

    return slotDiv;
  }

  /**
   * Create DOM element for a layer within a slot
   *
   * @private
   * @param {object} layerData - Layer data with items
   * @returns {HTMLElement} Layer DOM element
   */
  _createLayerElement(layerData) {
    const layerDiv = this._document.createElement('div');
    layerDiv.className = 'equipment-layer';

    // Layer name
    const layerName = this._document.createElement('div');
    layerName.className = 'equipment-layer-name';
    layerName.textContent = `Layer: ${layerData.layerName}`;
    layerDiv.appendChild(layerName);

    // Add items
    for (const item of layerData.items) {
      const itemDiv = this._createItemElement(item);
      layerDiv.appendChild(itemDiv);
    }

    return layerDiv;
  }

  /**
   * Create DOM element for a single equipment item
   *
   * @private
   * @param {object} itemData - Item data
   * @returns {HTMLElement} Item DOM element
   */
  _createItemElement(itemData) {
    const itemDiv = this._document.createElement('div');
    itemDiv.className = 'equipment-item';

    // Item name
    const nameSpan = this._document.createElement('span');
    nameSpan.className = 'equipment-item-name';
    nameSpan.textContent = '• ' + itemData.name;
    itemDiv.appendChild(nameSpan);

    // Item details
    const details = [];
    if (itemData.material && itemData.material !== 'unknown') {
      details.push(itemData.material);
    }
    if (itemData.color && itemData.color !== 'unknown') {
      details.push(itemData.color);
    }

    if (details.length > 0) {
      const detailsSpan = this._document.createElement('span');
      detailsSpan.className = 'equipment-item-details';
      detailsSpan.textContent = ` (${details.join(', ')})`;
      itemDiv.appendChild(detailsSpan);
    }

    return itemDiv;
  }

  /**
   * Format slot ID into human-readable name
   *
   * @private
   * @param {string} slotId - Slot ID (e.g., "underwear_upper")
   * @returns {string} Formatted name (e.g., "Underwear Upper")
   */
  _formatSlotName(slotId) {
    return slotId
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export default AnatomyVisualizerUI;
