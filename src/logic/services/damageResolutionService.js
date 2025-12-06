import { calculateStateFromPercentage } from '../../anatomy/registries/healthStateRegistry.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'core:gender';
const DAMAGE_PROPAGATION_COMPONENT_ID = 'anatomy:damage_propagation';

const DAMAGE_APPLIED_EVENT = 'anatomy:damage_applied';
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';
const PART_DESTROYED_EVENT = 'anatomy:part_destroyed';

const PRONOUN_MAP = Object.freeze({
  male: 'he',
  female: 'she',
  neutral: 'they',
  unknown: 'they',
});

const PRONOUN_POSSESSIVE_MAP = Object.freeze({
  male: 'his',
  female: 'her',
  neutral: 'their',
  unknown: 'their',
});

/**
 * Encapsulates APPLY_DAMAGE resolution logic so the handler can delegate orchestration.
 */
class DamageResolutionService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */ #logger;
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../../anatomy/services/damageTypeEffectsService.js').default} */ #damageTypeEffectsService;
  /** @type {import('../../anatomy/services/damagePropagationService.js').default} */ #damagePropagationService;
  /** @type {import('../../anatomy/services/deathCheckService.js').default} */ #deathCheckService;
  /** @type {import('../../anatomy/services/damageAccumulator.js').default} */ #damageAccumulator;
  /** @type {import('../../anatomy/services/damageNarrativeComposer.js').default} */ #damageNarrativeComposer;

  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    damageTypeEffectsService,
    damagePropagationService,
    deathCheckService,
    damageAccumulator,
    damageNarrativeComposer,
  }) {
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#damageTypeEffectsService = damageTypeEffectsService;
    this.#damagePropagationService = damagePropagationService;
    this.#deathCheckService = deathCheckService;
    this.#damageAccumulator = damageAccumulator;
    this.#damageNarrativeComposer = damageNarrativeComposer;
  }

  /**
   * Resolves and applies damage to the specified part, including propagation and death checks.
   *
   * @param {object} params - Resolution parameters
   * @param {string} params.entityId - Target entity ID
   * @param {string} params.partId - Target part ID
   * @param {object} params.finalDamageEntry - Damage entry with multiplier already applied
   * @param {string|null} [params.propagatedFrom] - Parent part ID when called from propagation
   * @param {object} params.executionContext - Shared execution context
   * @param {boolean} params.isTopLevel - Whether this is the initial call (not propagated)
   * @param {Function} params.applyDamage - Callback for recursive propagation (applyDamageHandler.execute)
   * @param {import('../../interfaces/coreServices.js').ILogger} [params.log] - Logger to use (defaults to injected logger)
   * @returns {Promise<void>}
   */
  async resolve({
    entityId,
    partId,
    finalDamageEntry,
   propagatedFrom = null,
   executionContext = {},
   isTopLevel = !propagatedFrom,
   applyDamage,
   log = this.#logger,
    rng = Math.random,
  }) {
    const logger = log || this.#logger;
    if (!entityId || !partId || !finalDamageEntry) {
      logger?.warn('DamageResolutionService: Missing required parameters', {
        entityId,
        partId,
        finalDamageEntry,
      });
      return;
    }

    const damageAmount = finalDamageEntry.amount;
    const damageType = finalDamageEntry.name;
    const damageTags = Array.isArray(finalDamageEntry?.damageTags) ? finalDamageEntry.damageTags : [];
    const metadata =
      finalDamageEntry?.metadata && typeof finalDamageEntry.metadata === 'object' && !Array.isArray(finalDamageEntry.metadata)
        ? finalDamageEntry.metadata
        : {};

    // Session lifecycle: Create session at top-level, reuse for propagation
    let session;
    if (isTopLevel) {
      session = this.#damageAccumulator.createSession(entityId);
      if (!session) {
        const errorMsg = 'APPLY_DAMAGE: Failed to create damage session';
        safeDispatchError(this.#dispatcher, errorMsg, { entityId }, logger);
        return;
      }
      executionContext.damageSession = session;
    } else {
      session = executionContext.damageSession;
      if (!session) {
        logger?.warn(
          `APPLY_DAMAGE: Propagated damage call missing session in executionContext for entity ${entityId}`
        );
      }
    }

    if (damageAmount <= 0 || Number.isNaN(damageAmount)) {
      logger?.debug(
        `APPLY_DAMAGE: Non-positive damage (${damageAmount}) for part ${partId}. Skipping damage application and propagation.`
      );

      if (isTopLevel && session) {
        delete executionContext.damageSession;
      }

      return;
    }

    const entityName = this.#getEntityName(entityId);
    const entityPronoun = this.#getEntityPronoun(entityId);
    const entityPossessive = this.#getEntityPossessive(entityId);
    const { partType, orientation } = this.#getPartInfo(partId);

    const damageEntryForSession = {
      entityId,
      entityName,
      entityPronoun,
      entityPossessive,
      partId,
      partType,
      orientation,
      amount: damageAmount,
      damageType,
      propagatedFrom,
      metadata,
      damageTags,
      effectsTriggered: [],
    };

    const partComponent = this.#entityManager.hasComponent(partId, PART_COMPONENT_ID)
      ? this.#entityManager.getComponentData(partId, PART_COMPONENT_ID)
      : null;
    const hasHealthComponent = this.#entityManager.hasComponent(partId, PART_HEALTH_COMPONENT_ID);

    let appliedDamageAmount = damageAmount;

    // Read propagation rules - try standalone component first, fallback to part component property
    const propagationComponent = this.#entityManager.hasComponent(partId, DAMAGE_PROPAGATION_COMPONENT_ID)
      ? this.#entityManager.getComponentData(partId, DAMAGE_PROPAGATION_COMPONENT_ID)
      : null;
    const propagationRules = propagationComponent?.rules ?? partComponent?.damage_propagation;

    if (!hasHealthComponent) {
      logger?.debug(
        `APPLY_DAMAGE: Part ${partId} has no health component. Skipping health update.`
      );
    } else {
      try {
        const healthComponent = this.#entityManager.getComponentData(partId, PART_HEALTH_COMPONENT_ID);
        const { currentHealth, maxHealth, state: previousState } = healthComponent;
        const previousHealth = currentHealth;
        const previousTurnsInState = healthComponent.turnsInState || 0;

        const appliedDamage = Math.max(0, Math.min(previousHealth, damageAmount));
        if (appliedDamage <= 0) {
          logger?.debug(
            `APPLY_DAMAGE: Damage to ${partId} resolved to 0 after clamping (current health ${previousHealth}). Skipping.`
          );

          if (isTopLevel && session) {
            delete executionContext.damageSession;
          }

          return;
        }

        appliedDamageAmount = appliedDamage;

        const newHealth = Math.max(0, currentHealth - appliedDamage);
        const healthPercentage = (newHealth / maxHealth) * 100;
        const newState = calculateStateFromPercentage(healthPercentage);
        const turnsInState = newState === previousState ? previousTurnsInState + 1 : 0;

        await this.#entityManager.addComponent(partId, PART_HEALTH_COMPONENT_ID, {
          currentHealth: newHealth,
          maxHealth,
          state: newState,
          turnsInState,
        });

        let resolvedPartType = 'unknown';
        let ownerEntityId = null;
        if (partComponent) {
          resolvedPartType = partComponent.subType || 'unknown';
          ownerEntityId = partComponent.ownerEntityId;
        }

        this.#dispatcher.dispatch(PART_HEALTH_CHANGED_EVENT, {
          partEntityId: partId,
          ownerEntityId,
          partType: resolvedPartType,
          previousHealth,
          newHealth,
          maxHealth,
          healthPercentage,
          previousState,
          newState,
          delta: -appliedDamage,
          timestamp: Date.now(),
        });

        if (newHealth <= 0 && previousHealth > 0) {
          this.#dispatcher.dispatch(PART_DESTROYED_EVENT, {
            entityId: ownerEntityId || entityId,
            partId,
            timestamp: Date.now(),
          });
          logger?.info(`APPLY_DAMAGE: Part ${partId} destroyed.`);
        }

        logger?.debug(
          `APPLY_DAMAGE: Applied ${appliedDamage} ${damageType} to ${partId}. Health: ${currentHealth} -> ${newHealth}. State: ${newState}.`
        );

        await this.#damageTypeEffectsService.applyEffectsForDamage({
          entityId: ownerEntityId || entityId,
          entityName,
          entityPronoun,
          partId,
          partType,
          orientation,
          damageEntry: { ...finalDamageEntry, amount: appliedDamage },
          maxHealth,
          currentHealth: newHealth,
          damageSession: session,
          rng,
        });
      } catch (error) {
        logger?.error('APPLY_DAMAGE operation failed', error, { partId });
        safeDispatchError(
          this.#dispatcher,
          `APPLY_DAMAGE: Operation failed - ${error.message}`,
          { partId, error: error.message },
          logger
        );
        return;
      }
    }

    if (session) {
      this.#damageAccumulator.recordDamage(session, {
        ...damageEntryForSession,
        amount: appliedDamageAmount,
      });
    }

    const damageAppliedPayload = {
      entityId,
      entityName,
      entityPronoun,
      partId,
      partType,
      orientation,
      amount: appliedDamageAmount,
      damageType,
      propagatedFrom,
      metadata,
      damageTags,
      timestamp: Date.now(),
    };

    if (session) {
      this.#damageAccumulator.queueEvent(session, DAMAGE_APPLIED_EVENT, damageAppliedPayload);
    } else {
      this.#dispatcher.dispatch(DAMAGE_APPLIED_EVENT, damageAppliedPayload);
    }

    if (typeof applyDamage === 'function') {
      await this.#propagateDamage({
        entityId,
        parentPartId: partId,
        damageAmount: appliedDamageAmount,
        damageType,
        propagationRules,
        executionContext,
        applyDamage,
        rng,
      });
    }

    if (isTopLevel) {
      const deathCheckOwnerEntityId = partComponent?.ownerEntityId || entityId;

      let deathEvaluation;
      try {
        deathEvaluation = this.#deathCheckService.evaluateDeathConditions(
          deathCheckOwnerEntityId,
          this.#extractActorId(executionContext)
        );
      } catch (deathCheckError) {
        logger?.warn(
          `APPLY_DAMAGE: evaluateDeathConditions failed for ${deathCheckOwnerEntityId}: ${deathCheckError.message}`
        );
        deathEvaluation = {
          isDead: false,
          isDying: false,
          shouldFinalize: false,
          finalizationParams: null,
          deathInfo: null,
        };
      }

      if (deathEvaluation.shouldFinalize) {
        logger?.info(`APPLY_DAMAGE: Entity ${deathCheckOwnerEntityId} will die from damage.`);
      } else if (deathEvaluation.isDying) {
        logger?.info(`APPLY_DAMAGE: Entity ${deathCheckOwnerEntityId} is now dying.`);
      }

      if (session) {
        let entries;
        let pendingEvents;
        try {
          const finalized = this.#damageAccumulator.finalize(session);
          entries = finalized.entries;
          pendingEvents = finalized.pendingEvents;
        } catch (finalizeError) {
          logger?.error('APPLY_DAMAGE: FAIL-FAST - Session finalization threw an error', finalizeError);
          throw finalizeError;
        }

        if (entries.length > 0) {
          let composedNarrative;
          try {
            composedNarrative = this.#damageNarrativeComposer.compose(entries);
          } catch (composeError) {
            logger?.error('APPLY_DAMAGE: FAIL-FAST - Narrative composition threw an error', composeError);
            throw composeError;
          }

          const totalDamage = entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

          if (composedNarrative) {
            const actorId = this.#extractActorId(executionContext);
            const locationId = this.#resolveLocationForEvent(
              deathCheckOwnerEntityId,
              actorId,
              logger
            );

            if (locationId) {
              this.#dispatcher.dispatch('core:perceptible_event', {
                eventName: 'core:perceptible_event',
                locationId,
                descriptionText: composedNarrative,
                timestamp: new Date().toISOString(),
                perceptionType: 'damage_received',
                actorId: actorId || entityId,
                targetId: deathCheckOwnerEntityId,
                involvedEntities: [deathCheckOwnerEntityId],
                contextualData: { totalDamage },
              });

              logger?.debug(`APPLY_DAMAGE: Dispatched composed narrative: "${composedNarrative}"`);
            } else {
              const errorMsg = `APPLY_DAMAGE: Cannot dispatch perceptible event - no location found for target ${deathCheckOwnerEntityId} or actor ${actorId}`;
              logger?.error(errorMsg);
              safeDispatchError(
                this.#dispatcher,
                errorMsg,
                {
                  targetEntityId: deathCheckOwnerEntityId,
                  actorId,
                  composedNarrative,
                  totalDamage,
                },
                logger
              );
            }
          } else {
            logger?.warn(
              `APPLY_DAMAGE: Composer returned empty narrative for ${entries.length} entries`
            );
          }
        }

        for (const { eventType, payload } of pendingEvents) {
          this.#dispatcher.dispatch(eventType, payload);
        }

        delete executionContext.damageSession;
      }

      if (deathEvaluation.shouldFinalize) {
        this.#deathCheckService.finalizeDeathFromEvaluation(deathEvaluation);
      }
    }
  }

  #getEntityName(entityId) {
    try {
      const nameData = this.#entityManager.getComponentData(entityId, NAME_COMPONENT_ID);
      return nameData?.text || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  #getEntityPronoun(entityId) {
    try {
      const genderData = this.#entityManager.getComponentData(entityId, GENDER_COMPONENT_ID);
      const gender = genderData?.value || 'neutral';
      return PRONOUN_MAP[gender] || PRONOUN_MAP.neutral;
    } catch {
      return PRONOUN_MAP.neutral;
    }
  }

  #getEntityPossessive(entityId) {
    try {
      const genderData = this.#entityManager.getComponentData(entityId, GENDER_COMPONENT_ID);
      const gender = genderData?.value || 'neutral';
      return PRONOUN_POSSESSIVE_MAP[gender] || PRONOUN_POSSESSIVE_MAP.neutral;
    } catch {
      return PRONOUN_POSSESSIVE_MAP.neutral;
    }
  }

  #getPartInfo(partId) {
    try {
      const partData = this.#entityManager.getComponentData(partId, PART_COMPONENT_ID);
      return {
        partType: partData?.subType || 'body part',
        orientation: partData?.orientation || null,
      };
    } catch {
      return { partType: 'body part', orientation: null };
    }
  }

  #getEntityLocation(entityId) {
    try {
      const locationData = this.#entityManager.getComponentData(entityId, POSITION_COMPONENT_ID);
      return locationData?.locationId || null;
    } catch {
      return null;
    }
  }

  #extractActorId(executionContext) {
    return executionContext?.actor?.id || executionContext?.actorId || null;
  }

  #resolveLocationForEvent(targetEntityId, actorId, log) {
    let locationId = this.#getEntityLocation(targetEntityId);
    if (locationId) return locationId;

    if (actorId) {
      locationId = this.#getEntityLocation(actorId);
      if (locationId) {
        log?.warn(
          `APPLY_DAMAGE: Target entity ${targetEntityId} has no location, using actor's location`
        );
        return locationId;
      }
    }

    return null;
  }

  async #propagateDamage({
    entityId,
    parentPartId,
    damageAmount,
    damageType,
    propagationRules,
    executionContext,
    applyDamage,
    rng,
  }) {
    const propagationResults = this.#damagePropagationService.propagateDamage(
      parentPartId,
      damageAmount,
      damageType,
      entityId,
      propagationRules,
      rng
    );

    for (const result of propagationResults) {
      await applyDamage(
        {
          entity_ref: entityId,
          part_ref: result.childPartId,
          damage_entry: {
            name: result.damageTypeId,
            amount: result.damageApplied,
          },
          propagatedFrom: parentPartId,
        },
        executionContext
      );
    }
  }
}

export default DamageResolutionService;
