/**
 * @file The interface for the result of a decision for what action/speech/etc. taken for a turn.
 * @see src/turns/interfaces/ITurnDecisionResult.js
 */

/**
 * @typedef {object} ITurnDecisionResult
 * @property {'success'|'fallback'} kind  - Success or graceful fallback.
 * @property {import('./IActorTurnStrategy.js').ITurnAction} action
 * @property {{ speech:string|null, thoughts:string|null, notes:Array<{text: string, subject: string, context?: string, timestamp?: string}>|null, moodUpdate?: { valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, self_evaluation: number }|null, sexualUpdate?: { sex_excitation: number, sex_inhibition: number }|null }} extractedData
 */
export const typedef = {}; // JSDoc-only file
