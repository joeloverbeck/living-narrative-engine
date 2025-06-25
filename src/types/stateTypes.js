/**
 * @file Generic type definitions for turn state helpers.
 */

/**
 * @typedef {object} ProcessingCommandStateLike
 * @description Minimal shape used by helper utilities for ProcessingCommandState.
 * @property {function(): boolean} isProcessing - Indicates if command processing is active.
 * @property {function(): string} getStateName - Retrieves the state's name for logging.
 * @property {function(): import('../turns/interfaces/ITurnContext.js').ITurnContext | null} _getTurnContext - Gets the current turn context.
 * @property {{ safeEventDispatcher?: any, _currentState?: any }} _handler - Owning handler reference.
 */

export {};
