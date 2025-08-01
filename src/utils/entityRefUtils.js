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

/**
 * Check if a string is a recognized placeholder name
 * @param {string} name - Name to check
 * @returns {boolean} - True if it's a placeholder name
 */
function isPlaceholderName(name) {
  const PLACEHOLDER_NAMES = ['primary', 'secondary', 'tertiary'];
  return PLACEHOLDER_NAMES.includes(name);
}

/**
 * Resolve placeholder name to entity ID using event payload
 * @param {string} placeholder - Placeholder name (e.g., "primary")
 * @param {Object} eventPayload - Event payload with target information
 * @returns {string|null} - Resolved entity ID or null if not found
 */
function resolveTargetPlaceholder(placeholder, eventPayload) {
  if (!eventPayload) return null;

  // Try comprehensive format first (from Ticket 1)
  if (eventPayload.targets && eventPayload.targets[placeholder]) {
    const targetInfo = eventPayload.targets[placeholder];
    // Handle both string IDs and object entries
    if (typeof targetInfo === 'string') {
      return targetInfo;
    }
    if (targetInfo.entityId) {
      return targetInfo.entityId;
    }
  }

  // Fall back to flattened format (primaryId, secondaryId, tertiaryId)
  const fieldName = `${placeholder}Id`;
  if (eventPayload[fieldName]) {
    return eventPayload[fieldName];
  }

  // No resolution found
  return null;
}

/**
 * Get list of available targets for debugging
 * @param {Object} eventPayload - Event payload
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

    // NEW: Add placeholder name support with logging
    if (isPlaceholderName(trimmed)) {
      const resolvedId = resolveTargetPlaceholder(trimmed, ec.event?.payload);

      if (logger) {
        if (resolvedId) {
          logger.debug(
            `Resolved placeholder '${trimmed}' to entity ID '${resolvedId}'`
          );
        } else {
          logger.warn(
            `Failed to resolve placeholder '${trimmed}' - no matching target in event payload`,
            {
              availableTargets: getAvailableTargets(ec.event?.payload),
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
