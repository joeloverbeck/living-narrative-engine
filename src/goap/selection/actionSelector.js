/**
 * @file Action selector for GOAP planning
 * Selects actions that move toward goals using greedy selection
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Selects best action to move toward goal (greedy)
 */
class ActionSelector {
  #logger;
  #goalStateEvaluator;
  #abstractPreconditionSimulator;

  /**
   * Creates a new ActionSelector instance
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   * @param {object} params.goalStateEvaluator - Goal state evaluator
   * @param {object} params.entityManager - Entity manager (validated but not stored)
   * @param {object} params.abstractPreconditionSimulator - Simulator for abstract preconditions
   */
  constructor({
    logger,
    goalStateEvaluator,
    entityManager,
    abstractPreconditionSimulator
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(goalStateEvaluator, 'IGoalStateEvaluator', logger, {
      requiredMethods: ['evaluate', 'calculateDistance']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getComponentData']
    });
    validateDependency(abstractPreconditionSimulator, 'IAbstractPreconditionSimulator', logger, {
      requiredMethods: ['simulate']
    });

    this.#logger = logger;
    this.#goalStateEvaluator = goalStateEvaluator;
    this.#abstractPreconditionSimulator = abstractPreconditionSimulator;
  }

  /**
   * Selects best action to move toward goal
   *
   * @param {Array<object>} availableActions - Actions from action discovery
   * @param {object} goal - Selected goal
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context (built by caller from EntityManager)
   *   Expected structure:
   *   {
   *     entities: { [entityId]: { components: { [componentId]: data } } },
   *     targetId: optional target entity ID,
   *     tertiaryTargetId: optional tertiary target entity ID
   *   }
   * @returns {object|null} Selected action or null
   */
  selectAction(availableActions, goal, actorId, context) {
    assertPresent(availableActions, 'Available actions required');
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'selectAction', this.#logger);

    this.#logger.debug(`Selecting action for goal ${goal.id} (${availableActions.length} actions available)`);

    try {
      // Step 1: Filter to actions with planning effects
      const plannable = availableActions.filter(a => a.planningEffects);

      if (plannable.length === 0) {
        this.#logger.debug('No plannable actions available');
        return null;
      }

      this.#logger.debug(`${plannable.length} plannable actions found`);

      // Step 2: Calculate progress score for each action
      const scored = plannable.map(action => {
        const score = this.calculateProgress(action, goal, actorId, context);
        return { action, score };
      });

      // Filter out actions with negative or zero progress
      const positive = scored.filter(s => s.score > 0);

      if (positive.length === 0) {
        this.#logger.debug('No actions with positive progress');
        return null;
      }

      // Step 3: Sort by score (descending)
      positive.sort((a, b) => b.score - a.score);

      // Step 4: Return best action
      const selected = positive[0].action;
      this.#logger.info(
        `Selected action ${selected.id} with progress score ${positive[0].score.toFixed(2)}`
      );

      return selected;
    } catch (error) {
      this.#logger.error('Failed to select action', error);
      return null;
    }
  }

  /**
   * Calculates how much an action progresses toward goal
   *
   * @param {object} action - Action with planningEffects
   * @param {object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {object} context - World state context
   * @returns {number} Progress score (higher = better)
   */
  calculateProgress(action, goal, actorId, context) {
    assertPresent(action, 'Action is required');
    assertPresent(goal, 'Goal is required');
    string.assertNonBlank(actorId, 'actorId', 'calculateProgress', this.#logger);

    try {
      // Step 1: Get current distance to goal
      const currentDistance = this.#goalStateEvaluator.calculateDistance(
        goal.goalState,
        actorId,
        context
      );

      // Step 2: Simulate applying action effects
      const futureState = this.simulateEffects(action, actorId, context);

      // Step 3: Get future distance to goal
      const futureDistance = this.#goalStateEvaluator.calculateDistance(
        goal.goalState,
        actorId,
        futureState
      );

      // Step 4: Progress = reduction in distance
      const progress = currentDistance - futureDistance;

      this.#logger.debug(
        `Action ${action.id}: current=${currentDistance}, ` +
        `future=${futureDistance}, progress=${progress}`
      );

      return progress;
    } catch (error) {
      this.#logger.error(`Failed to calculate progress for ${action.id}`, error);
      return 0;
    }
  }

  /**
   * Simulates applying action effects to world state
   *
   * Note: The worldState object is a simulated state structure used during planning,
   * NOT direct access to EntityManager. Structure:
   * {
   *   entities: {
   *     [entityId]: {
   *       components: {
   *         [componentId]: componentData
   *       }
   *     }
   *   },
   *   targetId: string,
   *   tertiaryTargetId: string
   * }
   *
   * @param {object} action - Action with planningEffects
   * @param {string} actorId - Entity ID of actor
   * @param {object} currentState - Current world state
   * @returns {object} Simulated future state
   */
  simulateEffects(action, actorId, currentState) {
    assertPresent(action, 'Action is required');
    string.assertNonBlank(actorId, 'actorId', 'simulateEffects', this.#logger);
    assertPresent(currentState, 'Current state is required');

    if (!action.planningEffects) {
      return currentState;
    }

    try {
      // Create deep copy of current state
      const futureState = this.#cloneState(currentState);

      // Apply each effect
      for (const effect of action.planningEffects.effects) {
        this.#applyEffect(effect, actorId, futureState);
      }

      return futureState;
    } catch (error) {
      this.#logger.error(`Failed to simulate effects for ${action.id}`, error);
      return currentState;
    }
  }

  // Private helper methods

  /**
   * Deep clones world state
   *
   * @param {object} state - State to clone
   * @returns {object} Cloned state
   */
  #cloneState(state) {
    // Deep clone world state
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Applies a single effect to state
   *
   * @param {object} effect - Effect to apply
   * @param {string} actorId - Actor entity ID
   * @param {object} state - State to modify
   */
  #applyEffect(effect, actorId, state) {
    if (effect.operation === 'CONDITIONAL') {
      // Evaluate condition
      const conditionMet = this.#evaluateCondition(effect.condition, actorId, state);

      if (conditionMet) {
        // Apply then effects
        for (const thenEffect of effect.then) {
          this.#applyEffect(thenEffect, actorId, state);
        }
      } else if (effect.else) {
        // Apply else effects
        for (const elseEffect of effect.else) {
          this.#applyEffect(elseEffect, actorId, state);
        }
      }

      return;
    }

    // Resolve entity ID
    const entityId = this.#resolveEntityId(effect.entity, actorId, state);

    if (effect.operation === 'ADD_COMPONENT') {
      this.#simulateAddComponent(entityId, effect.component, effect.data || {}, state);
    } else if (effect.operation === 'REMOVE_COMPONENT') {
      this.#simulateRemoveComponent(entityId, effect.component, state);
    } else if (effect.operation === 'MODIFY_COMPONENT') {
      this.#simulateModifyComponent(entityId, effect.component, effect.updates, state);
    }
  }

  /**
   * Evaluates a condition
   *
   * @param {object} condition - Condition to evaluate
   * @param {string} actorId - Actor entity ID
   * @param {object} state - Current state
   * @returns {boolean} Whether condition is met
   */
  #evaluateCondition(condition, actorId, state) {
    // Check for abstract precondition structure
    // Format: { abstractPrecondition: "name", params: ["entity1", "entity2"] }
    if (condition.abstractPrecondition) {
      const functionName = condition.abstractPrecondition;
      const rawParams = condition.params || [];

      // Resolve entity references to actual IDs
      const resolvedParams = rawParams.map(param =>
        this.#resolveEntityId(param, actorId, state)
      );

      return this.#abstractPreconditionSimulator.simulate(
        functionName,
        resolvedParams,
        state
      );
    }

    // Fallback: basic JSON Logic evaluation
    // For Tier 1, we'll use a simple implementation
    // Tier 2+ can integrate full JSON Logic evaluator
    this.#logger.warn('Condition evaluation without abstract precondition not fully implemented');
    return true;
  }

  /**
   * Resolves entity reference to ID
   *
   * @param {string} entityRef - Entity reference (actor, target, tertiary_target, or ID)
   * @param {string} actorId - Actor entity ID
   * @param {object} state - Current state
   * @returns {string} Resolved entity ID
   */
  #resolveEntityId(entityRef, actorId, state) {
    if (entityRef === 'actor') return actorId;
    if (entityRef === 'target') return state.targetId;
    if (entityRef === 'tertiary_target') return state.tertiaryTargetId;
    return entityRef;
  }

  /**
   * Simulates adding a component
   *
   * @param {string} entityId - Entity ID
   * @param {string} componentId - Component ID
   * @param {object} data - Component data
   * @param {object} state - State to modify
   */
  #simulateAddComponent(entityId, componentId, data, state) {
    if (!state.entities) state.entities = {};
    if (!state.entities[entityId]) state.entities[entityId] = { components: {} };
    if (!state.entities[entityId].components) state.entities[entityId].components = {};

    state.entities[entityId].components[componentId] = data;
  }

  /**
   * Simulates removing a component
   *
   * @param {string} entityId - Entity ID
   * @param {string} componentId - Component ID
   * @param {object} state - State to modify
   */
  #simulateRemoveComponent(entityId, componentId, state) {
    if (!state.entities?.[entityId]?.components) return;

    delete state.entities[entityId].components[componentId];
  }

  /**
   * Simulates modifying a component
   *
   * @param {string} entityId - Entity ID
   * @param {string} componentId - Component ID
   * @param {object} updates - Updates to apply
   * @param {object} state - State to modify
   */
  #simulateModifyComponent(entityId, componentId, updates, state) {
    if (!state.entities?.[entityId]?.components?.[componentId]) return;

    Object.assign(state.entities[entityId].components[componentId], updates);
  }
}

export default ActionSelector;
