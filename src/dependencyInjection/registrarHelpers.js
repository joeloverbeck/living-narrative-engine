/**
 * @file Provides helper utilities for dependency injection registrations.
 */

/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('./tokens.js').DiToken} DiToken */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../utils/registrarHelpers.js').Registrar} Registrar */
/** @typedef {import('../utils/registrarHelpers.js').FactoryFunction} FactoryFunction */
/** @typedef {import('../utils/registrarHelpers.js').Constructor<any>} ConstructorAny */

/**
 * @typedef {import('../dependencyInjection/appContainer.js').RegistrationOptions} RegistrationOptions
 */

/**
 * Registers a dependency and logs the action using the provided logger.
 *
 * @description This helper reduces boilerplate in registration modules by
 * calling {@link Registrar#register} and emitting a standardized debug log.
 * @param {Registrar} registrar - The registrar instance handling the registration.
 * @param {DiToken} token - The token to register.
 * @param {FactoryFunction | ConstructorAny | any} factoryOrValueOrClass - The factory,
 * class constructor or instance/value to register.
 * @param {RegistrationOptions} [options] - Registration options passed to the registrar.
 * @param {ILogger} logger - Logger used for debug output.
 * @returns {void}
 */
export function registerWithLog(
  registrar,
  token,
  factoryOrValueOrClass,
  options,
  logger
) {
  registrar.register(token, factoryOrValueOrClass, options);
  if (logger && typeof logger.debug === 'function') {
    logger.debug(`UI Registrations: Registered ${String(token)}.`);
  }
}
