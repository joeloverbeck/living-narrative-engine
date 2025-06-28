/**
 * @file Integration test to verify that condition references work in Scope DSL filters
 */

import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('Condition References in Scope DSL Integration Tests', () => {
  let gameDataRepository;
  let jsonLogicEval;
  let scopeEngine;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    // Set up mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Set up data registry with condition definitions
    const dataRegistry = new InMemoryDataRegistry();

    // Add a condition definition for testing
    dataRegistry.store('conditions', 'core:target-is-not-self', {
      id: 'core:target-is-not-self',
      description: 'Checks if the target is not the same as the actor',
      logic: {
        '!=': [{ var: 'entity.id' }, { var: 'actor.id' }],
      },
    });

    // Add another condition that uses condition_ref internally
    dataRegistry.store('conditions', 'core:target-is-valid-follower', {
      id: 'core:target-is-valid-follower',
      description: 'Checks if target is a valid follower',
      logic: {
        and: [
          { condition_ref: 'core:target-is-not-self' },
          {
            '==': [{ var: 'entity.components.core:follower.canFollow' }, true],
          },
        ],
      },
    });

    gameDataRepository = new GameDataRepository(dataRegistry, mockLogger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository,
    });
    scopeEngine = new ScopeEngine();

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
      entities: new Map(),
    };
  });

  describe('Basic Condition Reference Resolution', () => {
    test('should resolve condition_ref in scope DSL filter', () => {
      // Arrange
      const dslExpression =
        'entities(core:person)[{"condition_ref": "core:target-is-not-self"}]';
      const ast = parseDslExpression(dslExpression);

      const actorEntity = { id: 'actor-1', components: {} };
      const targetEntity1 = {
        id: 'target-1',
        components: { 'core:person': {} },
      };
      const targetEntity2 = {
        id: 'actor-1',
        components: { 'core:person': {} },
      }; // Same as actor

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        targetEntity1,
        targetEntity2,
      ]);
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'target-1') return targetEntity1;
        return null;
      });

      const runtimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval,
        logger: mockLogger,
        location: { id: 'test-location' },
      };

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.has('target-1')).toBe(true); // Should include target that's not self
      expect(result.has('actor-1')).toBe(false); // Should exclude actor (self)
      expect(jsonLogicEval.evaluate).toBeDefined(); // Service was used
    });
  });

  describe('Nested Condition References', () => {
    test('should resolve nested condition_ref (condition that references another condition)', () => {
      // Arrange
      const dslExpression =
        'entities(core:person)[{"condition_ref": "core:target-is-valid-follower"}]';
      const ast = parseDslExpression(dslExpression);

      const actorEntity = { id: 'actor-1', components: {} };
      const validFollower = {
        id: 'follower-1',
        components: {
          'core:person': {},
          'core:follower': { canFollow: true },
        },
      };
      const invalidFollower = {
        id: 'follower-2',
        components: {
          'core:person': {},
          'core:follower': { canFollow: false },
        },
      };
      const selfEntity = {
        id: 'actor-1',
        components: {
          'core:person': {},
          'core:follower': { canFollow: true },
        },
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        validFollower,
        invalidFollower,
        selfEntity,
      ]);
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'follower-1') return validFollower;
        if (id === 'follower-2') return invalidFollower;
        return null;
      });

      const runtimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval,
        logger: mockLogger,
        location: { id: 'test-location' },
      };

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.has('follower-1')).toBe(true); // Valid follower, not self
      expect(result.has('follower-2')).toBe(false); // Invalid follower (canFollow: false)
      expect(result.has('actor-1')).toBe(false); // Self (excluded by condition_ref)
    });
  });

  describe('Mixed Logic and Condition References', () => {
    test('should handle combination of condition_ref and inline JSON Logic', () => {
      // Arrange
      const dslExpression = `entities(core:person)[{
        "and": [
          {"condition_ref": "core:target-is-not-self"},
          {"==": [{"var": "entity.components.core:person.status"}, "available"]}
        ]
      }]`;
      const ast = parseDslExpression(dslExpression);

      const actorEntity = { id: 'actor-1', components: {} };
      const availablePerson = {
        id: 'person-1',
        components: {
          'core:person': { status: 'available' },
        },
      };
      const busyPerson = {
        id: 'person-2',
        components: {
          'core:person': { status: 'busy' },
        },
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        availablePerson,
        busyPerson,
        actorEntity,
      ]);
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'person-1') return availablePerson;
        if (id === 'person-2') return busyPerson;
        return null;
      });

      const runtimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval,
        logger: mockLogger,
        location: { id: 'test-location' },
      };

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.has('person-1')).toBe(true); // Available person, not self
      expect(result.has('person-2')).toBe(false); // Busy person (filtered out)
      expect(result.has('actor-1')).toBe(false); // Self (filtered out by condition_ref)
    });
  });

  describe('Error Handling', () => {
    test('should handle missing condition_ref gracefully', () => {
      // Arrange
      const dslExpression =
        'entities(core:person)[{"condition_ref": "core:nonexistent-condition"}]';
      const ast = parseDslExpression(dslExpression);

      const actorEntity = { id: 'actor-1', components: {} };
      const targetEntity = {
        id: 'target-1',
        components: { 'core:person': {} },
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        targetEntity,
      ]);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval,
        logger: mockLogger,
        location: { id: 'test-location' },
      };

      // Act & Assert
      // The JsonLogicEvaluationService should handle missing conditions gracefully
      // by returning a safe default (false), so no entities should match
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0); // No entities should match due to failed condition resolution

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve condition_ref')
      );
    });
  });
});
