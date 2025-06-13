/**
 * @file The interface for the result of a decision for what action/speech/etc. taken for a turn.
 * @see src/turns/interfaces/ITurnDecisionResult.js
 */

/**
 * @typedef {object} ITurnDecisionResult
 * @property {'success'|'fallback'} kind  - Success or graceful fallback.
 * @property {import('./IActorTurnStrategy.js').ITurnAction} action
 * @property {{ speech:string|null, thoughts:string|null, notes:string[]|null }} extractedData
 */
export const typedef = {}; // JSDoc-only file
