// src/turns/constants/aiConstants.js
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */

/**
 * Default/Fallback ITurnAction to be used when an AI strategy or processing cannot produce a valid action
 * due to an internal error. Specific error contexts should be added by consumers to resolvedParameters.
 * @type {Readonly<ITurnAction>}
 */
export const FALLBACK_AI_ACTION = Object.freeze({
    actionDefinitionId: 'core:wait', // Or a more specific "AI error" action like 'core:aiErrorWait'
    commandString: 'wait', // Base command string
    resolvedParameters: { baseErrorContext: 'ai_fallback_action' }, // Base error context for AI-related fallbacks
});