/**
 * @file Unit tests for GoapController
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';
import { createGoapPlannerMock } from '../../../common/mocks/createGoapPlannerMock.js';
import { expectGoapPlannerMock } from '../../../common/mocks/expectGoapPlannerMock.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';
import { recordNumericConstraintFallback, clearNumericConstraintDiagnostics } from '../../../../src/goap/planner/numericConstraintDiagnostics.js';

describe('GoapController - Core Structure', () => {
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
   *
   * @returns {object} Valid dependencies
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

    mockGoapPlanner = createGoapPlannerMock();
    expectGoapPlannerMock(mockGoapPlanner);
    mockGoapPlanner.getTaskLibraryDiagnostics = jest.fn();

    mockRefinementEngine = {
      refine: jest.fn(),
    };

    mockPlanInvalidationDetector = {
      checkPlanValidity: jest.fn(),
    };

    mockContextAssemblyService = {
      assemblePlanningContext: jest.fn(),
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
      clearCache: jest.fn(),
    };
  });

  afterEach(() => {
    clearNumericConstraintDiagnostics();
  });

  describe('constructor', () => {
    it('should construct with all valid dependencies', () => {
      const controller = new GoapController(createValidDependencies());

      expect(controller).toBeInstanceOf(GoapController);
      expect(mockLogger.info).toHaveBeenCalledWith('GoapController initialized');
    });

    it('should throw if goapPlanner is missing', () => {
      const deps = createValidDependencies();
      deps.goapPlanner = undefined;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if goapPlanner missing plan method', () => {
      const deps = createValidDependencies();
      deps.goapPlanner = {};

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if refinementEngine is missing', () => {
      const deps = createValidDependencies();
      deps.refinementEngine = undefined;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if refinementEngine missing refine method', () => {
      const deps = createValidDependencies();
      deps.refinementEngine = {};

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if planInvalidationDetector is missing', () => {
      const deps = createValidDependencies();
      deps.planInvalidationDetector = undefined;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if planInvalidationDetector missing checkPlanValidity method', () => {
      const deps = createValidDependencies();
      deps.planInvalidationDetector = {};

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if contextAssemblyService is missing', () => {
      const deps = createValidDependencies();
      deps.contextAssemblyService = undefined;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if contextAssemblyService missing assemblePlanningContext method', () => {
      const deps = createValidDependencies();
      deps.contextAssemblyService = {};

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if eventBus is missing', () => {
      const deps = createValidDependencies();
      deps.eventBus = undefined;

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should throw if eventBus missing dispatch method', () => {
      const deps = createValidDependencies();
      deps.eventBus = {};

      expect(() => {
        new GoapController(deps);
      }).toThrow();
    });

    it('should use fallback logger if logger is missing', () => {
      const deps = createValidDependencies();
      deps.logger = undefined;

      // ensureValidLogger provides a fallback, doesn't throw
      const controller = new GoapController(deps);

      expect(controller).toBeInstanceOf(GoapController);
    });
  });

  describe('decideTurn', () => {
    let controller;

    beforeEach(() => {
      controller = new GoapController(createValidDependencies());
    });

    it('should throw if actor is missing', async () => {
      await expect(controller.decideTurn(undefined, {})).rejects.toThrow(
        'Actor is required'
      );
    });

    it('should throw if actor.id is missing', async () => {
      await expect(controller.decideTurn({}, {})).rejects.toThrow();
    });

    it('should throw if actor.id is blank string', async () => {
      await expect(controller.decideTurn({ id: '' }, {})).rejects.toThrow();
    });

    it('should throw if world is missing', async () => {
      await expect(
        controller.decideTurn({ id: 'actor_1' }, undefined)
      ).rejects.toThrow('World is required');
    });

    it('should return null when no goals are registered', async () => {
      mockDataRegistry.getAll.mockReturnValue([]);

      const result = await controller.decideTurn({ id: 'actor_1' }, {});

      expect(result).toBeNull();
    });

    it('should log debug message when no goals registered', async () => {
      mockDataRegistry.getAll.mockReturnValue([]);

      await controller.decideTurn({ id: 'actor_1' }, {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No goals registered in system',
        {
          actorId: 'actor_1',
        }
      );
    });

    it('dispatches task preconditions normalization events when diagnostics are present', async () => {
      const goapEventDispatcher = {
        dispatch: jest.fn(),
        getComplianceSnapshot: jest.fn().mockReturnValue({ actors: [], global: null }),
        getComplianceForActor: jest.fn().mockReturnValue(null),
      };
      const eventfulController = new GoapController({
        ...createValidDependencies(),
        eventBus: undefined,
        goapEventDispatcher,
      });

      mockDataRegistry.getAll.mockReturnValue([
        { id: 'goal:reduce-hunger', priority: 1, goalState: {}, relevance: null },
      ]);
      mockContextAssemblyService.assemblePlanningContext.mockReturnValue({});
      mockGoapPlanner.plan.mockReturnValueOnce({ tasks: [] });
      mockGoapPlanner.getTaskLibraryDiagnostics.mockReturnValueOnce({
        preconditionNormalizations: [
          {
            taskId: 'task:legacy',
            sourceField: 'preconditions',
            normalizedCount: 1,
            normalizedPreconditions: [
              { description: 'legacy gate', condition: { '==': [true, true] } },
            ],
            actorId: 'actor_1',
            goalId: 'goal:reduce-hunger',
            timestamp: 987,
          },
        ],
      });

      await eventfulController.decideTurn({ id: 'actor_1' }, { state: {} });

      const normalizationCall = goapEventDispatcher.dispatch.mock.calls.find(
        ([eventType]) => eventType === GOAP_EVENTS.TASK_PRECONDITIONS_NORMALIZED
      );
      expect(normalizationCall).toBeDefined();
      expect(normalizationCall[1]).toEqual(
        expect.objectContaining({
          actorId: 'actor_1',
          taskId: 'task:legacy',
          sourceField: 'preconditions',
          normalizedCount: 1,
        })
      );
    });
  });

  describe('getNumericConstraintDiagnostics', () => {
    it('returns diagnostics snapshot for actor', () => {
      const controller = new GoapController(createValidDependencies());
      recordNumericConstraintFallback({ actorId: 'actor-n1', goalId: 'goal-x' });

      const diagnostics = controller.getNumericConstraintDiagnostics('actor-n1');
      expect(diagnostics).not.toBeNull();
      expect(diagnostics.totalFallbacks).toBe(1);
    });

    it('throws when actorId missing', () => {
      const controller = new GoapController(createValidDependencies());
      expect(() => controller.getNumericConstraintDiagnostics()).toThrow();
    });
  });
});
