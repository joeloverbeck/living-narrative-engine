/**
 * @file Factory helpers related to the dependency injection container and storage providers.
 * @see tests/common/mockFactories/container.js
 */

import { jest } from '@jest/globals';

/**
 * Resolves a token using override and base maps.
 *
 * @description Helper function for DI mocks that first checks the override map
 *   before falling back to the base map.
 * @param {string | symbol} token - Token to look up.
 * @param {Record<string | symbol, any>} baseMap - Base token map.
 * @param {Record<string | symbol, any>} overrideMap - Overrides for the base map.
 * @returns {any} The mapped value for the token.
 * @throws {Error} If the token is not found in either map.
 */
export function resolveFromMaps(token, baseMap, overrideMap) {
  if (Object.prototype.hasOwnProperty.call(overrideMap, token)) {
    return overrideMap[token];
  }
  if (Object.prototype.hasOwnProperty.call(baseMap, token)) {
    return baseMap[token];
  }
  const tokenName =
    typeof token === 'symbol' ? token.toString() : String(token);
  throw new Error(`Mock container: Unmapped token: ${tokenName}`);
}

/**
 * Creates a minimal DI container mock.
 *
 * @param {Record<string | symbol, any>} mapping - Base token–to–mock map.
 * @param {Record<string | symbol, any>} [overrides] - Per-test override map.
 * @returns {{ resolve: jest.Mock }} Object with a jest.fn `resolve` method.
 */
export const createMockContainer = (mapping, overrides = {}) => ({
  resolve: jest.fn((token) => resolveFromMaps(token, mapping, overrides)),
});

/**
 * Mock container with registration and resolution capabilities.
 *
 * @class
 */
export class MockContainer {
  constructor() {
    this._registrations = new Map();

    // Wrap core methods with jest.fn to allow call assertions in tests
    this.register = jest.fn(this._register.bind(this));
    this.resolve = jest.fn(this._resolve.bind(this));
    this.resolveByTag = jest.fn(this._resolveByTag.bind(this));
  }

  /**
   * Registers a token with a factory or value.
   *
   * @param {string|symbol} token - Token key to register.
   * @param {any} factoryOrValue - Factory function or value to register.
   * @param {object} [options] - Registration options.
   * @returns {void}
   */
  _register(token, factoryOrValue, options = {}) {
    if (!token) throw new Error('Mock Register Error: Token is required.');
    const registration = {
      factoryOrValue,
      options: { ...options, tags: options.tags || [] },
      instance: undefined,
    };
    this._registrations.set(String(token), registration);
  }

  /**
   * Resolves a previously registered token.
   *
   * @param {string|symbol} token - Token to resolve.
   * @returns {any} The resolved instance or value.
   */
  _resolve(token) {
    const registrationKey =
      typeof token === 'symbol' ? token.toString() : String(token);

    if (!this._registrations.has(registrationKey)) {
      const registeredTokens = Array.from(this._registrations.keys())
        .map(String)
        .join(', ');
      throw new Error(
        `Mock Resolve Error: Token not registered: ${registrationKey}. Registered tokens are: [${registeredTokens}]`
      );
    }

    const registration = this._registrations.get(registrationKey);
    const { factoryOrValue, options } = registration;

    if (
      options?.lifecycle === 'singletonFactory' ||
      options?.lifecycle === 'singleton'
    ) {
      if (registration.instance !== undefined) {
        return registration.instance;
      }
      if (typeof factoryOrValue === 'function') {
        try {
          const isClass =
            factoryOrValue.prototype &&
            typeof factoryOrValue.prototype.constructor === 'function';
          if (
            isClass &&
            options?.lifecycle === 'singleton' &&
            !options?.isFactory
          ) {
            registration.instance = new factoryOrValue(this);
          } else {
            registration.instance = factoryOrValue(this);
          }
        } catch (e) {
          throw new Error(
            `Mock container: Error executing factory for ${registrationKey}: ${e.message}`
          );
        }
        return registration.instance;
      }
      registration.instance = factoryOrValue;
      return registration.instance;
    }

    if (typeof factoryOrValue === 'function') {
      try {
        const isClass =
          factoryOrValue.prototype &&
          typeof factoryOrValue.prototype.constructor === 'function';
        if (isClass && !options?.isFactory) {
          return new factoryOrValue(this);
        }
        return factoryOrValue(this);
      } catch (e) {
        throw new Error(
          `Mock container: Error executing transient factory for ${registrationKey}: ${e.message}`
        );
      }
    }

    return factoryOrValue;
  }

  /**
   * Resolves all registrations matching the given tag.
   *
   * @param {string} tag - Tag identifier.
   * @returns {Promise<any[]>} Array of resolved services.
   */
  async _resolveByTag(tag) {
    const resolved = [];
    this._registrations.forEach((reg, tokenKey) => {
      if (reg.options?.tags?.includes(tag)) {
        try {
          resolved.push(this.resolve(tokenKey));
        } catch (e) {
          console.warn(
            `Mock resolveByTag: Failed to resolve tagged token ${tokenKey}: ${e.message}`
          );
        }
      }
    });
    return resolved;
  }
}

export { default as createMemoryStorageProvider } from './memoryStorageProvider.js';

export default createMockContainer;
