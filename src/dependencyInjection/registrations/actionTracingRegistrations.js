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

  // Register ActionTraceFilter
  container.register(
    actionTracingTokens.IActionTraceFilter,
    (c) =>
      new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'], // Default to trace all actions
        excludedActions: [],
        verbosityLevel: 'standard',
        inclusionConfig: {
          componentData: false,
          prerequisites: false,
          targets: false,
        },
        logger: c.resolve(tokens.ILogger),
      }),
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
        namingOptions: {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: true,
          hashLength: 6,
        },
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

  log.debug('Action Tracing Registration: complete.');
}
