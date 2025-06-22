/**
 * @file turnStateContextTypes.js
 * @description JSDoc typedefs describing the ITurnContext capabilities
 * required by specific turn states.
 */

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @typedef {object} ProcessingCommandStateContext
 * @property {function(): Entity|null} getActor
 * @property {function(): ILogger} getLogger
 * @property {function(): ITurnAction|null} getChosenAction
 * @property {function(): ICommandProcessor} getCommandProcessor
 * @property {function(): ICommandOutcomeInterpreter} getCommandOutcomeInterpreter
 * @property {function(): ISafeEventDispatcher} getSafeEventDispatcher
 */

/**
 * @typedef {object} AwaitingActorDecisionStateContext
 * @property {function(): Entity|null} getActor
 * @property {function(): ILogger} getLogger
 * @property {function(): IActorTurnStrategy} getStrategy
 * @property {function(ITurnAction): void} setChosenAction
 * @property {function(object|null): void} setDecisionMeta
 * @property {function(string, ITurnAction): Promise<void>} requestProcessingCommandStateTransition
 * @property {function(Error|null): Promise<void>} endTurn
 */

export {};
