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

    // Resolve entity_ref (required for all operations)
    if (!parameters.entity_ref) {
      throw new Error(`Critical: ${type} effect missing entity_ref parameter`);
    }

    try {
      resolved.entityId = this.#parameterResolutionService.resolve(
        parameters.entity_ref,
        context,
        { validateEntity: true, contextType: 'planning' }
      );
    } catch (err) {
      throw new Error(
        `Critical: Failed to resolve entity_ref "${parameters.entity_ref}": ${err.message}`
      );
    }

    // Resolve component_type (required for all operations)
    if (!parameters.component_type) {
      throw new Error(
        `Critical: ${type} effect missing component_type parameter`
      );
    }

    // Component type is usually literal, but could be a reference
    resolved.componentType = parameters.component_type.includes('.')
      ? this.#parameterResolutionService.resolve(
          parameters.component_type,
          context
        )
      : parameters.component_type;

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
        const hasComponentObject =
          state[baseKey] !== undefined && typeof state[baseKey] === 'object';

        if (hasNestedFieldKey) {
          // Direct nested field modification (rare case)
          switch (mode) {
            case PlanningEffectsSimulator.MODIFICATION_MODES.SET:
              state[fieldKey] = value;
              break;

            case PlanningEffectsSimulator.MODIFICATION_MODES.INCREMENT:
              state[fieldKey] = (state[fieldKey] || 0) + value;
              break;

            case PlanningEffectsSimulator.MODIFICATION_MODES.DECREMENT:
              state[fieldKey] = (state[fieldKey] || 0) - value;
              break;

            default:
              throw new Error(`Unknown modification mode: ${mode}`);
          }

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

          switch (mode) {
            case PlanningEffectsSimulator.MODIFICATION_MODES.SET:
              state[baseKey] = { ...state[baseKey], [field]: value };
              break;

            case PlanningEffectsSimulator.MODIFICATION_MODES.INCREMENT:
              state[baseKey] = {
                ...state[baseKey],
                [field]: (state[baseKey][field] || 0) + value,
              };
              break;

            case PlanningEffectsSimulator.MODIFICATION_MODES.DECREMENT:
              state[baseKey] = {
                ...state[baseKey],
                [field]: (state[baseKey][field] || 0) - value,
              };
              break;

            default:
              throw new Error(`Unknown modification mode: ${mode}`);
          }

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

        this.#logger.debug(`Simulated REMOVE_COMPONENT: ${stateKey}`);
        break;
      }

      default:
        throw new Error(`Critical: Unknown operation type: ${operationType}`);
    }
  }
}

export default PlanningEffectsSimulator;
