/**
 * @file PlanningNode - Data structure for GOAP state-space search nodes
 * @description Represents a state in the A* search algorithm with world state snapshot,
 * costs, parent reference, and task that generated it. Immutable for safe comparison
 * and path reconstruction.
 * @see specs/goap-system-specs.md lines 296-310 - State space search algorithm
 * @see tickets/GOAPIMPL-015-planning-node-structure.md
 */

import { isEqual } from 'lodash';
import { deepClone } from '../../utils/cloneUtils.js';

/**
 * PlanningNode - Immutable data structure for GOAP planning search nodes
 *
 * Represents a state in the A* search space during GOAP planning. Each node stores:
 * - World state snapshot (symbolic facts as key-value pairs)
 * - Cost scores (g, h, f) for A* search
 * - Parent node reference for path reconstruction
 * - Task and parameters that generated this state
 *
 * State format: { "entityId:componentName:propertyPath": value }
 * Example: { "entity-123:core:hungry": true, "entity-123:core:health": 50 }
 *
 * Immutability guarantees:
 * - Private fields prevent external mutation
 * - Getters only (no setters)
 * - State and taskParameters are frozen
 * - Safe for duplicate detection and state comparison
 */
class PlanningNode {
  /** @type {Object<string, any>} Frozen world state snapshot */
  #state;

  /** @type {number} Accumulated cost from start node (actual cost) */
  #gScore;

  /** @type {number} Heuristic estimate to goal (estimated remaining cost) */
  #hScore;

  /** @type {number} Total estimated cost (g + h) for A* priority */
  #fScore;

  /** @type {PlanningNode|null} Parent node reference (null for start node) */
  #parent;

  /** @type {object | null} Task object that generated this state (null for start node) */
  #task;

  /** @type {object | null} Frozen bound parameters for the task */
  #taskParameters;

  /**
   * Create a new PlanningNode
   *
   * @param {object} config - Node configuration
   * @param {Object<string, any>} config.state - World state as symbolic facts
   * @param {number} config.gScore - Accumulated cost from start
   * @param {number} config.hScore - Heuristic estimate to goal
   * @param {PlanningNode|null} config.parent - Parent node (null for start)
   * @param {object | null} config.task - Task object (null for start)
   * @param {object | null} config.taskParameters - Bound parameters (null if none)
   */
  constructor({ state, gScore, hScore, parent, task, taskParameters }) {
    // Validate required fields
    if (state === undefined || state === null) {
      throw new Error('PlanningNode requires a state object');
    }
    if (typeof gScore !== 'number' || gScore < 0) {
      throw new Error('PlanningNode requires a non-negative gScore');
    }
    if (typeof hScore !== 'number' || hScore < 0) {
      throw new Error('PlanningNode requires a non-negative hScore');
    }

    // Store state as frozen deep clone to prevent mutation
    this.#state = Object.freeze(deepClone(state));

    // Store scores
    this.#gScore = gScore;
    this.#hScore = hScore;
    this.#fScore = gScore + hScore;

    // Store parent reference (can be null for start node)
    this.#parent = parent;

    // Store task reference (can be null for start node)
    this.#task = task;

    // Store parameters as frozen deep clone if provided
    this.#taskParameters = taskParameters
      ? Object.freeze(deepClone(taskParameters))
      : null;
  }

  /**
   * Get the world state snapshot
   *
   * @returns {Object<string, any>} Frozen state object
   */
  get state() {
    return this.#state;
  }

  /**
   * Get the accumulated cost from start
   *
   * @returns {number} G-score (actual cost so far)
   */
  get gScore() {
    return this.#gScore;
  }

  /**
   * Get the heuristic estimate to goal
   *
   * @returns {number} H-score (estimated remaining cost)
   */
  get hScore() {
    return this.#hScore;
  }

  /**
   * Get the total estimated cost
   *
   * @returns {number} F-score (g + h) for A* priority queue
   */
  get fScore() {
    return this.#fScore;
  }

  /**
   * Get the parent node reference
   *
   * @returns {PlanningNode|null} Parent node or null for start node
   */
  get parent() {
    return this.#parent;
  }

  /**
   * Get the task that generated this state
   *
   * @returns {object | null} Task object or null for start node
   */
  get task() {
    return this.#task;
  }

  /**
   * Get the bound parameters for the task
   *
   * @returns {object | null} Frozen parameters object or null
   */
  get taskParameters() {
    return this.#taskParameters;
  }

  /**
   * Check if this node's state equals another node's state
   *
   * Uses deep equality comparison - states are equal if they have
   * the same keys with the same values (order doesn't matter).
   *
   * @param {PlanningNode} other - Node to compare against
   * @returns {boolean} True if states are deeply equal
   */
  stateEquals(other) {
    if (!other || !(other instanceof PlanningNode)) {
      return false;
    }
    return isEqual(this.#state, other.#state);
  }

  /**
   * Reconstruct the plan from this node to the start node
   *
   * Follows the parent chain backward and collects tasks and parameters.
   * Returns them in execution order (start → goal).
   *
   * @returns {Array<{taskId: string, parameters: object}>} Plan steps in execution order
   */
  getPath() {
    const path = [];
    let current = this;

    // Follow parent chain backward, collecting tasks
    while (current !== null) {
      // Skip start node (no task)
      if (current.#task !== null) {
        path.unshift({
          taskId: current.#task.id,
          parameters: current.#taskParameters || {},
        });
      }
      current = current.#parent;
    }

    return path;
  }

  /**
   * Calculate state differences for debugging
   *
   * Returns an object describing what changed between this state and another:
   * - added: Properties in this state but not in other
   * - removed: Properties in other state but not in this
   * - changed: Properties with different values
   *
   * @param {PlanningNode} other - Node to compare against
   * @returns {object} Diff object with added, removed, changed arrays
   */
  getStateDiff(other) {
    if (!other || !(other instanceof PlanningNode)) {
      return {
        added: Object.keys(this.#state),
        removed: [],
        changed: [],
      };
    }

    const added = [];
    const removed = [];
    const changed = [];

    const thisKeys = Object.keys(this.#state);
    const otherKeys = Object.keys(other.#state);

    // Find added and changed
    for (const key of thisKeys) {
      if (!(key in other.#state)) {
        added.push(key);
      } else if (!isEqual(this.#state[key], other.#state[key])) {
        changed.push({
          key,
          from: other.#state[key],
          to: this.#state[key],
        });
      }
    }

    // Find removed
    for (const key of otherKeys) {
      if (!(key in this.#state)) {
        removed.push(key);
      }
    }

    return { added, removed, changed };
  }
}

export default PlanningNode;
