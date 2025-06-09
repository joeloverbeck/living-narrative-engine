/**
 * @file Test suite for worldAndEntityRegistrations.
 * @see tests/dependencyInjection/registrations/worldAndEntityRegistrations.js
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
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { registerWorldAndEntity } from '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Concrete Classes
import WorldContext from '../../../src/context/worldContext.js';
import PerceptionUpdateService from '../../../src/perception/perceptionUpdateService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { EntityDisplayDataProvider } from '../../../src/entities/entityDisplayDataProvider.js';

describe('registerWorldAndEntity', () => {
  let container;
  let mockLogger;
  let mockEntityManager;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    // Mocks for dependencies
    mockLogger = mock();
    mockEntityManager = mock();

    // Pre-register required tokens
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IEntityManager, () => mockEntityManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logs start, each service registration, and completion in order', () => {
    registerWorldAndEntity(container);

    const logs = mockLogger.debug.mock.calls.map((call) => call[0]);

    expect(logs[0]).toBe('World and Entity Registration: Starting...');
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.IWorldContext)}.`
    );
    expect(logs).toContain(
      `World and Entity Registration: Registered ${String(tokens.PerceptionUpdateService)}.`
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

  const specs = [
    {
      token: tokens.IWorldContext,
      Class: WorldContext,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.PerceptionUpdateService,
      Class: PerceptionUpdateService,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
    {
      token: tokens.JsonLogicEvaluationService,
      Class: JsonLogicEvaluationService,
      lifecycle: 'singleton',
      deps: [tokens.ILogger],
    },
    {
      token: tokens.EntityDisplayDataProvider,
      Class: EntityDisplayDataProvider,
      lifecycle: 'singletonFactory',
      deps: undefined,
    },
  ];

  test.each(specs)(
    'registers $token correctly',
    ({ token, Class, lifecycle, deps }) => {
      registerWorldAndEntity(container);

      // Resolution yields correct instance
      const instance = container.resolve(token);
      expect(instance).toBeInstanceOf(Class);
      // Singleton behavior
      expect(container.resolve(token)).toBe(instance);

      // Registration metadata
      const call = registerSpy.mock.calls.find((c) => c[0] === token);
      expect(call).toBeDefined();
      const options = call[2] || {};
      expect(options.lifecycle).toBe(lifecycle);
      if (deps) {
        expect(options.dependencies).toEqual(deps);
      } else {
        expect(options.dependencies).toBeUndefined();
      }
    }
  );
});
