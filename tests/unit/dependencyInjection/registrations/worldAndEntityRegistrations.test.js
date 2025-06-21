/**
 * @file Test suite for worldAndEntityRegistrations.
 * @see tests/dependencyInjection/registrations/worldAndEntityRegistrations.test.js
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock } from 'jest-mock-extended';

// SUT and DI
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerWorldAndEntity } from '../../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Concrete Classes
import WorldContext from '../../../../src/context/worldContext.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { EntityDisplayDataProvider } from '../../../../src/entities/entityDisplayDataProvider.js';
// EntityManager is now registered by the SUT, so we might not need to import its class here unless for instanceof checks on IEntityManager resolution.
// import EntityManager from '../../../src/entities/entityManager.js';

describe('registerWorldAndEntity', () => {
  let container;
  let mockLogger;
  // let mockEntityManager; // No longer needed if we expect the real one to be constructed.
  let mockDataRegistry;
  let mockSchemaValidator;
  let mockSpatialIndexManager;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    // Mocks for dependencies that EntityManager will need, and others.
    mockLogger = mock();
    mockDataRegistry = mock();
    mockSchemaValidator = mock();
    mockSpatialIndexManager = mock();

    // Pre-register ALL dependencies required by the REAL EntityManager factory and other services in SUT.
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IDataRegistry, () => mockDataRegistry);
    container.register(tokens.ISchemaValidator, () => mockSchemaValidator);
    container.register(
      tokens.ISpatialIndexManager,
      () => mockSpatialIndexManager
    );

    // Other dependencies for services registered by registerWorldAndEntity
    container.register(tokens.ISafeEventDispatcher, () => ({
      dispatch: jest.fn().mockResolvedValue(true),
    }));
    container.register(tokens.IGameDataRepository, () => ({
      getConditionDefinition: jest.fn(), // For JsonLogicEvaluationService
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logs start, each service registration, and completion in order', () => {
    registerWorldAndEntity(container);

    const logs = mockLogger.debug.mock.calls.map((call) => call[0]);

    expect(logs[0]).toBe('World and Entity Registration: Starting...');
    // Order might vary slightly depending on internal registration sequence within registerWorldAndEntity
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.IEntityManager)}.`
    );
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.IWorldContext)}.`
    );
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.JsonLogicEvaluationService)}.`
    );
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.EntityDisplayDataProvider)}.`
    );
    expect(logs[logs.length - 1]).toBe(
      'World and Entity Registration: Completed.'
    );
  });

  // Add IEntityManager to the specs if we want to test its direct registration properties
  // For now, these specs test services that might DEPEND on IEntityManager
  const specs = [
    {
      token: tokens.IWorldContext,
      Class: WorldContext,
      lifecycle: 'singletonFactory',
      deps: undefined, // Dependencies are resolved within the factory, not declared in register options
    },
    {
      token: tokens.JsonLogicEvaluationService,
      Class: JsonLogicEvaluationService,
      lifecycle: 'singleton', // Assuming it's a direct class registration with deps
      deps: [tokens.ILogger, tokens.IGameDataRepository],
    },
    {
      token: tokens.EntityDisplayDataProvider,
      Class: EntityDisplayDataProvider,
      lifecycle: 'singletonFactory',
      deps: undefined, // Dependencies are resolved within the factory
    },
  ];

  test.each(specs)(
    'registers $token correctly and its instance can be resolved',
    ({ token, Class, lifecycle, deps }) => {
      registerWorldAndEntity(container);

      // Resolution yields correct instance
      const instance = container.resolve(token);
      expect(instance).toBeInstanceOf(Class);
      // Singleton behavior
      expect(container.resolve(token)).toBe(instance);

      // Registration metadata check (verifies how it was registered by the SUT)
      const registrationCall = registerSpy.mock.calls.find(
        (c) => c[0] === token
      );
      expect(registrationCall).toBeDefined();
      const registrationOptions = registrationCall[2] || {}; // Third argument to register()
      expect(registrationOptions.lifecycle).toBe(lifecycle);

      // For direct class registrations (like singleton), dependencies might be in registrationOptions.
      // For factories, dependencies are internal to the factory and not in registrationOptions.dependencies.
      if (lifecycle === 'singleton') {
        // Typically used for r.single(token, Class, deps)
        expect(registrationOptions.dependencies).toEqual(deps);
      } else if (lifecycle === 'singletonFactory') {
        expect(registrationOptions.dependencies).toBeUndefined(); // Factories don't list deps this way
      }
    }
  );
});
