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
import { ActionPipelineOrchestrator } from '../../actions/actionPipelineOrchestrator.js';
import { TargetResolutionService } from '../../actions/targetResolutionService.js';
import { UnifiedScopeResolver } from '../../actions/scopes/unifiedScopeResolver.js';
import { ScopeCacheStrategy } from '../../actions/scopes/scopeCacheStrategy.js';
import { ActionIndex } from '../../actions/actionIndex.js';
import { ActionValidationContextBuilder } from '../../actions/validation/actionValidationContextBuilder.js';
import { PrerequisiteEvaluationService } from '../../actions/validation/prerequisiteEvaluationService.js';
import { ActionErrorContextBuilder } from '../../actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../actions/errors/fixSuggestionEngine.js';
import CommandProcessor from '../../commands/commandProcessor.js';
import { StructuredTrace } from '../../actions/tracing/structuredTrace.js';
import TargetContextBuilder from '../../scopeDsl/utils/targetContextBuilder.js';
import { MultiTargetResolutionStage } from '../../actions/pipeline/stages/MultiTargetResolutionStage.js';

// --- Helper Function Imports ---
import ActionCommandFormatter from '../../actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../actions/formatters/MultiTargetActionFormatter.js';
import { getActorLocation } from '../../utils/actorLocationUtils.js';
import { getEntityDisplayName } from '../../utils/entityUtils.js';

// --- Infrastructure Dependency ---
import ScopeRegistry from '../../scopeDsl/scopeRegistry.js';

// --- Turn Command Processing Services ---
import { CommandDispatcher } from '../../turns/states/helpers/services/commandDispatcher.js';
import { DirectiveExecutor } from '../../turns/states/helpers/services/directiveExecutor.js';
import { ResultInterpreter } from '../../turns/states/helpers/services/resultInterpreter.js';
import { UnifiedErrorHandler } from '../../actions/errors/unifiedErrorHandler.js';
import TurnDirectiveStrategyResolver, {
  DEFAULT_STRATEGY_MAP,
} from '../../turns/strategies/turnDirectiveStrategyResolver.js';

/**
 * Creates a MultiTargetActionFormatter with legacy formatter as base
 *
 * @param {ILogger} logger - Logger instance
 * @returns {MultiTargetActionFormatter} Configured formatter
 */
function createMultiTargetFormatter(logger) {
  const baseFormatter = new ActionCommandFormatter();
  return new MultiTargetActionFormatter(baseFormatter, logger);
}

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

  // --- Scope Cache Strategy ---
  // Must be registered before UnifiedScopeResolver
  registrar.singletonFactory(tokens.IScopeCacheStrategy, (c) => {
    return new ScopeCacheStrategy({
      logger: c.resolve(tokens.ILogger),
      maxSize: 1000,
      defaultTTL: 5000,
    });
  });
  logger.debug(
    'Command and Action Registration: Registered ScopeCacheStrategy.'
  );

  // --- Unified Scope Resolver ---
  // Must be registered before TargetResolutionService
  registrar.singletonFactory(tokens.IUnifiedScopeResolver, (c) => {
    return new UnifiedScopeResolver({
      scopeRegistry: c.resolve(tokens.IScopeRegistry),
      scopeEngine: c.resolve(tokens.IScopeEngine),
      entityManager: c.resolve(tokens.IEntityManager),
      jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
      dslParser: c.resolve(tokens.DslParser),
      logger: c.resolve(tokens.ILogger),
      actionErrorContextBuilder: c.resolve(tokens.IActionErrorContextBuilder),
      cacheStrategy: c.resolve(tokens.IScopeCacheStrategy),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered UnifiedScopeResolver.'
  );

  // --- Target Context Builder ---
  // Must be registered before any stage that uses it
  registrar.singletonFactory(tokens.ITargetContextBuilder, (c) => {
    return new TargetContextBuilder({
      entityManager: c.resolve(tokens.IEntityManager),
      gameStateManager: {}, // TODO: Replace with actual game state manager when available
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered TargetContextBuilder.'
  );

  // --- Multi-Target Resolution Stage ---
  registrar.singletonFactory(tokens.IMultiTargetResolutionStage, (c) => {
    return new MultiTargetResolutionStage({
      targetDependencyResolver: c.resolve(tokens.ITargetDependencyResolver),
      legacyTargetCompatibilityLayer: c.resolve(
        tokens.ILegacyTargetCompatibilityLayer
      ),
      scopeContextBuilder: c.resolve(tokens.IScopeContextBuilder),
      targetDisplayNameResolver: c.resolve(tokens.ITargetDisplayNameResolver),
      unifiedScopeResolver: c.resolve(tokens.IUnifiedScopeResolver),
      entityManager: c.resolve(tokens.IEntityManager),
      targetResolver: c.resolve(tokens.ITargetResolutionService),
      targetContextBuilder: c.resolve(tokens.ITargetContextBuilder),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered MultiTargetResolutionStage.'
  );

  // --- Target Resolution Service ---
  // Must be registered before ActionDiscoveryService
  registrar.singletonFactory(tokens.ITargetResolutionService, (c) => {
    return new TargetResolutionService({
      unifiedScopeResolver: c.resolve(tokens.IUnifiedScopeResolver),
      logger: c.resolve(tokens.ILogger),
      serviceSetup: c.resolve(tokens.ServiceSetup),
    });
  });

  // --- TraceContext Factory ---
  // Register the factory that creates StructuredTrace instances for enhanced tracing
  registrar.singletonFactory(tokens.TraceContextFactory, (c) => {
    return () => {
      // Get trace configuration if available
      let traceConfig = null;
      try {
        traceConfig = c.resolve(tokens.ITraceConfiguration);
      } catch {
        // Configuration might not be loaded yet
        traceConfig = { traceAnalysisEnabled: false };
      }

      return new StructuredTrace(null, traceConfig);
    };
  });
  logger.debug(
    'Command and Action Registration: Registered TraceContextFactory.'
  );

  // --- Fix Suggestion Engine ---
  // Must be registered before ActionErrorContextBuilder
  registrar.singletonFactory(tokens.IFixSuggestionEngine, (c) => {
    return new FixSuggestionEngine({
      logger: c.resolve(tokens.ILogger),
      gameDataRepository: c.resolve(tokens.IGameDataRepository),
      actionIndex: c.resolve(tokens.ActionIndex),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered FixSuggestionEngine.'
  );

  // --- Action Error Context Builder ---
  // Must be registered before ActionCandidateProcessor
  registrar.singletonFactory(tokens.IActionErrorContextBuilder, (c) => {
    return new ActionErrorContextBuilder({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      fixSuggestionEngine: c.resolve(tokens.IFixSuggestionEngine),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered ActionErrorContextBuilder.'
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
      actionCommandFormatter: createMultiTargetFormatter(
        c.resolve(tokens.ILogger)
      ),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      getEntityDisplayNameFn: getEntityDisplayName,
      logger: c.resolve(tokens.ILogger),
      actionErrorContextBuilder: c.resolve(tokens.IActionErrorContextBuilder),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered ActionCandidateProcessor.'
  );

  // --- Action Pipeline Orchestrator ---
  // Must be registered before ActionDiscoveryService
  registrar.singletonFactory(tokens.ActionPipelineOrchestrator, (c) => {
    return new ActionPipelineOrchestrator({
      actionIndex: c.resolve(tokens.ActionIndex),
      prerequisiteService: c.resolve(tokens.PrerequisiteEvaluationService),
      targetService: c.resolve(tokens.ITargetResolutionService),
      formatter: createMultiTargetFormatter(c.resolve(tokens.ILogger)),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      getEntityDisplayNameFn: getEntityDisplayName,
      errorBuilder: c.resolve(tokens.IActionErrorContextBuilder),
      logger: c.resolve(tokens.ILogger),
      unifiedScopeResolver: c.resolve(tokens.IUnifiedScopeResolver),
      targetContextBuilder: c.resolve(tokens.ITargetContextBuilder),
      multiTargetResolutionStage: c.resolve(tokens.IMultiTargetResolutionStage),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered ActionPipelineOrchestrator.'
  );

  // --- Action Discovery & Execution ---
  registrar
    .tagged(INITIALIZABLE)
    .singletonFactory(tokens.IActionDiscoveryService, (c) => {
      const logger = c.resolve(tokens.ILogger);

      // Get optional action tracing dependencies
      let actionAwareTraceFactory = null;
      let actionTraceFilter = null;

      try {
        // Try to resolve action-aware trace factory if registered
        if (c.isRegistered(tokens.IActionAwareStructuredTrace)) {
          actionAwareTraceFactory = c.resolve(
            tokens.IActionAwareStructuredTrace
          );
        }
      } catch (err) {
        logger.debug('ActionAwareStructuredTrace not available', err);
      }

      try {
        // Try to resolve action trace filter if registered
        if (c.isRegistered(tokens.IActionTraceFilter)) {
          actionTraceFilter = c.resolve(tokens.IActionTraceFilter);
        }
      } catch (err) {
        logger.debug('ActionTraceFilter not available', err);
      }

      // Log action tracing availability
      const actionTracingAvailable = !!(
        actionAwareTraceFactory && actionTraceFilter
      );
      logger.info(
        `ActionDiscoveryService: Action tracing ${actionTracingAvailable ? 'available' : 'not available'}`,
        {
          hasActionAwareTraceFactory: !!actionAwareTraceFactory,
          hasActionTraceFilter: !!actionTraceFilter,
        }
      );

      return new ActionDiscoveryService({
        entityManager: c.resolve(tokens.IEntityManager),
        logger,
        serviceSetup: c.resolve(tokens.ServiceSetup),
        actionPipelineOrchestrator: c.resolve(
          tokens.ActionPipelineOrchestrator
        ),
        traceContextFactory: c.resolve(tokens.TraceContextFactory),
        actionAwareTraceFactory,
        actionTraceFilter,
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
      eventDispatchService: c.resolve(tokens.EventDispatchService),
    });
  });
  logger.debug(
    `Command and Action Registration: Registered ${String(tokens.ICommandProcessor)}.`
  );

  // --- Command Processing Services ---
  // These services provide separation of concerns for the command processing workflow

  // Register UnifiedErrorHandler
  registrar.singletonFactory(tokens.UnifiedErrorHandler, (c) => {
    return new UnifiedErrorHandler({
      actionErrorContextBuilder: c.resolve(tokens.IActionErrorContextBuilder),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered UnifiedErrorHandler.'
  );

  // Register DirectiveStrategyResolver
  registrar.singletonFactory(tokens.DirectiveStrategyResolver, (c) => {
    return new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP);
  });
  logger.debug(
    'Command and Action Registration: Registered DirectiveStrategyResolver.'
  );

  registrar.singletonFactory(tokens.CommandDispatcher, (c) => {
    return new CommandDispatcher({
      commandProcessor: c.resolve(tokens.ICommandProcessor),
      unifiedErrorHandler: c.resolve(tokens.UnifiedErrorHandler),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered CommandDispatcher.'
  );

  registrar.singletonFactory(tokens.DirectiveExecutor, (c) => {
    return new DirectiveExecutor({
      directiveStrategyResolver: c.resolve(tokens.DirectiveStrategyResolver),
      unifiedErrorHandler: c.resolve(tokens.UnifiedErrorHandler),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered DirectiveExecutor.'
  );

  registrar.singletonFactory(tokens.ResultInterpreter, (c) => {
    return new ResultInterpreter({
      commandOutcomeInterpreter: c.resolve(tokens.ICommandOutcomeInterpreter),
      unifiedErrorHandler: c.resolve(tokens.UnifiedErrorHandler),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'Command and Action Registration: Registered ResultInterpreter.'
  );

  logger.debug('Command and Action Registration: Completed.');
}
