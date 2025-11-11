/**
 * @file Abstract precondition simulator
 * Simulates abstract preconditions during planning
 *
 * Note: This class works with simulated world state during planning,
 * not with live EntityManager queries. The worldState parameter structure:
 * {
 *   entities: {
 *     [entityId]: {
 *       components: {
 *         [componentId]: componentData
 *       }
 *     }
 *   }
 * }
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Simulates abstract preconditions for planning
 */
class AbstractPreconditionSimulator {
  #logger;

  /**
   * Creates a new AbstractPreconditionSimulator instance
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#logger = logger;
  }

  /**
   * Simulates an abstract precondition
   *
   * @param {string} functionName - Name of abstract function
   * @param {Array} parameters - Function parameters
   * @param {object} worldState - World state for simulation
   * @returns {boolean} Result of simulation
   */
  simulate(functionName, parameters, worldState) {
    const simulators = {
      hasInventoryCapacity: this.#simulateInventoryCapacity.bind(this),
      hasContainerCapacity: this.#simulateContainerCapacity.bind(this),
      hasComponent: this.#simulateHasComponent.bind(this)
    };

    const simulator = simulators[functionName];
    if (!simulator) {
      this.#logger.warn(`No simulator for abstract function: ${functionName}`);
      return false;
    }

    return simulator(parameters, worldState);
  }

  /**
   * Simulates inventory capacity check
   *
   * @param {[string, string]} params - [actorId, itemId]
   * @param {object} worldState - World state
   * @returns {boolean} Whether actor has capacity
   */
  #simulateInventoryCapacity([actorId, itemId], worldState) {
    // Get actor inventory component
    const inventory = worldState.entities?.[actorId]?.components?.['items:inventory'];
    if (!inventory) return true; // No inventory component, assume unlimited

    // Get item component
    const item = worldState.entities?.[itemId]?.components?.['items:item'];
    if (!item) return false; // Item doesn't exist

    // Calculate current weight
    const currentWeight = this.#calculateTotalWeight(actorId, worldState);
    const itemWeight = item.weight || 0;
    const maxWeight = inventory.max_weight || Infinity;

    return (currentWeight + itemWeight) <= maxWeight;
  }

  /**
   * Simulates container capacity check
   *
   * @param {[string, string]} params - [containerId, itemId]
   * @param {object} worldState - World state
   * @returns {boolean} Whether container has capacity
   */
  #simulateContainerCapacity([containerId, itemId], worldState) {
    // Get container component
    const container = worldState.entities?.[containerId]?.components?.['items:container'];
    if (!container) return false; // Not a container

    // Get item component
    const item = worldState.entities?.[itemId]?.components?.['items:item'];
    if (!item) return false; // Item doesn't exist

    // Check capacity
    const currentCount = container.contents?.length || 0;
    const maxCapacity = container.max_capacity || Infinity;

    return currentCount < maxCapacity;
  }

  /**
   * Simulates component existence check
   *
   * @param {[string, string]} params - [entityId, componentId]
   * @param {object} worldState - World state
   * @returns {boolean} Whether entity has component
   */
  #simulateHasComponent([entityId, componentId], worldState) {
    return !!worldState.entities?.[entityId]?.components?.[componentId];
  }

  /**
   * Calculates total weight of items in inventory
   *
   * @param {string} actorId - Actor entity ID
   * @param {object} worldState - World state
   * @returns {number} Total weight
   */
  #calculateTotalWeight(actorId, worldState) {
    const inventory = worldState.entities?.[actorId]?.components?.['items:inventory'];
    if (!inventory?.items) return 0;

    let totalWeight = 0;
    for (const itemId of inventory.items) {
      const item = worldState.entities?.[itemId]?.components?.['items:item'];
      totalWeight += item?.weight || 0;
    }

    return totalWeight;
  }
}

export default AbstractPreconditionSimulator;
