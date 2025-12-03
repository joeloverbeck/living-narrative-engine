/**
 * @file Centralized registry for health state configuration
 * Single source of truth for all health state metadata, thresholds, and descriptions.
 *
 * This registry eliminates the need for manual synchronization across handlers,
 * formatters, and schemas, providing a single definition for health state logic.
 * @see data/mods/anatomy/components/part_health.component.json
 */

/**
 * @typedef {object} HealthStateMetadata
 * @property {string} id - The state identifier (matches schema enum)
 * @property {number} thresholdMin - Minimum health percentage (inclusive) to be in this state
 * @property {number} order - Numeric priority for severity ordering (higher = worse)
 * @property {string} firstPerson - First-person narrative description
 * @property {string} thirdPerson - Third-person narrative description
 * @property {string} cssClass - CSS class for UI styling
 */

/**
 * Centralized registry of all health state metadata.
 *
 * States are ordered by severity (0 = best, 5 = worst).
 * Thresholds represent the minimum percentage to qualify for that state.
 *
 * @type {{[key: string]: HealthStateMetadata}}
 */
export const HEALTH_STATE_REGISTRY = Object.freeze({
  healthy: {
    id: 'healthy',
    thresholdMin: 81,
    order: 0,
    firstPerson: 'feels fine',
    thirdPerson: 'is uninjured',
    cssClass: 'severity-healthy',
  },
  scratched: {
    id: 'scratched',
    thresholdMin: 61,
    order: 1,
    firstPerson: 'stings slightly',
    thirdPerson: 'is scratched',
    cssClass: 'severity-scratched',
  },
  wounded: {
    id: 'wounded',
    thresholdMin: 41,
    order: 2,
    firstPerson: 'throbs painfully',
    thirdPerson: 'is wounded',
    cssClass: 'severity-wounded',
  },
  injured: {
    id: 'injured',
    thresholdMin: 21,
    order: 3,
    firstPerson: 'aches deeply',
    thirdPerson: 'is injured',
    cssClass: 'severity-injured',
  },
  critical: {
    id: 'critical',
    thresholdMin: 1,
    order: 4,
    firstPerson: 'screams with agony',
    thirdPerson: 'is critically injured',
    cssClass: 'severity-critical',
  },
  destroyed: {
    id: 'destroyed',
    thresholdMin: 0,
    order: 5,
    firstPerson: 'is completely numb',
    thirdPerson: 'has been destroyed',
    cssClass: 'severity-destroyed',
  },
});

/**
 * Calculate health state from health percentage.
 *
 * @param {number} percentage - Health percentage (0-100)
 * @returns {string} The corresponding health state ID
 * @example
 * calculateStateFromPercentage(100); // 'healthy'
 * calculateStateFromPercentage(50);  // 'wounded'
 * calculateStateFromPercentage(0);   // 'destroyed'
 */
export function calculateStateFromPercentage(percentage) {
  // Edge cases
  if (percentage <= 0) return 'destroyed';
  if (percentage > 100) return 'healthy';

  // Iterate through states to find the first one that matches the threshold
  // We sort by threshold descending to find the highest matching bracket
  const sortedStates = Object.values(HEALTH_STATE_REGISTRY).sort(
    (a, b) => b.thresholdMin - a.thresholdMin
  );

  for (const state of sortedStates) {
    if (percentage >= state.thresholdMin) {
      return state.id;
    }
  }

  // Fallback (should technically be unreachable if thresholds cover 0-100)
  return 'destroyed';
}

/**
 * Get health state metadata by state ID.
 *
 * @param {string} stateId - The state ID to look up
 * @returns {HealthStateMetadata|undefined} The state metadata or undefined if invalid
 */
export function getStateMetadata(stateId) {
  return HEALTH_STATE_REGISTRY[stateId];
}

/**
 * Get all valid state IDs.
 *
 * @returns {string[]} Array of all valid state IDs
 */
export function getAllStateIds() {
  return Object.keys(HEALTH_STATE_REGISTRY);
}

/**
 * Check if a state ID is valid.
 *
 * @param {string} stateId - The state ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidState(stateId) {
  return Object.prototype.hasOwnProperty.call(HEALTH_STATE_REGISTRY, stateId);
}

/**
 * Get states sorted by severity order (ascending: healthy -> destroyed)
 * or descending (destroyed -> healthy).
 *
 * @param {boolean} [ascending=true] - Whether to sort by ascending severity
 * @returns {string[]} Array of state IDs sorted by severity
 */
export function getStateOrder(ascending = true) {
  return Object.values(HEALTH_STATE_REGISTRY)
    .sort((a, b) => (ascending ? a.order - b.order : b.order - a.order))
    .map((s) => s.id);
}

/**
 * Get first-person description for a state.
 *
 * @param {string} stateId - The state ID
 * @returns {string} The first-person description or empty string if invalid
 */
export function getFirstPersonDescription(stateId) {
  return HEALTH_STATE_REGISTRY[stateId]?.firstPerson || '';
}

/**
 * Get third-person description for a state.
 *
 * @param {string} stateId - The state ID
 * @returns {string} The third-person description or empty string if invalid
 */
export function getThirdPersonDescription(stateId) {
  return HEALTH_STATE_REGISTRY[stateId]?.thirdPerson || '';
}

/**
 * Check if newState represents a deterioration compared to oldState.
 *
 * @param {string} oldState - The previous state ID
 * @param {string} newState - The new state ID
 * @returns {boolean} True if newState is worse (higher order) than oldState
 */
export function isDeterioration(oldState, newState) {
  const oldMeta = HEALTH_STATE_REGISTRY[oldState];
  const newMeta = HEALTH_STATE_REGISTRY[newState];

  if (!oldMeta || !newMeta) return false;

  return newMeta.order > oldMeta.order;
}
