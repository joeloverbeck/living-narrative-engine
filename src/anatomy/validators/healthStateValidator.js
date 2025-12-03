/**
 * @file Validator for health state consistency and values.
 * Ensures that health states used in the application match the registry
 * and provides mechanisms to verify schema synchronization.
 */

import {
  isValidState,
  getAllStateIds,
} from '../registries/healthStateRegistry.js';

/**
 * Error thrown when an invalid health state is encountered.
 */
export class InvalidHealthStateError extends Error {
  /**
   * @param {string} state - The invalid state value
   * @param {object} [context] - Additional context (entityId, componentId)
   */
  constructor(state, context = {}) {
    const validStates = getAllStateIds().join(', ');
    super(
      `Invalid health state: '${state}'. Valid states are: ${validStates}.`
    );
    this.name = 'InvalidHealthStateError';
    this.state = state;
    this.context = context;
  }
}

/**
 * Validates that a state string is a known health state.
 *
 * @param {string} state - The state string to validate
 * @param {object} [context] - Debugging context (e.g., entityId)
 * @throws {InvalidHealthStateError} If the state is invalid
 * @returns {boolean} True if valid
 */
export function validateHealthState(state, context = {}) {
  if (!isValidState(state)) {
    throw new InvalidHealthStateError(state, context);
  }
  return true;
}

/**
 * Validates that a schema enum matches the registry states.
 * Used primarily by tests and build tools to prevent drift.
 *
 * @param {string[]} schemaEnum - The enum array from the component schema
 * @returns {object} Result object with success boolean and error details
 */
export function validateSchemaConsistency(schemaEnum) {
  const registryStates = new Set(getAllStateIds());
  const schemaStates = new Set(schemaEnum);
  const errors = [];

  // Check for states in registry but missing from schema
  for (const state of registryStates) {
    if (!schemaStates.has(state)) {
      errors.push(`Registry state '${state}' is missing from schema enum.`);
    }
  }

  // Check for states in schema but missing from registry
  for (const state of schemaStates) {
    if (!registryStates.has(state)) {
      errors.push(`Schema state '${state}' is missing from health registry.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
