/**
 * @file Factory helpers related to the dependency injection container and storage providers.
 * @see tests/common/mockFactories/container.js
 */

import { jest } from '@jest/globals';

/**
 * Creates a minimal DI container mock.
 *
 * @param {Record<string | symbol, any>} mapping - Base token–to–mock map.
 * @param {Record<string | symbol, any>} [overrides] - Per-test override map.
 * @returns {{ resolve: jest.Mock }} Object with a jest.fn `resolve` method.
 */
export const createMockContainer = (mapping, overrides = {}) => ({
  resolve: jest.fn((token) => {
    if (Object.prototype.hasOwnProperty.call(overrides, token)) {
      return overrides[token];
    }
    if (Object.prototype.hasOwnProperty.call(mapping, token)) {
      return mapping[token];
    }
    const tokenName =
      typeof token === 'symbol' ? token.toString() : String(token);
    throw new Error(`createMockContainer: Unmapped token: ${tokenName}`);
  }),
});

/**
 * Creates a sophisticated DI container mock with registration capabilities.
 * Used for testing registration functions that need to register and resolve services.
 *
 * @returns {{
 *   _registrations: Map,
 *   register: jest.Mock,
 *   resolve: jest.Mock,
 *   resolveByTag: jest.Mock
 * }} Container mock with registration and resolution capabilities.
 */
export const createMockContainerWithRegistration = () => {
  const registrations = new Map();
  const container = {
    _registrations: registrations,
    register: jest.fn((token, factoryOrValue, options = {}) => {
      if (!token) throw new Error('Mock Register Error: Token is required.');
      const registration = {
        factoryOrValue,
        options: { ...options, tags: options.tags || [] },
        instance: undefined,
      };
      registrations.set(String(token), registration);
    }),
    resolve: jest.fn((token) => {
      const registrationKey = String(token);
      const registration = registrations.get(registrationKey);
      if (!registration) {
        const registeredTokens = Array.from(registrations.keys())
          .map(String)
          .join(', ');
        throw new Error(
          `Mock Resolve Error: Token not registered: ${registrationKey}. Registered tokens are: [${registeredTokens}]`
        );
      }

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
              registration.instance = new factoryOrValue(container);
            } else {
              registration.instance = factoryOrValue(container);
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
            return new factoryOrValue(container);
          }
          return factoryOrValue(container);
        } catch (e) {
          throw new Error(
            `Mock container: Error executing transient factory for ${registrationKey}: ${e.message}`
          );
        }
      }
      return factoryOrValue;
    }),
    resolveByTag: jest.fn(async (tag) => {
      const resolved = [];
      registrations.forEach((reg, tokenKey) => {
        if (reg.options?.tags?.includes(tag)) {
          try {
            resolved.push(container.resolve(tokenKey));
          } catch (e) {
            console.warn(
              `Mock resolveByTag: Failed to resolve tagged token ${tokenKey}: ${e.message}`
            );
          }
        }
      });
      return resolved;
    }),
  };
  return container;
};

/**
 * Creates a simple in-memory storage provider used by persistence tests.
 *
 * @returns {import('../../../src/interfaces/IStorageProvider.js').IStorageProvider} In-memory provider
 */
export function createMemoryStorageProvider() {
  const files = {};
  return {
    writeFileAtomically: jest.fn(async (path, data) => {
      files[path] = data;
      return { success: true };
    }),
    readFile: jest.fn(async (path) => files[path]),
    listFiles: jest.fn(async () => Object.keys(files)),
    deleteFile: jest.fn(async (path) => {
      if (path in files) {
        delete files[path];
        return { success: true };
      }
      return { success: false, error: 'not found' };
    }),
    fileExists: jest.fn(async (path) => path in files),
    ensureDirectoryExists: jest.fn(async () => {}),
  };
}

export default createMockContainer;
