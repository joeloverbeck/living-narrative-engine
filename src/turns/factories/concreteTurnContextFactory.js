// src/core/turns/factories/ConcreteTurnContextFactory.js
// ──────────────────────────────────────────────────────────────────────────────

import {ITurnContextFactory} from '../interfaces/ITurnContextFactory.js';
import {TurnContext} from '../context/turnContext.js';

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */
/** @typedef {function(Error | null): void} OnEndTurnCallback */
/** @typedef {function(): boolean} IsAwaitingExternalEventProvider */

/** @typedef {function(boolean, string): void} OnSetAwaitingExternalEventCallback */

/**
 * @class ConcreteTurnContextFactory
 * @implements {ITurnContextFactory}
 * @description
 * Concrete factory for creating turn contexts.
 */
export class ConcreteTurnContextFactory extends ITurnContextFactory {
    /**
     * Creates a TurnContext instance.
     * @param {object} params - The parameters required to create the turn context.
     * @param {Entity} params.actor
     * @param {ILogger} params.logger
     * @param {TurnContextServices} params.services
     * @param {IActorTurnStrategy} params.strategy
     * @param {OnEndTurnCallback} params.onEndTurnCallback
     * @param {IsAwaitingExternalEventProvider} params.isAwaitingExternalEventProvider
     * @param {OnSetAwaitingExternalEventCallback} params.onSetAwaitingExternalEventCallback
     * @param {BaseTurnHandler} params.handlerInstance
     * @returns {ITurnContext} The created TurnContext.
     */
    create({
               actor,
               logger,
               services,
               strategy,
               onEndTurnCallback,
               isAwaitingExternalEventProvider,
               onSetAwaitingExternalEventCallback,
               handlerInstance
           }) {
        return new TurnContext({
            actor,
            logger,
            services,
            strategy,
            onEndTurnCallback,
            isAwaitingExternalEventProvider,
            onSetAwaitingExternalEventCallback,
            handlerInstance
        });
    }
}

// --- FILE END ---