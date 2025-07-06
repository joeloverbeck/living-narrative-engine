// tests/integration/actions/prerequisiteEvaluation.test.js

import { jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('PrerequisiteEvaluation Integration Tests', () => {
  let prereqService;
  let mockLogger;
  let mockEntityManager;
  let mockGameDataRepository;
  let jsonLogicService;
  let contextBuilder;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getAllComponentTypesForEntity: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Create real services for integration testing
    jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });
    contextBuilder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    prereqService = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository: mockGameDataRepository,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('entity with components', () => {
    it('should pass prerequisites when entity has required components', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Setup entity with components
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:name',
        'core:movement',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:name') return { text: 'Test Actor' };
        if (type === 'core:movement') return { locked: false };
        return undefined;
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return type === 'core:name' || type === 'core:movement';
      });

      const prerequisites = [
        {
          logic: {
            '==': [{ var: 'actor.components.core:movement.locked' }, false],
          },
          failure_message: 'Actor is locked and cannot move',
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has 2 components available')
      );
    });

    it('should fail prerequisites when component check fails', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Setup entity with movement locked
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: true };
        return undefined;
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      const prerequisites = [
        {
          logic: {
            '==': [{ var: 'actor.components.core:movement.locked' }, false],
          },
          failure_message: 'Actor is locked and cannot move',
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('FAILED')
      );
    });
  });

  describe('entity with no components', () => {
    it('should warn when entity has no components', () => {
      const actorId = 'test:empty_actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Setup entity with no components
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);
      mockEntityManager.getComponentData.mockReturnValue(undefined);
      mockEntityManager.hasComponent.mockReturnValue(false);

      const prerequisites = [
        {
          logic: { '!!': { var: 'actor.id' } }, // Simple check that always passes
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('appears to have NO components')
      );
    });
  });

  describe('condition_ref resolution', () => {
    it('should resolve condition_ref and evaluate correctly', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Setup entity
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: false };
        return undefined;
      });

      // Setup condition definition
      mockGameDataRepository.getConditionDefinition.mockReturnValue({
        id: 'test:can-move',
        logic: {
          '==': [{ var: 'actor.components.core:movement.locked' }, false],
        },
      });

      const prerequisites = [
        {
          logic: { condition_ref: 'test:can-move' },
          failure_message: 'Cannot move',
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(true);
      expect(
        mockGameDataRepository.getConditionDefinition
      ).toHaveBeenCalledWith('test:can-move');
    });

    it('should handle circular condition_ref gracefully', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      // Setup circular reference
      mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
        if (id === 'test:circular1') {
          return {
            id: 'test:circular1',
            logic: { condition_ref: 'test:circular2' },
          };
        }
        if (id === 'test:circular2') {
          return {
            id: 'test:circular2',
            logic: { condition_ref: 'test:circular1' },
          };
        }
        return null;
      });

      const prerequisites = [
        {
          logic: { condition_ref: 'test:circular1' },
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during rule resolution or evaluation'),
        expect.any(Object)
      );
    });
  });

  describe('missing entity handling', () => {
    it('should handle missing entity gracefully', () => {
      const actorId = 'test:missing_actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Entity doesn't exist in manager
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);
      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      const prerequisites = [
        {
          logic: { '!!': { var: 'actor.components.core:name' } },
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      // Should still evaluate but fail the check
      expect(result).toBe(false);
    });
  });

  describe('complex prerequisite scenarios', () => {
    it('should handle multiple prerequisites with different results', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:complex_action' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
        'core:health',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: false };
        if (type === 'core:health') return { current: 50, max: 100 };
        return undefined;
      });

      const prerequisites = [
        {
          logic: {
            '==': [{ var: 'actor.components.core:movement.locked' }, false],
          },
          failure_message: 'Cannot move',
        },
        {
          logic: {
            '>': [
              { var: 'actor.components.core:health.current' },
              75, // This will fail
            ],
          },
          failure_message: 'Not enough health',
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false); // Should fail on second prerequisite
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prerequisite Rule 1/2 PASSED')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('FAILED (Rule 2/2)')
      );
    });

    it('should handle nested logic operations', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:nested_action' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
        'core:health',
        'core:stamina',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: false };
        if (type === 'core:health') return { current: 80, max: 100 };
        if (type === 'core:stamina') return { current: 30, max: 100 };
        return undefined;
      });

      const prerequisites = [
        {
          logic: {
            and: [
              {
                '==': [{ var: 'actor.components.core:movement.locked' }, false],
              },
              {
                or: [
                  {
                    '>': [{ var: 'actor.components.core:health.current' }, 50],
                  },
                  {
                    '>': [{ var: 'actor.components.core:stamina.current' }, 50],
                  },
                ],
              },
            ],
          },
          failure_message: 'Complex requirement not met',
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(true); // Should pass (movement ok AND (health > 50 OR stamina > 50))
    });
  });

  describe('error handling', () => {
    it('should handle errors during context building', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Force an error during context building
      jest.spyOn(contextBuilder, 'buildContext').mockImplementation(() => {
        throw new Error('Context building failed');
      });

      const prerequisites = [
        {
          logic: { '!!': { var: 'actor.id' } },
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to build evaluation context'),
        expect.any(Object)
      );
    });

    it('should handle malformed prerequisite objects', () => {
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      const prerequisites = [
        {
          // Missing logic property
          failure_message: 'This should fail',
        },
        null, // Invalid prerequisite
        {
          logic: 'not an object', // Invalid logic format
        },
      ];

      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Prerequisite item is invalid or missing 'logic' property"
        )
      );
    });
  });
});
