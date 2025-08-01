// src/utils/entityRefUtils.js
/**
 * Utility functions for resolving entity references to concrete entity IDs.
 *
 * @module entityRefUtils
 * @description Utilities for resolving entity references to concrete entity IDs.
 */

/** @typedef {import('../logic/defs.js').ExecutionContext} ExecutionContext */
/**
 * @typedef {object} EntityRefObject
 * @property {string} entityId - The entity identifier.
 */

// Simple metrics object (no external dependencies)
const placeholderMetrics = {
  resolutionCount: 0,
  successCount: 0,
  failureCount: 0,

  recordResolution(success) {
    this.resolutionCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
  },

  getMetrics() {
    return {
      total: this.resolutionCount,
      success: this.successCount,
      failure: this.failureCount,
      successRate:
        this.resolutionCount > 0 ? this.successCount / this.resolutionCount : 0,
    };
  },

  reset() {
    this.resolutionCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
  },
};

/**
 * Check if a string is a recognized placeholder name
 *
 * @param {string} name - Name to check
 * @returns {boolean} - True if it's a placeholder name
 */
function isPlaceholderName(name) {
  const PLACEHOLDER_NAMES = ['primary', 'secondary', 'tertiary'];
  return PLACEHOLDER_NAMES.includes(name);
}

/**
 * Resolve placeholder name to entity ID using event payload
 *
 * @param {string} placeholder - Placeholder name (e.g., "primary")
 * @param {object} eventPayload - Event payload with target information
 * @returns {string|null} - Resolved entity ID or null if not found
 */
function resolveTargetPlaceholder(placeholder, eventPayload) {
  if (!eventPayload) {
    placeholderMetrics.recordResolution(false);
    return null;
  }

  // Try comprehensive format first (from Ticket 1)
  if (eventPayload.targets && eventPayload.targets[placeholder]) {
    const targetInfo = eventPayload.targets[placeholder];
    // Handle both string IDs and object entries
    if (typeof targetInfo === 'string') {
      placeholderMetrics.recordResolution(true);
      return targetInfo;
    }
    if (targetInfo.entityId) {
      placeholderMetrics.recordResolution(true);
      return targetInfo.entityId;
    }
  }

  // Fall back to flattened format (primaryId, secondaryId, tertiaryId)
  const fieldName = `${placeholder}Id`;
  if (eventPayload[fieldName]) {
    placeholderMetrics.recordResolution(true);
    return eventPayload[fieldName];
  }

  // No resolution found
  placeholderMetrics.recordResolution(false);
  return null;
}

/**
 * Get list of available targets for debugging
 *
 * @param {object} eventPayload - Event payload
 * @returns {Array<string>} - List of available target placeholder names
 */
function getAvailableTargets(eventPayload) {
  const available = [];

  // Check legacy format
  if (eventPayload?.primaryId) available.push('primary');
  if (eventPayload?.secondaryId) available.push('secondary');
  if (eventPayload?.tertiaryId) available.push('tertiary');

  // Check comprehensive format
  if (eventPayload?.targets) {
    Object.keys(eventPayload.targets).forEach((key) => {
      if (!available.includes(key)) {
        available.push(key);
      }
    });
  }

  return available;
}

/**
 * Validate that all required placeholders can be resolved
 *
 * @param {Array<string>} placeholders - Array of placeholder names to validate
 * @param {object} eventPayload - Event payload to validate against
 * @returns {object} Validation result with details
 */
export function validatePlaceholders(placeholders, eventPayload) {
  const result = {
    valid: true,
    resolved: [],
    missing: [],
    available: getAvailableTargets(eventPayload),
    errors: [],
  };

  if (!Array.isArray(placeholders)) {
    result.valid = false;
    result.errors.push({
      errorType: 'INVALID_INPUT',
      message: 'Placeholders must be an array',
    });
    return result;
  }

  // Check each placeholder
  placeholders.forEach((placeholder) => {
    if (!isPlaceholderName(placeholder)) {
      result.missing.push(placeholder);
      result.errors.push({
        placeholder,
        errorType: 'INVALID_PLACEHOLDER',
        message: `'${placeholder}' is not a valid placeholder name`,
        validNames: ['primary', 'secondary', 'tertiary'],
      });
      return;
    }

    const resolvedId = resolveTargetPlaceholder(placeholder, eventPayload);
    if (resolvedId) {
      result.resolved.push(placeholder);
    } else {
      result.missing.push(placeholder);
      result.errors.push({
        placeholder,
        errorType: 'PLACEHOLDER_NOT_RESOLVED',
        message: `Placeholder '${placeholder}' could not be resolved to entity ID`,
        available: result.available,
      });
    }
  });

  result.valid = result.missing.length === 0;
  return result;
}

/**
 * Resolve multiple placeholders in batch
 *
 * @param {Array<string>} placeholders - Array of placeholder names
 * @param {object} eventPayload - Event payload with target information
 * @returns {Map<string, string|null>} - Map of placeholder to entity ID
 */
export function resolvePlaceholdersBatch(placeholders, eventPayload) {
  const results = new Map();

  if (!Array.isArray(placeholders)) {
    return results;
  }

  placeholders.forEach((placeholder) => {
    const entityId = isPlaceholderName(placeholder)
      ? resolveTargetPlaceholder(placeholder, eventPayload)
      : null;
    results.set(placeholder, entityId);
  });

  return results;
}

/**
 * Resolves an entity reference into a concrete entity ID string. Supports the special keywords
 * 'actor' and 'target', placeholder names 'primary', 'secondary', 'tertiary',
 * plain ID strings, or objects of the form `{ entityId: string }`.
 *
 * @description Resolves an entity reference into a concrete entity ID string.
 * Supports the special keywords 'actor' and 'target', placeholder names,
 * plain ID strings, or objects of the form `{ entityId: string }`.
 * @param {'actor'|'target'|'primary'|'secondary'|'tertiary'|string|EntityRefObject} ref - Reference to resolve.
 * @param {ExecutionContext} executionContext - The current execution context providing actor/target.
 * @returns {string|null} The resolved entity ID, or `null` if it cannot be resolved.
 */
export function resolveEntityId(ref, executionContext) {
  const ec = executionContext?.evaluationContext ?? {};
  const logger = executionContext?.logger;

  if (typeof ref === 'string') {
    const trimmed = ref.trim();
    if (!trimmed) return null;

    // Existing keyword support
    if (trimmed === 'actor') return ec.actor?.id ?? null;
    if (trimmed === 'target') return ec.target?.id ?? null;

    // Enhanced placeholder support with detailed logging
    if (isPlaceholderName(trimmed)) {
      const resolvedId = resolveTargetPlaceholder(trimmed, ec.event?.payload);

      if (logger) {
        if (resolvedId) {
          logger.debug(
            `Resolved placeholder '${trimmed}' to entity ID '${resolvedId}'`
          );
        } else {
          // Enhanced error message with available targets
          const availableTargets = getAvailableTargets(ec.event?.payload);
          logger.warn(
            `Failed to resolve placeholder '${trimmed}' - no matching target in event payload`,
            {
              placeholder: trimmed,
              availableTargets,
              eventType: ec.event?.type,
              actionId: ec.event?.payload?.actionId,
              suggestion:
                availableTargets.length > 0
                  ? `Available targets: ${availableTargets.join(', ')}`
                  : 'No targets available in event payload',
            }
          );
        }
      }

      return resolvedId;
    }

    return trimmed; // Direct entity ID
  }

  // Existing object reference support
  if (
    ref &&
    typeof ref === 'object' &&
    typeof ref.entityId === 'string' &&
    ref.entityId.trim()
  ) {
    return ref.entityId.trim();
  }

  return null;
}

// Export metrics for monitoring
export { placeholderMetrics };
