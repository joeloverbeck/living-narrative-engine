/**
 * @file ServiceFactory - Factory for creating pipeline services
 * @see ServiceRegistry.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ServiceError, ServiceErrorCodes } from './base/ServiceError.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../dependencyInjection/appContainer.js').default} AppContainer */

/**
 * Factory for creating and configuring pipeline services
 *
 * This factory provides:
 * - Service instantiation through DI container
 * - Service registration management
 * - Error handling for missing dependencies
 * - Support for testing with mock services
 */
export class ServiceFactory {
  #container;
  #logger;

  /**
   * @param {object} deps
   * @param {AppContainer} deps.container - DI container
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ container, logger }) {
    validateDependency(container, 'IContainer', null, {
      requiredMethods: ['resolve', 'register'],
    });
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#container = container;
    this.#logger = logger;
  }

  /**
   * Create service instance with dependencies
   *
   * @template T
   * @param {string} token - Service token
   * @returns {T} Service instance
   * @throws {ServiceError} If service cannot be created
   */
  createService(token) {
    this.#logger.debug(`ServiceFactory: Creating service for token: ${token}`);

    try {
      const service = this.#container.resolve(token);
      this.#logger.debug(
        `ServiceFactory: Successfully created service: ${token}`
      );
      return service;
    } catch (error) {
      this.#logger.error(
        `ServiceFactory: Failed to create service for token ${token}`,
        error
      );

      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(
        `Failed to create service for token ${token}: ${error.message}`,
        ServiceErrorCodes.DEPENDENCY_ERROR,
        { token, originalError: error }
      );
    }
  }

  /**
   * Create multiple services at once
   *
   * @param {string[]} tokens - Array of service tokens
   * @returns {Map<string, object>} Map of token to service instance
   * @throws {ServiceError} If any service cannot be created
   */
  createServices(tokens) {
    const services = new Map();
    const errors = [];

    for (const token of tokens) {
      try {
        services.set(token, this.createService(token));
      } catch (error) {
        errors.push({ token, error });
      }
    }

    if (errors.length > 0) {
      throw new ServiceError(
        `Failed to create ${errors.length} service(s)`,
        ServiceErrorCodes.DEPENDENCY_ERROR,
        { errors }
      );
    }

    return services;
  }

  /**
   * Register service in container
   *
   * @param {string} token - Service token
   * @param {Function} implementation - Service class or factory
   * @param {object} [options] - Registration options
   * @param {boolean} [options.singleton] - Register as singleton
   * @param {string[]} [options.dependencies] - Dependency tokens
   */
  registerService(token, implementation, options = {}) {
    const { singleton = true, dependencies = [] } = options;

    this.#logger.debug(`ServiceFactory: Registering service: ${token}`, {
      singleton,
      dependencies,
    });

    try {
      if (singleton) {
        this.#container.register(token, implementation, {
          singleton: true,
          dependencies,
        });
      } else {
        this.#container.register(token, implementation, {
          singleton: false,
          dependencies,
        });
      }

      this.#logger.debug(
        `ServiceFactory: Successfully registered service: ${token}`
      );
    } catch (error) {
      this.#logger.error(
        `ServiceFactory: Failed to register service: ${token}`,
        error
      );
      throw new ServiceError(
        `Failed to register service ${token}: ${error.message}`,
        ServiceErrorCodes.DEPENDENCY_ERROR,
        { token, originalError: error }
      );
    }
  }

  /**
   * Check if a service is registered
   *
   * @param {string} token - Service token
   * @returns {boolean} True if service is registered
   */
  hasService(token) {
    try {
      this.#container.resolve(token);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all registered pipeline service tokens
   *
   * @returns {string[]} Array of registered tokens that start with 'I' (interfaces)
   */
  getRegisteredServices() {
    // This is a simplified version - in a real implementation,
    // we'd need access to the container's registration map
    const pipelineTokens = [
      'ITargetDependencyResolver',
      'ILegacyTargetCompatibilityLayer',
      'IScopeContextBuilder',
      'ITargetDisplayNameResolver',
    ];

    return pipelineTokens.filter((token) => this.hasService(token));
  }
}
