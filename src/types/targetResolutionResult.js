/**
 * This type is imported from ResolutionStatus.js and represents the status of a target resolution.
 * Make sure ResolutionStatus.js is in the same directory or adjust the path in the import.
 * @typedef {import('./ResolutionStatus').ResolutionStatus} ResolutionStatus
 */

/**
 * @typedef {object} TargetResolutionResult
 * @property {ResolutionStatus} status - The outcome of the resolution attempt.
 * @property {'entity'|'self'|'direction'|'none'} targetType - The type of target that was identified or expected.
 * @property {string|null} targetId - The unique identifier of the resolved target (e.g., entity ID). Null if no specific target is identified or if not applicable (e.g., for 'none' or 'self' in some contexts without ID).
 * @property {string} [error] - An optional player-facing message explaining why resolution failed or if there's an issue (as indicated by "player-facing" in the ticket).
 * @property {string[]} [candidates] - An optional array of entity IDs when the resolution is ambiguous (i.e., status is AMBIGUOUS, as indicated by "ids when ambiguous" in the ticket).
 */

// Note: This file is named with a .d.ts extension, which is conventionally for TypeScript.
// For a JavaScript project using JSDoc, these typedefs can reside in .js files.
// If your tooling is configured to pick up JSDoc from .d.ts files in a JS project, this is fine.
// This file itself does not need to export any JavaScript code if it's solely for JSDoc type definitions.