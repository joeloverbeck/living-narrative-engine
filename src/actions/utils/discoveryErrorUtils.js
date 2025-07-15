// src/actions/utils/discoveryErrorUtils.js

/**
 * @module discoveryErrorUtils
 * @description Utilities for creating enhanced action error contexts.
 * This replaces the old simple error format with comprehensive error context.
 * @see specs/action-system-better-error-context.md
 */

/** @typedef {import('../errors/actionErrorTypes.js').ActionErrorContext} ActionErrorContext */

/**
 * Creates an action error context from an existing ActionErrorContext object.
 * This is a pass-through function that ensures the error context is properly structured.
 *
 * @param {ActionErrorContext} errorContext - The complete error context
 * @returns {ActionErrorContext} The error context
 */
export function createActionErrorContext(errorContext) {
  // Validate required fields
  if (!errorContext.actionId) {
    throw new Error('ActionErrorContext must have actionId');
  }
  if (!errorContext.error) {
    throw new Error('ActionErrorContext must have error');
  }
  if (!errorContext.phase) {
    throw new Error('ActionErrorContext must have phase');
  }

  return errorContext;
}

/**
 * Extracts a target entity ID from various error shapes.
 * This is kept for utility purposes but works with ActionErrorContext.
 *
 * @param {Error|ActionErrorContext} error - The error or error context
 * @returns {string|null} The resolved target entity ID or null if not present
 */
export function extractTargetId(error) {
  // If it's an ActionErrorContext
  if (error.targetId !== undefined) {
    return error.targetId;
  }

  // Legacy error object support for extraction
  return error?.targetId ?? error?.target?.entityId ?? error?.entityId ?? null;
}
