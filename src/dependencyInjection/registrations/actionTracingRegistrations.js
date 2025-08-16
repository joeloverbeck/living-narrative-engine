/**
 * @file Dependency injection registrations for action tracing services
 */

import { Registrar } from '../../utils/registrarHelpers.js';
import { tokens } from '../tokens.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';
import ActionTraceConfigLoader from '../../configuration/actionTraceConfigLoader.js';
import ActionTraceConfigValidator from '../../configuration/actionTraceConfigValidator.js';
import TraceDirectoryManager from '../../actions/tracing/traceDirectoryManager.js';
import ActionTraceFilter from '../../actions/tracing/actionTraceFilter.js';
import ActionAwareStructuredTrace from '../../actions/tracing/actionAwareStructuredTrace.js';
import { EventDispatchTracer } from '../../events/tracing/eventDispatchTracer.js';
import { ActionTraceOutputService } from '../../actions/tracing/actionTraceOutputService.js';
import { IndexedDBStorageAdapter } from '../../storage/indexedDBStorageAdapter.js';
import { JsonTraceFormatter } from '../../actions/tracing/jsonTraceFormatter.js';
import { HumanReadableFormatter } from '../../actions/tracing/humanReadableFormatter.js';
import {
  NamingStrategy,
  TimestampFormat,
} from '../../actions/tracing/actionTraceOutputService.js';
import { ErrorMetricsService } from '../../actions/tracing/metrics/errorMetricsService.js';
import { RetryManager } from '../../actions/tracing/resilience/retryManager.js';
import { RecoveryManager } from '../../actions/tracing/recovery/recoveryManager.js';
import { TraceErrorHandler } from '../../actions/tracing/errors/traceErrorHandler.js';
import { ResilientServiceWrapper } from '../../actions/tracing/resilience/resilientServiceWrapper.js';
import TracingConfigurationInitializer from '../../actions/tracing/tracingConfigurationInitializer.js';
import { INITIALIZABLE } from '../tags.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../configuration/traceConfigLoader.js').TraceConfigLoader} TraceConfigLoader
 */

/**
 * Register action tracing services with the DI container
 *
 * @param {import('../appContainer.js').default} container - DI container instance
 */
export function registerActionTracing(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const log = container.resolve(tokens.ILogger);

  log.debug('Action Tracing Registration: starting…');

  // Register ActionTraceConfigValidator
  container.register(
    actionTracingTokens.IActionTraceConfigValidator,
    (c) =>
      new ActionTraceConfigValidator({
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IActionTraceConfigValidator)}.`
  );

  // Register ActionTraceConfigLoader
  container.register(
    actionTracingTokens.IActionTraceConfigLoader,
    (c) =>
      new ActionTraceConfigLoader({
        traceConfigLoader: c.resolve(tokens.ITraceConfigLoader),
        validator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IActionTraceConfigLoader)}.`
  );

  // Register TraceDirectoryManager
  container.register(
    actionTracingTokens.ITraceDirectoryManager,
    (c) =>
      new TraceDirectoryManager({
        storageProvider: c.resolve(tokens.IStorageProvider),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.ITraceDirectoryManager)}.`
  );

  // Register IndexedDBStorageAdapter
  container.register(
    actionTracingTokens.IIndexedDBStorageAdapter,
    (c) =>
      new IndexedDBStorageAdapter({
        logger: c.resolve(tokens.ILogger),
        dbName: 'ActionTraces',
        dbVersion: 1,
        storeName: 'traces',
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IIndexedDBStorageAdapter)}.`
  );

  // Register ActionTraceFilter with safe defaults
  // Configuration will be loaded later by TracingConfigurationInitializer during system initialization
  container.register(
    actionTracingTokens.IActionTraceFilter,
    (c) => {
      // Start with safe defaults - configuration will be loaded during system initialization
      const filter = new ActionTraceFilter({
        enabled: false, // Start disabled until config is loaded during system init
        tracedActions: [],
        excludedActions: [],
        verbosityLevel: 'standard',
        inclusionConfig: {
          componentData: false,
          prerequisites: false,
          targets: false,
        },
        logger: c.resolve(tokens.ILogger),
      });

      // Note: Configuration loading is now handled by TracingConfigurationInitializer
      // during proper system initialization after schemas are loaded

      return filter;
    },
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IActionTraceFilter)}.`
  );

  // Register JsonTraceFormatter
  container.register(
    actionTracingTokens.IJsonTraceFormatter,
    (c) =>
      new JsonTraceFormatter({
        logger: c.resolve(tokens.ILogger),
        actionTraceFilter: c.resolve(actionTracingTokens.IActionTraceFilter),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IJsonTraceFormatter)}.`
  );

  // Register HumanReadableFormatter
  container.register(
    actionTracingTokens.IHumanReadableFormatter,
    (c) =>
      new HumanReadableFormatter({
        logger: c.resolve(tokens.ILogger),
        actionTraceFilter: c.resolve(actionTracingTokens.IActionTraceFilter),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IHumanReadableFormatter)}.`
  );

  // Register enhanced ActionTraceOutputService with IndexedDB support and naming options
  container.register(
    actionTracingTokens.IActionTraceOutputService,
    (c) =>
      new ActionTraceOutputService({
        storageAdapter: c.resolve(actionTracingTokens.IIndexedDBStorageAdapter),
        logger: c.resolve(tokens.ILogger),
        actionTraceFilter: c.resolve(actionTracingTokens.IActionTraceFilter),
        jsonFormatter: c.resolve(actionTracingTokens.IJsonTraceFormatter),
        humanReadableFormatter: c.resolve(
          actionTracingTokens.IHumanReadableFormatter
        ),
        traceDirectoryManager: c.resolve(
          actionTracingTokens.ITraceDirectoryManager
        ),
        eventBus: c.resolve(tokens.IEventBus),
        namingOptions: {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: true,
          hashLength: 6,
        },
        // Enable file output mode - the output directory will be configured
        // later by TracingConfigurationInitializer when config is loaded
        outputToFiles: true,
        outputDirectory: './traces/rub-vagina-debugging', // Default directory
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered enhanced ${String(actionTracingTokens.IActionTraceOutputService)}.`
  );

  // Register ActionAwareStructuredTrace factory
  // Note: This is a factory registration - instances are created per-request
  container.register(
    actionTracingTokens.IActionAwareStructuredTrace,
    (c) => {
      return function createActionAwareStructuredTrace({
        actorId,
        context = {},
        traceContext = null,
        traceConfig = null,
      }) {
        if (!actorId) {
          throw new Error(
            'actorId is required to create ActionAwareStructuredTrace'
          );
        }

        return new ActionAwareStructuredTrace({
          actionTraceFilter: c.resolve(actionTracingTokens.IActionTraceFilter),
          actorId,
          context,
          logger: c.resolve(tokens.ILogger),
          traceContext,
          traceConfig,
        });
      };
    },
    { lifecycle: 'singleton' } // The factory is singleton, instances are created per-call
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IActionAwareStructuredTrace)} factory.`
  );

  // Register EventDispatchTracer
  container.register(
    actionTracingTokens.IEventDispatchTracer,
    (c) =>
      new EventDispatchTracer({
        logger: c.resolve(tokens.ILogger),
        outputService: c.resolve(actionTracingTokens.IActionTraceOutputService),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IEventDispatchTracer)}.`
  );

  // Register error metrics service
  container.register(
    actionTracingTokens.IErrorMetrics,
    (c) =>
      new ErrorMetricsService({
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IErrorMetrics)}.`
  );

  // Register retry manager
  container.register(
    actionTracingTokens.IRetryManager,
    (c) => new RetryManager(),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IRetryManager)}.`
  );

  // Register recovery manager
  container.register(
    actionTracingTokens.IRecoveryManager,
    (c) =>
      new RecoveryManager({
        logger: c.resolve(tokens.ILogger),
        config: c.resolve(tokens.IConfiguration),
        retryManager: c.resolve(actionTracingTokens.IRetryManager),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.IRecoveryManager)}.`
  );

  // Register trace error handler
  container.register(
    actionTracingTokens.ITraceErrorHandler,
    (c) =>
      new TraceErrorHandler({
        logger: c.resolve(tokens.ILogger),
        errorMetrics: c.resolve(actionTracingTokens.IErrorMetrics),
        recoveryManager: c.resolve(actionTracingTokens.IRecoveryManager),
        config: c.resolve(tokens.IConfiguration),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.ITraceErrorHandler)}.`
  );

  // Register TracingConfigurationInitializer with INITIALIZABLE tag for system startup
  container.register(
    actionTracingTokens.ITracingConfigurationInitializer,
    (c) =>
      new TracingConfigurationInitializer({
        configLoader: c.resolve(actionTracingTokens.IActionTraceConfigLoader),
        actionTraceFilter: c.resolve(actionTracingTokens.IActionTraceFilter),
        actionTraceOutputService: c.resolve(
          actionTracingTokens.IActionTraceOutputService
        ),
        logger: c.resolve(tokens.ILogger),
      }),
    {
      lifecycle: 'singleton',
      tags: INITIALIZABLE,
    }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(actionTracingTokens.ITracingConfigurationInitializer)}.`
  );

  log.debug('Action Tracing Registration: complete.');
}
