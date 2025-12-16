/**
 * @jest-environment node
 *
 * Integration test for anatomy-based conditions using the custom hasPartOfTypeWithComponentValue operator
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
  let mockLightingStateService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockComponentAccessService = {
      getComponentForEntity: jest.fn(),
    };

    mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Set up condition definitions
    mockGameDataRepository.getConditionDefinition.mockImplementation(
      (conditionId) => {
        const conditions = {
          'core:actor-has-muscular-legs': {
            id: 'core:actor-has-muscular-legs',
            logic: {
              hasPartOfTypeWithComponentValue: [
                'actor',
                'leg',
                'descriptors:build',
                'build',
                'muscular',
              ],
            },
          },
          'core:actor-has-shapely-legs': {
            id: 'core:actor-has-shapely-legs',
            logic: {
              hasPartOfTypeWithComponentValue: [
                'actor',
                'leg',
                'descriptors:build',
                'build',
                'shapely',
              ],
            },
          },
        };
        return conditions[conditionId] || null;
      }
    );

    // Create services with custom operators
    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
    });

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
      lightingStateService: mockLightingStateService,
    });

    // Register custom operators
    customOperators.registerOperators(jsonLogicService);

    contextBuilder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      componentAccessService: mockComponentAccessService,
      logger: mockLogger,
    });

    prerequisiteService = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository: mockGameDataRepository,
    });
  });

  describe('actor-has-muscular-legs condition', () => {
    test('should pass when actor has muscular legs', () => {
      const actor = {
        id: 'player123',
        components: {},
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({ build: 'muscular' }); // descriptors:build for leg123

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg123']);

      const prerequisites = [
        {
          logic: { condition_ref: 'core:actor-has-muscular-legs' },
        },
      ];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(true);
      expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
        'body123',
        'leg'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'leg123',
        'descriptors:build'
      );
    });

    test('should fail when actor has no muscular legs', () => {
      const actor = {
        id: 'player123',
        components: {},
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body
        .mockReturnValueOnce({ build: 'normal' }); // descriptors:build for leg123

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg123']);

      const prerequisites = [
        {
          logic: { condition_ref: 'core:actor-has-muscular-legs' },
          failure_message: 'You need muscular legs.',
        },
      ];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('combined muscular or shapely legs condition', () => {
    test('should pass when actor has muscular legs', () => {
      const actor = {
        id: 'player123',
        components: {},
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body for muscular check
        .mockReturnValueOnce({ build: 'muscular' }); // descriptors:build for leg123

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg123']);

      const prerequisites = [
        {
          logic: {
            or: [
              { condition_ref: 'core:actor-has-muscular-legs' },
              { condition_ref: 'core:actor-has-shapely-legs' },
            ],
          },
          failure_message:
            'You need muscular or shapely legs to follow someone.',
        },
      ];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(true);
    });

    test('should pass when actor has shapely legs but not muscular', () => {
      const actor = {
        id: 'player123',
        components: {},
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body for muscular check
        .mockReturnValueOnce({ build: 'normal' }) // descriptors:build for leg123 (not muscular)
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body for shapely check
        .mockReturnValueOnce({ build: 'shapely' }); // descriptors:build for leg123

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg123']);

      const prerequisites = [
        {
          logic: {
            or: [
              { condition_ref: 'core:actor-has-muscular-legs' },
              { condition_ref: 'core:actor-has-shapely-legs' },
            ],
          },
          failure_message:
            'You need muscular or shapely legs to follow someone.',
        },
      ];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(true);
    });

    test('should fail when actor has neither muscular nor shapely legs', () => {
      const actor = {
        id: 'player123',
        components: {},
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body for muscular check
        .mockReturnValueOnce({ build: 'normal' }) // descriptors:build for leg123 (not muscular)
        .mockReturnValueOnce({ root: 'body123' }) // anatomy:body for shapely check
        .mockReturnValueOnce({ build: 'normal' }); // descriptors:build for leg123 (not shapely)

      mockBodyGraphService.findPartsByType.mockReturnValue(['leg123']);

      const prerequisites = [
        {
          logic: {
            or: [
              { condition_ref: 'core:actor-has-muscular-legs' },
              { condition_ref: 'core:actor-has-shapely-legs' },
            ],
          },
          failure_message:
            'You need muscular or shapely legs to follow someone.',
        },
      ];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle actor with no body component', () => {
      const actor = {
        id: 'robot123',
        components: {},
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getComponentData.mockReturnValue(null); // No body component

      const prerequisites = [
        {
          logic: { condition_ref: 'core:actor-has-muscular-legs' },
          failure_message: 'You need muscular legs.',
        },
      ];

      const actionDefinition = { id: 'core:follow' };
      const result = prerequisiteService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
    });
  });
});
