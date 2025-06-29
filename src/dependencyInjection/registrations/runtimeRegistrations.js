// src/dependencyInjection/registrations/runtimeRegistrations.js
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Registers runtime-level services. The GameLoop is created during
 * application bootstrapping and is not registered here.
 *
 * @param {AppContainer} container - Application dependency container.
 */
export function registerRuntime(container) {
  const _registrar = new Registrar(container); // Reserved for future runtime services
  const logger = /** @type {ILogger} */ (container.resolve(tokens.ILogger));
  logger.debug('Runtime Registration: starting…');

  // Place runtime service registrations below as the engine evolves.

  logger.debug('Runtime Registration: complete.');
}
