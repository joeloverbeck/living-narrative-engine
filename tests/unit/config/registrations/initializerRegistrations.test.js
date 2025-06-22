// tests/dependencyInjection/registrations/initializerRegistrations.test.js
// --- FILE START ---

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../../src/context/worldContext.js').default} WorldContext */
/** @typedef {import('../../../../src/data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../../src/initializers/worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../../../src/initializers/systemInitializer.js').default} SystemInitializer */
/** @typedef {any} AppContainer */ // Using 'any' for the mock container type for simplicity

// --- Jest Imports ---
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

// --- Class Under Test ---
import { registerInitializers } from '../../../../src/dependencyInjection/registrations/initializerRegistrations.js';

// --- Dependencies ---
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { INITIALIZABLE } from '../../../../src/dependencyInjection/tags.js';
import { createMockContainerWithRegistration } from '../../../common/mockFactories/index.js';

// --- MOCK the Modules (Classes being registered) ---
jest.mock('../../../../src/initializers/worldInitializer.js');
jest.mock('../../../../src/initializers/systemInitializer.js');

// --- Import AFTER mocking ---
import WorldInitializer from '../../../../src/initializers/worldInitializer.js';
import SystemInitializer from '../../../../src/initializers/systemInitializer.js';

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

describe('registerInitializers', () => {
  /** @type {ReturnType<typeof createMockContainerWithRegistration>} */
  let mockContainer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContainer = createMockContainerWithRegistration();

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
      // spatialIndexManager dependency removed - now handled by SpatialIndexSynchronizer
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
    // spatialIndexManager dependency removed - no longer resolved
    resolveSpy.mockRestore();
  });
});
// --- FILE END ---
