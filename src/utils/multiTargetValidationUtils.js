/**
 * @file Validation utilities for multi-target actions
 */

import { isNonBlankString } from './textUtils.js';
import {
  ACTOR_ROLE,
  ALL_MULTI_TARGET_ROLES,
  LEGACY_TARGET_ROLE,
} from '../actions/pipeline/TargetRoleRegistry.js';

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
 * Supports both namespaced IDs (mod:entity) and UUIDs
 *
 * @param {string} entityId - Entity ID to validate
 * @returns {boolean} True if valid entity ID
 */
export function isValidEntityId(entityId) {
  if (!isNonBlankString(entityId)) {
    return false;
  }

  // Support namespaced IDs (alphanumeric + underscore + colon + hyphen)
  // and UUID formats (alphanumeric + hyphen + underscore)
  return /^[a-zA-Z0-9_:-]+$/.test(entityId);
}

/**
 * Determines the primary target from a targets object
 * Handles both string targets and object targets with entityId
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
  const priorityOrder = [
    ...ALL_MULTI_TARGET_ROLES,
    LEGACY_TARGET_ROLE,
    'self',
    ACTOR_ROLE,
  ];

  for (const priority of priorityOrder) {
    if (targets[priority]) {
      const target = targets[priority];
      // Handle both string targets and object targets
      if (typeof target === 'string') {
        return target;
      } else if (target && typeof target === 'object' && target.entityId) {
        return target.entityId;
      }
    }
  }

  // Return first target if no priority match
  const firstTarget = targets[targetKeys[0]];
  if (typeof firstTarget === 'string') {
    return firstTarget;
  } else if (
    firstTarget &&
    typeof firstTarget === 'object' &&
    firstTarget.entityId
  ) {
    return firstTarget.entityId;
  }

  return null;
}

/**
 * Validates a single target value (string or object)
 *
 * @param {string|object} target - Target value to validate
 * @param {string} targetName - Name of the target for error reporting
 * @returns {object} Validation result with isValid and errors
 */
export function validateTargetValue(target, targetName) {
  const errors = [];

  if (!target) {
    errors.push(`${targetName} target is required`);
    return { isValid: false, errors };
  }

  if (typeof target === 'string') {
    // String target validation
    if (target.trim().length === 0) {
      errors.push(`${targetName} target cannot be empty string`);
    } else if (!isValidEntityId(target)) {
      errors.push(`${targetName} target has invalid entity ID format`);
    }
  } else if (typeof target === 'object') {
    // Object target validation
    if (!target.entityId) {
      errors.push(`${targetName} target object must have entityId property`);
    } else if (typeof target.entityId !== 'string') {
      errors.push(`${targetName} target entityId must be a string`);
    } else if (target.entityId.trim().length === 0) {
      errors.push(`${targetName} target entityId cannot be empty`);
    } else if (!isValidEntityId(target.entityId)) {
      errors.push(`${targetName} target entityId has invalid format`);
    }

    // Validate optional properties if present
    if (
      target.placeholder !== undefined &&
      typeof target.placeholder !== 'string'
    ) {
      errors.push(`${targetName} target placeholder must be a string`);
    }
    if (
      target.description !== undefined &&
      typeof target.description !== 'string'
    ) {
      errors.push(`${targetName} target description must be a string`);
    }
    if (
      target.resolvedFromContext !== undefined &&
      typeof target.resolvedFromContext !== 'boolean'
    ) {
      errors.push(`${targetName} target resolvedFromContext must be a boolean`);
    }
    if (
      target.contextSource !== undefined &&
      typeof target.contextSource !== 'string'
    ) {
      errors.push(`${targetName} target contextSource must be a string`);
    }
  } else {
    errors.push(`${targetName} target must be a string or object`);
  }

  return { isValid: errors.length === 0, errors };
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

    // Validate each target value (string or object)
    for (const [targetName, targetValue] of Object.entries(payload.targets)) {
      const targetValidation = validateTargetValue(targetValue, targetName);
      if (!targetValidation.isValid) {
        errors.push(...targetValidation.errors);
      }
    }

    // Only determine primary target if individual targets are valid
    if (errors.length === 0) {
      primaryTarget = determinePrimaryTarget(payload.targets);
    }

    // Validate target consistency
    if (hasTargetId && primaryTarget && payload.targetId !== primaryTarget) {
      warnings.push('targetId does not match determined primary target');
    }
  } else if (hasTargetId) {
    targetCount = payload.targetId ? 1 : 0;
    primaryTarget = payload.targetId;

    // Validate single targetId (null is allowed for legacy compatibility)
    if (payload.targetId !== null && !isValidEntityId(payload.targetId)) {
      errors.push('targetId has invalid entity ID format');
    }
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
