/**
 * @file Unit tests for GoapController
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapController from '../../../../src/goap/controllers/goapController.js';

describe('GoapController - Core Structure', () => {
  let mockLogger;
  let mockGoapPlanner;
  let mockRefinementEngine;
  let mockPlanInvalidationDetector;
  let mockContextAssemblyService;
  let mockEventBus;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockGoapPlanner = {
      plan: jest.fn(),
    };

    mockRefinementEngine = {
      refine: jest.fn(),
    };

    mockPlanInvalidationDetector = {
      checkPlanValidity: jest.fn(),
    };

    mockContextAssemblyService = {
      assemblePlanningContext: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should construct with all valid dependencies', () => {
      const controller = new GoapController({
        goapPlanner: mockGoapPlanner,
        refinementEngine: mockRefinementEngine,
        planInvalidationDetector: mockPlanInvalidationDetector,
        contextAssemblyService: mockContextAssemblyService,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      expect(controller).toBeInstanceOf(GoapController);
      expect(mockLogger.info).toHaveBeenCalledWith('GoapController initialized');
    });

    it('should throw if goapPlanner is missing', () => {
      expect(() => {
        new GoapController({
          goapPlanner: undefined,
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: mockContextAssemblyService,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if goapPlanner missing plan method', () => {
      expect(() => {
        new GoapController({
          goapPlanner: {},
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: mockContextAssemblyService,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if refinementEngine is missing', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: undefined,
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: mockContextAssemblyService,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if refinementEngine missing refine method', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: {},
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: mockContextAssemblyService,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if planInvalidationDetector is missing', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: undefined,
          contextAssemblyService: mockContextAssemblyService,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if planInvalidationDetector missing checkPlanValidity method', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: {},
          contextAssemblyService: mockContextAssemblyService,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if contextAssemblyService is missing', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: undefined,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if contextAssemblyService missing assemblePlanningContext method', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: {},
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if eventBus is missing', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: mockContextAssemblyService,
          eventBus: undefined,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw if eventBus missing dispatch method', () => {
      expect(() => {
        new GoapController({
          goapPlanner: mockGoapPlanner,
          refinementEngine: mockRefinementEngine,
          planInvalidationDetector: mockPlanInvalidationDetector,
          contextAssemblyService: mockContextAssemblyService,
          eventBus: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should use fallback logger if logger is missing', () => {
      // ensureValidLogger provides a fallback, doesn't throw
      const controller = new GoapController({
        goapPlanner: mockGoapPlanner,
        refinementEngine: mockRefinementEngine,
        planInvalidationDetector: mockPlanInvalidationDetector,
        contextAssemblyService: mockContextAssemblyService,
        eventBus: mockEventBus,
        logger: undefined,
      });

      expect(controller).toBeInstanceOf(GoapController);
    });
  });

  describe('decideTurn', () => {
    let controller;

    beforeEach(() => {
      controller = new GoapController({
        goapPlanner: mockGoapPlanner,
        refinementEngine: mockRefinementEngine,
        planInvalidationDetector: mockPlanInvalidationDetector,
        contextAssemblyService: mockContextAssemblyService,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
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

    it('should return null when no plan exists (stub behavior)', async () => {
      const result = await controller.decideTurn({ id: 'actor_1' }, {});

      expect(result).toBeNull();
    });

    it('should log debug message with actor ID', async () => {
      await controller.decideTurn({ id: 'actor_1' }, {});

      expect(mockLogger.debug).toHaveBeenCalledWith('GOAP decideTurn called', {
        actorId: 'actor_1',
      });
    });
  });
});
