/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import { addMockAstsToScopes } from '../../../common/scopeDsl/mockAstGenerator.js';

describe('Actors Sitting With Space To Right - Integration Test', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    // Mock GameDataRepository with empty conditions
    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    scopeRegistry = new ScopeRegistry();

    // Register the scope
    const mockScopes = {
      'personal-space:actors_sitting_with_space_to_right': {
        expr: 'entities(core:actor)[{"hasSittingSpaceToRight": ["entity", "target", 2]}]',
        definition:
          'personal-space:actors_sitting_with_space_to_right := entities(core:actor)[{"hasSittingSpaceToRight": ["entity", "target", 2]}]',
        modId: 'personal-space',
      },
    };

    scopeRegistry.initialize(addMockAstsToScopes(mockScopes));

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });

    // Create a simple mock BodyGraphService (required for JsonLogicCustomOperators)
    const mockBodyGraphService = {
      hasPartWithComponentValue: () => false,
      findPartsByType: () => [],
      getAllParts: () => [],
      buildAdjacencyCache: () => {},
    };

    // Create a simple mock EntityManager for custom operators
    const mockEntityManagerForOperators = {
      getComponentData: (entityId, componentId) => {
        return entityManager.getComponentData(entityId, componentId);
      },
    };

    const mockLightingStateService = {
      isLocationLit: () => true,
    };

    // Register custom operators including hasSittingSpaceToRight
    const customOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManagerForOperators,
      lightingStateService: mockLightingStateService,
    });

    customOperators.registerOperators(jsonLogicEval);
  });

  describe('actors_sitting_with_space_to_right scope', () => {
    test('should find actor with 2+ empty spots to right and is rightmost', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor1', null, null, null],
            },
          },
        },
        {
          id: 'actor1',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 0,
            },
          },
        },
      ]);

      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('actor1')).toBe(true);
    });

    test('should NOT find actor with only 1 empty spot when 2 required', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: [null, 'actor2', null],
            },
          },
        },
        {
          id: 'actor2',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 1,
            },
          },
        },
      ]);

      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    test('should NOT find actor who is not rightmost occupant', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor3', null, null, 'actor4', null],
            },
          },
        },
        {
          id: 'actor3',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 0,
            },
          },
        },
        {
          id: 'actor4',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 3,
            },
          },
        },
      ]);

      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      // Actor3 has 2+ empty spots but is not rightmost
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    test('should find rightmost actor even with occupied spots to their left', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor5', 'actor6', null, null, null],
            },
          },
        },
        {
          id: 'actor5',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 0,
            },
          },
        },
        {
          id: 'actor6',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 1,
            },
          },
        },
      ]);

      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      // Actor6 is rightmost with 3 empty spots to right
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('actor6')).toBe(true);
    });

    test('should NOT find actor on last spot (no space to right)', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: [null, null, 'actor7'],
            },
          },
        },
        {
          id: 'actor7',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 2,
            },
          },
        },
      ]);

      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    test('should handle multiple eligible actors across all entities', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor8', null, null, null],
            },
          },
        },
        {
          id: 'furniture2',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor9', null, null],
            },
          },
        },
        {
          id: 'actor8',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 0,
            },
          },
        },
        {
          id: 'actor9',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture2',
              spot_index: 0,
            },
          },
        },
      ]);

      // Test with furniture1 as target
      const furniture1 = entityManager.getEntityInstance('furniture1');
      const runtimeCtx1 = {
        entityManager,
        logger,
        target: furniture1,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result1 = scopeEngine.resolve(ast, furniture1, runtimeCtx1);

      expect(result1).toBeInstanceOf(Set);
      expect(result1.has('actor8')).toBe(true);

      // Test with furniture2 as target
      const furniture2 = entityManager.getEntityInstance('furniture2');
      const runtimeCtx2 = {
        entityManager,
        logger,
        target: furniture2,
        jsonLogicEval,
      };

      const result2 = scopeEngine.resolve(ast, furniture2, runtimeCtx2);

      expect(result2).toBeInstanceOf(Set);
      expect(result2.has('actor9')).toBe(true);
    });

    test('should handle dynamic spot occupation changes', () => {
      // Test initial state
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor10', null, null, null],
            },
          },
        },
        {
          id: 'actor10',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 0,
            },
          },
        },
      ]);

      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      let result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      // Initially should find actor
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('actor10')).toBe(true);

      // Now test with actor11 added (making actor10 no longer rightmost)
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor10', null, 'actor11', null],
            },
          },
        },
        {
          id: 'actor10',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 0,
            },
          },
        },
        {
          id: 'actor11',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture1',
              spot_index: 2,
            },
          },
        },
      ]);

      const furniture2 = entityManager.getEntityInstance('furniture1');
      const runtimeCtx2 = {
        entityManager,
        logger,
        target: furniture2,
        jsonLogicEval,
      };

      result = scopeEngine.resolve(ast, furniture2, runtimeCtx2);

      // Should no longer find actor10 (not rightmost)
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    test('should NOT find actors sitting on wrong furniture', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: [null, null, null],
            },
          },
        },
        {
          id: 'furniture2',
          components: {
            'positioning:allows_sitting': {
              spots: ['actor12', null, null],
            },
          },
        },
        {
          id: 'actor12',
          components: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: 'furniture2',
              spot_index: 0,
            },
          },
        },
      ]);

      // Query with furniture1 as target (actor12 is on furniture2)
      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    test('should NOT find actors without sitting_on component', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'furniture1',
          components: {
            'positioning:allows_sitting': {
              spots: [null, null, null],
            },
          },
        },
        {
          id: 'actor13',
          components: {
            'core:actor': {},
          },
        },
      ]);

      const furniture = entityManager.getEntityInstance('furniture1');
      const runtimeCtx = {
        entityManager,
        logger,
        target: furniture,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'personal-space:actors_sitting_with_space_to_right'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, furniture, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
