/**
 * @file HierarchicalAnatomyRenderer.js
 * @description Renders body parts as cards in a hierarchical tree structure.
 * Shows health bars, mechanical components for each body part.
 * @see DamageSimulatorUI.js - Parent controller that orchestrates this component
 * @see AnatomyDataExtractor.js - Provides AnatomyTreeNode data structure
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} AnatomyTreeNode
 * @property {string} id - The part entity ID
 * @property {string} name - Human-readable part name from core:name
 * @property {{[key: string]: object}} components - Mechanical components (excludes descriptors)
 * @property {{current: number, max: number}|null} health - Health data from anatomy:part_health
 * @property {AnatomyTreeNode[]} children - Child nodes in the hierarchy
 */

/**
 * CSS class constants matching damage-simulator.css
 * @readonly
 */
const CSS_CLASSES = Object.freeze({
  partCard: 'ds-part-card',
  partCardHeader: 'ds-part-card-header',
  partCardName: 'ds-part-card-name',
  partExpand: 'ds-part-expand',
  healthBar: 'ds-health-bar',
  healthBarFill: 'ds-health-bar-fill',
  healthBarHealthy: 'ds-health-bar-fill--healthy',
  healthBarDamaged: 'ds-health-bar-fill--damaged',
  healthBarCritical: 'ds-health-bar-fill--critical',
  partCardHealth: 'ds-part-card-health',
  partComponents: 'ds-part-components',
  partChildren: 'ds-part-children',
  // Oxygen display
  partOxygen: 'ds-part-oxygen',
  oxygenBar: 'ds-oxygen-bar',
  oxygenFill: 'ds-oxygen-fill',
  oxygenText: 'ds-oxygen-text',
  // Status effects
  partEffects: 'ds-part-effects',
  effect: 'ds-effect',
  effectBleeding: 'ds-effect-bleeding',
  effectBurning: 'ds-effect-burning',
  effectPoisoned: 'ds-effect-poisoned',
  effectFractured: 'ds-effect-fractured',
});

/**
 * Component ID for respiratory organs that have oxygen capacity
 * @readonly
 */
const RESPIRATORY_COMPONENT = 'breathing-states:respiratory_organ';

/**
 * Status effect component mappings
 * @readonly
 */
const EFFECT_COMPONENTS = Object.freeze({
  bleeding: 'anatomy:bleeding',
  burning: 'anatomy:burning',
  poisoned: 'anatomy:poisoned',
  fractured: 'anatomy:fractured',
});

/**
 * Emoji display for each effect type
 * @readonly
 */
const EFFECT_EMOJIS = Object.freeze({
  bleeding: '🩸',
  burning: '🔥',
  poisoned: '☠️',
  fractured: '🦴',
});

/**
 * Health thresholds for color coding
 * @readonly
 */
const HEALTH_THRESHOLDS = Object.freeze({
  healthy: 66, // > 66% = healthy (green)
  damaged: 33, // > 33% = damaged (orange), <= 33% = critical (red)
});

/**
 * Renders body parts as hierarchical cards with health bars and component lists.
 */
class HierarchicalAnatomyRenderer {
  /** @type {HTMLElement} */
  #containerElement;

  /** @type {ILogger} */
  #logger;

  /** @type {Map<string, HTMLElement>} */
  #partElements;

  /**
   * Expose constants for testing
   */
  static CSS_CLASSES = CSS_CLASSES;
  static HEALTH_THRESHOLDS = HEALTH_THRESHOLDS;
  static RESPIRATORY_COMPONENT = RESPIRATORY_COMPONENT;
  static EFFECT_COMPONENTS = EFFECT_COMPONENTS;
  static EFFECT_EMOJIS = EFFECT_EMOJIS;

  /**
   * @param {object} dependencies
   * @param {HTMLElement} dependencies.containerElement - DOM element to render into
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ containerElement, logger }) {
    if (!containerElement || !(containerElement instanceof HTMLElement)) {
      throw new Error(
        'HierarchicalAnatomyRenderer: containerElement must be a valid HTMLElement'
      );
    }
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#containerElement = containerElement;
    this.#logger = logger;
    this.#partElements = new Map();
  }

  /**
   * Render the anatomy hierarchy as cards.
   * Clears previous render before creating new structure.
   *
   * @param {AnatomyTreeNode|null} hierarchyData - Root node of anatomy tree
   */
  render(hierarchyData) {
    this.#logger.debug('[HierarchicalAnatomyRenderer] Rendering hierarchy', {
      hasData: !!hierarchyData,
      rootId: hierarchyData?.id,
    });

    // Clear previous render
    this.clear();

    if (!hierarchyData) {
      this.#renderEmptyState();
      return;
    }

    // Set tree role on container for accessibility
    this.#containerElement.setAttribute('role', 'tree');
    this.#containerElement.setAttribute('aria-label', 'Body parts hierarchy');

    // Render root node and children recursively
    const rootElement = this.#renderNode(hierarchyData, 0);
    if (rootElement) {
      this.#containerElement.appendChild(rootElement);
    }

    this.#logger.info(
      `[HierarchicalAnatomyRenderer] Rendered ${this.#partElements.size} parts`
    );
  }

  /**
   * Clear current render and reset state.
   */
  clear() {
    this.#containerElement.innerHTML = '';
    this.#containerElement.removeAttribute('role');
    this.#containerElement.removeAttribute('aria-label');
    this.#partElements.clear();
    this.#logger.debug('[HierarchicalAnatomyRenderer] Cleared');
  }

  /**
   * Update a specific part's display without full re-render.
   *
   * @param {string} partId - Part entity ID
   * @param {AnatomyTreeNode} partData - Updated part data
   */
  updatePart(partId, partData) {
    const element = this.#partElements.get(partId);
    if (!element) {
      this.#logger.warn(
        `[HierarchicalAnatomyRenderer] Part not found for update: ${partId}`
      );
      return;
    }

    // Update health bar
    if (partData.health) {
      const healthBar = element.querySelector(`.${CSS_CLASSES.healthBarFill}`);
      const healthText = element.querySelector(
        `.${CSS_CLASSES.partCardHealth}`
      );

      if (healthBar) {
        const percentage = this.#calculateHealthPercentage(partData.health);
        healthBar.style.width = `${percentage}%`;
        this.#updateHealthBarColor(healthBar, percentage);
      }

      if (healthText) {
        healthText.textContent = this.#formatHealthText(partData.health);
      }
    }

    // Update oxygen bar if components provided
    if (partData.components) {
      const oxygenData = this.#getOxygenData(partData.components);
      this.#updateOxygenDisplay(element, oxygenData);

      // Update effects display
      const effects = this.#getActiveEffects(partData.components);
      this.#updateEffectsDisplay(element, effects);
    }

    this.#logger.debug(
      `[HierarchicalAnatomyRenderer] Updated part: ${partId}`
    );
  }

  /**
   * Get the DOM element for a specific part.
   *
   * @param {string} partId - Part entity ID
   * @returns {HTMLElement|null} The part's card element or null
   */
  getPartElement(partId) {
    return this.#partElements.get(partId) || null;
  }

  /**
   * Render empty state when no hierarchy data.
   * @private
   */
  #renderEmptyState() {
    const placeholder = document.createElement('div');
    placeholder.className = 'ds-empty-state';
    placeholder.textContent = 'No anatomy data available';
    this.#containerElement.appendChild(placeholder);
  }

  /**
   * Recursively render a node and its children.
   * @private
   * @param {AnatomyTreeNode} node - Node to render
   * @param {number} depth - Current depth in hierarchy
   * @returns {HTMLElement} The card element
   */
  #renderNode(node, depth) {
    const card = document.createElement('div');
    card.className = CSS_CLASSES.partCard;
    card.setAttribute('data-part-id', node.id);
    card.setAttribute('data-depth', String(depth));
    card.setAttribute('role', 'treeitem');
    card.setAttribute('aria-expanded', 'true');

    // Header with name and expand toggle
    const header = this.#renderHeader(node, node.children.length > 0);
    card.appendChild(header);

    // Health bar (if health data exists)
    if (node.health) {
      const healthSection = this.#renderHealthSection(node.health);
      card.appendChild(healthSection);
    }

    // Oxygen bar (if respiratory component exists)
    const oxygenData = this.#getOxygenData(node.components);
    if (oxygenData) {
      const oxygenSection = this.#renderOxygenSection(oxygenData);
      card.appendChild(oxygenSection);
    }

    // Status effects (if any effect components exist)
    const effects = this.#getActiveEffects(node.components);
    if (effects.length > 0) {
      const effectsSection = this.#renderEffectsSection(effects);
      card.appendChild(effectsSection);
    }

    // Components list (mechanical only)
    const componentsSection = this.#renderComponentsSection(node.components);
    if (componentsSection) {
      card.appendChild(componentsSection);
    }

    // Children container
    if (node.children && node.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = CSS_CLASSES.partChildren;
      childrenContainer.setAttribute('role', 'group');

      for (const child of node.children) {
        const childElement = this.#renderNode(child, depth + 1);
        childrenContainer.appendChild(childElement);
      }

      card.appendChild(childrenContainer);
    }

    // Store reference for updates
    this.#partElements.set(node.id, card);

    return card;
  }

  /**
   * Render the header section with name and expand toggle.
   * @private
   * @param {AnatomyTreeNode} node - Node data
   * @param {boolean} hasChildren - Whether node has children
   * @returns {HTMLElement} Header element
   */
  #renderHeader(node, hasChildren) {
    const header = document.createElement('div');
    header.className = CSS_CLASSES.partCardHeader;

    const name = document.createElement('span');
    name.className = CSS_CLASSES.partCardName;
    name.textContent = node.name;
    header.appendChild(name);

    if (hasChildren) {
      const expand = document.createElement('span');
      expand.className = CSS_CLASSES.partExpand;
      expand.setAttribute('aria-label', 'Toggle children');
      expand.textContent = '▼';
      expand.style.cursor = 'pointer';
      expand.addEventListener('click', (e) => this.#handleExpandClick(e, node));
      header.appendChild(expand);
    }

    return header;
  }

  /**
   * Handle expand/collapse toggle click.
   * @private
   * @param {Event} event - Click event
   * @param {AnatomyTreeNode} node - Node being toggled
   */
  #handleExpandClick(event, node) {
    event.stopPropagation();
    const card = this.#partElements.get(node.id);
    if (!card) return;

    const childrenContainer = card.querySelector(`.${CSS_CLASSES.partChildren}`);
    const expandIcon = card.querySelector(`.${CSS_CLASSES.partExpand}`);

    if (childrenContainer) {
      const isExpanded = card.getAttribute('aria-expanded') === 'true';
      card.setAttribute('aria-expanded', String(!isExpanded));
      childrenContainer.style.display = isExpanded ? 'none' : 'block';
      if (expandIcon) {
        expandIcon.textContent = isExpanded ? '▶' : '▼';
      }
    }
  }

  /**
   * Render health bar section.
   * @private
   * @param {{current: number, max: number}} health - Health data
   * @returns {DocumentFragment} Fragment containing health bar elements
   */
  #renderHealthSection(health) {
    const fragment = document.createDocumentFragment();

    // Health bar container
    const healthBar = document.createElement('div');
    healthBar.className = CSS_CLASSES.healthBar;

    // Health bar fill
    const healthFill = document.createElement('div');
    healthFill.className = CSS_CLASSES.healthBarFill;
    const percentage = this.#calculateHealthPercentage(health);
    healthFill.style.width = `${percentage}%`;
    this.#updateHealthBarColor(healthFill, percentage);

    healthBar.appendChild(healthFill);
    fragment.appendChild(healthBar);

    // Health text
    const healthText = document.createElement('span');
    healthText.className = CSS_CLASSES.partCardHealth;
    healthText.textContent = this.#formatHealthText(health);
    fragment.appendChild(healthText);

    return fragment;
  }

  /**
   * Calculate health percentage.
   * @private
   * @param {{current: number, max: number}} health - Health data
   * @returns {number} Percentage (0-100)
   */
  #calculateHealthPercentage(health) {
    if (!health || health.max <= 0) return 0;
    return Math.min(100, Math.max(0, (health.current / health.max) * 100));
  }

  /**
   * Update health bar color based on percentage.
   * @private
   * @param {HTMLElement} element - Health bar fill element
   * @param {number} percentage - Health percentage
   */
  #updateHealthBarColor(element, percentage) {
    // Remove existing color classes
    element.classList.remove(
      CSS_CLASSES.healthBarHealthy,
      CSS_CLASSES.healthBarDamaged,
      CSS_CLASSES.healthBarCritical
    );

    // Add appropriate color class
    if (percentage > HEALTH_THRESHOLDS.healthy) {
      element.classList.add(CSS_CLASSES.healthBarHealthy);
    } else if (percentage > HEALTH_THRESHOLDS.damaged) {
      element.classList.add(CSS_CLASSES.healthBarDamaged);
    } else {
      element.classList.add(CSS_CLASSES.healthBarCritical);
    }
  }

  /**
   * Format health text.
   * @private
   * @param {{current: number, max: number}} health - Health data
   * @returns {string} Formatted health string
   */
  #formatHealthText(health) {
    return `${health.current}/${health.max} HP`;
  }

  /**
   * Render components section (mechanical only).
   * @private
   * @param {{[key: string]: object}} components - Components map
   * @returns {HTMLElement|null} Components section or null if empty
   */
  #renderComponentsSection(components) {
    if (!components || typeof components !== 'object') {
      return null;
    }

    const mechanicalComponents = this.#filterMechanicalComponents(components);
    const componentIds = Object.keys(mechanicalComponents);

    if (componentIds.length === 0) {
      return null;
    }

    const section = document.createElement('div');
    section.className = CSS_CLASSES.partComponents;

    const list = document.createElement('ul');
    for (const componentId of componentIds) {
      const item = document.createElement('li');
      item.textContent = this.#formatComponentDisplay(
        componentId,
        mechanicalComponents[componentId]
      );
      list.appendChild(item);
    }

    section.appendChild(list);
    return section;
  }

  /**
   * Filter to mechanical components only (exclude descriptors).
   * @private
   * @param {{[key: string]: object}} components - All components
   * @returns {{[key: string]: object}} Filtered components
   */
  #filterMechanicalComponents(components) {
    const filtered = {};

    for (const [componentId, componentData] of Object.entries(components)) {
      // Skip descriptor components
      if (componentId.startsWith('descriptors:')) {
        continue;
      }
      // Skip core:name (displayed separately)
      if (componentId === 'core:name') {
        continue;
      }
      // Skip core:description
      if (componentId === 'core:description') {
        continue;
      }
      filtered[componentId] = componentData;
    }

    return filtered;
  }

  /**
   * Format component display text.
   * @private
   * @param {string} componentId - Component ID
   * @param {object} componentData - Component data
   * @returns {string} Formatted display string
   */
  #formatComponentDisplay(componentId, componentData) {
    // Special formatting for known components
    if (componentId === 'anatomy:sockets' && componentData?.slots) {
      const slotCount = Object.keys(componentData.slots).length;
      return `anatomy:sockets (${slotCount} slots)`;
    }

    return componentId;
  }

  /**
   * Extract oxygen data from respiratory component if present.
   * @private
   * @param {{[key: string]: object}} components - Components map
   * @returns {{current: number, max: number}|null} Oxygen data or null
   */
  #getOxygenData(components) {
    if (!components || typeof components !== 'object') {
      return null;
    }
    const respiratory = components[RESPIRATORY_COMPONENT];
    if (!respiratory) {
      return null;
    }
    return {
      current: respiratory.currentOxygen ?? respiratory.oxygenCapacity,
      max: respiratory.oxygenCapacity,
    };
  }

  /**
   * Render oxygen bar section.
   * @private
   * @param {{current: number, max: number}} oxygenData - Oxygen data
   * @returns {HTMLElement} Oxygen section element
   */
  #renderOxygenSection(oxygenData) {
    const section = document.createElement('div');
    section.className = CSS_CLASSES.partOxygen;

    // Oxygen bar container
    const oxygenBar = document.createElement('div');
    oxygenBar.className = CSS_CLASSES.oxygenBar;

    // Oxygen bar fill
    const oxygenFill = document.createElement('div');
    oxygenFill.className = CSS_CLASSES.oxygenFill;
    const percentage = this.#calculateOxygenPercentage(oxygenData);
    oxygenFill.style.width = `${percentage}%`;

    oxygenBar.appendChild(oxygenFill);
    section.appendChild(oxygenBar);

    // Oxygen text
    const oxygenText = document.createElement('span');
    oxygenText.className = CSS_CLASSES.oxygenText;
    oxygenText.textContent = this.#formatOxygenText(oxygenData);
    section.appendChild(oxygenText);

    return section;
  }

  /**
   * Calculate oxygen percentage.
   * @private
   * @param {{current: number, max: number}} oxygenData - Oxygen data
   * @returns {number} Percentage (0-100)
   */
  #calculateOxygenPercentage(oxygenData) {
    if (!oxygenData || oxygenData.max <= 0) return 0;
    return Math.min(100, Math.max(0, (oxygenData.current / oxygenData.max) * 100));
  }

  /**
   * Format oxygen text display.
   * @private
   * @param {{current: number, max: number}} oxygenData - Oxygen data
   * @returns {string} Formatted oxygen string
   */
  #formatOxygenText(oxygenData) {
    return `${oxygenData.current}/${oxygenData.max} O₂`;
  }

  /**
   * Update oxygen display for an existing element.
   * @private
   * @param {HTMLElement} element - Part card element
   * @param {{current: number, max: number}|null} oxygenData - New oxygen data
   */
  #updateOxygenDisplay(element, oxygenData) {
    const existingSection = element.querySelector(`.${CSS_CLASSES.partOxygen}`);

    if (!oxygenData) {
      // Remove oxygen section if no longer has respiratory component
      if (existingSection) {
        existingSection.remove();
      }
      return;
    }

    if (existingSection) {
      // Update existing oxygen display
      const oxygenFill = existingSection.querySelector(`.${CSS_CLASSES.oxygenFill}`);
      const oxygenText = existingSection.querySelector(`.${CSS_CLASSES.oxygenText}`);

      if (oxygenFill) {
        const percentage = this.#calculateOxygenPercentage(oxygenData);
        oxygenFill.style.width = `${percentage}%`;
      }
      if (oxygenText) {
        oxygenText.textContent = this.#formatOxygenText(oxygenData);
      }
    } else {
      // Insert new oxygen section after health bar or header
      const healthBar = element.querySelector(`.${CSS_CLASSES.healthBar}`);
      const healthText = element.querySelector(`.${CSS_CLASSES.partCardHealth}`);
      const insertAfter = healthText || healthBar || element.querySelector(`.${CSS_CLASSES.partCardHeader}`);

      if (insertAfter) {
        const oxygenSection = this.#renderOxygenSection(oxygenData);
        insertAfter.after(oxygenSection);
      }
    }
  }

  /**
   * Get active status effects from components.
   * @private
   * @param {{[key: string]: object}} components - Components map
   * @returns {Array<{type: string, data: object}>} Active effects
   */
  #getActiveEffects(components) {
    if (!components || typeof components !== 'object') {
      return [];
    }

    const effects = [];
    for (const [effectType, componentId] of Object.entries(EFFECT_COMPONENTS)) {
      if (components[componentId]) {
        effects.push({
          type: effectType,
          data: components[componentId],
        });
      }
    }
    return effects;
  }

  /**
   * Render status effects section.
   * @private
   * @param {Array<{type: string, data: object}>} effects - Active effects
   * @returns {HTMLElement} Effects section element
   */
  #renderEffectsSection(effects) {
    const section = document.createElement('div');
    section.className = CSS_CLASSES.partEffects;

    for (const effect of effects) {
      const effectBadge = document.createElement('span');
      effectBadge.className = `${CSS_CLASSES.effect} ${CSS_CLASSES[`effect${this.#capitalize(effect.type)}`]}`;
      effectBadge.textContent = EFFECT_EMOJIS[effect.type];
      effectBadge.setAttribute('title', this.#formatEffectTooltip(effect.type, effect.data));
      section.appendChild(effectBadge);
    }

    return section;
  }

  /**
   * Capitalize first letter of a string.
   * @private
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  #capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Format tooltip text for a status effect.
   * @private
   * @param {string} effectType - Effect type (bleeding, burning, etc.)
   * @param {object} effectData - Effect component data
   * @returns {string} Formatted tooltip string
   */
  #formatEffectTooltip(effectType, effectData) {
    const displayName = this.#capitalize(effectType);

    switch (effectType) {
      case 'bleeding': {
        const severity = effectData.severity || 'unknown';
        const turns = effectData.remainingTurns;
        return turns !== undefined
          ? `${displayName} (${severity}, ${turns} turns)`
          : `${displayName} (${severity})`;
      }
      case 'burning': {
        const turns = effectData.remainingTurns;
        const stacks = effectData.stackedCount;
        const parts = [displayName];
        if (turns !== undefined) parts.push(`${turns} turns`);
        if (stacks !== undefined && stacks > 1) parts.push(`x${stacks}`);
        return parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(', ')})` : displayName;
      }
      case 'poisoned': {
        const turns = effectData.remainingTurns;
        return turns !== undefined ? `${displayName} (${turns} turns)` : displayName;
      }
      case 'fractured':
        // Fractured has NO duration - just show the name
        return displayName;
      default:
        return displayName;
    }
  }

  /**
   * Update effects display for an existing element.
   * @private
   * @param {HTMLElement} element - Part card element
   * @param {Array<{type: string, data: object}>} effects - New effects list
   */
  #updateEffectsDisplay(element, effects) {
    const existingSection = element.querySelector(`.${CSS_CLASSES.partEffects}`);

    if (effects.length === 0) {
      // Remove effects section if no effects
      if (existingSection) {
        existingSection.remove();
      }
      return;
    }

    if (existingSection) {
      // Replace existing effects section
      const newSection = this.#renderEffectsSection(effects);
      existingSection.replaceWith(newSection);
    } else {
      // Insert new effects section after oxygen or health
      const oxygenSection = element.querySelector(`.${CSS_CLASSES.partOxygen}`);
      const healthText = element.querySelector(`.${CSS_CLASSES.partCardHealth}`);
      const healthBar = element.querySelector(`.${CSS_CLASSES.healthBar}`);
      const insertAfter = oxygenSection || healthText || healthBar || element.querySelector(`.${CSS_CLASSES.partCardHeader}`);

      if (insertAfter) {
        const effectsSection = this.#renderEffectsSection(effects);
        insertAfter.after(effectsSection);
      }
    }
  }
}

export default HierarchicalAnatomyRenderer;
