/**
 * @file Dependency injection registrations for action tracing services
 */

import { Registrar } from '../../utils/registrarHelpers.js';
import { tokens } from '../tokens.js';
import ActionTraceConfigLoader from '../../configuration/actionTraceConfigLoader.js';

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

  log.debug('Action Tracing Registration: complete.');
}
