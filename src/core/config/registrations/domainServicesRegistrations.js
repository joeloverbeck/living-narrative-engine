// src/core/config/registrations/domainServicesRegistrations.js

import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import ConditionEvaluationService from '../../../services/conditionEvaluationService.js';
import {ItemTargetResolverService} from "../../../services/itemTargetResolver.js";
import TargetResolutionService from "../../../services/targetResolutionService.js";
import {ActionValidationContextBuilder} from "../../../services/actionValidationContextBuilder.js";
import {PrerequisiteEvaluationService} from "../../../services/prerequisiteEvaluationService.js";
import {DomainContextCompatibilityChecker} from "../../../validation/domainContextCompatibilityChecker.js";
import {ActionValidationService} from "../../../services/actionValidationService.js";
import PayloadValueResolverService from "../../../services/payloadValueResolverService.js";
import CommandParser from "../../commandParser.js";
import JsonLogicEvaluationService from '../../../logic/jsonLogicEvaluationService.js';
import WorldContext from '../../worldContext.js';
import {TurnOrderService} from "../../turnOrder/turnOrderService.js";
import CommandProcessor from "../../commandProcessor.js";
import PlayerPromptService from '../../services/playerPromptService.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */ // <<< UPDATED FOR CONSISTENCY
/** @typedef {import('../../interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */ // <<< UPDATED FOR CONSISTENCY
/** @typedef {import('../../../services/targetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */

// --- Concrete type imports for DI resolution, if needed for casting ---
/** @typedef {import('../../services/gameDataRepository.js').GameDataRepository} GameDataRepository */ // Kept for casting clarity if needed
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */ // Kept for casting clarity if needed


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

    // ... (other registrations remain the same) ...
    r.single(tokens.ConditionEvaluationService, ConditionEvaluationService, [tokens.EntityManager]);
    r.single(tokens.ItemTargetResolverService, ItemTargetResolverService,
        [tokens.EntityManager, tokens.IValidatedEventDispatcher, tokens.ConditionEvaluationService, tokens.ILogger]);
    r.single(tokens.TargetResolutionService, TargetResolutionService, []);
    r.single(tokens.JsonLogicEvaluationService, JsonLogicEvaluationService, [tokens.ILogger]);
    r.single(tokens.ActionValidationContextBuilder, ActionValidationContextBuilder,
        [tokens.EntityManager, tokens.ILogger]);
    r.single(tokens.PrerequisiteEvaluationService, PrerequisiteEvaluationService,
        [tokens.ILogger, tokens.JsonLogicEvaluationService, tokens.ActionValidationContextBuilder]);
    r.single(tokens.DomainContextCompatibilityChecker, DomainContextCompatibilityChecker, [tokens.ILogger]);
    r.single(tokens.ActionValidationService, ActionValidationService,
        [tokens.EntityManager, tokens.ILogger, tokens.DomainContextCompatibilityChecker, tokens.PrerequisiteEvaluationService]);
    r.single(tokens.PayloadValueResolverService, PayloadValueResolverService, [tokens.ILogger]);

    r.singletonFactory(tokens.IWorldContext, c => new WorldContext(
        /** @type {EntityManager} */ (c.resolve(tokens.EntityManager)), // Concrete EntityManager needed by WorldContext constructor
        /** @type {ILogger} */ (c.resolve(tokens.ILogger))
    ));
    log.debug(`Domain Services Registration: Registered ${String(tokens.IWorldContext)}.`);

    container.register(tokens.ICommandParser, c => {
        const gameDataRepoInstance = /** @type {GameDataRepository} */ (c.resolve(tokens.GameDataRepository)); // Concrete GameDataRepository needed by CommandParser constructor
        return new CommandParser(gameDataRepoInstance);
    }, {lifecycle: 'singleton'});
    log.debug(`Domain-services Registration: Registered ${String(tokens.ICommandParser)}.`);

    // --- Register CommandProcessor against its Interface Token using factory ---
    r.singletonFactory(tokens.ICommandProcessor, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${String(tokens.ICommandProcessor)}...`);

        // CommandProcessor constructor now expects IEntityManager and IGameDataRepository
        // The DI container will resolve concrete EntityManager and GameDataRepository,
        // which implement these interfaces.
        const commandProcessorDeps = {
            commandParser: /** @type {ICommandParser} */ (c.resolve(tokens.ICommandParser)),
            targetResolutionService: /** @type {ITargetResolutionService} */ (c.resolve(tokens.TargetResolutionService)),
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (c.resolve(tokens.ISafeEventDispatcher)),
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.EntityManager)), // Resolves concrete EntityManager, cast to IEntityManager
            gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.GameDataRepository)), // Resolves concrete GameDataRepository, cast to IGameDataRepository
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
            log.error(errorMsg);
            throw new Error(`Missing dependency "logger" for ${String(tokens.ITurnOrderService)}`);
        }
        return new TurnOrderService(dependencies);
    });
    log.debug(`Domain-services Registration: Registered ${String(tokens.ITurnOrderService)}.`);

    r.singletonFactory(tokens.PlayerPromptService, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${String(tokens.PlayerPromptService)}...`);
        const playerPromptDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            actionDiscoverySystem: /** @type {IActionDiscoverySystem} */ (c.resolve(tokens.IActionDiscoverySystem)),
            promptOutputPort: /** @type {IPromptOutputPort} */ (c.resolve(tokens.IPromptOutputPort)),
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            // PlayerPromptService constructor might still expect concrete types or interfaces.
            // Assuming it expects interfaces or compatible concrete types for now.
            entityManager: /** @type {IEntityManager} */ (c.resolve(tokens.EntityManager)),
            gameDataRepository: /** @type {IGameDataRepository} */ (c.resolve(tokens.GameDataRepository))
        };
        for (const [key, value] of Object.entries(playerPromptDeps)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.PlayerPromptService)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(`Missing dependency "${key}" for ${String(tokens.PlayerPromptService)}`);
            }
        }
        log.debug(`Domain-services Registration: Dependencies for ${String(tokens.PlayerPromptService)} resolved, creating instance.`);
        return new PlayerPromptService(playerPromptDeps);
    });
    log.debug(`Domain Services Registration: Registered ${String(tokens.PlayerPromptService)} factory.`);

    log.info('Domain-services Registration: complete.');
}