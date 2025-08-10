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
