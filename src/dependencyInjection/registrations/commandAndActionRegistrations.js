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
/** @typedef {import('../../actions/validation/actionValidationService.js').ActionValidationService} ActionValidationService_Interface */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { INITIALIZABLE } from '../tags.js';

// --- Service Imports ---
import { ActionDiscoveryService } from '../../actions/actionDiscoveryService.js';
import { ActionIndex } from '../../actions/actionIndex.js';
import { ActionValidationContextBuilder } from '../../actions/validation/actionValidationContextBuilder.js';
import { PrerequisiteEvaluationService } from '../../actions/validation/prerequisiteEvaluationService.js';
import { DomainContextCompatibilityChecker } from '../../validation/domainContextCompatibilityChecker.js';
import { ActionValidationService } from '../../actions/validation/actionValidationService.js';
import CommandProcessor from '../../commands/commandProcessor.js';

// --- Helper Function Imports ---
import { formatActionCommand } from '../../actions/actionFormatter.js';
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

  // --- Action Discovery & Execution ---
  registrar
    .tagged(INITIALIZABLE)
    .singletonFactory(tokens.IActionDiscoveryService, (c) => {
      return new ActionDiscoveryService({
        gameDataRepository: c.resolve(tokens.IGameDataRepository),
        entityManager: c.resolve(tokens.IEntityManager),
        actionValidationService: c.resolve(tokens.ActionValidationService),
        actionIndex: c.resolve(tokens.ActionIndex),
        logger: c.resolve(tokens.ILogger),
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        scopeRegistry: c.resolve(tokens.IScopeRegistry),
        scopeEngine: c.resolve(tokens.IScopeEngine),
        getActorLocationFn: getActorLocation,
        getEntityDisplayNameFn: getEntityDisplayName,
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
  registrar.single(
    tokens.DomainContextCompatibilityChecker,
    DomainContextCompatibilityChecker,
    [tokens.ILogger]
  );
  registrar.single(tokens.ActionValidationService, ActionValidationService, [
    tokens.IEntityManager,
    tokens.ILogger,
    tokens.DomainContextCompatibilityChecker,
    tokens.PrerequisiteEvaluationService,
  ]);
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
