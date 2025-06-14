/**
 * @file Alias module exposing ActorTurnHandler as `HumanTurnHandler` for
 * backward compatibility.
 * @see src/turns/handlers/humanTurnHandler.js
 */

import ActorTurnHandler from './actorTurnHandler.js';

/** @typedef {import('../../interfaces/IPromptCoordinator.js').IPromptCoordinator} IPromptCoordinator */

/**
 * @class HumanTurnHandler
 * @augments ActorTurnHandler
 * @description Empty subclass preserving the original class name so that
 * logs and instanceof checks remain consistent while delegating all
 * behavior to {@link ActorTurnHandler}.
 */
export class HumanTurnHandler extends ActorTurnHandler {}

export default HumanTurnHandler;
