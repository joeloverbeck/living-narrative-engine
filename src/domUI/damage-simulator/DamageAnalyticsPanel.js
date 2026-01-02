/**
 * @file DamageAnalyticsPanel.js
 * @description Displays analytical insights about damage capabilities against the current entity.
 * Includes hits-to-destroy calculations, effect trigger analysis, and aggregate statistics.
 * @see DamageCapabilityComposer.js - Source of damage configuration
 * @see HierarchicalAnatomyRenderer.js - Source of anatomy data
 * @see DamageSimulatorUI.js - Parent UI controller
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @typedef {object} HitProbabilityCalculator
 * @property {function(AnatomyPart[]): PartProbability[]} calculateProbabilities - Calculate probability distribution for parts.
 * @property {function(PartProbability[]): VisualizationData} getVisualizationData - Generate visualization data from probabilities.
 */

/**
 * @typedef {object} PartProbability
 * @property {string} partId - Entity ID of the part.
 * @property {string} partName - Human-readable part name.
 * @property {number} probability - Probability percentage (0-100).
 * @property {string} tier - Probability tier ('high', 'medium', 'low', 'none').
 */

/**
 * @typedef {object} VisualizationData
 * @property {Array<{partId: string, label: string, percentage: number, barWidth: number, colorClass: string}>} bars - Bar chart data for visualization.
 * @property {number} maxProbability - Highest probability value.
 * @property {number} totalParts - Number of parts in distribution.
 */

/**
 * @typedef {object} PartAnalytics
 * @property {string} partId - Entity ID of the part
 * @property {string} partName - Human-readable part name
 * @property {number} currentHealth - Current health value
 * @property {number} maxHealth - Maximum health value
 * @property {number} hitsToDestroy - Calculated hits needed
 * @property {number} effectiveDamage - Damage after penetration/resistance
 * @property {boolean} isCritical - Whether this is a critical part
 */

/**
 * @typedef {object} AggregateStats
 * @property {number} averageHits - Average hits across all parts
 * @property {number} minHits - Minimum hits needed
 * @property {number} maxHits - Maximum hits needed
 * @property {number} totalParts - Total number of parts analyzed
 */

/**
 * @typedef {object} EffectThreshold
 * @property {string} effectType - Type of effect
 * @property {number} threshold - Health percentage threshold
 * @property {string} description - Human-readable description
 */

/**
 * @typedef {object} AnalyticsData
 * @property {PartAnalytics[]} parts - Per-part analytics
 * @property {AggregateStats} aggregate - Aggregate statistics
 * @property {EffectThreshold[]} effectThresholds - Effect trigger thresholds
 */

/**
 * @typedef {object} DamageEntry
 * @property {number} amount - Base damage amount
 * @property {string} [damageType] - Type of damage
 * @property {number} [penetration] - Armor penetration value (0-1)
 */

/**
 * @typedef {object} AnatomyPart
 * @property {string} id - Part entity ID
 * @property {string} name - Part display name
 * @property {number} currentHealth - Current HP
 * @property {number} maxHealth - Maximum HP
 * @property {number} [armor] - Armor value (optional)
 * @property {number} [resistance] - Damage resistance (optional)
 */

/**
 * @typedef {object} AnatomyData
 * @property {AnatomyPart[]} parts - All body parts
 */

/**
 * @typedef {object} AnatomyTreeNode
 * @property {string} id - The part entity ID
 * @property {string} name - Human-readable part name
 * @property {{[key: string]: object}} [components] - Mechanical components
 * @property {{current: number, max: number}|null} [health] - Health data from anatomy:part_health
 * @property {AnatomyTreeNode[]} [children] - Child nodes in the hierarchy
 */

/**
 * Event types for analytics panel.
 * These must match the event types emitted by DamageSimulatorUI.js
 *
 * @readonly
 */
const EVENTS = Object.freeze({
  CONFIG_CHANGED: 'damage-composer:config-changed',
  ENTITY_LOADED: 'core:damage_simulator_entity_loaded',
});

/**
 * Critical body part names (case-insensitive matching).
 *
 * @readonly
 */
const CRITICAL_PARTS = Object.freeze(['head', 'torso', 'heart']);

/**
 * Default effect thresholds for damage effects.
 *
 * @readonly
 */
const DEFAULT_EFFECT_THRESHOLDS = Object.freeze([
  { effectType: 'bleed', threshold: 50, description: 'Bleeding when health ≤50%' },
  { effectType: 'fracture', threshold: 25, description: 'Fracture risk when health ≤25%' },
  { effectType: 'cripple', threshold: 10, description: 'Crippled when health ≤10%' },
]);

/**
 * Component for displaying damage analytics and hits-to-destroy calculations.
 */
class DamageAnalyticsPanel {
  /** @type {HTMLElement} */
  #containerElement;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /** @type {Array<() => void>} */
  #unsubscribers = [];

  /** @type {AnatomyData|null} */
  #anatomyData = null;

  /** @type {DamageEntry|null} */
  #damageEntry = null;

  /** @type {number} */
  #multiplier = 1;

  /** @type {boolean} */
  #isCollapsed = false;

  /** @type {HitProbabilityCalculator|null} */
  #hitProbabilityCalculator = null;

  /**
   * Expose constants for testing and external use
   */
  static EVENTS = EVENTS;
  static CRITICAL_PARTS = CRITICAL_PARTS;
  static DEFAULT_EFFECT_THRESHOLDS = DEFAULT_EFFECT_THRESHOLDS;

  /**
   * Creates a new DamageAnalyticsPanel instance.
   *
   * @param {object} dependencies - The dependencies object.
   * @param {HTMLElement} dependencies.containerElement - DOM element to render into.
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @param {HitProbabilityCalculator|null} [dependencies.hitProbabilityCalculator] - Optional hit probability calculator.
   */
  constructor({ containerElement, eventBus, logger, hitProbabilityCalculator = null }) {
    validateDependency(containerElement, 'HTMLElement', console, {
      requiredMethods: ['appendChild', 'querySelector'],
    });
    validateDependency(eventBus, 'IEventBus', console, {
      requiredMethods: ['dispatch', 'subscribe'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#containerElement = containerElement;
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#hitProbabilityCalculator = hitProbabilityCalculator;

    this.#subscribeToEvents();
    this.#logger.debug('[DamageAnalyticsPanel] Initialized');
  }

  /**
   * Subscribe to relevant events.
   *
   * @private
   */
  #subscribeToEvents() {
    // Subscribe to damage config changes
    const unsubConfigChanged = this.#eventBus.subscribe(
      EVENTS.CONFIG_CHANGED,
      (event) => {
        const { damageEntry, multiplier } = event.payload || {};
        if (damageEntry) {
          this.updateDamageConfig(damageEntry, multiplier ?? 1);
          this.render();
        }
      }
    );
    this.#unsubscribers.push(unsubConfigChanged);

    // Subscribe to entity loaded events
    // DamageSimulatorUI.js emits 'instanceId' (not 'entityId') in the payload
    const unsubEntityLoaded = this.#eventBus.subscribe(
      EVENTS.ENTITY_LOADED,
      (event) => {
        const { instanceId, anatomyData } = event.payload || {};
        if (instanceId && anatomyData) {
          this.setEntity(instanceId, anatomyData);
          this.render();
        }
      }
    );
    this.#unsubscribers.push(unsubEntityLoaded);
  }

  /**
   * Set the current entity for analysis.
   *
   * @param {string} entityId - Entity identifier.
   * @param {AnatomyData|AnatomyTreeNode} anatomyData - Anatomy data from extractor (tree or flat format).
   */
  setEntity(entityId, anatomyData) {
    this.#anatomyData = this.#normalizeAnatomyData(anatomyData);
    this.#logger.debug(`[DamageAnalyticsPanel] Entity set: ${entityId}`);
  }

  /**
   * Normalize anatomy data to expected flat structure.
   * Handles both tree format (from AnatomyDataExtractor) and pre-flattened format.
   *
   * @private
   * @param {AnatomyTreeNode|AnatomyData|null|undefined} anatomyData - Raw or extracted data.
   * @returns {AnatomyData} Normalized structure with flat parts array.
   */
  #normalizeAnatomyData(anatomyData) {
    if (!anatomyData) return { parts: [] };

    // Already in expected format with parts array
    if (anatomyData.parts && Array.isArray(anatomyData.parts)) {
      return anatomyData;
    }

    // Tree format from AnatomyDataExtractor - flatten it
    // Tree nodes have 'id', 'children', and nested 'health' object
    if (anatomyData.id && anatomyData.children !== undefined) {
      const parts = [];
      this.#flattenTree(anatomyData, parts);
      return { parts };
    }

    return { parts: [] };
  }

  /**
   * Recursively flatten a tree node into a parts array.
   *
   * @private
   * @param {AnatomyTreeNode} node - Tree node to flatten.
   * @param {AnatomyPart[]} parts - Accumulator for flattened parts.
   */
  #flattenTree(node, parts) {
    if (!node) return;

    parts.push({
      id: node.id,
      name: node.name,
      currentHealth: node.health?.current ?? 0,
      maxHealth: node.health?.max ?? 0,
      components: node.components || {},
    });

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        this.#flattenTree(child, parts);
      }
    }
  }

  /**
   * Update with new damage configuration.
   *
   * @param {DamageEntry} damageEntry - Damage entry from composer.
   * @param {number} [multiplier] - Damage multiplier (defaults to 1).
   */
  updateDamageConfig(damageEntry, multiplier = 1) {
    this.#damageEntry = damageEntry;
    this.#multiplier = multiplier;
    this.#logger.debug('[DamageAnalyticsPanel] Damage config updated');
  }

  /**
   * Render the analytics display.
   */
  render() {
    this.#containerElement.innerHTML = this.#generateHTML();
    this.#attachEventListeners();
  }

  /**
   * Generate HTML for the analytics display.
   *
   * @private
   * @returns {string} HTML content.
   */
  #generateHTML() {
    const analytics = this.getAnalytics();
    const collapseClass = this.#isCollapsed ? 'collapsed' : '';
    const collapseIcon = this.#isCollapsed ? '▶' : '▼';

    return `
      <div class="ds-analytics-panel ${collapseClass}">
        <div class="ds-analytics-header" id="analytics-header">
          <h3>Damage Analytics</h3>
          <button class="ds-collapse-btn" id="analytics-collapse-btn" aria-label="Toggle analytics panel">${collapseIcon}</button>
        </div>

        ${this.#isCollapsed ? '' : this.#generateContentHTML(analytics)}
      </div>
    `;
  }

  /**
   * Generate HTML content for the analytics sections.
   *
   * @private
   * @param {AnalyticsData} analytics - Calculated analytics data.
   * @returns {string} HTML content.
   */
  #generateContentHTML(analytics) {
    const hitsTableHTML = this.#generateHitsTableHTML(analytics.parts);
    const hitProbabilityHTML = this.#generateHitProbabilityHTML(analytics.parts);
    const effectsHTML = this.#generateEffectsHTML(analytics.effectThresholds);
    const aggregateHTML = this.#generateAggregateHTML(analytics.aggregate);

    return `
      <!-- Main Analytics Grid - Two Column Layout -->
      <div class="ds-analytics-content">
        <!-- Hits to Destroy Section (Left Column) -->
        <section class="ds-analytics-section">
          <h4>Hits to Destroy</h4>
          ${hitsTableHTML}
        </section>

        <!-- Hit Probability Section (Right Column) -->
        <section class="ds-analytics-section">
          <h4>Hit Probability</h4>
          ${hitProbabilityHTML}
        </section>
      </div>

      <!-- Bottom Row - Effect Triggers and Aggregate Stats -->
      <div class="ds-analytics-bottom-row">
        <!-- Effect Triggers Section -->
        <section class="ds-analytics-section">
          <h4>Effect Triggers</h4>
          ${effectsHTML}
        </section>

        <!-- Aggregate Stats Section -->
        <section class="ds-analytics-section ds-aggregate-stats">
          ${aggregateHTML}
        </section>
      </div>
    `;
  }

  /**
   * Generate HTML for the hits-to-destroy table.
   *
   * @private
   * @param {PartAnalytics[]} parts - Part analytics data.
   * @returns {string} HTML for the table.
   */
  #generateHitsTableHTML(parts) {
    if (parts.length === 0) {
      return '<p class="ds-no-data">No anatomy data available. Load an entity first.</p>';
    }

    const rowsHTML = parts.map((part) => {
      const criticalClass = part.isCritical ? 'ds-critical-part' : '';
      // Handle null values when no damage config is set
      const hitsDisplay =
        part.hitsToDestroy === null ? '—' : part.hitsToDestroy === Infinity ? '∞' : part.hitsToDestroy;
      const damageDisplay = part.effectiveDamage === null ? '—' : part.effectiveDamage.toFixed(1);

      return `
        <tr class="${criticalClass}">
          <td>${this.#escapeHtml(part.partName)}</td>
          <td>${part.currentHealth}/${part.maxHealth}</td>
          <td>${damageDisplay}</td>
          <td>${hitsDisplay}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="ds-hits-table">
        <thead>
          <tr>
            <th>Part</th>
            <th>Health</th>
            <th>Eff. Damage</th>
            <th>Hits</th>
          </tr>
        </thead>
        <tbody id="hits-table-body">
          ${rowsHTML}
        </tbody>
      </table>
    `;
  }

  /**
   * Generate HTML for hit probability visualization.
   *
   * @private
   * @param {PartAnalytics[]} parts - Part analytics data with component info.
   * @returns {string} HTML for the probability chart.
   */
  #generateHitProbabilityHTML(parts) {
    if (!this.#hitProbabilityCalculator || parts.length === 0) {
      return '<p class="ds-no-data">Hit probability data not available.</p>';
    }

    // Transform parts to format expected by HitProbabilityCalculator
    // Extract the 'anatomy:part' component from the nested components object
    // The anatomyData.parts contains AnatomyPart objects with structure:
    // { id, name, currentHealth, maxHealth, components: { 'anatomy:part': {...}, ... } }
    // HitProbabilityCalculator expects component to be the 'anatomy:part' object directly
    const partsWithComponents = parts.map((part) => {
      const anatomyPart = this.#anatomyData?.parts?.find(
        (p) => p.id === part.partId
      );
      return {
        id: part.partId,
        name: part.partName,
        component: anatomyPart?.components?.['anatomy:part'] || null,
      };
    });

    const probabilities = this.#hitProbabilityCalculator.calculateProbabilities(partsWithComponents);
    const vizData = this.#hitProbabilityCalculator.getVisualizationData(probabilities);

    if (vizData.bars.length === 0) {
      return '<p class="ds-no-data">No probability data calculated.</p>';
    }

    const barsHTML = vizData.bars
      .map(
        (bar) => `
      <div class="ds-prob-bar-row">
        <span class="ds-prob-label">${this.#escapeHtml(bar.label)}</span>
        <div class="ds-prob-bar-container">
          <div class="ds-prob-bar ${bar.colorClass}" style="width: ${bar.barWidth}%"></div>
        </div>
        <span class="ds-prob-value">${bar.percentage.toFixed(1)}%</span>
      </div>
    `
      )
      .join('');

    return `<div class="ds-prob-chart">${barsHTML}</div>`;
  }

  /**
   * Generate HTML for the effect thresholds.
   *
   * @private
   * @param {EffectThreshold[]} effects - Effect threshold data.
   * @returns {string} HTML for the effects list.
   */
  #generateEffectsHTML(effects) {
    const itemsHTML = effects.map((effect) => `
      <li class="ds-effect-item">
        <span class="ds-effect-name">${this.#escapeHtml(effect.effectType)}</span>
        <span class="ds-effect-threshold">≤${effect.threshold}% HP</span>
      </li>
    `).join('');

    return `<ul class="ds-effect-list">${itemsHTML}</ul>`;
  }

  /**
   * Generate HTML for aggregate statistics.
   *
   * @private
   * @param {AggregateStats} aggregate - Aggregate statistics.
   * @returns {string} HTML for the stats.
   */
  #generateAggregateHTML(aggregate) {
    if (aggregate.totalParts === 0) {
      return '<p class="ds-no-data">No statistics available.</p>';
    }

    const avgDisplay = aggregate.averageHits === Infinity ? '∞' : aggregate.averageHits.toFixed(1);
    const minDisplay = aggregate.minHits === Infinity ? '∞' : aggregate.minHits;
    const maxDisplay = aggregate.maxHits === Infinity ? '∞' : aggregate.maxHits;

    return `
      <div class="ds-stat">
        <span class="ds-stat-label">Avg Hits</span>
        <span class="ds-stat-value" id="avg-hits">${avgDisplay}</span>
      </div>
      <div class="ds-stat">
        <span class="ds-stat-label">Min/Max</span>
        <span class="ds-stat-value" id="min-max-hits">${minDisplay}/${maxDisplay}</span>
      </div>
      <div class="ds-stat">
        <span class="ds-stat-label">Parts</span>
        <span class="ds-stat-value" id="total-parts">${aggregate.totalParts}</span>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS.
   *
   * @private
   * @param {string} str - String to escape.
   * @returns {string} Escaped string.
   */
  #escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Attach event listeners to rendered elements.
   *
   * @private
   */
  #attachEventListeners() {
    const collapseBtn = this.#containerElement.querySelector('#analytics-collapse-btn');
    const header = this.#containerElement.querySelector('#analytics-header');

    const toggleCollapse = () => {
      this.#isCollapsed = !this.#isCollapsed;
      this.render();
    };

    if (collapseBtn) {
      collapseBtn.addEventListener('click', toggleCollapse);
    }
    if (header) {
      header.addEventListener('click', (e) => {
        // Only toggle if clicking on header itself, not the button
        if (e.target === header || e.target.tagName === 'H3') {
          toggleCollapse();
        }
      });
    }
  }

  /**
   * Calculate effective damage after penetration and resistance.
   *
   * @private
   * @param {AnatomyPart} part - Body part data.
   * @returns {number} Effective damage amount.
   */
  #calculateEffectiveDamage(part) {
    // Note: This method is only called when hasDamageConfig is true (line 658),
    // which means this.#damageEntry is guaranteed to exist at call time.
    const baseDamage = this.#damageEntry.amount * this.#multiplier;
    const penetration = this.#damageEntry.penetration ?? 0;
    const resistance = part.resistance ?? 0;
    const armor = part.armor ?? 0;

    // Penetration reduces effective armor
    const effectiveArmor = armor * (1 - penetration);

    // Resistance reduces damage percentage
    const afterResistance = baseDamage * (1 - resistance);

    // Armor reduces flat damage
    const effectiveDamage = Math.max(0, afterResistance - effectiveArmor);

    return effectiveDamage;
  }

  /**
   * Calculate hits needed to destroy a part.
   *
   * @private
   * @param {number} health - Part's current health.
   * @param {number} effectiveDamage - Effective damage per hit.
   * @returns {number} Hits needed (Infinity if damage is 0).
   */
  #calculateHitsToDestroy(health, effectiveDamage) {
    if (effectiveDamage <= 0) return Infinity;
    return Math.ceil(health / effectiveDamage);
  }

  /**
   * Check if a part name matches a critical part.
   *
   * @private
   * @param {string} partName - Part name to check.
   * @returns {boolean} True if critical.
   */
  #isCriticalPart(partName) {
    const lowerName = partName.toLowerCase();
    return CRITICAL_PARTS.some((critical) => lowerName.includes(critical));
  }

  /**
   * Get current analytics data.
   *
   * @returns {AnalyticsData} Calculated analytics.
   */
  getAnalytics() {
    /** @type {PartAnalytics[]} */
    const parts = [];

    /** @type {AggregateStats} */
    const aggregate = {
      averageHits: 0,
      minHits: Infinity,
      maxHits: 0,
      totalParts: 0,
    };

    // Fix Issue 1: Show anatomy data even without damage config
    // Only require anatomy data, damage calculations are conditional
    if (this.#anatomyData?.parts) {
      const hasDamageConfig = !!this.#damageEntry;

      // Calculate hit probabilities if calculator is available
      let probabilitiesMap = new Map();
      if (this.#hitProbabilityCalculator) {
        // Transform parts to format expected by HitProbabilityCalculator
        // Extract the 'anatomy:part' component from the nested components object
        const partsWithComponents = this.#anatomyData.parts.map((part) => ({
          id: part.id,
          name: part.name,
          component: part.components?.['anatomy:part'] || null,
        }));
        const probabilities =
          this.#hitProbabilityCalculator.calculateProbabilities(partsWithComponents);
        // Create a map for quick lookup by part ID
        for (const prob of probabilities) {
          probabilitiesMap.set(prob.partId, prob.probability);
        }
      }

      for (const part of this.#anatomyData.parts) {
        // Only calculate damage metrics if damage config exists
        const effectiveDamage = hasDamageConfig ? this.#calculateEffectiveDamage(part) : null;
        const hitsToDestroy = hasDamageConfig
          ? this.#calculateHitsToDestroy(part.currentHealth, effectiveDamage)
          : null;
        const isCritical = this.#isCriticalPart(part.name);

        parts.push({
          partId: part.id,
          partName: part.name,
          currentHealth: part.currentHealth,
          maxHealth: part.maxHealth,
          hitsToDestroy,
          effectiveDamage,
          isCritical,
          hitProbability: probabilitiesMap.get(part.id) ?? 0,
        });

        // Update aggregate stats (only for finite values when damage config exists)
        if (hasDamageConfig && hitsToDestroy !== null && hitsToDestroy !== Infinity) {
          aggregate.minHits = Math.min(aggregate.minHits, hitsToDestroy);
          aggregate.maxHits = Math.max(aggregate.maxHits, hitsToDestroy);
        }
      }

      aggregate.totalParts = parts.length;

      // Calculate average (exclude null/Infinity values)
      if (hasDamageConfig) {
        const finiteParts = parts.filter((p) => p.hitsToDestroy !== null && p.hitsToDestroy !== Infinity);
        if (finiteParts.length > 0) {
          const sum = finiteParts.reduce((acc, p) => acc + p.hitsToDestroy, 0);
          aggregate.averageHits = sum / finiteParts.length;
        } else {
          aggregate.averageHits = Infinity;
        }

        // If no finite values, reset min/max
        if (aggregate.minHits === Infinity && aggregate.maxHits === 0) {
          aggregate.maxHits = Infinity;
        }
      }
    }

    return {
      parts,
      aggregate,
      effectThresholds: [...DEFAULT_EFFECT_THRESHOLDS],
    };
  }

  /**
   * Clean up resources.
   */
  destroy() {
    for (const unsubscribe of this.#unsubscribers) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
    this.#unsubscribers = [];
    this.#anatomyData = null;
    this.#damageEntry = null;
    this.#logger.debug('[DamageAnalyticsPanel] Destroyed');
  }
}

export default DamageAnalyticsPanel;
