/**
 * @file Validation utilities for multi-target actions
 */

import { isNonBlankString } from './textUtils.js';

/**
 * Validates if a target name follows naming conventions
 *
 * @param {string} name - Target name to validate
 * @returns {boolean} True if valid target name
 */
export function isValidTargetName(name) {
  if (!isNonBlankString(name)) {
    return false;
  }

  // Target names should be alphanumeric + underscore
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Validates if an entity ID follows naming conventions
 *
 * @param {string} entityId - Entity ID to validate
 * @returns {boolean} True if valid entity ID
 */
export function isValidEntityId(entityId) {
  if (!isNonBlankString(entityId)) {
    return false;
  }

  // Entity IDs should be alphanumeric + underscore + namespace separator
  return /^[a-zA-Z0-9_:]+$/.test(entityId);
}

/**
 * Determines the primary target from a targets object
 *
 * @param {object} targets - Targets object
 * @returns {string|null} Primary target entity ID
 */
export function determinePrimaryTarget(targets) {
  if (!targets || typeof targets !== 'object') {
    return null;
  }

  const targetKeys = Object.keys(targets);
  if (targetKeys.length === 0) {
    return null;
  }

  // Priority order for primary target determination
  const priorityOrder = ['primary', 'target', 'self', 'actor'];

  for (const priority of priorityOrder) {
    if (targets[priority]) {
      return targets[priority];
    }
  }

  // Return first target if no priority match
  return targets[targetKeys[0]];
}

/**
 * Validates an attempt action payload for multi-target events
 *
 * @param {object} payload - Event payload to validate
 * @returns {object} Validation result
 */
export function validateAttemptActionPayload(payload) {
  const errors = [];
  const warnings = [];

  if (!payload) {
    return {
      isValid: false,
      errors: ['Payload is required'],
      warnings: [],
      details: {},
    };
  }

  // Validate required fields
  if (!payload.actorId) {
    errors.push('actorId is required');
  }

  if (!payload.actionId) {
    errors.push('actionId is required');
  }

  if (!payload.originalInput) {
    errors.push('originalInput is required');
  }

  // Validate targets
  const hasTargets = payload.targets && Object.keys(payload.targets).length > 0;
  const hasTargetId = payload.targetId !== undefined;

  if (!hasTargets && !hasTargetId) {
    errors.push('Either targets object or targetId must be provided');
  }

  // Analyze target structure
  let hasMultipleTargets = false;
  let targetCount = 0;
  let primaryTarget = null;

  if (hasTargets) {
    targetCount = Object.keys(payload.targets).length;
    hasMultipleTargets = targetCount > 1;
    primaryTarget = determinePrimaryTarget(payload.targets);

    // Validate target consistency
    if (hasTargetId && payload.targetId !== primaryTarget) {
      warnings.push('targetId does not match determined primary target');
    }
  } else if (hasTargetId) {
    targetCount = 1;
    primaryTarget = payload.targetId;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    details: {
      hasMultipleTargets,
      targetCount,
      primaryTarget,
    },
  };
}
