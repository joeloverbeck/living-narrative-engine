import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';
import { createGoapPlannerMock } from '../../../common/mocks/createGoapPlannerMock.js';
import { expectGoapPlannerMock } from '../../../common/mocks/expectGoapPlannerMock.js';

describe('GoapController - Debug API', () => {
  let mockLogger;
  let mockGoapPlanner;
  let mockRefinementEngine;
  let mockPlanInvalidationDetector;
  let mockContextAssemblyService;
  let mockJsonLogicService;
  let mockDataRegistry;
  let mockEventBus;
  let mockParameterResolutionService;
  let controller;

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
    // Create mocks (pattern from goapController.test.js)
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockGoapPlanner = createGoapPlannerMock();
    expectGoapPlannerMock(mockGoapPlanner);
    mockRefinementEngine = { refine: jest.fn() };
    mockPlanInvalidationDetector = { checkPlanValidity: jest.fn() };
    mockContextAssemblyService = { assemblePlanningContext: jest.fn() };
    mockJsonLogicService = { evaluate: jest.fn() };
    mockDataRegistry = { getAll: jest.fn(), get: jest.fn() };
    mockEventBus = { dispatch: jest.fn() };
    mockParameterResolutionService = {
      resolve: jest.fn(),
      clearCache: jest.fn(),
    };

    controller = new GoapController(createValidDependencies());
  });

  describe('getActivePlan', () => {
    it('should return null when no plan exists', () => {
      const plan = controller.getActivePlan('actor-1');
      expect(plan).toBeNull();
    });

    it('should validate actorId parameter', () => {
      expect(() => controller.getActivePlan('')).toThrow();
      expect(() => controller.getActivePlan(null)).toThrow();
      expect(() => controller.getActivePlan(undefined)).toThrow();
    });

    // Note: Testing with actual plan creation via decideTurn() is complex
    // and requires full integration test setup. The method signature and
    // basic contract (null when no plan, validation) are tested here.
    // Integration tests will validate actual plan retrieval.
  });

  describe('getFailedGoals', () => {
    it('should return empty array when no failures exist', () => {
      const failures = controller.getFailedGoals('actor-1');
      expect(failures).toEqual([]);
    });

    it('should return array type', () => {
      const failures = controller.getFailedGoals('actor-1');
      expect(Array.isArray(failures)).toBe(true);
    });

    it('should validate actorId parameter', () => {
      expect(() => controller.getFailedGoals('')).toThrow();
      expect(() => controller.getFailedGoals(null)).toThrow();
      expect(() => controller.getFailedGoals(undefined)).toThrow();
    });
  });

  describe('getFailedTasks', () => {
    it('should return empty array when no failures exist', () => {
      const failures = controller.getFailedTasks('actor-1');
      expect(failures).toEqual([]);
    });

    it('should return array type', () => {
      const failures = controller.getFailedTasks('actor-1');
      expect(Array.isArray(failures)).toBe(true);
    });

    it('should validate actorId parameter', () => {
      expect(() => controller.getFailedTasks('')).toThrow();
      expect(() => controller.getFailedTasks(null)).toThrow();
      expect(() => controller.getFailedTasks(undefined)).toThrow();
    });
  });

  describe('getCurrentTask', () => {
    it('should return null when no plan exists', () => {
      const task = controller.getCurrentTask('actor-1');
      expect(task).toBeNull();
    });

    // Note: Testing with actual plan/task retrieval requires full integration
    // test setup with decideTurn(). The method signature and basic contract
    // (null when no plan, validation) are tested here. Integration tests will
    // validate actual task retrieval.

    it('should validate actorId parameter', () => {
      expect(() => controller.getCurrentTask('')).toThrow();
      expect(() => controller.getCurrentTask(null)).toThrow();
      expect(() => controller.getCurrentTask(undefined)).toThrow();
    });
  });
});
