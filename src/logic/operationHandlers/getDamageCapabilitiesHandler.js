/**
 * @file Handler for GET_DAMAGE_CAPABILITIES operation
 *
 * Retrieves damage capabilities from an entity and stores them in a context variable.
 * If the entity has no damage_capabilities component, generates blunt damage from weight.
 *
 * Operation flow:
 * 1. Validates operation parameters (entity_ref, output_variable)
 * 2. Resolves entity reference to entity ID
 * 3. Checks for damage-types:damage_capabilities component
 * 4. If present: stores entries array in output_variable
 * 5. If absent: generates blunt damage from core:weight component
 * 6. If no weight: generates minimal fallback entry
 *
 * Related files:
 * @see data/schemas/operations/getDamageCapabilities.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - GetDamageCapabilitiesHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments ComponentOperationHandler
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import ComponentOperationHandler from './componentOperationHandler.js';
import { writeContextVariable } from '../../utils/contextVariableUtils.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';

/**
 * @typedef {object} DamageCapabilityEntry
 * @property {string} name - Damage type name (e.g., 'blunt', 'slashing')
 * @property {number} amount - Base damage amount
 * @property {number} [penetration] - Penetration value
 * @property {object} [fracture] - Fracture configuration
 * @property {boolean} [fracture.enabled] - Whether fracture is enabled
 * @property {number} [fracture.thresholdFraction] - Threshold fraction for fracture
 * @property {number} [fracture.stunChance] - Chance to stun on fracture
 * @property {string[]} [flags] - Damage flags (e.g., 'improvised')
 */

/**
 * @typedef {object} GetDamageCapabilitiesParams
 * @property {'actor' | 'target' | 'primary' | 'secondary' | 'tertiary' | string | object} entity_ref - Reference to the entity
 * @property {string} output_variable - Variable name to store the damage capabilities array
 */

const DAMAGE_CAPABILITIES_COMPONENT = 'damage-types:damage_capabilities';
const WEIGHT_COMPONENT = 'core:weight';
const MIN_DAMAGE = 1;
const MAX_DAMAGE = 50;
const DAMAGE_MULTIPLIER = 5;
const FRACTURE_WEIGHT_THRESHOLD = 1.0;

/**
 * Calculate blunt damage from weight.
 * Formula: Math.ceil(weightKg * 5), clamped between 1 and 50.
 *
 * @param {number} weightKg - Weight in kilograms
 * @returns {number} Calculated damage value
 */
function calculateBluntDamage(weightKg) {
  const baseDamage = Math.ceil(weightKg * DAMAGE_MULTIPLIER);
  return Math.max(MIN_DAMAGE, Math.min(MAX_DAMAGE, baseDamage));
}

/**
 * Calculate fracture configuration from weight.
 * Objects >= 1kg can cause fractures.
 *
 * @param {number} weightKg - Weight in kilograms
 * @returns {{ enabled: boolean, thresholdFraction?: number, stunChance?: number }}
 */
function calculateFracture(weightKg) {
  if (weightKg < FRACTURE_WEIGHT_THRESHOLD) {
    return { enabled: false };
  }
  return {
    enabled: true,
    thresholdFraction: Math.max(0.3, 1.0 - weightKg * 0.1),
    stunChance: Math.min(0.5, weightKg * 0.05),
  };
}

/**
 * Generate a damage capability entry from weight.
 *
 * @param {number} weightKg - Weight in kilograms
 * @returns {DamageCapabilityEntry}
 */
function generateDamageEntryFromWeight(weightKg) {
  return {
    name: 'blunt',
    amount: calculateBluntDamage(weightKg),
    penetration: 0,
    fracture: calculateFracture(weightKg),
    flags: ['improvised'],
  };
}

/**
 * Generate a minimal fallback damage entry for weightless entities.
 *
 * @returns {DamageCapabilityEntry}
 */
function generateFallbackDamageEntry() {
  return {
    name: 'blunt',
    amount: MIN_DAMAGE,
    penetration: 0,
    fracture: { enabled: false },
    flags: ['improvised', 'weightless'],
  };
}

/**
 * Handler for GET_DAMAGE_CAPABILITIES operation.
 * Retrieves existing damage capabilities or generates blunt damage from weight.
 *
 * @implements {OperationHandler}
 */
class GetDamageCapabilitiesHandler extends ComponentOperationHandler {
  #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;
  /** @type {JsonLogicEvaluationService} */
  #jsonLogicService;

  /**
   * @param {object} deps - Dependencies object
   * @param {EntityManager} deps.entityManager - Entity manager for component access
   * @param {ILogger} deps.logger - Logger instance
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher
   * @param {JsonLogicEvaluationService} deps.jsonLogicService - JSON Logic evaluation service
   */
  constructor({
    entityManager,
    logger,
    safeEventDispatcher,
    jsonLogicService,
  }) {
    super('GetDamageCapabilitiesHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      jsonLogicService: {
        value: jsonLogicService,
        requiredMethods: ['evaluate'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#jsonLogicService = jsonLogicService;
  }

  /**
   * Resolve entity reference with support for keywords, placeholders, and JSON Logic.
   *
   * @param {string|object} ref - The entity reference to resolve
   * @param {ExecutionContext} context - The execution context
   * @param {ILogger} logger - Logger instance
   * @returns {string|null} - Resolved entity ID or null
   * @private
   */
  #resolveEntityRef(ref, context, logger) {
    // First try resolveEntityId for placeholder/keyword support
    const resolvedId = resolveEntityId(ref, context);
    if (resolvedId) return resolvedId;

    // Fall back to JSON Logic evaluation for object refs
    if (typeof ref === 'object' && ref !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(ref, context);
        if (typeof resolved === 'string' && resolved.trim())
          return resolved.trim();
        if (typeof resolved === 'object' && resolved !== null) {
          const id = resolved.id || resolved.entityId;
          if (typeof id === 'string' && id.trim()) return id.trim();
        }
      } catch (err) {
        logger.warn('GET_DAMAGE_CAPABILITIES: Failed to evaluate entity ref', {
          error: err.message,
        });
      }
    }
    return null;
  }

  /**
   * Validate parameters and context.
   *
   * @param {GetDamageCapabilitiesParams} params - Raw parameters object
   * @param {ExecutionContext} executionContext - Current execution context
   * @param {ILogger} logger - Logger for diagnostics
   * @returns {{ entityId: string, outputVariable: string } | null}
   * @private
   */
  #validateParams(params, executionContext, logger) {
    if (
      !assertParamsObject(
        params,
        this.#dispatcher,
        'GetDamageCapabilitiesHandler'
      )
    ) {
      return null;
    }

    if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
      return null;
    }

    const { entity_ref, output_variable } = params;

    // Use custom resolution that supports JSON Logic expressions
    const entityId = this.#resolveEntityRef(
      entity_ref,
      executionContext,
      logger
    );

    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        'GET_DAMAGE_CAPABILITIES: Could not resolve entity id from entity_ref.',
        { params }
      );
      return null;
    }

    if (typeof output_variable !== 'string' || !output_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'GetDamageCapabilitiesHandler: Missing or invalid required "output_variable" parameter (must be non-empty string).',
        { params }
      );
      return null;
    }

    return {
      entityId,
      outputVariable: output_variable.trim(),
    };
  }

  /**
   * Get damage capabilities from entity or generate from weight.
   *
   * @param {string} entityId - Entity identifier
   * @param {ILogger} logger - Logger for diagnostics
   * @returns {DamageCapabilityEntry[]} Damage capability entries
   * @private
   */
  #getDamageCapabilities(entityId, logger) {
    // Check for existing damage capabilities
    const damageCapabilities = this.#entityManager.getComponentData(
      entityId,
      DAMAGE_CAPABILITIES_COMPONENT
    );

    if (damageCapabilities && damageCapabilities.entries) {
      logger.debug(
        `GetDamageCapabilitiesHandler: Found existing damage capabilities on entity "${entityId}".`
      );
      return damageCapabilities.entries;
    }

    // Generate from weight
    const weightComponent = this.#entityManager.getComponentData(
      entityId,
      WEIGHT_COMPONENT
    );

    if (weightComponent && typeof weightComponent.weight === 'number') {
      const entry = generateDamageEntryFromWeight(weightComponent.weight);
      logger.debug(
        `GetDamageCapabilitiesHandler: Generated blunt damage (${entry.amount}) from weight (${weightComponent.weight}kg) for entity "${entityId}".`
      );
      return [entry];
    }

    // Fallback for weightless entities
    logger.warn(
      `GetDamageCapabilitiesHandler: Entity "${entityId}" has neither damage capabilities nor weight. Using minimal fallback.`
    );
    return [generateFallbackDamageEntry()];
  }

  /**
   * Execute the GET_DAMAGE_CAPABILITIES operation.
   *
   * @param {GetDamageCapabilitiesParams} params - Operation parameters
   * @param {ExecutionContext} executionContext - Current execution context
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    const validated = this.#validateParams(params, executionContext, logger);
    if (!validated) return;

    const { entityId, outputVariable } = validated;

    try {
      const damageEntries = this.#getDamageCapabilities(entityId, logger);

      writeContextVariable(
        outputVariable,
        damageEntries,
        executionContext,
        this.#dispatcher,
        logger
      );

      logger.debug(
        `GetDamageCapabilitiesHandler: Stored ${damageEntries.length} damage entries in "${outputVariable}".`
      );
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        `GetDamageCapabilitiesHandler: Error retrieving damage capabilities for entity "${entityId}".`,
        {
          error: error.message,
          stack: error.stack,
          params,
        }
      );
    }
  }
}

export default GetDamageCapabilitiesHandler;
