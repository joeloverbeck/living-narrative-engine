/**
 * @file Registers services related to command and action processing, including discovery, validation, and execution logic.
 * @see src/dependencyInjection/registrations/commandAndActionRegistrations.js
 */

/* eslint-env node */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService_Interface */
/** @typedef {import('../../actions/validation/prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService_Interface */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { INITIALIZABLE } from '../tags.js';

// --- Service Imports ---
import { ActionDiscoveryService } from '../../actions/actionDiscoveryService.js';
import { ActionCandidateProcessor } from '../../actions/actionCandidateProcessor.js';
import { TargetResolutionService } from '../../actions/targetResolutionService.js';
import { ActionIndex } from '../../actions/actionIndex.js';
import { ActionValidationContextBuilder } from '../../actions/validation/actionValidationContextBuilder.js';
import { PrerequisiteEvaluationService } from '../../actions/validation/prerequisiteEvaluationService.js';
import CommandProcessor from '../../commands/commandProcessor.js';
import { TraceContext as TraceContextImpl } from '../../actions/tracing/traceContext.js';

// --- Helper Function Imports ---
import ActionCommandFormatter from '../../actions/actionFormatter.js';
import { getActorLocation } from '../../utils/actorLocationUtils.js';
import { getEntityDisplayName } from '../../utils/entityUtils.js';

// --- Infrastructure Dependency ---
import ScopeRegistry from '../../scopeDsl/scopeRegistry.js';

/**
 * Registers command and action related services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerCommandAndAction(container) {
  const registrar = new Registrar(container);
  const c = container; // Shorthand
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Command and Action Registration: Starting...');

  // --- Scope Registry ---
  // Must be registered before ActionDiscoveryService
  registrar.singletonFactory(tokens.IScopeRegistry, (c) => {
    return new ScopeRegistry({
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
  });

  // --- Action Index ---
  // Must be registered before ActionDiscoveryService
  registrar.single(tokens.ActionIndex, ActionIndex, [
    tokens.ILogger,
    tokens.IEntityManager,
  ]);

  // --- Target Resolution Service ---
  // Must be registered before ActionDiscoveryService
  registrar.singletonFactory(tokens.ITargetResolutionService, (c) => {
    return new TargetResolutionService({
      scopeRegistry: c.resolve(tokens.IScopeRegistry),
      scopeEngine: c.resolve(tokens.IScopeEngine),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
    });
  });

  // --- TraceContext Factory ---
  // Register the factory that creates TraceContext instances
  registrar.singletonFactory(tokens.TraceContextFactory, () => {
    return () => new TraceContextImpl();
  });
  logger.debug(
    'Command and Action Registration: Registered TraceContextFactory.'
  );

  // --- Action Candidate Processor ---
  // Must be registered before ActionDiscoveryService
  registrar.singletonFactory(tokens.ActionCandidateProcessor, (c) => {
    return new ActionCandidateProcessor({
      prerequisiteEvaluationService: c.resolve(
        tokens.PrerequisiteEvaluationService
      ),
      targetResolutionService: c.resolve(tokens.ITargetResolutionService),
      entityManager: c.resolve(tokens.IEntityManager),
      actionCommandFormatter: new ActionCommandFormatter(),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      getEntityDisplayNameFn: getEntityDisplayName,
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered ActionCandidateProcessor.'
  );

  // --- Action Discovery & Execution ---
  registrar
    .tagged(INITIALIZABLE)
    .singletonFactory(tokens.IActionDiscoveryService, (c) => {
      return new ActionDiscoveryService({
        entityManager: c.resolve(tokens.IEntityManager),
        actionIndex: c.resolve(tokens.ActionIndex),
        logger: c.resolve(tokens.ILogger),
        actionCandidateProcessor: c.resolve(tokens.ActionCandidateProcessor),
        traceContextFactory: c.resolve(tokens.TraceContextFactory),
        getActorLocationFn: getActorLocation,
      });
    });
  logger.debug(
    `Command and Action Registration: Registered ${String(tokens.IActionDiscoveryService)}.`
  );

  registrar.single(
    tokens.ActionValidationContextBuilder,
    ActionValidationContextBuilder,
    [tokens.IEntityManager, tokens.ILogger]
  );
  registrar.single(
    tokens.PrerequisiteEvaluationService,
    PrerequisiteEvaluationService,
    [
      tokens.ILogger,
      tokens.JsonLogicEvaluationService,
      tokens.ActionValidationContextBuilder,
      tokens.IGameDataRepository,
    ]
  );
  logger.debug(
    `Command and Action Registration: Registered Action Validation services.`
  );

  // --- Command Processing ---

  registrar.singletonFactory(tokens.ICommandProcessor, (c) => {
    return new CommandProcessor({
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `Command and Action Registration: Registered ${String(tokens.ICommandProcessor)}.`
  );

  logger.debug('Command and Action Registration: Completed.');
}
