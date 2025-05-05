// src/core/config/registrations/domainServicesRegistrations.js
// ****** MODIFIED FILE ******
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
import ActionExecutor from "../../../actions/actionExecutor.js"; // Concrete Class Import
import CommandParser from "../../commandParser.js";             // Concrete Class Import
import JsonLogicEvaluationService from '../../../logic/jsonLogicEvaluationService.js';
import WorldContext from '../../worldContext.js';       // Concrete Class Import
import {TurnOrderService} from "../../turnOrder/turnOrderService.js"; // Adjust path if needed
import CommandProcessor from "../../commandProcessor.js";
import PlayerPromptService from '../../services/playerPromptService.js'; // <<< ADDED IMPORT

// --- Type Imports for JSDoc ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../interfaces/IActionExecutor.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */ // <<< CORRECTED path
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */ // <<< ADDED
/** @typedef {import('../../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */ // <<< ADDED


/**
 * Registers core domain logic services.
 * These services typically encapsulate business rules and orchestrate interactions
 * between different parts of the game state, but are not necessarily systems
 * run every tick.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerDomainServices(container) {
    const r = new Registrar(container);
    /** @type {ILogger} */
    const log = container.resolve(tokens.ILogger);
    log.debug('Domain-services Registration: starting…');

    // Register other domain services using the helper or direct registration as preferred
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

    // --- Register ActionExecutor against its Interface Token ---
    r.single(tokens.IActionExecutor, ActionExecutor,
        [tokens.GameDataRepository, tokens.TargetResolutionService, tokens.ActionValidationService,
            tokens.PayloadValueResolverService, tokens.EventBus, tokens.ILogger, tokens.IValidatedEventDispatcher]);
    log.debug(`Domain-services Registration: Registered ${tokens.IActionExecutor}.`);

    // --- Register IWorldContext ---
    r.singletonFactory(tokens.IWorldContext, c => new WorldContext(
        /** @type {EntityManager} */ (c.resolve(tokens.EntityManager)),
        /** @type {ILogger} */ (c.resolve(tokens.ILogger))
    ));
    log.debug(`Domain Services Registration: Registered ${String(tokens.IWorldContext)}.`);

    // --- Register CommandParser against its Interface Token using explicit factory function ---
    container.register(tokens.ICommandParser, c => {
        const gameDataRepoInstance = /** @type {GameDataRepository} */ (c.resolve(tokens.GameDataRepository));
        return new CommandParser(gameDataRepoInstance);
    }, {lifecycle: 'singleton'});
    log.debug(`Domain-services Registration: Registered ${tokens.ICommandParser}.`);

    // --- Register CommandProcessor against its Interface Token using explicit factory function ---
    r.singletonFactory(tokens.ICommandProcessor, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${tokens.ICommandProcessor}...`);
        const commandProcessorDeps = {
            commandParser: /** @type {ICommandParser} */ (c.resolve(tokens.ICommandParser)),
            actionExecutor: /** @type {IActionExecutor} */ (c.resolve(tokens.IActionExecutor)),
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher)),
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            entityManager: /** @type {EntityManager} */ (c.resolve(tokens.EntityManager)),
            gameDataRepository: /** @type {GameDataRepository} */ (c.resolve(tokens.GameDataRepository)),
        };
        log.debug(`Domain-services Registration: Dependencies for ${tokens.ICommandProcessor} resolved.`);
        return new CommandProcessor(commandProcessorDeps);
    });
    log.debug(`Domain-services Registration: Registered ${tokens.ICommandProcessor} factory.`);

    // --- Register TurnOrderService ---
    r.singletonFactory(tokens.ITurnOrderService, (c) => {
        const dependencies = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger))
        };
        return new TurnOrderService(dependencies);
    });
    log.debug(`Domain-services Registration: Registered ${tokens.ITurnOrderService}.`);

    // --- Register PlayerPromptService --- // <<< ADDED REGISTRATION BLOCK
    r.singletonFactory(tokens.PlayerPromptService, (c) => {
        log.debug(`Domain-services Registration: Factory creating ${tokens.PlayerPromptService}...`);
        // Resolve all dependencies for PlayerPromptService's options object
        const playerPromptDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            actionDiscoverySystem: /** @type {IActionDiscoverySystem} */ (c.resolve(tokens.IActionDiscoverySystem)),
            promptOutputPort: /** @type {IPromptOutputPort} */ (c.resolve(tokens.IPromptOutputPort)),
            worldContext: /** @type {IWorldContext} */ (c.resolve(tokens.IWorldContext)),
            entityManager: /** @type {EntityManager} */ (c.resolve(tokens.EntityManager)),
            gameDataRepository: /** @type {GameDataRepository} */ (c.resolve(tokens.GameDataRepository))
        };
        // Verify all dependencies were resolved (optional, but good practice)
        for (const [key, value] of Object.entries(playerPromptDeps)) {
            if (!value) {
                log.error(`Domain-services Registration: Failed to resolve dependency "${key}" for ${tokens.PlayerPromptService}.`);
                throw new Error(`Missing dependency "${key}" for ${tokens.PlayerPromptService}`);
            }
        }
        log.debug(`Domain-services Registration: Dependencies for ${tokens.PlayerPromptService} resolved.`);
        return new PlayerPromptService(playerPromptDeps);
    });
    log.debug(`Domain Services Registration: Registered ${tokens.PlayerPromptService} factory.`);
    // --- END ADDED REGISTRATION BLOCK ---

    log.info('Domain-services Registration: complete.');
}