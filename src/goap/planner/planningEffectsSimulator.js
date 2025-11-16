/**
 * @file Planning Effects Simulator
 * Pure state transformation service for GOAP planning that predicts task effects
 * without executing operation handlers or triggering side effects.
 * This simulator enables the GOAP planner to perform fast state prediction during
 * A* search by directly manipulating symbolic state keys rather than invoking
 * operation handlers (which have side effects and are slow).
 * Key Characteristics:
 * - Immutable: Never mutates input state, always returns new instance
 * - Pure: No side effects, no event dispatching, no validation
 * - Fast: Direct state manipulation for efficient A* search
 * - Graceful: Returns original state on failure, never throws
 * @see src/goap/planner/planningNode.js - State format definition
 * @see data/schemas/task.schema.json - Planning effects structure
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';

/**
 * Planning Effects Simulator
 *
 * Simulates the effects of task operations on symbolic planning state without
 * executing actual operation handlers or triggering side effects.
 *
 * @example
 * const simulator = new PlanningEffectsSimulator({
 *   parameterResolutionService,
 *   contextAssemblyService,
 *   logger
 * });
 *
 * const result = simulator.simulateEffects(
 *   currentState,
 *   task.planningEffects,
 *   context
 * );
 *
 * if (result.success) {
 *   // Use result.state for planning
 * }
 */
class PlanningEffectsSimulator {
  #parameterResolutionService;
  // Note: contextAssemblyService reserved for future planner integration
  // eslint-disable-next-line no-unused-private-class-members
  #contextAssemblyService;
  #logger;

  /**
   * Supported operation types for effect simulation
   */
  static OPERATION_TYPES = {
    ADD_COMPONENT: 'ADD_COMPONENT',
    MODIFY_COMPONENT: 'MODIFY_COMPONENT',
    REMOVE_COMPONENT: 'REMOVE_COMPONENT',
  };

  /**
   * Supported modification modes for MODIFY_COMPONENT operations
   */
  static MODIFICATION_MODES = {
    SET: 'set',
    INCREMENT: 'increment',
    DECREMENT: 'decrement',
  };

  /**
   * Create a Planning Effects Simulator
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.parameterResolutionService - Parameter resolution service
   * @param {object} dependencies.contextAssemblyService - Context assembly service
   * @param {object} dependencies.logger - Logger service
   */
  constructor({ parameterResolutionService, contextAssemblyService, logger }) {
    validateDependency(
      parameterResolutionService,
      'IParameterResolutionService',
      logger,
      {
        requiredMethods: ['resolve', 'clearCache'],
      }
    );

    validateDependency(
      contextAssemblyService,
      'IContextAssemblyService',
      logger,
      {
        requiredMethods: ['assemblePlanningContext'],
      }
    );

    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#parameterResolutionService = parameterResolutionService;
    this.#contextAssemblyService = contextAssemblyService;
    this.#logger = logger;

    this.#logger.debug('PlanningEffectsSimulator initialized');
  }

  /**
   * Validate that modification values are numeric and not NaN/Infinity
   * This helper ensures type safety for MODIFY_COMPONENT operations during planning.
   *
   * @private
   * @param {number|string|boolean|object|null|undefined} value - Value to validate
   * @param {string} componentType - Component type being modified
   * @param {string} entityId - Entity ID for error reporting
   * @param {string} field - Field name for error reporting
   * @returns {boolean} True if value is valid numeric, false otherwise
   */
  #validateModificationTypes(value, componentType, entityId, field) {
    // Check if value is a number
    if (typeof value !== 'number') {
      this.#logger.warn(
        `MODIFY_COMPONENT type validation failed: value is not a number`,
        {
          entityId,
          componentType,
          field,
          valueType: typeof value,
          value,
        }
      );
      return false;
    }

    // Check for NaN
    if (Number.isNaN(value)) {
      this.#logger.warn(
        `MODIFY_COMPONENT type validation failed: value is NaN`,
        {
          entityId,
          componentType,
          field,
        }
      );
      return false;
    }

    // Check for Infinity
    if (!Number.isFinite(value)) {
      this.#logger.warn(
        `MODIFY_COMPONENT type validation failed: value is Infinity`,
        {
          entityId,
          componentType,
          field,
          value,
        }
      );
      return false;
    }

    return true;
  }

  /**
   * Safely apply a numeric modification with overflow/underflow detection
   * Returns null if the modification would result in overflow, underflow, or NaN.
   *
   * @private
   * @param {number} currentValue - Current field value
   * @param {number} modValue - Modification value
   * @param {string} mode - Modification mode (set, increment, decrement)
   * @param {string} fieldName - Field name for logging
   * @returns {number|null} New value or null if modification failed
   */
  #applyModification(currentValue, modValue, mode, fieldName) {
    let result;

    switch (mode) {
      case PlanningEffectsSimulator.MODIFICATION_MODES.SET:
        // For set mode, the modValue becomes the new value directly
        // No numeric validation needed - SET can accept any type
        return modValue;

      case PlanningEffectsSimulator.MODIFICATION_MODES.INCREMENT: {
        // Default to 0 if current value is missing or non-numeric
        const currentIncrement = typeof currentValue === 'number' ? currentValue : 0;
        result = currentIncrement + modValue;
        break;
      }

      case PlanningEffectsSimulator.MODIFICATION_MODES.DECREMENT: {
        // Default to 0 if current value is missing or non-numeric
        const currentDecrement = typeof currentValue === 'number' ? currentValue : 0;
        result = currentDecrement - modValue;
        break;
      }

      default:
        this.#logger.warn(
          `Unknown modification mode: ${mode}, field: ${fieldName}`
        );
        return null;
    }

    // Numeric validation checks (only for increment/decrement modes)
    // Check for NaN result
    if (Number.isNaN(result)) {
      this.#logger.warn(
        `Modification resulted in NaN, skipping modification`,
        {
          field: fieldName,
          mode,
          currentValue,
          modValue,
        }
      );
      return null;
    }

    // Check for overflow (beyond safe integer range)
    if (result > Number.MAX_SAFE_INTEGER) {
      this.#logger.warn(
        `Modification would overflow safe integer range, skipping modification`,
        {
          field: fieldName,
          mode,
          currentValue,
          modValue,
          result,
          max: Number.MAX_SAFE_INTEGER,
        }
      );
      return null;
    }

    // Check for underflow (below safe integer range)
    if (result < Number.MIN_SAFE_INTEGER) {
      this.#logger.warn(
        `Modification would underflow safe integer range, skipping modification`,
        {
          field: fieldName,
          mode,
          currentValue,
          modValue,
          result,
          min: Number.MIN_SAFE_INTEGER,
        }
      );
      return null;
    }

    // Check for Infinity
    if (!Number.isFinite(result)) {
      this.#logger.warn(
        `Modification resulted in Infinity, skipping modification`,
        {
          field: fieldName,
          mode,
          currentValue,
          modValue,
          result,
        }
      );
      return null;
    }

    return result;
  }

  /**
   * Simulate the effects of planning operations on a state snapshot
   * This method creates a new state by applying planning effects to a cloned
   * copy of the input state. The original state is never modified.
   * State Format:
   * - Simple component: "entityId:componentId" → {} or boolean
   * - Component field: "entityId:componentId:field" → value
   *
   * @param {object} currentState - Current symbolic planning state (key-value pairs)
   * @param {Array} planningEffects - Array of planning effect operations to apply
   * @param {object} context - Planning context for parameter resolution
   * @returns {{state: object, success: boolean, error?: string}} Simulation result
   * @example
   * const result = simulator.simulateEffects(
   *   { "entity-1:core:hungry": true },
   *   [
   *     {
   *       type: "REMOVE_COMPONENT",
   *       parameters: { entity_ref: "actor", component_type: "core:hungry" }
   *     },
   *     {
   *       type: "ADD_COMPONENT",
   *       parameters: {
   *         entity_ref: "actor",
   *         component_type: "core:satiated",
   *         value: {}
   *       }
   *     }
   *   ],
   *   { actor: "entity-1" }
   * );
   * // result.state = { "entity-1:core:satiated": {} }
   */
  simulateEffects(currentState, planningEffects, context) {
    // Validate inputs
    if (!currentState || typeof currentState !== 'object') {
      const error = 'Invalid currentState: must be an object';
      this.#logger.error(error);
      return { state: currentState, success: false, error };
    }

    if (!Array.isArray(planningEffects)) {
      const error = 'Invalid planningEffects: must be an array';
      this.#logger.error(error);
      return { state: currentState, success: false, error };
    }

    if (!context || typeof context !== 'object') {
      const error = 'Invalid context: must be an object';
      this.#logger.error(error);
      return { state: currentState, success: false, error };
    }

    try {
      // CRITICAL: Deep clone to ensure immutability
      const newState = deepClone(currentState);

      this.#logger.debug(
        `Simulating ${planningEffects.length} planning effects`,
        {
          effectTypes: planningEffects.map((e) => e.type),
        }
      );

      // Apply each planning effect in order
      for (let i = 0; i < planningEffects.length; i++) {
        const effect = planningEffects[i];

        try {
          // Resolve effect parameters (may contain references like "actor", "task.params.item")
          const resolvedParameters = this.#resolveEffectParameters(
            effect,
            context
          );

          // Apply the effect directly to the state (no handler invocation)
          this.#simulateOperationEffect(
            effect.type,
            resolvedParameters,
            newState
          );

          this.#logger.debug(`Effect ${i + 1}/${planningEffects.length} applied`, {
            type: effect.type,
            entity: resolvedParameters.entityId,
            component: resolvedParameters.componentType,
          });
        } catch (err) {
          // Log warning but continue with remaining effects
          this.#logger.warn(
            `Failed to simulate effect ${i + 1}/${planningEffects.length}: ${effect.type}`,
            {
              error: err.message,
              effect,
            }
          );

          // On critical failure, return original state
          if (err.message.includes('Critical')) {
            return {
              state: currentState,
              success: false,
              error: `Critical failure: ${err.message}`,
            };
          }
        }
      }

      return { state: newState, success: true };
    } catch (err) {
      this.#logger.error('Effects simulation failed catastrophically', err);
      return {
        state: currentState,
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Resolve planning effect parameters
   * Converts parameter references (like "actor", "task.params.item") to actual values
   * using the parameter resolution service.
   *
   * @private
   * @param {object} effect - Planning effect with parameters
   * @param {object} context - Planning context for resolution
   * @returns {object} Resolved parameters with entityId, componentType, etc.
   * @throws {Error} If critical parameter resolution fails
   */
  #resolveEffectParameters(effect, context) {
    if (!effect.parameters) {
      throw new Error('Critical: Effect missing parameters');
    }

    const { type, parameters } = effect;
    const resolved = {};

    // Resolve entity reference (supports both entity_ref and entityId for backwards compatibility)
    const entityRef = parameters.entity_ref || parameters.entityId;
    if (!entityRef) {
      throw new Error(`Critical: ${type} effect missing entity_ref or entityId parameter`);
    }

    // Preserve original entity reference for dual-format state sync
    resolved.entityRef = entityRef;

    try {
      // Check if entityRef is a variable reference (contains dot or is a known variable)
      // Otherwise treat as literal entity ID (for testing and direct entity references)
      const isReference = entityRef.includes('.') || context[entityRef] !== undefined;

      resolved.entityId = isReference
        ? this.#parameterResolutionService.resolve(
            entityRef,
            context,
            { validateEntity: true, contextType: 'planning' }
          )
        : entityRef; // Use literal entity ID directly
    } catch (err) {
      throw new Error(
        `Critical: Failed to resolve entity reference "${entityRef}": ${err.message}`
      );
    }

    // Resolve component type (supports both component_type and componentId for backwards compatibility)
    const componentType = parameters.component_type || parameters.componentId;
    if (!componentType) {
      throw new Error(
        `Critical: ${type} effect missing component_type or componentId parameter`
      );
    }

    // Component type is usually literal, but could be a reference
    resolved.componentType = componentType.includes('.')
      ? this.#parameterResolutionService.resolve(
          componentType,
          context
        )
      : componentType;

    // Resolve operation-specific parameters
    switch (type) {
      case PlanningEffectsSimulator.OPERATION_TYPES.ADD_COMPONENT:
        // Value can be object, boolean, or reference
        resolved.value =
          typeof parameters.value === 'string' &&
          parameters.value.includes('.')
            ? this.#parameterResolutionService.resolve(parameters.value, context)
            : parameters.value !== undefined
              ? parameters.value
              : {};
        break;

      case PlanningEffectsSimulator.OPERATION_TYPES.MODIFY_COMPONENT:
        // Field is usually literal
        resolved.field = parameters.field;

        // Mode defaults to 'set'
        resolved.mode = parameters.mode || 'set';

        // Value can be literal or reference
        resolved.value =
          typeof parameters.value === 'string' &&
          parameters.value.includes('.')
            ? this.#parameterResolutionService.resolve(parameters.value, context)
            : parameters.value;

        // Type validation: Ensure modification value is numeric for increment/decrement modes
        // SET mode can accept any type, but increment/decrement require numeric values
        if (
          (resolved.mode === 'increment' || resolved.mode === 'decrement') &&
          !this.#validateModificationTypes(
            resolved.value,
            resolved.componentType,
            resolved.entityId,
            resolved.field
          )
        ) {
          throw new Error(
            `Critical: MODIFY_COMPONENT type validation failed: ${resolved.mode} mode requires numeric value (got ${typeof resolved.value})`
          );
        }
        break;

      case PlanningEffectsSimulator.OPERATION_TYPES.REMOVE_COMPONENT:
        // No additional parameters needed
        break;

      default:
        throw new Error(`Critical: Unknown operation type: ${type}`);
    }

    return resolved;
  }

  /**
   * Synchronizes dual-format state after modifying flat hash format.
   * For numeric goal planning, state must maintain three formats:
   * - Flat hash: entityId:componentType -> component data (for operations)
   * - Nested: state[entityRef].components[componentType] -> component data (for JSON Logic)
   * - Flattened alias: state[entityRef].components[componentType_flattened] -> component data (for JSON Logic paths)
   *
   * The flattened alias replaces colons with underscores to make component IDs JSON Logic-compatible.
   * For example, 'core:needs' becomes 'core_needs', allowing paths like 'state.actor.components.core_needs.hunger'
   * instead of the unparseable 'state.actor.components.core:needs.hunger'.
   *
   * @private
   * @param {object} state - State object with dual format
   * @param {string} entityId - Resolved entity ID (for flat hash key)
   * @param {string} entityRef - Original entity reference (for nested state key)
   * @param {string} componentType - Component type
   */
  #syncDualFormat(state, entityId, entityRef, componentType) {
    const flatKey = `${entityId}:${componentType}`;

    // Check if nested format exists (state[entityRef].components)
    // Use entityRef (e.g., 'actor') not entityId (e.g., 'test_actor')
    if (state[entityRef] && state[entityRef].components) {
      // Sync flat hash value to nested format (with original colon-based key)
      state[entityRef].components[componentType] = state[flatKey];

      // Also create flattened alias (replace colons with underscores for JSON Logic)
      const flattenedComponentType = componentType.replace(/:/g, '_');
      state[entityRef].components[flattenedComponentType] = state[flatKey];

      this.#logger.debug(
        `Synced dual format: ${flatKey} -> ${entityRef}.components.${componentType} + ${flattenedComponentType}`,
        {
          flatValue: state[flatKey],
          nestedValue: state[entityRef].components[componentType],
          flattenedValue: state[entityRef].components[flattenedComponentType],
          areEqual: state[flatKey] === state[entityRef].components[componentType]
        }
      );
    } else {
      this.#logger.debug(
        `Dual format sync skipped: nested structure missing for ${entityRef}`
      );
    }
  }

  /**
   * Simulate an operation effect by directly manipulating state
   * This method performs direct state key manipulation rather than invoking
   * operation handlers, enabling fast state prediction for planning.
   * IMPORTANT: The state parameter is mutated directly (it's already a clone)
   *
   * @private
   * @param {string} operationType - Type of operation (ADD_COMPONENT, MODIFY_COMPONENT, REMOVE_COMPONENT)
   * @param {object} parameters - Resolved parameters (entityId, componentType, etc.)
   * @param {object} state - State to mutate (already a clone, safe to modify)
   * @throws {Error} If operation type is unknown or parameters are invalid
   */
  #simulateOperationEffect(operationType, parameters, state) {
    const { entityId, componentType } = parameters;

    switch (operationType) {
      case PlanningEffectsSimulator.OPERATION_TYPES.ADD_COMPONENT: {
        // State key format: "entityId:componentId"
        const stateKey = `${entityId}:${componentType}`;
        state[stateKey] = parameters.value;

        // Sync to nested format for JSON Logic evaluation
        this.#syncDualFormat(state, entityId, parameters.entityRef, componentType);

        this.#logger.debug(`Simulated ADD_COMPONENT: ${stateKey}`, {
          value: parameters.value,
        });
        break;
      }

      case PlanningEffectsSimulator.OPERATION_TYPES.MODIFY_COMPONENT: {
        const { field, mode, value } = parameters;

        if (!field) {
          throw new Error('MODIFY_COMPONENT requires field parameter');
        }

        // State key format:
        // - "entityId:componentId" for component objects
        // - "entityId:componentId:field" for direct field access (less common)
        const baseKey = `${entityId}:${componentType}`;
        const fieldKey = `${baseKey}:${field}`;

        // Determine modification strategy:
        // 1. If nested field key exists explicitly in state, use it
        // 2. If component exists as object, modify object property
        // 3. Otherwise, create new component object with field
        const hasNestedFieldKey = state[fieldKey] !== undefined;

        if (hasNestedFieldKey) {
          // Direct nested field modification (rare case)
          const newValue = this.#applyModification(
            state[fieldKey],
            value,
            mode,
            fieldKey
          );

          // Skip modification if it would result in overflow/underflow/NaN
          if (newValue === null) {
            this.#logger.warn(
              `Skipping MODIFY_COMPONENT for ${fieldKey} due to invalid result`
            );
            break;
          }

          state[fieldKey] = newValue;

          this.#logger.debug(`Simulated MODIFY_COMPONENT: ${fieldKey}`, {
            mode,
            value,
            result: state[fieldKey],
          });
        } else {
          // Component object modification (common case)
          if (!state[baseKey]) {
            state[baseKey] = {};
          }

          if (typeof state[baseKey] !== 'object') {
            throw new Error(
              `Cannot modify field of non-object component: ${baseKey}`
            );
          }

          // Apply modification safely
          const currentFieldValue = state[baseKey][field];
          const newValue = this.#applyModification(
            currentFieldValue,
            value,
            mode,
            `${baseKey}.${field}`
          );

          // Skip modification if it would result in overflow/underflow/NaN
          if (newValue === null) {
            this.#logger.warn(
              `Skipping MODIFY_COMPONENT for ${baseKey}.${field} due to invalid result`
            );
            break;
          }

          // Apply the new value
          state[baseKey] = { ...state[baseKey], [field]: newValue };

          // Sync to nested format for JSON Logic evaluation
          this.#syncDualFormat(state, entityId, parameters.entityRef, componentType);

          this.#logger.debug(`Simulated MODIFY_COMPONENT: ${baseKey}.${field}`, {
            mode,
            value,
            result: state[baseKey][field],
          });
        }
        break;
      }

      case PlanningEffectsSimulator.OPERATION_TYPES.REMOVE_COMPONENT: {
        // State key format: "entityId:componentId"
        const stateKey = `${entityId}:${componentType}`;

        // Remove the component (and any nested fields)
        delete state[stateKey];

        // Also remove any nested field keys that belong to this component
        const nestedPrefix = `${stateKey}:`;
        for (const key of Object.keys(state)) {
          if (key.startsWith(nestedPrefix)) {
            delete state[key];
          }
        }

        // Remove from nested format as well
        if (state[entityId] && state[entityId].components) {
          delete state[entityId].components[componentType];
        }

        this.#logger.debug(`Simulated REMOVE_COMPONENT: ${stateKey}`);
        break;
      }

      default:
        throw new Error(`Critical: Unknown operation type: ${operationType}`);
    }
  }
}

export default PlanningEffectsSimulator;
