import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('Scope DSL - Union Operator Integration', () => {
  let engine;
  let actorEntity;
  let runtimeCtx;

  beforeEach(() => {
    // Create a simple logger for testing
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    // Create a simple component registry
    const componentRegistry = {
      getEntitiesWithComponent: jest.fn((componentId) => {
        if (componentId === 'core:actor')
          return [{ id: 'actor1' }, { id: 'actor2' }];
        if (componentId === 'core:npc') return [{ id: 'npc1' }, { id: 'npc2' }];
        return [];
      }),
    };

    // Create engine - it doesn't take dependencies in constructor
    engine = new ScopeEngine();

    // Create test actor with followers and partners
    actorEntity = createEntityInstance({
      instanceId: 'test:actor',
      definitionId: 'test:actor',
      baseComponents: {
        'social:relationships': {
          followers: ['follower1', 'follower2'],
          partners: ['partner1', 'partner2'],
        },
      },
    });

    // Mock entity manager
    const entityManager = {
      getEntity: jest.fn((id) => {
        const entities = {
          'test:actor': actorEntity,
          follower1: createEntityInstance({ instanceId: 'follower1' }),
          follower2: createEntityInstance({ instanceId: 'follower2' }),
          partner1: createEntityInstance({ instanceId: 'partner1' }),
          partner2: createEntityInstance({ instanceId: 'partner2' }),
        };
        return entities[id];
      }),
      getEntityInstance: jest.fn((id) => {
        // Provide the same as getEntity for test purposes
        const entities = {
          'test:actor': actorEntity,
          follower1: createEntityInstance({ instanceId: 'follower1' }),
          follower2: createEntityInstance({ instanceId: 'follower2' }),
          partner1: createEntityInstance({ instanceId: 'partner1' }),
          partner2: createEntityInstance({ instanceId: 'partner2' }),
        };
        return entities[id];
      }),
      getComponentData: jest.fn((entityId, componentId) => {
        const entity = entityManager.getEntity(entityId);
        return entity ? entity.getComponentData(componentId) : null;
      }),
      hasComponent: jest.fn((entityId, componentId) => {
        const entity = entityManager.getEntity(entityId);
        return entity ? entity.hasComponent(componentId) : false;
      }),
      getEntitiesWithComponent: jest.fn((componentId) => {
        return componentRegistry.getEntitiesWithComponent(componentId);
      }),
    };

    const jsonLogicEval = new JsonLogicEvaluationService({
      entityManager,
      logger,
    });

    runtimeCtx = {
      entityManager,
      componentRegistry,
      jsonLogicEval,
      logger,
    };
  });

  describe('Pipe operator functionality', () => {
    it('should combine results using pipe operator', () => {
      const ast = parseDslExpression('actor.followers | actor.partners');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(Array.from(result).sort()).toEqual([
        'follower1',
        'follower2',
        'partner1',
        'partner2',
      ]);
    });

    it('should produce identical results to plus operator', () => {
      const pipeAst = parseDslExpression('actor.followers | actor.partners');
      const plusAst = parseDslExpression('actor.followers + actor.partners');

      const pipeResult = engine.resolve(pipeAst, actorEntity, runtimeCtx);
      const plusResult = engine.resolve(plusAst, actorEntity, runtimeCtx);

      expect(Array.from(pipeResult).sort()).toEqual(
        Array.from(plusResult).sort()
      );
    });

    it('should handle multiple pipe unions', () => {
      // Add more relationships
      actorEntity.addComponent('social:relationships', {
        followers: ['f1'],
        partners: ['p1'],
        friends: ['fr1', 'fr2'],
      });

      const ast = parseDslExpression(
        'actor.followers | actor.partners | actor.friends'
      );
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['f1', 'fr1', 'fr2', 'p1']);
    });

    it('should work with entity queries', () => {
      const ast = parseDslExpression(
        'entities(core:actor) | entities(core:npc)'
      );
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'actor1',
        'actor2',
        'npc1',
        'npc2',
      ]);
    });

    it('should handle empty results in unions', () => {
      actorEntity.addComponent('social:relationships', {
        followers: [],
        partners: ['partner1'],
      });

      const ast = parseDslExpression('actor.followers | actor.partners');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['partner1']);
    });

    it('should deduplicate results', () => {
      actorEntity.addComponent('social:relationships', {
        followers: ['person1', 'person2'],
        partners: ['person1', 'person3'], // person1 is both follower and partner
      });

      const ast = parseDslExpression('actor.followers | actor.partners');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual([
        'person1',
        'person2',
        'person3',
      ]);
      expect(result.size).toBe(3); // Not 4, due to deduplication
    });
  });

  describe('Complex union scenarios', () => {
    it('should work with clothing queries', () => {
      actorEntity.addComponent('clothing:wearing', {
        slots: {
          'torso:upper': { items: ['shirt1'] },
          'torso:lower': { items: ['pants1'] },
        },
      });

      // Create mock clothing resolver
      actorEntity.addComponent('clothing:topmost', {
        torso_upper: 'shirt1',
        torso_lower: 'pants1',
      });

      const ast = parseDslExpression('actor.torso_upper | actor.torso_lower');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['pants1', 'shirt1']);
    });

    it('should work with filters and unions', () => {
      actorEntity.addComponent('inventory:items', {
        items: [
          { id: 'sword1', type: 'weapon' },
          { id: 'shield1', type: 'armor' },
          { id: 'potion1', type: 'consumable' },
        ],
      });

      actorEntity.addComponent('equipment:equipped', {
        weapon: 'sword2',
      });

      // Create a mock JSON Logic evaluator
      const jsonLogicEval = {
        evaluate: jest.fn((logic, data) => {
          if (
            logic['=='] &&
            logic['=='][0].var === 'type' &&
            logic['=='][1] === 'weapon'
          ) {
            return data.type === 'weapon';
          }
          return false;
        }),
      };

      // Update runtime context with JSON Logic evaluator
      runtimeCtx.jsonLogicEval = jsonLogicEval;

      const ast = parseDslExpression(
        'actor.inventory[{"==": [{"var": "type"}, "weapon"]}] | actor.equipped'
      );

      // Note: The actual filter implementation would need to be mocked
      // For now, we'll test the union structure is created correctly
      expect(ast.type).toBe('Union');
      expect(ast.left.type).toBe('Filter');
      expect(ast.right.type).toBe('Step');
      expect(ast.right.field).toBe('equipped');
    });

    it('should handle nested unions with right-associativity', () => {
      actorEntity.addComponent('test:data', {
        a: ['a1'],
        b: ['b1'],
        c: ['c1'],
        d: ['d1'],
      });

      // This parses as: a | (b | (c | d))
      const ast = parseDslExpression('actor.a | actor.b | actor.c | actor.d');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['a1', 'b1', 'c1', 'd1']);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid fields in union gracefully', () => {
      const ast = parseDslExpression('actor.nonexistent | actor.followers');
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Should return only the valid results
      expect(Array.from(result).sort()).toEqual(['follower1', 'follower2']);
    });

    it('should handle null actor entity appropriately', () => {
      const ast = parseDslExpression('actor.followers | actor.partners');

      expect(() => {
        engine.resolve(ast, null, runtimeCtx);
      }).toThrow();
    });
  });
});
