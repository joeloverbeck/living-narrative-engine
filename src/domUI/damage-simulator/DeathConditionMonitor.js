/**
 * @file DeathConditionMonitor.js
 * @description Monitors death-triggering conditions for entities with vital organs.
 * Displays current health status vs death thresholds and alerts when entity would die.
 * @see DamageAnalyticsPanel.js - Pattern reference
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * Event types for death condition monitoring
 * @readonly
 */
const EVENTS = Object.freeze({
  ENTITY_LOADED: 'damage-simulator:entity-loaded',
  DAMAGE_APPLIED: 'anatomy:damage_applied',
  CONFIG_CHANGED: 'damage-composer:config-changed',
});

/**
 * Health status thresholds (as percentages)
 * @readonly
 */
const THRESHOLDS = Object.freeze({
  CRITICAL: 10, // ≤10% health = critical
  WARNING: 25, // ≤25% health = warning
});

/**
 * Status classifications for vital organs
 * @readonly
 */
const STATUS = Object.freeze({
  SAFE: 'safe',
  WARNING: 'warning',
  CRITICAL: 'critical',
  DESTROYED: 'destroyed',
});

/**
 * @typedef {Object} VitalOrganStatus
 * @property {string} partId - Entity ID of the vital organ part
 * @property {string} partName - Display name of the part
 * @property {string} organType - Type: brain | heart | spine
 * @property {number} currentHealth - Current health value
 * @property {number} maxHealth - Maximum health value
 * @property {number} healthPercent - Current health as percentage
 * @property {number} hitsUntilDeath - Estimated hits until destruction
 * @property {string} status - safe | warning | critical | destroyed
 */

/**
 * @typedef {Object} DeathConditionSummary
 * @property {boolean} isDead - True if any vital organ is destroyed
 * @property {boolean} isInDanger - True if any vital organ is critical (1 hit from death)
 * @property {Array<VitalOrganStatus>} vitalOrgans - Status of all vital organs
 * @property {string|null} deathCause - Part name that caused/would cause death
 */

/**
 * Monitors death conditions for entities with vital organs.
 * Displays health status, hits-until-death calculations, and death alerts.
 */
class DeathConditionMonitor {
  /** @type {HTMLElement} */
  #containerElement;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /** @type {string|null} */
  #currentEntityId;

  /** @type {Array<VitalOrganStatus>} */
  #vitalOrgans;

  /** @type {Object|null} */
  #currentDamageConfig;

  /** @type {Array<Function>} */
  #unsubscribers;

  /** @type {boolean} */
  #isCollapsed;

  /**
   * Expose constants for testing and external use
   */
  static EVENTS = EVENTS;
  static THRESHOLDS = THRESHOLDS;
  static STATUS = STATUS;

  /**
   * @param {Object} dependencies
   * @param {HTMLElement} dependencies.containerElement - Container to render into
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for subscriptions
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ containerElement, eventBus, logger }) {
    validateDependency(containerElement, 'HTMLElement', console, {
      requiredMethods: ['appendChild'],
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

    this.#currentEntityId = null;
    this.#vitalOrgans = [];
    this.#currentDamageConfig = null;
    this.#unsubscribers = [];
    this.#isCollapsed = false;

    this.#subscribeToEvents();
    this.#logger.debug('[DeathConditionMonitor] Initialized');
  }

  /**
   * Set the entity to monitor for death conditions
   * @param {string} entityId - Entity instance ID
   * @param {Object} anatomyData - Extracted anatomy data
   */
  setEntity(entityId, anatomyData) {
    this.#currentEntityId = entityId;
    this.#extractVitalOrgans(anatomyData);
    this.render();
    this.#logger.debug(
      `[DeathConditionMonitor] Entity set: ${entityId}, vital organs: ${this.#vitalOrgans.length}`
    );
  }

  /**
   * Update damage configuration for hits-until-death calculations
   * @param {Object} damageEntry - Damage type and amount configuration
   * @param {number} multiplier - Damage multiplier
   */
  updateDamageConfig(damageEntry, multiplier) {
    this.#currentDamageConfig = { damageEntry, multiplier };
    this.#recalculateHitsUntilDeath();
    this.render();
  }

  /**
   * Get current death condition summary
   * @returns {DeathConditionSummary}
   */
  getDeathConditionSummary() {
    const destroyedOrgan = this.#vitalOrgans.find(
      (organ) => organ.status === STATUS.DESTROYED
    );
    const criticalOrgan = this.#vitalOrgans.find(
      (organ) => organ.status === STATUS.CRITICAL
    );

    return {
      isDead: !!destroyedOrgan,
      isInDanger: !!criticalOrgan,
      vitalOrgans: [...this.#vitalOrgans],
      deathCause: destroyedOrgan?.partName || criticalOrgan?.partName || null,
    };
  }

  /**
   * Check if entity would die from a specific damage application
   * @param {Object} damageEntry - Damage configuration to test
   * @param {string} [targetPartId] - Specific part to target (optional)
   * @returns {boolean} True if damage would cause death
   */
  wouldDieOnHit(damageEntry, targetPartId = null) {
    const damageAmount = damageEntry?.amount || 0;

    for (const organ of this.#vitalOrgans) {
      // If targeting specific part, only check that one
      if (targetPartId && organ.partId !== targetPartId) {
        continue;
      }

      // Would this damage destroy the vital organ?
      if (organ.currentHealth - damageAmount <= 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Render the death condition monitor display
   */
  render() {
    const summary = this.getDeathConditionSummary();
    const overallStatus = this.#determineOverallStatus(summary);

    this.#containerElement.innerHTML = `
      <div class="ds-death-monitor ${this.#isCollapsed ? 'collapsed' : ''}">
        <div class="ds-death-header" role="button" tabindex="0" aria-expanded="${!this.#isCollapsed}">
          <h4>
            <span class="ds-death-icon">${this.#getStatusIcon(overallStatus)}</span>
            Death Conditions
          </h4>
          <div class="ds-header-controls">
            <span class="ds-death-status ds-status-${overallStatus}">${this.#getStatusLabel(overallStatus)}</span>
            <button class="ds-collapse-btn" aria-label="${this.#isCollapsed ? 'Expand' : 'Collapse'}">${this.#isCollapsed ? '▶' : '▼'}</button>
          </div>
        </div>

        <div class="ds-death-content">
          ${this.#renderVitalOrgansList()}
          ${this.#renderDeathAlert(summary)}
        </div>
      </div>
    `;

    this.#bindPanelEvents();
  }

  /**
   * Clear monitoring state
   */
  clear() {
    this.#currentEntityId = null;
    this.#vitalOrgans = [];
    this.#currentDamageConfig = null;
    this.#containerElement.innerHTML = '';
    this.#logger.debug('[DeathConditionMonitor] Cleared');
  }

  /**
   * Cleanup subscriptions and resources
   */
  destroy() {
    for (const unsubscribe of this.#unsubscribers) {
      unsubscribe();
    }
    this.#unsubscribers = [];
    this.clear();
    this.#logger.debug('[DeathConditionMonitor] Destroyed');
  }

  /**
   * Subscribe to relevant events
   * @private
   */
  #subscribeToEvents() {
    // Entity loaded event
    const unsubEntity = this.#eventBus.subscribe(
      EVENTS.ENTITY_LOADED,
      (event) => {
        const { instanceId, anatomyData } = event.payload || {};
        if (instanceId && anatomyData) {
          this.setEntity(instanceId, anatomyData);
        }
      }
    );
    this.#unsubscribers.push(unsubEntity);

    // Damage applied event - refresh anatomy data
    const unsubDamage = this.#eventBus.subscribe(
      EVENTS.DAMAGE_APPLIED,
      (event) => {
        if (
          this.#currentEntityId &&
          event.payload?.entityId === this.#currentEntityId
        ) {
          // Re-extract anatomy data would require entityManager access
          // For now, dispatch a refresh request that DamageSimulatorUI handles
          this.#logger.debug(
            '[DeathConditionMonitor] Damage applied, awaiting refresh'
          );
        }
      }
    );
    this.#unsubscribers.push(unsubDamage);

    // Damage config changed event
    const unsubConfig = this.#eventBus.subscribe(
      EVENTS.CONFIG_CHANGED,
      (event) => {
        const { damageEntry, multiplier } = event.payload || {};
        if (damageEntry) {
          this.updateDamageConfig(damageEntry, multiplier || 1);
        }
      }
    );
    this.#unsubscribers.push(unsubConfig);
  }

  /**
   * Extract vital organs from anatomy data recursively
   * @private
   * @param {Object} anatomyData - Anatomy tree data
   */
  #extractVitalOrgans(anatomyData) {
    this.#vitalOrgans = [];

    if (!anatomyData?.parts) {
      return;
    }

    const extractFromPart = (part) => {
      const vitalOrgan = part.components?.['anatomy:vital_organ'];

      // killOnDestroy defaults to true if not specified
      if (vitalOrgan && vitalOrgan.killOnDestroy !== false) {
        const health = part.components?.['anatomy:part_health'];
        const currentHealth = health?.current ?? 0;
        const maxHealth = health?.max ?? 1;
        const healthPercent =
          maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 0;

        this.#vitalOrgans.push({
          partId: part.id,
          partName: part.name || part.id,
          organType: vitalOrgan.organType || 'unknown',
          currentHealth,
          maxHealth,
          healthPercent,
          hitsUntilDeath: this.#calculateHitsUntilDeath(currentHealth),
          status: this.#determinePartStatus(healthPercent, currentHealth),
        });
      }

      // Recurse into children
      if (part.children) {
        for (const child of part.children) {
          extractFromPart(child);
        }
      }
    };

    for (const part of anatomyData.parts) {
      extractFromPart(part);
    }

    this.#logger.debug(
      `[DeathConditionMonitor] Extracted ${this.#vitalOrgans.length} vital organs`
    );
  }

  /**
   * Calculate hits until death for a given health amount
   * @private
   * @param {number} currentHealth - Current health value
   * @returns {number} Estimated hits until destruction
   */
  #calculateHitsUntilDeath(currentHealth) {
    if (currentHealth <= 0) {
      return 0;
    }

    const damagePerHit =
      (this.#currentDamageConfig?.damageEntry?.amount || 10) *
      (this.#currentDamageConfig?.multiplier || 1);

    if (damagePerHit <= 0) {
      return Infinity;
    }

    return Math.ceil(currentHealth / damagePerHit);
  }

  /**
   * Recalculate hits until death for all vital organs
   * @private
   */
  #recalculateHitsUntilDeath() {
    for (const organ of this.#vitalOrgans) {
      organ.hitsUntilDeath = this.#calculateHitsUntilDeath(organ.currentHealth);
      // Update status based on hits until death
      if (organ.hitsUntilDeath <= 1 && organ.status !== STATUS.DESTROYED) {
        organ.status = STATUS.CRITICAL;
      }
    }
  }

  /**
   * Determine status for a single part
   * @private
   * @param {number} healthPercent - Health as percentage (0-100)
   * @param {number} currentHealth - Absolute current health
   * @returns {string} Status classification
   */
  #determinePartStatus(healthPercent, currentHealth) {
    if (currentHealth <= 0) {
      return STATUS.DESTROYED;
    }
    if (healthPercent <= THRESHOLDS.CRITICAL) {
      return STATUS.CRITICAL;
    }
    if (healthPercent <= THRESHOLDS.WARNING) {
      return STATUS.WARNING;
    }
    return STATUS.SAFE;
  }

  /**
   * Determine overall status based on all vital organs
   * @private
   * @param {DeathConditionSummary} summary - Current summary
   * @returns {string} Overall status
   */
  #determineOverallStatus(summary) {
    if (summary.isDead) {
      return STATUS.DESTROYED;
    }
    if (summary.isInDanger) {
      return STATUS.CRITICAL;
    }
    const hasWarning = summary.vitalOrgans.some(
      (organ) => organ.status === STATUS.WARNING
    );
    if (hasWarning) {
      return STATUS.WARNING;
    }
    return STATUS.SAFE;
  }

  /**
   * Get icon for status
   * @private
   * @param {string} status - Status classification
   * @returns {string} Emoji icon
   */
  #getStatusIcon(status) {
    switch (status) {
      case STATUS.DESTROYED:
        return '☠️';
      case STATUS.CRITICAL:
        return '💀';
      case STATUS.WARNING:
        return '⚠️';
      default:
        return '❤️';
    }
  }

  /**
   * Get label for status
   * @private
   * @param {string} status - Status classification
   * @returns {string} Human-readable label
   */
  #getStatusLabel(status) {
    switch (status) {
      case STATUS.DESTROYED:
        return 'DEAD';
      case STATUS.CRITICAL:
        return 'CRITICAL';
      case STATUS.WARNING:
        return 'WARNING';
      default:
        return 'ALIVE';
    }
  }

  /**
   * Render the list of vital organs
   * @private
   * @returns {string} HTML string
   */
  #renderVitalOrgansList() {
    if (this.#vitalOrgans.length === 0) {
      return `
        <div class="ds-no-vital-organs">
          <p>No vital organs detected in this entity.</p>
        </div>
      `;
    }

    const items = this.#vitalOrgans
      .map((organ) => this.#renderVitalOrganItem(organ))
      .join('');

    return `
      <div class="ds-vital-organs-list">
        ${items}
      </div>
    `;
  }

  /**
   * Render a single vital organ item
   * @private
   * @param {VitalOrganStatus} organ - Vital organ status
   * @returns {string} HTML string
   */
  #renderVitalOrganItem(organ) {
    const healthBarWidth = Math.max(0, Math.min(100, organ.healthPercent));
    const hitsText = this.#formatHitsUntilDeath(organ);
    const organIcon = this.#getOrganIcon(organ.organType);

    return `
      <div class="ds-vital-organ-item ds-status-${organ.status}" data-part-id="${this.#escapeHtml(organ.partId)}">
        <div class="ds-vital-organ-header">
          <span class="ds-organ-icon">${organIcon}</span>
          <span class="ds-organ-name">${this.#escapeHtml(organ.partName)}</span>
          <span class="ds-organ-health">${organ.currentHealth}/${organ.maxHealth} HP</span>
        </div>
        <div class="ds-death-progress">
          <div class="ds-death-bar ds-bar-${organ.status}" style="width: ${healthBarWidth}%"></div>
        </div>
        <div class="ds-vital-organ-footer">
          <span class="ds-organ-type">${this.#escapeHtml(organ.organType)}</span>
          <span class="ds-hits-until-death">${hitsText}</span>
        </div>
      </div>
    `;
  }

  /**
   * Get icon for organ type
   * @private
   * @param {string} organType - Type of organ
   * @returns {string} Emoji icon
   */
  #getOrganIcon(organType) {
    switch (organType) {
      case 'brain':
        return '🧠';
      case 'heart':
        return '❤️';
      case 'spine':
        return '🦴';
      default:
        return '🫀';
    }
  }

  /**
   * Format hits until death text
   * @private
   * @param {VitalOrganStatus} organ - Vital organ status
   * @returns {string} Formatted text
   */
  #formatHitsUntilDeath(organ) {
    if (organ.status === STATUS.DESTROYED) {
      return 'DESTROYED';
    }
    if (organ.hitsUntilDeath === Infinity) {
      return 'Invulnerable';
    }
    if (organ.hitsUntilDeath <= 1) {
      return '⚠️ 1 hit until death!';
    }
    return `${organ.hitsUntilDeath} hits until death`;
  }

  /**
   * Render death alert if applicable
   * @private
   * @param {DeathConditionSummary} summary - Current summary
   * @returns {string} HTML string
   */
  #renderDeathAlert(summary) {
    // Note: deathCause is always set when isDead or isInDanger is true
    // because these flags are derived from destroyed/critical organs which have partName
    if (summary.isDead) {
      return `
        <div class="ds-death-alert" role="alert">
          <span class="ds-alert-icon">☠️</span>
          <span class="ds-alert-text">ENTITY IS DEAD</span>
          <span class="ds-death-cause">Cause: ${this.#escapeHtml(summary.deathCause)} destruction</span>
        </div>
      `;
    }

    if (summary.isInDanger) {
      return `
        <div class="ds-dying-alert" role="alert">
          <span class="ds-alert-icon">💀</span>
          <span class="ds-alert-text">CRITICAL CONDITION</span>
          <span class="ds-death-cause">${this.#escapeHtml(summary.deathCause)} at critical health</span>
        </div>
      `;
    }

    return '';
  }

  /**
   * Bind event listeners for panel interactions
   * @private
   */
  #bindPanelEvents() {
    const header = this.#containerElement.querySelector('.ds-death-header');
    if (header) {
      header.addEventListener('click', () => this.#toggleCollapse());
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.#toggleCollapse();
        }
      });
    }
  }

  /**
   * Toggle panel collapse state
   * @private
   */
  #toggleCollapse() {
    this.#isCollapsed = !this.#isCollapsed;
    this.render();
  }

  /**
   * Escape HTML characters to prevent XSS
   * @private
   * @param {string} unsafeString - String to escape
   * @returns {string} Escaped string
   */
  #escapeHtml(unsafeString) {
    if (typeof unsafeString !== 'string') {
      return String(unsafeString);
    }
    return unsafeString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export default DeathConditionMonitor;
