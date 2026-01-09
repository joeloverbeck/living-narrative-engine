/**
 * @file DamageSimulatorUI.js
 * @description Main UI controller for the damage simulator tool.
 * Orchestrates recipe selection, entity loading, and coordinates child components.
 * @see AnatomyVisualizerUI.js - Pattern reference
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../shared/RecipeSelectorService.js').default} RecipeSelectorService */
/** @typedef {import('../shared/EntityLoadingService.js').default} EntityLoadingService */
/** @typedef {import('../../anatomy/anatomyDataExtractor.js').default} AnatomyDataExtractor */
/** @typedef {import('../../anatomy/services/injuryAggregationService.js').default} InjuryAggregationService */

/**
 * Required DOM element IDs from HTML structure
 *
 * @readonly
 */
const ELEMENT_IDS = Object.freeze({
  entitySelect: 'entity-select',
  anatomyTree: 'anatomy-tree',
  damageForm: 'damage-form',
  hitsToDestroy: 'hits-to-destroy',
  hitProbability: 'hit-probability',
  historyLog: 'history-log',
  applyDamageBtn: 'apply-damage-btn',
  targetPartSelect: 'target-part',
});

/**
 * UI state constants
 *
 * @readonly
 */
const UI_STATES = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
});

/**
 * Event types for child component coordination
 *
 * @readonly
 */
const UI_EVENTS = Object.freeze({
  ENTITY_LOADING: 'core:damage_simulator_entity_loading',
  ENTITY_LOADED: 'core:damage_simulator_entity_loaded',
  ENTITY_LOAD_ERROR: 'core:damage_simulator_entity_load_error',
  REFRESH_REQUESTED: 'core:damage_simulator_refresh_requested',
});

/**
 * Main UI controller for the damage simulator.
 * Orchestrates UI components and handles page lifecycle.
 */
class DamageSimulatorUI {
  /** @type {RecipeSelectorService} */
  #recipeSelectorService;

  /** @type {EntityLoadingService} */
  #entityLoadingService;

  /** @type {AnatomyDataExtractor} */
  #anatomyDataExtractor;

  /** @type {InjuryAggregationService} */
  #injuryAggregationService;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /** @type {string} */
  #currentState;

  /** @type {object | null} */
  #currentEntityData;

  /** @type {Map<string, object>} */
  #childComponents;

  /** @type {Object<string, HTMLElement|null>} */
  #elements;

  /**
   * Expose constants for testing and external use
   */
  static ELEMENT_IDS = ELEMENT_IDS;
  static UI_STATES = UI_STATES;
  static UI_EVENTS = UI_EVENTS;

  /**
   * @param {object} dependencies
   * @param {RecipeSelectorService} dependencies.recipeSelectorService
   * @param {EntityLoadingService} dependencies.entityLoadingService
   * @param {AnatomyDataExtractor} dependencies.anatomyDataExtractor
   * @param {InjuryAggregationService} dependencies.injuryAggregationService
   * @param {ISafeEventDispatcher} dependencies.eventBus
   * @param {ILogger} dependencies.logger
   */
  constructor({
    recipeSelectorService,
    entityLoadingService,
    anatomyDataExtractor,
    injuryAggregationService,
    eventBus,
    logger,
  }) {
    validateDependency(
      recipeSelectorService,
      'IRecipeSelectorService',
      console,
      { requiredMethods: ['populateWithComponent'] }
    );
    validateDependency(entityLoadingService, 'IEntityLoadingService', console, {
      requiredMethods: ['loadEntityWithAnatomy'],
    });
    validateDependency(anatomyDataExtractor, 'IAnatomyDataExtractor', console, {
      requiredMethods: ['extractFromEntity'],
    });
    validateDependency(
      injuryAggregationService,
      'InjuryAggregationService',
      console,
      { requiredMethods: ['calculateOverallHealth'] }
    );
    validateDependency(eventBus, 'IEventBus', console, {
      requiredMethods: ['dispatch', 'subscribe'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#recipeSelectorService = recipeSelectorService;
    this.#entityLoadingService = entityLoadingService;
    this.#anatomyDataExtractor = anatomyDataExtractor;
    this.#injuryAggregationService = injuryAggregationService;
    this.#eventBus = eventBus;
    this.#logger = logger;

    this.#currentState = UI_STATES.IDLE;
    this.#currentEntityData = null;
    this.#childComponents = new Map();
    this.#elements = {};
  }

  /**
   * Initialize the UI - bind events, populate selectors
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    this.#logger.debug('[DamageSimulatorUI] Initializing...');

    // Bind DOM elements
    this.#bindDomElements();

    // Setup event listeners
    this.#setupEventListeners();

    // Populate entity selector
    await this.#populateEntitySelector();

    this.#logger.info('[DamageSimulatorUI] Initialization complete');
  }

  /**
   * Handle entity selection from dropdown
   *
   * @param {string} definitionId - Entity definition ID to load
   * @returns {Promise<void>}
   */
  async handleEntitySelection(definitionId) {
    if (!definitionId) {
      this.#logger.debug(
        '[DamageSimulatorUI] Empty selection, clearing state'
      );
      this.#clearCurrentEntity();
      return;
    }

    this.#logger.info(
      `[DamageSimulatorUI] Loading entity: ${definitionId}`
    );

    this.#setState(UI_STATES.LOADING);
    this.#emitEvent(UI_EVENTS.ENTITY_LOADING, { definitionId });
    this.#showLoadingState();

    try {
      // Load entity with anatomy
      const instanceId =
        await this.#entityLoadingService.loadEntityWithAnatomy(definitionId);

      // Extract anatomy data
      const anatomyData =
        await this.#anatomyDataExtractor.extractFromEntity(instanceId);

      this.#currentEntityData = {
        definitionId,
        instanceId,
        anatomyData,
      };

      this.#setState(UI_STATES.LOADED);
      this.#emitEvent(UI_EVENTS.ENTITY_LOADED, {
        definitionId,
        instanceId,
        anatomyData,
      });

      // Render anatomy via child component if available
      this.#renderAnatomy(anatomyData);

      // Populate target part dropdown
      this.#populateTargetPartDropdown();

      // Enable apply damage button
      this.#enableApplyDamageButton(true);

      this.#logger.info(
        `[DamageSimulatorUI] Entity loaded: ${instanceId}`
      );
    } catch (error) {
      this.#logger.error(
        `[DamageSimulatorUI] Failed to load entity ${definitionId}:`,
        error
      );
      this.#setState(UI_STATES.ERROR);
      this.#emitEvent(UI_EVENTS.ENTITY_LOAD_ERROR, {
        definitionId,
        error: error.message,
      });
      this.#showErrorState(error);
    }
  }

  /**
   * Get current loaded entity data
   *
   * @returns {object | null} Current entity data or null if none loaded
   */
  getCurrentEntityData() {
    return this.#currentEntityData;
  }

  /**
   * Get current UI state
   *
   * @returns {string} Current state (idle, loading, loaded, error)
   */
  getCurrentState() {
    return this.#currentState;
  }

  /**
   * Refresh anatomy display with current entity
   *
   * @returns {Promise<void>}
   */
  async refreshAnatomyDisplay() {
    if (!this.#currentEntityData) {
      this.#logger.debug(
        '[DamageSimulatorUI] No entity loaded, cannot refresh'
      );
      return;
    }

    this.#emitEvent(UI_EVENTS.REFRESH_REQUESTED, {
      instanceId: this.#currentEntityData.instanceId,
    });

    // Re-extract anatomy data
    const anatomyData = await this.#anatomyDataExtractor.extractFromEntity(
      this.#currentEntityData.instanceId
    );

    this.#currentEntityData.anatomyData = anatomyData;

    // Re-render anatomy tree with updated data
    this.#renderAnatomy(anatomyData);

    this.#emitEvent(UI_EVENTS.ENTITY_LOADED, {
      definitionId: this.#currentEntityData.definitionId,
      instanceId: this.#currentEntityData.instanceId,
      anatomyData,
    });
  }

  /**
   * Set a child component for later tickets
   *
   * @param {string} name - Component name: 'anatomyRenderer' | 'damageComposer' | 'analytics' | 'executionService' | 'historyTracker' | 'deathMonitor' | 'multiHitSimulator'
   * @param {object} component - Child component instance
   */
  setChildComponent(name, component) {
    const validNames = [
      'anatomyRenderer',
      'damageComposer',
      'analytics',
      'executionService',
      'historyTracker',
      'deathMonitor',
      'multiHitSimulator',
    ];
    if (!validNames.includes(name)) {
      this.#logger.warn(
        `[DamageSimulatorUI] Unknown child component name: ${name}`
      );
    }
    this.#childComponents.set(name, component);
    this.#logger.debug(`[DamageSimulatorUI] Child component set: ${name}`);
  }

  /**
   * Get a child component by name
   *
   * @param {string} name - Component name
   * @returns {object | undefined} Child component or undefined
   */
  getChildComponent(name) {
    return this.#childComponents.get(name);
  }

  /**
   * Bind DOM elements from HTML structure
   *
   * @private
   */
  #bindDomElements() {
    for (const [key, id] of Object.entries(ELEMENT_IDS)) {
      const element = document.getElementById(id);
      this.#elements[key] = element;

      if (!element) {
        this.#logger.warn(
          `[DamageSimulatorUI] DOM element not found: #${id}`
        );
      }
    }

    this.#logger.debug('[DamageSimulatorUI] DOM elements bound', {
      found: Object.values(this.#elements).filter(Boolean).length,
      total: Object.keys(ELEMENT_IDS).length,
    });
  }

  /**
   * Setup event listeners on DOM elements
   *
   * @private
   */
  #setupEventListeners() {
    const entitySelect = this.#elements.entitySelect;
    if (entitySelect) {
      entitySelect.addEventListener('change', (event) => {
        const definitionId = event.target.value;
        this.handleEntitySelection(definitionId);
      });
    }

    // Setup apply damage button
    this.#setupApplyDamageButton();

    // Setup target mode radio buttons
    this.#setupTargetModeListeners();
  }

  /**
   * Setup apply damage button click handler
   *
   * @private
   */
  #setupApplyDamageButton() {
    const applyBtn = this.#elements.applyDamageBtn;
    if (!applyBtn) {
      this.#logger.warn('[DamageSimulatorUI] Apply damage button not found');
      return;
    }

    applyBtn.addEventListener('click', () => {
      this.#handleApplyDamage();
    });
  }

  /**
   * Setup target mode radio button listeners
   *
   * @private
   */
  #setupTargetModeListeners() {
    const targetModeRadios = document.querySelectorAll(
      'input[name="target-mode"]'
    );
    const targetPartSelect = this.#elements.targetPartSelect;

    if (!targetPartSelect) {
      this.#logger.warn('[DamageSimulatorUI] Target part select not found');
      return;
    }

    targetModeRadios.forEach((radio) => {
      radio.addEventListener('change', (event) => {
        const isSpecific = event.target.value === 'specific';
        targetPartSelect.disabled = !isSpecific;
      });
    });
  }

  /**
   * Handle apply damage button click
   *
   * @private
   */
  async #handleApplyDamage() {
    if (!this.#currentEntityData) {
      this.#logger.warn('[DamageSimulatorUI] No entity loaded');
      return;
    }

    const executionService = this.#childComponents.get('executionService');
    if (!executionService) {
      this.#logger.warn(
        '[DamageSimulatorUI] No executionService child component set'
      );
      return;
    }

    const damageComposer = this.#childComponents.get('damageComposer');
    if (!damageComposer) {
      this.#logger.warn(
        '[DamageSimulatorUI] No damageComposer child component set'
      );
      return;
    }

    // Get damage configuration from composer
    const damageEntry = damageComposer.getDamageEntry();
    const multiplier = damageComposer.getDamageMultiplier();

    // Determine target mode
    const targetMode = this.#getSelectedTargetMode();
    const targetPartId =
      targetMode === 'specific' ? this.#getSelectedTargetPart() : null;

    this.#logger.debug('[DamageSimulatorUI] Applying damage', {
      entityId: this.#currentEntityData.instanceId,
      damageEntry,
      multiplier,
      targetMode,
      targetPartId,
    });

    try {
      const result = await executionService.applyDamage({
        entityId: this.#currentEntityData.instanceId,
        damageEntry,
        multiplier,
        targetPartId,
      });

      if (result.success) {
        this.#logger.info('[DamageSimulatorUI] Damage applied successfully');
        // Refresh anatomy display to show updated health
        await this.refreshAnatomyDisplay();
      } else {
        this.#logger.error(
          '[DamageSimulatorUI] Damage application failed:',
          result.error
        );
      }
    } catch (error) {
      this.#logger.error(
        '[DamageSimulatorUI] Error applying damage:',
        error
      );
    }
  }

  /**
   * Get selected target mode from radio buttons
   *
   * @private
   * @returns {string} 'random' or 'specific'
   */
  #getSelectedTargetMode() {
    const selectedRadio = document.querySelector(
      'input[name="target-mode"]:checked'
    );
    return selectedRadio ? selectedRadio.value : 'random';
  }

  /**
   * Get selected target part ID from dropdown
   *
   * @private
   * @returns {string|null} Part ID or null
   */
  #getSelectedTargetPart() {
    const targetPartSelect = this.#elements.targetPartSelect;
    return targetPartSelect?.value || null;
  }

  /**
   * Enable or disable the apply damage button
   *
   * @private
   * @param {boolean} enabled - Whether to enable the button
   */
  #enableApplyDamageButton(enabled) {
    const applyBtn = this.#elements.applyDamageBtn;
    if (applyBtn) {
      applyBtn.disabled = !enabled;
    }
  }

  /**
   * Populate the target part dropdown with entity parts
   *
   * @private
   */
  #populateTargetPartDropdown() {
    const targetPartSelect = this.#elements.targetPartSelect;
    if (!targetPartSelect) {
      return;
    }

    // Clear existing options except placeholder
    targetPartSelect.innerHTML = '<option value="">Select part...</option>';

    const executionService = this.#childComponents.get('executionService');
    if (!executionService || !this.#currentEntityData) {
      return;
    }

    const parts = executionService.getTargetableParts(
      this.#currentEntityData.instanceId
    );

    for (const part of parts) {
      const option = document.createElement('option');
      option.value = part.id;
      option.textContent = `${part.name} (weight: ${part.weight})`;
      targetPartSelect.appendChild(option);
    }

    this.#logger.debug(
      `[DamageSimulatorUI] Populated ${parts.length} parts in target dropdown`
    );
  }

  /**
   * Populate entity selector dropdown
   *
   * @private
   * @returns {Promise<void>}
   */
  async #populateEntitySelector() {
    const selector = this.#elements.entitySelect;
    if (!selector) {
      this.#logger.error(
        '[DamageSimulatorUI] Entity selector element not found'
      );
      return;
    }

    try {
      const filteredDefinitions =
        this.#recipeSelectorService.populateWithComponent(
          selector,
          'anatomy:body',
          { placeholderText: 'Select an entity...' }
        );

      // Enable the selector now that it's populated
      selector.disabled = false;

      this.#logger.info(
        `[DamageSimulatorUI] Found ${filteredDefinitions.length} entities with anatomy:body`
      );
    } catch (error) {
      this.#logger.error(
        '[DamageSimulatorUI] Failed to populate entity selector:',
        error
      );
      selector.innerHTML = '<option value="">Error loading entities</option>';
    }
  }

  /**
   * Set the current UI state
   *
   * @private
   * @param {string} newState - New state to transition to
   */
  #setState(newState) {
    const oldState = this.#currentState;
    this.#currentState = newState;
    this.#logger.debug(
      `[DamageSimulatorUI] State: ${oldState} → ${newState}`
    );
  }

  /**
   * Show loading state in UI
   *
   * @private
   */
  #showLoadingState() {
    const anatomyTree = this.#elements.anatomyTree;
    if (anatomyTree) {
      anatomyTree.innerHTML =
        '<div class="loading-indicator">Loading anatomy...</div>';
    }
  }

  /**
   * Show error state in UI
   *
   * @private
   * @param {Error} error - Error to display
   */
  #showErrorState(error) {
    const anatomyTree = this.#elements.anatomyTree;
    if (anatomyTree) {
      const escapedMessage = this.#escapeHtml(error.message);
      anatomyTree.innerHTML = `<div class="error-message">Error: ${escapedMessage}</div>`;
    }
  }

  /**
   * Emit an event through the event bus
   *
   * @private
   * @param {string} eventType - Event type to emit
   * @param {object} payload - Event payload
   */
  #emitEvent(eventType, payload) {
    this.#eventBus.dispatch(eventType, payload);
  }

  /**
   * Render anatomy data using the anatomyRenderer child component.
   *
   * @private
   * @param {object | null} anatomyData - Anatomy tree data
   */
  #renderAnatomy(anatomyData) {
    const renderer = this.#childComponents.get('anatomyRenderer');
    const analyticsPanel = this.#childComponents.get('analytics');
    const shouldSetOverallHealth =
      (renderer && typeof renderer.setOverallHealth === 'function') ||
      (analyticsPanel && typeof analyticsPanel.setOverallHealth === 'function');
    let overallHealth = null;

    if (shouldSetOverallHealth) {
      const partInfos = this.#buildPartInfosFromHierarchy(anatomyData);
      overallHealth =
        this.#injuryAggregationService.calculateOverallHealth(partInfos);
    }

    if (renderer) {
      if (typeof renderer.setOverallHealth === 'function') {
        renderer.setOverallHealth(overallHealth);
      }
      renderer.render(anatomyData);
    } else {
      this.#logger.debug(
        '[DamageSimulatorUI] No anatomyRenderer child component set'
      );
    }

    if (analyticsPanel && typeof analyticsPanel.setOverallHealth === 'function') {
      analyticsPanel.setOverallHealth(overallHealth);
    }
  }

  /**
   * Convert hierarchy nodes to partInfos format for overall health calculation.
   *
   * @private
   * @param {object | null} anatomyData
   * @returns {Array<{healthPercentage: number, healthCalculationWeight: number, vitalOrganCap: {threshold: number, capValue: number}|null}>}
   */
  #buildPartInfosFromHierarchy(anatomyData) {
    if (!anatomyData || typeof anatomyData !== 'object') {
      return [];
    }

    const partInfos = [];
    const stack = [anatomyData];

    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') {
        continue;
      }

      const health = node.health;
      if (health) {
        const healthPercentage = this.#calculateHealthPercentage(health);
        const partComponent = node.components?.['anatomy:part'];
        const vitalComponent = node.components?.['anatomy:vital_organ'];

        partInfos.push({
          healthPercentage,
          healthCalculationWeight: this.#getHealthCalculationWeight(partComponent),
          vitalOrganCap: this.#getVitalOrganCap(vitalComponent),
        });
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          stack.push(child);
        }
      }
    }

    return partInfos;
  }

  /**
   * Calculate health percentage from node health data.
   *
   * @private
   * @param {{current: number, max: number}} health
   * @returns {number}
   */
  #calculateHealthPercentage(health) {
    if (!health || health.max <= 0) {
      return 0;
    }

    const percentage = (health.current / health.max) * 100;
    return Math.round(Math.max(0, Math.min(100, percentage)));
  }

  /**
   * Extract health calculation weight from anatomy:part data.
   *
   * @private
   * @param {object|undefined} partComponent
   * @returns {number}
   */
  #getHealthCalculationWeight(partComponent) {
    const weight = partComponent?.health_calculation_weight;
    return typeof weight === 'number' && weight >= 0 ? weight : 1;
  }

  /**
   * Extract vital organ cap data when anatomy:vital_organ is present.
   *
   * @private
   * @param {object|undefined} vitalComponent
   * @returns {{threshold: number, capValue: number}|null}
   */
  #getVitalOrganCap(vitalComponent) {
    if (!vitalComponent) {
      return null;
    }

    return {
      threshold:
        typeof vitalComponent.healthCapThreshold === 'number'
          ? vitalComponent.healthCapThreshold
          : 20,
      capValue:
        typeof vitalComponent.healthCapValue === 'number'
          ? vitalComponent.healthCapValue
          : 30,
    };
  }

  /**
   * Clear current entity state
   *
   * @private
   */
  #clearCurrentEntity() {
    this.#currentEntityData = null;
    this.#setState(UI_STATES.IDLE);

    // Clear renderer if available
    const renderer = this.#childComponents.get('anatomyRenderer');
    if (renderer) {
      renderer.clear();
    }

    const anatomyTree = this.#elements.anatomyTree;
    if (anatomyTree) {
      anatomyTree.innerHTML =
        '<div class="placeholder">Select an entity to view anatomy</div>';
    }

    // Disable apply damage button
    this.#enableApplyDamageButton(false);

    // Clear target part dropdown
    const targetPartSelect = this.#elements.targetPartSelect;
    if (targetPartSelect) {
      targetPartSelect.innerHTML = '<option value="">Select part...</option>';
    }
  }

  /**
   * Escape HTML characters to prevent XSS
   *
   * @private
   * @param {string} unsafeString - String to escape
   * @returns {string} Escaped string
   */
  #escapeHtml(unsafeString) {
    return unsafeString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export default DamageSimulatorUI;
