import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';
import { createGoapPlannerMock } from '../../../common/mocks/createGoapPlannerMock.js';
import { expectGoapPlannerMock } from '../../../common/mocks/expectGoapPlannerMock.js';

describe('GoapController memory monitoring', () => {
  let mockLogger;
  let mockGoapPlanner;
  let mockRefinementEngine;
  let mockPlanInvalidationDetector;
  let mockContextAssemblyService;
  let mockJsonLogicService;
  let mockDataRegistry;
  let mockEventBus;
  let mockParameterResolutionService;

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
    mockGoapPlanner.getCacheMetrics = jest.fn(() => ({
      goalPathNormalizationCache: { size: 10, maxSize: 100 },
    }));

    mockRefinementEngine = { refine: jest.fn() };
    mockPlanInvalidationDetector = { checkPlanValidity: jest.fn() };
    mockContextAssemblyService = { assemblePlanningContext: jest.fn() };
    mockJsonLogicService = { evaluate: jest.fn() };
    mockDataRegistry = { getAll: jest.fn(), get: jest.fn() };
    mockEventBus = { dispatch: jest.fn() };
    mockParameterResolutionService = { resolve: jest.fn(), clearCache: jest.fn() };
  });

  it('returns cache and map metrics without altering decision flow', () => {
    const controller = new GoapController(createValidDependencies());

    const snapshot = controller.getMemoryPressureSnapshot();

    expect(snapshot.pressureLevel).toBe('none');
    expect(snapshot.caches.goalPathNormalizationCache).toMatchObject({
      size: 10,
      maxSize: 100,
    });
    expect(snapshot.failureTracking).toEqual({ failedGoals: 0, failedTasks: 0 });
    expect(snapshot.diagnostics).toEqual({
      goalPathDiagnostics: 0,
      effectFailureTelemetry: 0,
    });
  });

  it('classifies warning and critical pressure based on thresholds', () => {
    mockGoapPlanner.getCacheMetrics = jest.fn(() => ({
      goalPathNormalizationCache: { size: 96, maxSize: 100 },
    }));
    const controller = new GoapController(createValidDependencies());
    const hooks = GoapController.__getTestHooks(controller);

    hooks.trackFailedGoal('goal-1', 'test-warning');
    hooks.trackFailedTask('task-1', 'test-critical');

    const snapshot = controller.getMemoryPressureSnapshot({
      thresholds: {
        failedGoals: { warning: 1, critical: 3 },
        failedTasks: { warning: 1, critical: 1 },
      },
    });

    expect(snapshot.pressureLevel).toBe('critical');
    expect(snapshot.breaches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'goalPathNormalizationCache', level: 'critical' }),
        expect.objectContaining({ metric: 'failedTasks', level: 'critical' }),
      ])
    );
    expect(snapshot.failureTracking.failedGoals).toBe(1);
    expect(snapshot.failureTracking.failedTasks).toBe(1);
  });
});
