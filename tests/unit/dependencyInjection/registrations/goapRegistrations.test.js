/**
 * @file Test suite for goapRegistrations.
 * @see src/dependencyInjection/registrations/goapRegistrations.js
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// DI Container and SUT
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerGoapServices } from '../../../../src/dependencyInjection/registrations/goapRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Concrete Implementations
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';

describe('registerGoapServices - GoapPlanner', () => {
  /** @type {AppContainer} */
  let container;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    // Register GOAP services
    registerGoapServices(container);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should register IGoapPlanner token with GoapPlanner class', () => {
    // Verify the registration was called
    expect(registerSpy).toHaveBeenCalledWith(
      tokens.IGoapPlanner,
      GoapPlanner,
      expect.objectContaining({
        lifecycle: 'singleton',
      })
    );
  });

  test('should register GoapPlanner with all 9 required dependencies', () => {
    // Find the registration call for IGoapPlanner
    const registration = registerSpy.mock.calls.find(
      (call) => call[0] === tokens.IGoapPlanner
    );

    expect(registration).toBeDefined();
    expect(registration[2].dependencies).toEqual([
      tokens.ILogger,
      tokens.JsonLogicEvaluationService,
      tokens.GameDataRepository,
      tokens.IEntityManager,
      tokens.IScopeRegistry,
      tokens.IScopeEngine,
      tokens.ISpatialIndexManager,
      tokens.IPlanningEffectsSimulator,
      tokens.IHeuristicRegistry,
    ]);
  });

  test('should register GoapPlanner with singleton lifecycle', () => {
    // Find the registration call for IGoapPlanner
    const registration = registerSpy.mock.calls.find(
      (call) => call[0] === tokens.IGoapPlanner
    );

    expect(registration).toBeDefined();
    expect(registration[2].lifecycle).toBe('singleton');
  });

  test('should register IGoapPlanner after IHeuristicRegistry', () => {
    // Get the order of registrations
    const heuristicIndex = registerSpy.mock.calls.findIndex(
      (call) => call[0] === tokens.IHeuristicRegistry
    );
    const plannerIndex = registerSpy.mock.calls.findIndex(
      (call) => call[0] === tokens.IGoapPlanner
    );

    expect(heuristicIndex).toBeGreaterThanOrEqual(0);
    expect(plannerIndex).toBeGreaterThan(heuristicIndex);
  });
});
