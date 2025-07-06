/**
 * @jest-environment node
 * 
 * Integration test for anatomy-based conditions using the custom hasPartWithComponentValue operator
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';

describe('Anatomy Conditions Integration', () => {
  let prerequisiteService;
  let jsonLogicService;
  let customOperators;
  let contextBuilder;
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityManager;
  let mockGameDataRepository;
  let mockComponentAccessService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn()
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn()
    };

    mockComponentAccessService = {
      getComponentForEntity: jest.fn()
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn()
    };

    // Set up condition definitions
    mockGameDataRepository.getConditionDefinition.mockImplementation((conditionId) => {
      const conditions = {
        'core:actor-has-muscular-legs': {
          id: 'core:actor-has-muscular-legs',
          logic: {
            hasPartWithComponentValue: ['actor', 'descriptors:build', 'build', 'muscular']
          }
        },
        'core:actor-has-shapely-legs': {
          id: 'core:actor-has-shapely-legs',
          logic: {
            hasPartWithComponentValue: ['actor', 'descriptors:build', 'build', 'shapely']
          }
        }
      };
      return conditions[conditionId] || null;
    });

    // Create services with custom operators
    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository
    });

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager
    });

    // Register custom operators
    customOperators.registerOperators(jsonLogicService);

    contextBuilder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      componentAccessService: mockComponentAccessService,
      logger: mockLogger
    });

    prerequisiteService = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository: mockGameDataRepository
    });
  });

  describe('actor-has-muscular-legs condition', () => {
    test('should pass when actor has muscular legs', () => {
      const actor = {
        id: 'player123',
        components: {}
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123'
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: true,
        partId: 'leg123'
      });

      const prerequisites = [{
        logic: { condition_ref: 'core:actor-has-muscular-legs' }
      }];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(prerequisites, actionDefinition, actor);

      expect(result).toBe(true);
      expect(mockBodyGraphService.hasPartWithComponentValue).toHaveBeenCalledWith(
        { root: 'body123' },
        'descriptors:build',
        'build',
        'muscular'
      );
    });

    test('should fail when actor has no muscular legs', () => {
      const actor = {
        id: 'player123',
        components: {}
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123'
      });

      mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
        found: false
      });

      const prerequisites = [{
        logic: { condition_ref: 'core:actor-has-muscular-legs' },
        failure_message: 'You need muscular legs.'
      }];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(prerequisites, actionDefinition, actor);

      expect(result).toBe(false);
    });
  });

  describe('combined muscular or shapely legs condition', () => {
    test('should pass when actor has muscular legs', () => {
      const actor = {
        id: 'player123',
        components: {}
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123'
      });

      mockBodyGraphService.hasPartWithComponentValue
        .mockReturnValueOnce({ found: true, partId: 'leg123' }) // muscular check
        .mockReturnValueOnce({ found: false }); // shapely check (won't be called due to OR short-circuit)

      const prerequisites = [{
        logic: {
          or: [
            { condition_ref: 'core:actor-has-muscular-legs' },
            { condition_ref: 'core:actor-has-shapely-legs' }
          ]
        },
        failure_message: 'You need muscular or shapely legs to follow someone.'
      }];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(prerequisites, actionDefinition, actor);

      expect(result).toBe(true);
    });

    test('should pass when actor has shapely legs but not muscular', () => {
      const actor = {
        id: 'player123',
        components: {}
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123'
      });

      mockBodyGraphService.hasPartWithComponentValue
        .mockReturnValueOnce({ found: false }) // muscular check
        .mockReturnValueOnce({ found: true, partId: 'leg456' }); // shapely check

      const prerequisites = [{
        logic: {
          or: [
            { condition_ref: 'core:actor-has-muscular-legs' },
            { condition_ref: 'core:actor-has-shapely-legs' }
          ]
        },
        failure_message: 'You need muscular or shapely legs to follow someone.'
      }];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(prerequisites, actionDefinition, actor);

      expect(result).toBe(true);
    });

    test('should fail when actor has neither muscular nor shapely legs', () => {
      const actor = {
        id: 'player123',
        components: {}
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue({
        root: 'body123'
      });

      mockBodyGraphService.hasPartWithComponentValue
        .mockReturnValue({ found: false });

      const prerequisites = [{
        logic: {
          or: [
            { condition_ref: 'core:actor-has-muscular-legs' },
            { condition_ref: 'core:actor-has-shapely-legs' }
          ]
        },
        failure_message: 'You need muscular or shapely legs to follow someone.'
      }];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(prerequisites, actionDefinition, actor);

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle actor with no body component', () => {
      const actor = {
        id: 'robot123',
        components: {}
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null); // No body component

      const prerequisites = [{
        logic: { condition_ref: 'core:actor-has-muscular-legs' },
        failure_message: 'You need muscular legs.'
      }];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(prerequisites, actionDefinition, actor);

      expect(result).toBe(false);
    });
  });
});