// src/core/config/registrations/domainServicesRegistrations.js
// ****** MODIFIED FILE ******

import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import ConditionEvaluationService from '../../../services/conditionEvaluationService.js';
import {ItemTargetResolverService} from "../../../services/itemTargetResolver.js";
import {TargetResolutionService} from "../../../services/targetResolutionService.js";
import {ActionValidationContextBuilder} from "../../../services/actionValidationContextBuilder.js";
import {PrerequisiteEvaluationService} from "../../../services/prerequisiteEvaluationService.js";
import {DomainContextCompatibilityChecker} from "../../../validation/domainContextCompatibilityChecker.js";
import {ActionValidationService} from "../../../services/actionValidationService.js";
import CommandParser from "../../commands/commandParser.js";
import JsonLogicEvaluationService from '../../../logic/jsonLogicEvaluationService.js';
import WorldContext from '../../worldContext.js';
import {TurnOrderService} from "../../turns/order/turnOrderService.js";
import CommandProcessor from "../../commands/commandProcessor.js";
import PlayerPromptService from '../../services/playerPromptService.js'; // Concrete class
import SubscriptionLifecycleManager from '../../services/subscriptionLifecycleManager.js'; // <<< ADDED IMPORT

// Import getEntityIdsForScopes directly
import {getEntityIdsForScopes} from '../../../services/entityScopeService.js';


// --- Type Imports for JSDoc ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../commands/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../services/targetResolutionService.js').ITargetResolutionService} ITargetResolutionService */ // Path to the interface
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../../services/entityScopeService.js').getEntityIdsForScopes} GetEntityIdsForScopesFn */
/** @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../ports/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */ // <<< ADDED IMPORT FOR JSDOC
/** @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */ // <<< ADDED IMPORT FOR JSDOC


// --- Concrete type imports for DI resolution, if needed for casting ---
// /** @typedef {import('../../services/gameDataRepository.js').GameDataRepository} GameDataRepository */ // No longer needed as we resolve IGameDataRepository
// /** @typedef {import('../../../entities/entityManager.js').default} EntityManager */ // No longer needed as we resolve IEntityManager


/**
 * Registers core domain logic services.
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerDomainServices(container) {
    const r = new Registrar(container);
    /** @type {ILogger} */
    const log = container.resolve(tokens.ILogger);
    log.debug('Domain-services Registration: starting…');

    r.single(tokens.ConditionEvaluationService, ConditionEvaluationService, [tokens.IEntityManager]); // Use IEntityManager
    r.single(tokens.ItemTargetResolverService, ItemTargetResolverService,
        [tokens.IEntityManager, tokens.IValidatedEventDispatcher, tokens.ConditionEvaluationService, tokens.ILogger]); // Use IEntityManager

    // Register TargetResolutionService with getEntityIdsForScopes
    r.singletonFactory(tokens.TargetResolutionService, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${String(tokens.TargetResolutionService)}...`);
        const dependencies = {
            entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)), // Use IEntityManager
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.IGameDataRepository)), // Use IGameDataRepository
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            getEntityIdsForScopes: getEntityIdsForScopes // Pass the imported function directly
        };

        for (const [key, value] of Object.entries(dependencies)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.TargetResolutionService)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(`Missing dependency "${key}" for ${String(tokens.TargetResolutionService)}`);
            }
            // Special check for getEntityIdsForScopes as it's a function
            if (key === 'getEntityIdsForScopes' && typeof value !== 'function') {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.TargetResolutionService)} FAILED, dependency "${key}" is not a function.`;
                log.error(errorMsg);
                throw new Error(`Dependency "${key}" for ${String(tokens.TargetResolutionService)} must be a function.`);
            }
        }
        log.debug(`Domain-services Registration: Dependencies for ${String(tokens.TargetResolutionService)} resolved, creating instance.`);
        return new TargetResolutionService(dependencies);
    });
    log.debug(`Domain-services Registration: Registered ${String(tokens.TargetResolutionService)} factory.`);


    r.single(tokens.JsonLogicEvaluationService, JsonLogicEvaluationService, [tokens.ILogger]);
    r.single(tokens.ActionValidationContextBuilder, ActionValidationContextBuilder,
        [tokens.IEntityManager, tokens.ILogger]); // Use IEntityManager
    r.single(tokens.PrerequisiteEvaluationService, PrerequisiteEvaluationService,
        [tokens.ILogger, tokens.JsonLogicEvaluationService, tokens.ActionValidationContextBuilder]);
    r.single(tokens.DomainContextCompatibilityChecker, DomainContextCompatibilityChecker, [tokens.ILogger]);
    r.single(tokens.ActionValidationService, ActionValidationService,
        [tokens.IEntityManager, tokens.ILogger, tokens.DomainContextCompatibilityChecker, tokens.PrerequisiteEvaluationService]); // Use IEntityManager

    r.singletonFactory(tokens.IWorldContext, c => new WorldContext(
        /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)), // Use IEntityManager
        /** @type {ILogger} */ (c.resolve(tokens.ILogger))
    ));
    log.debug(`Domain Services Registration: Registered ${String(tokens.IWorldContext)}.`);

    container.register(tokens.ICommandParser, c => {
        const gameDataRepoInstance = /** @type {IGameDataRepository} */ (c.resolve(tokens.IGameDataRepository)); // Use IGameDataRepository
        return new CommandParser(gameDataRepoInstance);
    }, {lifecycle: 'singleton'});
    log.debug(`Domain-services Registration: Registered ${String(tokens.ICommandParser)}.`);

    r.singletonFactory(tokens.ICommandProcessor, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${String(tokens.ICommandProcessor)}...`);
        const commandProcessorDeps = {
            commandParser: /** @type {ICommandParser} */ (c.resolve(tokens.ICommandParser)),
            targetResolutionService: /** @type {ITargetResolutionService} */ (c.resolve(tokens.TargetResolutionService)),
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)), // Use IEntityManager
            gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.IGameDataRepository)), // Use IGameDataRepository
        };

        for (const [key, value] of Object.entries(commandProcessorDeps)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.ICommandProcessor)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(`Missing dependency "${key}" for ${String(tokens.ICommandProcessor)}`);
            }
        }
        log.debug(`Domain-services Registration: Dependencies for ${String(tokens.ICommandProcessor)} resolved, creating instance.`);
        return new CommandProcessor(commandProcessorDeps);
    });
    log.debug(`Domain-services Registration: Registered ${String(tokens.ICommandProcessor)} factory.`);

    r.singletonFactory(tokens.ITurnOrderService, (c) => {
        const dependencies = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger))
        };
        if (!dependencies.logger) {
            const errorMsg = `Domain-services Registration: Factory for ${String(tokens.ITurnOrderService)} FAILED to resolve dependency "logger".`;
            log.error(errorMsg); // Use the log instance obtained at the start of the function.
            throw new Error(`Missing dependency "logger" for ${String(tokens.ITurnOrderService)}`);
        }
        return new TurnOrderService(dependencies);
    });
    log.debug(`Domain-services Registration: Registered ${String(tokens.ITurnOrderService)}.`);

    // Register PlayerPromptService against IPlayerPromptService token
    r.singletonFactory(tokens.IPlayerPromptService, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${String(tokens.IPlayerPromptService)}...`);
        const playerPromptDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            actionDiscoverySystem: /** @type {IActionDiscoverySystem} */ (c.resolve(tokens.IActionDiscoverySystem)),
            promptOutputPort: /** @type {IPromptOutputPort} */ (c.resolve(tokens.IPromptOutputPort)),
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)), // Use IEntityManager
            gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.IGameDataRepository)) // Use IGameDataRepository
        };
        for (const [key, value] of Object.entries(playerPromptDeps)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.IPlayerPromptService)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(`Missing dependency "${key}" for ${String(tokens.IPlayerPromptService)}`);
            }
        }
        log.debug(`Domain-services Registration: Dependencies for ${String(tokens.IPlayerPromptService)} resolved, creating instance.`);
        return new PlayerPromptService(playerPromptDeps); // Instantiates the concrete class
    });
    log.debug(`Domain Services Registration: Registered ${String(tokens.IPlayerPromptService)} factory.`);

    // --- VVVVVV ADDED REGISTRATION FOR SubscriptionLifecycleManager VVVVVV ---
    r.singletonFactory(tokens.SubscriptionLifecycleManager, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${String(tokens.SubscriptionLifecycleManager)}...`);
        const slmDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            commandInputPort: /** @type {ICommandInputPort} */ (c.resolve(tokens.ICommandInputPort)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
        };
        for (const [key, value] of Object.entries(slmDeps)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.SubscriptionLifecycleManager)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(`Missing dependency "${key}" for ${String(tokens.SubscriptionLifecycleManager)}`);
            }
        }
        log.debug(`Domain-services Registration: Dependencies for ${String(tokens.SubscriptionLifecycleManager)} resolved, creating instance.`);
        return new SubscriptionLifecycleManager(slmDeps);
    });
    log.debug(`Domain Services Registration: Registered ${String(tokens.SubscriptionLifecycleManager)} factory.`);
    // --- ^^^^^^ ADDED REGISTRATION FOR SubscriptionLifecycleManager ^^^^^^ ---

    log.info('Domain-services Registration: complete.');
}