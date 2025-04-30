// src/core/config/registrations/domainServicesRegistrations.js
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import ConditionEvaluationService from '../../../services/conditionEvaluationService.js';
import {ItemTargetResolverService} from "../../../services/itemTargetResolver.js";
import TargetResolutionService from "../../../services/targetResolutionService.js";
import {ActionValidationContextBuilder} from "../../../services/actionValidationContextBuilder.js";
import {PrerequisiteEvaluationService} from "../../../services/prerequisiteEvaluationService.js";
import {DomainContextCompatibilityChecker} from "../../../validation/domainContextCompatibilityChecker.js";
import {ActionValidationService} from "../../../services/actionValidationService.js";
import PayloadValueResolverService from "../../../services/payloadValueResolverService.js";
import ActionExecutor from "../../../actions/actionExecutor.js";
import CommandParser from "../../commandParser.js";
import JsonLogicEvaluationService from '../../../logic/jsonLogicEvaluationService.js';
import GameStateManager from '../../gameStateManager.js';
// --- ADDED TurnOrderService IMPORT ---
import {TurnOrderService} from "../../turnOrder/turnOrderService.js"; // Adjust path if needed

// --- Type Imports for JSDoc ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../../services/gameDataRepository.js').GameDataRepository} GameDataRepository */


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
        [tokens.EntityManager, tokens.ValidatedEventDispatcher, tokens.ConditionEvaluationService, tokens.ILogger]);
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
    r.single(tokens.ActionExecutor, ActionExecutor,
        [tokens.GameDataRepository, tokens.TargetResolutionService, tokens.ActionValidationService,
            tokens.PayloadValueResolverService, tokens.EventBus, tokens.ILogger, tokens.ValidatedEventDispatcher]);
    r.single(tokens.GameStateManager, GameStateManager, []); // Assuming GameStateManager has no dependencies in constructor

    // --- CommandParser Registration using explicit factory function ---
    container.register(tokens.CommandParser, c => {
        const gameDataRepoInstance = /** @type {GameDataRepository} */ (c.resolve(tokens.GameDataRepository));
        return new CommandParser(gameDataRepoInstance);
    }, {lifecycle: 'singleton'});

    // --- ADDED TurnOrderService REGISTRATION ---
    // Register TurnOrderService as a singleton using a factory function
    // to explicitly pass the dependency object.
    r.singletonFactory(tokens.ITurnOrderService, (c) => {
        const dependencies = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger))
            // Add other dependencies here if TurnOrderService constructor changes
        };
        return new TurnOrderService(dependencies);
    });
    log.debug(`Domain-services Registration: Registered ${tokens.ITurnOrderService}.`);
    // --- END ADDED REGISTRATION ---


    log.info('Domain-services Registration: complete.');
}
