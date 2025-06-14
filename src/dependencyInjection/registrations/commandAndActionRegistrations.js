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
/** @typedef {import('../../commands/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { INITIALIZABLE } from '../tags.js';

// --- Service Imports ---
import { ActionDiscoveryService } from '../../actions/actionDiscoveryService.js';
import { ActionValidationContextBuilder } from '../../actions/validation/actionValidationContextBuilder.js';
import { PrerequisiteEvaluationService } from '../../actions/validation/prerequisiteEvaluationService.js';
import { DomainContextCompatibilityChecker } from '../../validation/domainContextCompatibilityChecker.js';
import { ActionValidationService } from '../../actions/validation/actionValidationService.js';
import CommandParser from '../../commands/commandParser.js';
import CommandProcessor from '../../commands/commandProcessor.js';

// --- Helper Function Imports ---
import { formatActionCommand } from '../../actions/actionFormatter.js';
import { getEntityIdsForScopes } from '../../entities/entityScopeService.js';

/**
 * Registers command and action related services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerCommandAndAction(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Command and Action Registration: Starting...');

  // --- Action Discovery & Validation ---

  r.tagged(INITIALIZABLE).singletonFactory(
    tokens.IActionDiscoveryService,
    (c) =>
      new ActionDiscoveryService({
        gameDataRepository: c.resolve(tokens.IGameDataRepository),
        entityManager: c.resolve(tokens.IEntityManager),
        actionValidationService: c.resolve(tokens.ActionValidationService),
        logger: c.resolve(tokens.ILogger),
        formatActionCommandFn: formatActionCommand,
        getEntityIdsForScopesFn: getEntityIdsForScopes,
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  logger.debug(
    `Command and Action Registration: Registered ${String(tokens.IActionDiscoveryService)}.`
  );

  r.single(
    tokens.ActionValidationContextBuilder,
    ActionValidationContextBuilder,
    [tokens.IEntityManager, tokens.ILogger]
  );
  r.single(
    tokens.PrerequisiteEvaluationService,
    PrerequisiteEvaluationService,
    [
      tokens.ILogger,
      tokens.JsonLogicEvaluationService,
      tokens.ActionValidationContextBuilder,
    ]
  );
  r.single(
    tokens.DomainContextCompatibilityChecker,
    DomainContextCompatibilityChecker,
    [tokens.ILogger]
  );
  r.single(tokens.ActionValidationService, ActionValidationService, [
    tokens.IEntityManager,
    tokens.ILogger,
    tokens.DomainContextCompatibilityChecker,
    tokens.PrerequisiteEvaluationService,
  ]);
  logger.debug(
    `Command and Action Registration: Registered Action Validation services.`
  );

  // --- Command Parsing and Processing ---

  r.singletonFactory(
    tokens.ICommandParser,
    (c) => new CommandParser(c.resolve(tokens.IGameDataRepository))
  );
  logger.debug(
    `Command and Action Registration: Registered ${String(tokens.ICommandParser)}.`
  );

  r.singletonFactory(tokens.ICommandProcessor, (c) => {
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
