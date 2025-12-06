/**
 * @file Integration tests for has_component JSON Logic operator
 * @description Tests the has_component operator in realistic scenarios including scope resolution
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { JsonLogicCustomOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';

/**
 * Helper to build a logger that records all log calls for assertions.
 *
 * @returns {object} Mock logger with debug, info, warn, error methods
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('has_component Operator - Integration', () => {
  let logger;
  let registry;
  let repository;
  let jsonLogicEvaluationService;
  let jsonLogicCustomOperators;
  let entityManager;
  let bodyGraphService;

  beforeEach(() => {
    logger = createTestLogger();
    registry = new InMemoryDataRegistry({ logger });
    repository = new GameDataRepository(registry, logger);

    // Create mock entity manager
    entityManager = {
      createEntity: jest.fn(() => `entity-${Date.now()}-${Math.random()}`),
      addComponent: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
      entities: [],
    };

    // Create mock body graph service
    bodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    // Create JSON Logic evaluation service
    jsonLogicEvaluationService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: repository,
    });

    // Create and register custom operators
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService,
      entityManager,
    });

    jsonLogicCustomOperators.registerOperators(jsonLogicEvaluationService);
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Basic Operation', () => {
    it('should evaluate has_component with entity that has the component', () => {
      // Mock entity with a test component
      const entityId = 'entity-1';
      entityManager.hasComponent.mockReturnValue(true);

      const rule = {
        has_component: ['entity', 'core:actor'],
      };

      const context = {
        entity: { id: entityId },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        entityId,
        'core:actor'
      );
    });

    it('should evaluate has_component with entity that does not have the component', () => {
      // Mock entity without the test component
      const entityId = 'entity-1';
      entityManager.hasComponent.mockReturnValue(false);

      const rule = {
        has_component: ['entity', 'core:position'],
      };

      const context = {
        entity: { id: entityId },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        entityId,
        'core:position'
      );
    });
  });

  describe('Nested Entity Paths', () => {
    beforeEach(() => {
      // Reset mocks before each test in this describe block
      entityManager.hasComponent.mockReset();
    });

    it('should resolve entity.blocker path and check component', () => {
      // Mock blocker entity with patrol component
      const blockerId = 'blocker-1';
      entityManager.hasComponent.mockReturnValue(true);

      // Test without 'and' first to isolate the issue
      const rule = {
        has_component: [
          { var: 'entity.blocker' },
          'movement:is_dimensional_portal',
        ],
      };

      const context = {
        entity: {
          id: 'entity-1',
          blocker: { id: blockerId },
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        blockerId,
        'movement:is_dimensional_portal'
      );
    });

    it('should return false when entity.blocker does not have the component', () => {
      // Mock blocker entity without patrol component
      const blockerId = 'blocker-1';
      entityManager.hasComponent.mockReturnValue(false);

      const rule = {
        and: [
          { var: 'entity.blocker' },
          {
            has_component: [
              { var: 'entity.blocker' },
              'movement:is_dimensional_portal',
            ],
          },
        ],
      };

      const context = {
        entity: {
          id: 'entity-1',
          blocker: { id: blockerId },
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      expect(result).toBe(false);
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        blockerId,
        'movement:is_dimensional_portal'
      );
    });

    it('should return false when entity.blocker is null', () => {
      const rule = {
        and: [
          { var: 'entity.blocker' },
          {
            has_component: [
              { var: 'entity.blocker' },
              'movement:is_dimensional_portal',
            ],
          },
        ],
      };

      const context = {
        entity: {
          blocker: null,
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      // and operator returns null (first falsy value) when blocker is null
      expect(result).toBe(null);
    });
  });

  describe('Condition File Scenario', () => {
    beforeEach(() => {
      // Reset mocks before each test in this describe block
      entityManager.hasComponent.mockReset();
    });

    it('should evaluate the exact condition from blocker-is-dimensional-portal.condition.json', () => {
      // This is the exact logic from the condition file that was failing
      // data/mods/patrol/conditions/blocker-is-dimensional-portal.condition.json

      // Mock a dimensional portal entity
      const portalId = 'portal-1';
      entityManager.hasComponent.mockReturnValue(true);

      const rule = {
        has_component: [
          { var: 'entity.blocker' },
          'movement:is_dimensional_portal',
        ],
      };

      const context = {
        entity: {
          id: 'entity-1',
          blocker: { id: portalId },
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      expect(result).toBe(true);
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        portalId,
        'movement:is_dimensional_portal'
      );
    });

    it('should not throw "Unrecognized operation has_component" error', () => {
      // This test validates that the error from the bug report no longer occurs
      const portalId = 'portal-1';
      entityManager.hasComponent.mockReturnValue(true);

      const rule = {
        and: [
          { var: 'entity.blocker' },
          {
            has_component: [
              { var: 'entity.blocker' },
              'movement:is_dimensional_portal',
            ],
          },
        ],
      };

      const context = {
        entity: {
          id: 'test-entity',
          blocker: { id: portalId },
        },
        actor: { id: 'test-actor' },
        location: { id: 'test-location' },
        id: 'test-trace-id',
        trace: {},
      };

      // This should not throw an error
      expect(() => {
        const result = jsonLogicEvaluationService.evaluate(rule, context);
        expect(typeof result).toBe('boolean');
      }).not.toThrow();

      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        portalId,
        'movement:is_dimensional_portal'
      );
    });
  });

  describe('Operator Registration', () => {
    it('should have has_component in allowed operations', () => {
      const allowedOps = jsonLogicEvaluationService.getAllowedOperations();
      expect(allowedOps.has('has_component')).toBe(true);
    });

    it('should have has_component in registered operators', () => {
      const registeredOps = jsonLogicCustomOperators.getRegisteredOperators();
      expect(registeredOps.has('has_component')).toBe(true);
    });

    it('should validate has_component as allowed operator', () => {
      expect(
        jsonLogicEvaluationService.isOperatorAllowed('has_component')
      ).toBe(true);
    });
  });
});
