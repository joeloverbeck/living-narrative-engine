/**
 * @file Unit tests for GoapController - New Dependencies (GOAPIMPL-021-02)
 *
 * NOTE: Goal selection logic (#selectGoal and #isGoalRelevant) will be tested
 * via integration tests once decideTurn is implemented in GOAPIMPL-021-06.
 * These private methods cannot be accessed directly in unit tests.
 *
 * This file tests that the new dependencies (jsonLogicService, dataRegistry)
 * are properly validated in the constructor.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';

describe('GoapController - New Dependencies for Goal Selection', () => {
  let mockLogger;
  let mockGoapPlanner;
  let mockRefinementEngine;
  let mockPlanInvalidationDetector;
  let mockContextAssemblyService;
  let mockJsonLogicService;
  let mockDataRegistry;
  let mockEventBus;
  let mockParameterResolutionService;

  /**
   * Create default valid dependencies for GoapController
   */
  const createValidDependencies = () => ({
    goapPlanner: mockGoapPlanner,
    refinementEngine: mockRefinementEngine,
    planInvalidationDetector: mockPlanInvalidationDetector,
    contextAssemblyService: mockContextAssemblyService,
    jsonLogicService: mockJsonLogicService,
    dataRegistry: mockDataRegistry,
    eventBus: mockEventBus,
    logger: mockLogger,
    parameterResolutionService: mockParameterResolutionService,
  });

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockGoapPlanner = {
      plan: jest.fn(),
      getLastFailure: jest.fn().mockReturnValue(null),
    };

    mockRefinementEngine = {
      refine: jest.fn(),
    };

    mockPlanInvalidationDetector = {
      checkPlanValidity: jest.fn(),
    };

    mockContextAssemblyService = {
      assemblePlanningContext: jest.fn().mockReturnValue({
        actor: {
          id: 'actor_1',
          components: {
            'core:health': { hp: 30 },
          },
        },
      }),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    mockDataRegistry = {
      getAll: jest.fn(),
      get: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockParameterResolutionService = {
      resolve: jest.fn(),
    };
  });

  describe('constructor - jsonLogicService validation', () => {
    it('should accept valid jsonLogicService', () => {
      const controller = new GoapController(createValidDependencies());

      expect(controller).toBeInstanceOf(GoapController);
      expect(mockLogger.info).toHaveBeenCalledWith('GoapController initialized');
    });

    it('should throw if jsonLogicService is missing', () => {
      const deps = createValidDependencies();
      delete deps.jsonLogicService;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if jsonLogicService is null', () => {
      const deps = createValidDependencies();
      deps.jsonLogicService = null;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if jsonLogicService missing evaluate method', () => {
      const deps = createValidDependencies();
      deps.jsonLogicService = {};

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if jsonLogicService.evaluate is not a function', () => {
      const deps = createValidDependencies();
      deps.jsonLogicService = { evaluate: 'not a function' };

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });
  });

  describe('constructor - dataRegistry validation', () => {
    it('should accept valid dataRegistry', () => {
      const controller = new GoapController(createValidDependencies());

      expect(controller).toBeInstanceOf(GoapController);
      expect(mockLogger.info).toHaveBeenCalledWith('GoapController initialized');
    });

    it('should throw if dataRegistry is missing', () => {
      const deps = createValidDependencies();
      delete deps.dataRegistry;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if dataRegistry is null', () => {
      const deps = createValidDependencies();
      deps.dataRegistry = null;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if dataRegistry missing getAll method', () => {
      const deps = createValidDependencies();
      deps.dataRegistry = { get: jest.fn() };

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if dataRegistry missing get method', () => {
      const deps = createValidDependencies();
      deps.dataRegistry = { getAll: jest.fn() };

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if dataRegistry.getAll is not a function', () => {
      const deps = createValidDependencies();
      deps.dataRegistry = { getAll: 'not a function', get: jest.fn() };

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if dataRegistry.get is not a function', () => {
      const deps = createValidDependencies();
      deps.dataRegistry = { getAll: jest.fn(), get: 'not a function' };

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });
  });

  describe('constructor - complete dependency set', () => {
    it('should construct successfully with all required dependencies', () => {
      const controller = new GoapController({
        goapPlanner: mockGoapPlanner,
        refinementEngine: mockRefinementEngine,
        planInvalidationDetector: mockPlanInvalidationDetector,
        contextAssemblyService: mockContextAssemblyService,
        jsonLogicService: mockJsonLogicService,
        dataRegistry: mockDataRegistry,
        eventBus: mockEventBus,
        logger: mockLogger,
        parameterResolutionService: mockParameterResolutionService,
      });

      expect(controller).toBeInstanceOf(GoapController);
      expect(mockLogger.info).toHaveBeenCalledWith('GoapController initialized');
    });

    it('should maintain backward compatibility with existing tests', () => {
      // This test verifies that adding new dependencies doesn't break existing functionality
      const controller = new GoapController(createValidDependencies());

      expect(controller).toBeInstanceOf(GoapController);
      expect(controller.decideTurn).toBeDefined();
      expect(typeof controller.decideTurn).toBe('function');
    });
  });
});
