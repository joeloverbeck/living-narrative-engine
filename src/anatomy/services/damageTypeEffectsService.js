/**
 * @file DamageTypeEffectsService - Applies immediate damage type effects
 *
 * Handles the application of special effects (bleed, fracture, burn, poison,
 * dismemberment) based on damage type definitions when damage is applied.
 *
 * Processing order (per spec):
 * 1. Dismemberment check - if triggered, skip all other effects
 * 2. Fracture check - may trigger stun
 * 3. Bleed attach
 * 4. Burn attach
 * 5. Poison attach
 *
 * @see specs/damage-types-and-special-effects.md
 */

import { BaseService } from '../../utils/serviceBase.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */

// Component IDs
const BLEEDING_COMPONENT_ID = 'anatomy:bleeding';
const BURNING_COMPONENT_ID = 'anatomy:burning';
const POISONED_COMPONENT_ID = 'anatomy:poisoned';
const FRACTURED_COMPONENT_ID = 'anatomy:fractured';
const DISMEMBERED_COMPONENT_ID = 'anatomy:dismembered';
const STUNNED_COMPONENT_ID = 'anatomy:stunned';

// Event types - started events
const DISMEMBERED_EVENT = 'anatomy:dismembered';
const FRACTURED_EVENT = 'anatomy:fractured';
const BLEEDING_STARTED_EVENT = 'anatomy:bleeding_started';
const BURNING_STARTED_EVENT = 'anatomy:burning_started';
const POISONED_STARTED_EVENT = 'anatomy:poisoned_started';

// Event types - stopped events (used by tick systems)
export const BLEEDING_STOPPED_EVENT = 'anatomy:bleeding_stopped';
export const BURNING_STOPPED_EVENT = 'anatomy:burning_stopped';
export const POISONED_STOPPED_EVENT = 'anatomy:poisoned_stopped';

// Export component IDs for use by tick systems
export { BLEEDING_COMPONENT_ID, BURNING_COMPONENT_ID, POISONED_COMPONENT_ID, DISMEMBERED_COMPONENT_ID };

// Severity to tick damage mapping per spec
const BLEED_SEVERITY_MAP = {
  minor: { tickDamage: 1 },
  moderate: { tickDamage: 3 },
  severe: { tickDamage: 5 },
};

// Default stun duration when fracture triggers stun
const DEFAULT_STUN_DURATION = 1;

// Default burn stack count
const DEFAULT_BURN_STACK_COUNT = 1;

/**
 * Service responsible for applying immediate damage type effects.
 * Called synchronously from ApplyDamageHandler after damage is applied.
 */
class DamageTypeEffectsService extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {EntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {() => number} */ #rngProvider;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {() => number} [deps.rngProvider] - Injectable RNG for deterministic testing
   */
  constructor({ logger, entityManager, safeEventDispatcher, rngProvider }) {
    super();

    this.#logger = this._init('DamageTypeEffectsService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'hasComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#rngProvider = typeof rngProvider === 'function' ? rngProvider : Math.random;
  }

  /**
   * Applies immediate effects for a damage event based on damage entry object.
   *
   * @param {object} params
   * @param {string} params.entityId - Owner entity ID
   * @param {string} [params.entityName] - Name of the entity (for events)
   * @param {string} [params.entityPronoun] - Pronoun (for events)
   * @param {string} params.partId - Target part entity ID
   * @param {string} [params.partType] - Type of part (for events)
   * @param {string} [params.orientation] - Orientation (for events)
   * @param {object} params.damageEntry - Complete damage entry object from weapon
   * @param {string} params.damageEntry.name - Damage type name
   * @param {number} params.damageEntry.amount - Damage amount
   * @param {number} [params.damageEntry.penetration] - Penetration value (0-1)
   * @param {object} [params.damageEntry.bleed] - Bleed effect configuration
   * @param {object} [params.damageEntry.fracture] - Fracture effect configuration
   * @param {object} [params.damageEntry.burn] - Burn effect configuration
   * @param {object} [params.damageEntry.poison] - Poison effect configuration
   * @param {object} [params.damageEntry.dismember] - Dismember effect configuration
   * @param {number} params.maxHealth - Part's max health
   * @param {number} params.currentHealth - Part's health AFTER damage was applied
   * @returns {Promise<void>}
   */
  async applyEffectsForDamage({
    entityId,
    entityName,
    entityPronoun,
    partId,
    partType,
    orientation,
    damageEntry,
    maxHealth,
    currentHealth,
  }) {
    // Validate damageEntry is provided
    if (!damageEntry) {
      this.#logger.warn('DamageTypeEffectsService: No damage entry provided, skipping effects.', {
        entityId,
        partId,
      });
      return;
    }

    const amount = damageEntry.amount ?? 0;
    const partDestroyed = currentHealth <= 0;

    // 1. Dismemberment check (before all other effects)
    await this.#checkAndApplyDismemberment({
      entityId,
      entityName,
      entityPronoun,
      partId,
      partType,
      orientation,
      amount,
      maxHealth,
      damageEntry,
    });
    // Note: We continue execution so that secondary effects (especially bleed) are applied.
    // A dismembered part should definitely bleed!

    // 2. Fracture check
    await this.#checkAndApplyFracture({
      entityId,
      partId,
      amount,
      maxHealth,
      currentHealth,
      damageEntry,
    });

    // Skip ongoing effects if part is destroyed
    if (partDestroyed) {
      return;
    }

    // 3. Bleed attach
    await this.#applyBleedEffect({ entityId, partId, damageEntry });

    // 4. Burn attach
    await this.#applyBurnEffect({ entityId, partId, damageEntry });

    // 5. Poison attach
    await this.#applyPoisonEffect({ entityId, partId, damageEntry });
  }

  /**
   * Checks and applies dismemberment if threshold is exceeded.
   *
   * @param {object} params
   * @param {string} params.entityId
   * @param {string} [params.entityName]
   * @param {string} [params.entityPronoun]
   * @param {string} params.partId
   * @param {string} [params.partType]
   * @param {string} [params.orientation]
   * @param {number} params.amount
   * @param {number} params.maxHealth
   * @param {object} params.damageEntry
   * @returns {Promise<boolean>} True if dismemberment was triggered
   * @private
   */
  async #checkAndApplyDismemberment({
    entityId,
    entityName,
    entityPronoun,
    partId,
    partType,
    orientation,
    amount,
    maxHealth,
    damageEntry,
  }) {
    const dismemberConfig = damageEntry.dismember;
    if (!dismemberConfig?.enabled) {
      return false;
    }

    const thresholdFraction = dismemberConfig.thresholdFraction ?? 0.8;
    const threshold = thresholdFraction * maxHealth;

    if (amount >= threshold) {
      // Mark part as dismembered
      await this.#entityManager.addComponent(partId, DISMEMBERED_COMPONENT_ID, {
        sourceDamageType: damageEntry.name,
      });

      this.#dispatcher.dispatch(DISMEMBERED_EVENT, {
        entityId,
        entityName,
        entityPronoun,
        partId,
        partType,
        orientation,
        damageTypeId: damageEntry.name,
        timestamp: Date.now(),
      });

      this.#logger.info(
        `DamageTypeEffectsService: Part ${partId} dismembered by ${damageEntry.name} damage.`
      );

      return true;
    }

    return false;
  }

  /**
   * Checks and applies fracture effect if threshold is exceeded.
   *
   * @param {object} params
   * @param {string} params.entityId
   * @param {string} params.partId
   * @param {number} params.amount
   * @param {number} params.maxHealth
   * @param {number} params.currentHealth
   * @param {object} params.damageEntry
   * @returns {Promise<void>}
   * @private
   */
  async #checkAndApplyFracture({ entityId, partId, amount, maxHealth, currentHealth, damageEntry }) {
    const fractureConfig = damageEntry.fracture;
    if (!fractureConfig?.enabled) {
      return;
    }

    const thresholdFraction = fractureConfig.thresholdFraction ?? 0.5;
    const threshold = thresholdFraction * maxHealth;

    if (amount < threshold) {
      return;
    }

    // Apply fractured component to part
    await this.#entityManager.addComponent(partId, FRACTURED_COMPONENT_ID, {
      sourceDamageType: damageEntry.name,
      appliedAtHealth: currentHealth,
    });

    // Roll for stun
    const stunChance = fractureConfig.stunChance ?? 0;
    const stunApplied = stunChance > 0 && this.#rngProvider() < stunChance;

    if (stunApplied) {
      await this.#entityManager.addComponent(entityId, STUNNED_COMPONENT_ID, {
        remainingTurns: DEFAULT_STUN_DURATION,
        sourcePartId: partId,
      });
    }

    this.#dispatcher.dispatch(FRACTURED_EVENT, {
      entityId,
      partId,
      damageTypeId: damageEntry.name,
      stunApplied,
      timestamp: Date.now(),
    });

    this.#logger.debug(
      `DamageTypeEffectsService: Part ${partId} fractured by ${damageEntry.name}. Stun: ${stunApplied}`
    );
  }

  /**
   * Applies bleed effect if enabled in damage entry.
   *
   * @param {object} params
   * @param {string} params.entityId
   * @param {string} params.partId
   * @param {object} params.damageEntry
   * @returns {Promise<void>}
   * @private
   */
  async #applyBleedEffect({ entityId, partId, damageEntry }) {
    const bleedConfig = damageEntry.bleed;
    if (!bleedConfig?.enabled) {
      return;
    }

    const severity = bleedConfig.severity ?? 'minor';
    const baseDuration = bleedConfig.baseDurationTurns ?? 2;
    const severityData = BLEED_SEVERITY_MAP[severity] ?? BLEED_SEVERITY_MAP.minor;

    // Add or refresh bleeding component
    await this.#entityManager.addComponent(partId, BLEEDING_COMPONENT_ID, {
      severity,
      remainingTurns: baseDuration,
      tickDamage: severityData.tickDamage,
    });

    this.#dispatcher.dispatch(BLEEDING_STARTED_EVENT, {
      entityId,
      partId,
      severity,
      timestamp: Date.now(),
    });

    this.#logger.debug(
      `DamageTypeEffectsService: Bleeding (${severity}) applied to part ${partId}.`
    );
  }

  /**
   * Applies burn effect if enabled in damage entry.
   * Handles stacking logic based on canStack configuration.
   *
   * @param {object} params
   * @param {string} params.entityId
   * @param {string} params.partId
   * @param {object} params.damageEntry
   * @returns {Promise<void>}
   * @private
   */
  async #applyBurnEffect({ entityId, partId, damageEntry }) {
    const burnConfig = damageEntry.burn;
    if (!burnConfig?.enabled) {
      return;
    }

    const dps = burnConfig.dps ?? 1;
    const durationTurns = burnConfig.durationTurns ?? 2;
    const canStack = burnConfig.canStack ?? false;

    // Check for existing burn component
    const existingBurn = this.#entityManager.hasComponent(partId, BURNING_COMPONENT_ID)
      ? this.#entityManager.getComponentData(partId, BURNING_COMPONENT_ID)
      : null;

    let newTickDamage = dps;
    let newStackedCount = DEFAULT_BURN_STACK_COUNT;

    if (existingBurn && canStack) {
      // Stack: increase damage and stack count
      newTickDamage = existingBurn.tickDamage + dps;
      newStackedCount = (existingBurn.stackedCount ?? DEFAULT_BURN_STACK_COUNT) + 1;
    } else if (existingBurn && !canStack) {
      // No stack: just refresh duration, keep existing damage
      newTickDamage = existingBurn.tickDamage;
      newStackedCount = existingBurn.stackedCount ?? DEFAULT_BURN_STACK_COUNT;
    }

    await this.#entityManager.addComponent(partId, BURNING_COMPONENT_ID, {
      remainingTurns: durationTurns,
      tickDamage: newTickDamage,
      stackedCount: newStackedCount,
    });

    this.#dispatcher.dispatch(BURNING_STARTED_EVENT, {
      entityId,
      partId,
      stackedCount: newStackedCount,
      timestamp: Date.now(),
    });

    this.#logger.debug(
      `DamageTypeEffectsService: Burning applied to part ${partId}. Stack: ${newStackedCount}`
    );
  }

  /**
   * Applies poison effect if enabled in damage entry.
   * Respects scope configuration (part vs entity).
   *
   * @param {object} params
   * @param {string} params.entityId
   * @param {string} params.partId
   * @param {object} params.damageEntry
   * @returns {Promise<void>}
   * @private
   */
  async #applyPoisonEffect({ entityId, partId, damageEntry }) {
    const poisonConfig = damageEntry.poison;
    if (!poisonConfig?.enabled) {
      return;
    }

    const tick = poisonConfig.tick ?? 1;
    const durationTurns = poisonConfig.durationTurns ?? 3;
    const scope = poisonConfig.scope ?? 'part';

    // Determine target based on scope
    const targetId = scope === 'entity' ? entityId : partId;

    await this.#entityManager.addComponent(targetId, POISONED_COMPONENT_ID, {
      remainingTurns: durationTurns,
      tickDamage: tick,
    });

    this.#dispatcher.dispatch(POISONED_STARTED_EVENT, {
      entityId,
      partId: scope === 'part' ? partId : undefined,
      scope,
      timestamp: Date.now(),
    });

    this.#logger.debug(
      `DamageTypeEffectsService: Poison applied to ${scope === 'entity' ? 'entity' : 'part'} ${targetId}.`
    );
  }
}

export default DamageTypeEffectsService;
