/**
 * @file Alias module exposing ActorTurnHandler as `AITurnHandler` for DI
 * compatibility.
 * @see src/turns/handlers/aiTurnHandler.js
 */

import ActorTurnHandler from './actorTurnHandler.js';

/**
 * @class AITurnHandler
 * @augments ActorTurnHandler
 * @description Empty subclass retaining the original class name so that
 * error messages and instanceof checks continue to work while delegating all
 * behavior to {@link ActorTurnHandler}.
 */
export class AITurnHandler extends ActorTurnHandler {}

export default AITurnHandler;
