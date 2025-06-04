// tests/config/registrations/initializerRegistrations.test.js
// --- FILE START ---

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../src/context/worldContext.js').default} WorldContext */
/** @typedef {import('../../../src/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../src/initializers/worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../../src/initializers/systemInitializer.js').default} SystemInitializer */
/** @typedef {import('../../../src/initializers/services/referenceResolver.js').default} ReferenceResolver */ // <<< NEW
/** @typedef {any} AppContainer */ // Using 'any' for the mock container type for simplicity

// --- Jest Imports ---
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

// --- Class Under Test ---
import { registerInitializers } from '../../../src/config/registrations/initializerRegistrations.js';

// --- Dependencies ---
import { tokens } from '../../../src/config/tokens.js';
import { INITIALIZABLE } from '../../../src/config/tags.js';

// --- MOCK the Modules (Classes being registered) ---
jest.mock('../../../src/initializers/worldInitializer.js');
jest.mock('../../../src/initializers/systemInitializer.js');
// No need to mock ReferenceResolver as we provide a mock instance for its token

// --- Import AFTER mocking ---
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import SystemInitializer from '../../../src/initializers/systemInitializer.js';

// --- Mock Implementations (Core & External Dependencies) ---
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockEntityManager = { name: 'MockEntityManager' };
const mockWorldContext = { name: 'MockWorldContext' };
const mockGameDataRepository = { name: 'MockGameDataRepository' };
const mockValidatedEventDispatcher = { name: 'MockValidatedEventDispatcher' };
const mockSpatialIndexManager = { name: 'MockSpatialIndexManager' };
const mockReferenceResolver = {
  name: 'MockReferenceResolver',
  resolve: jest.fn(),
}; // <<< NEW MOCK INSTANCE

const createMockContainer = () => {
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

describe('registerInitializers', () => {
  /** @type {ReturnType<typeof createMockContainer>} */
  let mockContainer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContainer = createMockContainer();

    // Register all base dependencies that the factories might try to resolve
    mockContainer.register(tokens.ILogger, mockLogger, {
      lifecycle: 'singleton',
    });
    mockContainer.register(tokens.IEntityManager, mockEntityManager, {
      lifecycle: 'singleton',
    });
    mockContainer.register(tokens.IWorldContext, mockWorldContext, {
      lifecycle: 'singleton',
    });
    mockContainer.register(tokens.IGameDataRepository, mockGameDataRepository, {
      lifecycle: 'singleton',
    });
    mockContainer.register(
      tokens.IValidatedEventDispatcher,
      mockValidatedEventDispatcher,
      { lifecycle: 'singleton' }
    );
    mockContainer.register(
      tokens.ISpatialIndexManager,
      mockSpatialIndexManager,
      { lifecycle: 'singleton' }
    );
    mockContainer.register(tokens.IReferenceResolver, mockReferenceResolver, {
      lifecycle: 'singleton',
    }); // <<< REGISTER IReferenceResolver

    Object.values(mockLogger).forEach((fn) => fn.mockClear?.());
    if (WorldInitializer.mockClear) WorldInitializer.mockClear();
    if (SystemInitializer.mockClear) SystemInitializer.mockClear();
  });

  it('should register initializer services without throwing errors', () => {
    expect(() => {
      registerInitializers(mockContainer);
    }).not.toThrow();

    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.WorldInitializer,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
    expect(mockContainer.register).toHaveBeenCalledWith(
      tokens.SystemInitializer,
      expect.any(Function),
      expect.objectContaining({ lifecycle: 'singletonFactory' })
    );
  });

  it('resolving WorldInitializer does not throw and calls its constructor with correctly resolved dependencies', () => {
    registerInitializers(mockContainer); // This registers the factory for WorldInitializer
    let resolvedService;
    expect(() => {
      resolvedService = mockContainer.resolve(tokens.WorldInitializer); // This executes the factory
    }).not.toThrow();

    expect(resolvedService).toBeDefined();
    expect(WorldInitializer).toHaveBeenCalledTimes(1);
    expect(WorldInitializer).toHaveBeenCalledWith({
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      logger: mockLogger,
      spatialIndexManager: mockSpatialIndexManager,
      referenceResolver: mockReferenceResolver, // <<< EXPECTED DEPENDENCY
    });
  });

  it('resolving SystemInitializer does not throw and calls its constructor with correctly resolved dependencies', () => {
    registerInitializers(mockContainer);
    let resolvedService;
    expect(() => {
      resolvedService = mockContainer.resolve(tokens.SystemInitializer);
    }).not.toThrow();

    expect(resolvedService).toBeDefined();
    expect(SystemInitializer).toHaveBeenCalledTimes(1);
    expect(SystemInitializer).toHaveBeenCalledWith({
      resolver: mockContainer,
      logger: mockLogger,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      initializationTag: INITIALIZABLE[0],
    });
  });

  it('WorldInitializer factory should attempt to resolve all its dependencies', () => {
    registerInitializers(mockContainer);
    const resolveSpy = jest.spyOn(mockContainer, 'resolve');

    // We need to actually call the factory for WorldInitializer by resolving it.
    // The first call to resolve ILogger is by registerInitializers itself.
    // The subsequent calls are by the factory when WorldInitializer is resolved.
    mockContainer.resolve(tokens.WorldInitializer);

    expect(resolveSpy).toHaveBeenCalledWith(tokens.ILogger); // Called multiple times, once by registerInitializers, once by factory
    expect(resolveSpy).toHaveBeenCalledWith(tokens.IEntityManager);
    expect(resolveSpy).toHaveBeenCalledWith(tokens.IWorldContext);
    expect(resolveSpy).toHaveBeenCalledWith(tokens.IGameDataRepository);
    expect(resolveSpy).toHaveBeenCalledWith(tokens.IValidatedEventDispatcher);
    expect(resolveSpy).toHaveBeenCalledWith(tokens.ISpatialIndexManager);
    expect(resolveSpy).toHaveBeenCalledWith(tokens.IReferenceResolver); // <<< CHECK RESOLUTION
    resolveSpy.mockRestore();
  });
});
// --- FILE END ---
