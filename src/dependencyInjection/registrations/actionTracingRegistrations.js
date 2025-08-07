/**
 * @file Dependency injection registrations for action tracing services
 */

import { Registrar } from '../../utils/registrarHelpers.js';
import { tokens } from '../tokens.js';
import ActionTraceConfigLoader from '../../configuration/actionTraceConfigLoader.js';
import ActionTraceConfigValidator from '../../configuration/actionTraceConfigValidator.js';
import TraceDirectoryManager from '../../actions/tracing/traceDirectoryManager.js';

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
    tokens.IActionTraceConfigValidator,
    (c) =>
      new ActionTraceConfigValidator({
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(tokens.IActionTraceConfigValidator)}.`
  );

  // Register ActionTraceConfigLoader
  container.register(
    tokens.IActionTraceConfigLoader,
    (c) =>
      new ActionTraceConfigLoader({
        traceConfigLoader: c.resolve(tokens.ITraceConfigLoader),
        validator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(tokens.IActionTraceConfigLoader)}.`
  );

  // Register TraceDirectoryManager
  container.register(
    tokens.ITraceDirectoryManager,
    (c) =>
      new TraceDirectoryManager({
        storageProvider: c.resolve(tokens.IStorageProvider),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(tokens.ITraceDirectoryManager)}.`
  );

  log.debug('Action Tracing Registration: complete.');
}
