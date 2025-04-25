// src/core/config/registrations/domainServicesRegistrations.js
import {tokens} from '../../tokens.js';
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
// --- ADDED IMPORTS ---
import JsonLogicEvaluationService from '../../../logic/jsonLogicEvaluationService.js';
import GameStateManager from '../../gameStateManager.js'; // Corrected path relative to this file
// --- END ADDED IMPORTS ---


export function registerDomainServices(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger);
    log.debug('Domain-services Registration: starting…');

    r.single(tokens.ConditionEvaluationService, ConditionEvaluationService, [tokens.EntityManager]);
    r.single(tokens.ItemTargetResolverService, ItemTargetResolverService,
        [tokens.EntityManager, tokens.ValidatedEventDispatcher, tokens.ConditionEvaluationService, tokens.ILogger]);
    r.single(tokens.TargetResolutionService, TargetResolutionService, []);

    // Now JsonLogicEvaluationService is defined via import
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

    // Now GameStateManager is defined via import
    r.single(tokens.GameStateManager, GameStateManager, []);
    r.single(tokens.CommandParser, CommandParser, [tokens.GameDataRepository]);

    log.info('Domain-services Registration: complete.');
}