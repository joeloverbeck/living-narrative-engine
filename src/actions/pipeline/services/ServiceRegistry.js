/**
 * @file ServiceRegistry - Registry for managing pipeline service lifecycles
 * @see ServiceFactory.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ServiceError, ServiceErrorCodes } from './base/ServiceError.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Registry for managing pipeline service lifecycles and metadata
 *
 * This registry provides:
 * - Service lifecycle management
 * - Service metadata tracking
 * - Service dependency tracking
 * - Service health monitoring
 */
export class ServiceRegistry {
  #services;
  #metadata;
  #logger;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#services = new Map();
    this.#metadata = new Map();
  }

  /**
   * Register a service instance
   *
   * @param {string} token - Service token
   * @param {object} service - Service instance
   * @param {object} [metadata] - Service metadata
   * @param {string} [metadata.version] - Service version
   * @param {string[]} [metadata.dependencies] - Service dependencies
   * @param {string} [metadata.description] - Service description
   */
  register(token, service, metadata = {}) {
    this.#logger.debug(
      `ServiceRegistry: Registering service: ${token}`,
      metadata
    );

    if (this.#services.has(token)) {
      throw new ServiceError(
        `Service already registered: ${token}`,
        ServiceErrorCodes.INVALID_STATE,
        { token }
      );
    }

    this.#services.set(token, service);
    this.#metadata.set(token, {
      registeredAt: new Date(),
      ...metadata,
    });

    this.#logger.info(
      `ServiceRegistry: Service registered successfully: ${token}`
    );
  }

  /**
   * Get a registered service
   *
   * @param {string} token - Service token
   * @returns {object} Service instance
   * @throws {ServiceError} If service not found
   */
  get(token) {
    const service = this.#services.get(token);

    if (!service) {
      throw new ServiceError(
        `Service not found: ${token}`,
        ServiceErrorCodes.DEPENDENCY_ERROR,
        { token }
      );
    }

    return service;
  }

  /**
   * Check if a service is registered
   *
   * @param {string} token - Service token
   * @returns {boolean} True if service is registered
   */
  has(token) {
    return this.#services.has(token);
  }

  /**
   * Get service metadata
   *
   * @param {string} token - Service token
   * @returns {object|null} Service metadata or null if not found
   */
  getMetadata(token) {
    return this.#metadata.get(token) || null;
  }

  /**
   * Get all registered services
   *
   * @returns {Map<string, object>} Map of all services
   */
  getAll() {
    return new Map(this.#services);
  }

  /**
   * Get all service tokens
   *
   * @returns {string[]} Array of service tokens
   */
  getTokens() {
    return Array.from(this.#services.keys());
  }

  /**
   * Unregister a service
   *
   * @param {string} token - Service token
   * @returns {boolean} True if service was unregistered
   */
  unregister(token) {
    this.#logger.debug(`ServiceRegistry: Unregistering service: ${token}`);

    const deleted = this.#services.delete(token);
    this.#metadata.delete(token);

    if (deleted) {
      this.#logger.info(`ServiceRegistry: Service unregistered: ${token}`);
    }

    return deleted;
  }

  /**
   * Clear all services
   */
  clear() {
    this.#logger.warn('ServiceRegistry: Clearing all services');
    this.#services.clear();
    this.#metadata.clear();
  }

  /**
   * Get registry statistics
   *
   * @returns {object} Registry statistics
   */
  getStats() {
    const tokens = this.getTokens();
    const stats = {
      totalServices: tokens.length,
      services: {},
    };

    for (const token of tokens) {
      const metadata = this.getMetadata(token);
      stats.services[token] = {
        registeredAt: metadata.registeredAt,
        dependencies: metadata.dependencies || [],
        version: metadata.version || 'unknown',
      };
    }

    return stats;
  }

  /**
   * Validate service dependencies are available
   *
   * @param {string} token - Service token to validate
   * @returns {object} Validation result
   */
  validateDependencies(token) {
    const metadata = this.getMetadata(token);

    if (!metadata || !metadata.dependencies) {
      return { valid: true, missing: [] };
    }

    const missing = metadata.dependencies.filter((dep) => !this.has(dep));

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
