import minimalValidGoal from './minimalValidGoal.json';

const baseGoal = Object.freeze(minimalValidGoal);

function cloneBaseGoal() {
  return JSON.parse(JSON.stringify(baseGoal));
}

/**
 * Returns the smallest schema-compliant goal payload used across loader tests.
 * Update this factory (and regenerate the snapshot) whenever the schema gains
 * new required fields so dependent suites fail loudly and deterministically.
 *
 * @param {Partial<import('../../../data/schemas/goal.schema.json').GoalDefinition>} overrides
 * @returns {import('../../../data/schemas/goal.schema.json').GoalDefinition}
 */
export function createGoalFixture(overrides = {}) {
  return Object.assign(cloneBaseGoal(), overrides);
}

/**
 * Provides a frozen copy of the default payload for snapshotting/reporting.
 *
 * @returns {import('../../../data/schemas/goal.schema.json').GoalDefinition}
 */
export function getDefaultGoalFixture() {
  return cloneBaseGoal();
}

export default createGoalFixture;
