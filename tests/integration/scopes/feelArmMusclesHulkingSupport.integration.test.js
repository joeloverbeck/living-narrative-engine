/**
 * @file Integration test for arm muscles scope with hulking build support
 * @description Tests that the caressing:actors_with_muscular_arms_facing_each_other_or_behind_target
 * scope correctly identifies actors with both muscular and hulking arm builds
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import fs from 'fs';
import path from 'path';

// Import the actual scope file
const armMuscleScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/caressing/scopes/actors_with_muscular_arms_facing_each_other_or_behind_target.scope'
  ),
  'utf8'
);

describe('Feel Arm Muscles Scope - Hulking Build Support', () => {
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);

    // Mock body graph service for custom operators
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    const dataRegistry = new InMemoryDataRegistry({ logger });

    // Register the conditions used by the scope
    dataRegistry.store(
      'conditions',
      'positioning:both-actors-facing-each-other',
      {
        id: 'positioning:both-actors-facing-each-other',
        logic: {
          and: [
            {
              '!': {
                in: [
                  { var: 'entity.id' },
                  {
                    var: 'actor.components.positioning:facing_away.facing_away_from',
                  },
                ],
              },
            },
            {
              '!': {
                in: [
                  { var: 'actor.id' },
                  {
                    var: 'entity.components.positioning:facing_away.facing_away_from',
                  },
                ],
              },
            },
          ],
        },
      }
    );

    dataRegistry.store('conditions', 'positioning:actor-is-behind-entity', {
      id: 'positioning:actor-is-behind-entity',
      logic: {
        in: [
          { var: 'actor.id' },
          { var: 'entity.components.positioning:facing_away.facing_away_from' },
        ],
      },
    });

    const gameDataRepository = {
      getConditionDefinition: (id) => dataRegistry.get('conditions', id),
    };

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const scopeDefinitions = parseScopeDefinitions(
      armMuscleScopeContent,
      'actors_with_muscular_arms_facing_each_other_or_behind_target.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();
    scopeRegistry.initialize({
      'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target':
        scopeDefinitions.get(
          'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target'
        ),
    });

    scopeEngine = new ScopeEngine({ scopeRegistry });
  });

  describe('Arm Build Recognition', () => {
    // Helper to create entities with anatomy
    /**
     *
     * @param actorId
     * @param targetId
     * @param armBuild
     * @param facingAwayConfig
     */
    function setupEntitiesWithArms(
      actorId,
      targetId,
      armBuild,
      facingAwayConfig = {}
    ) {
      const targetTorsoId = `${targetId}:torso`;
      const targetArmId = `${targetId}:arm`;

      const entities = [
        {
          id: actorId,
          components: {
            'positioning:closeness': {
              partners: [targetId],
            },
            ...(facingAwayConfig.actorFacingAway && {
              'positioning:facing_away': {
                facing_away_from: [targetId],
              },
            }),
          },
        },
        {
          id: targetId,
          components: {
            'positioning:closeness': {
              partners: [actorId],
            },
            'anatomy:body': {
              body: {
                root: targetTorsoId,
              },
            },
            ...(facingAwayConfig.targetFacingAway && {
              'positioning:facing_away': {
                facing_away_from: [actorId],
              },
            }),
          },
        },
        {
          id: targetTorsoId,
          components: {
            'anatomy:part': {
              parent: null,
              children: [targetArmId],
              subType: 'torso',
            },
          },
        },
      ];

      if (armBuild) {
        entities.push({
          id: targetArmId,
          components: {
            'anatomy:part': {
              parent: targetTorsoId,
              children: [],
              subType: 'arm',
            },
            'descriptors:build': {
              build: armBuild,
            },
          },
        });
      }

      entityManager.setEntities(entities);

      // Mock bodyGraphService to find arms
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (rootId === targetTorsoId && partType === 'arm') {
            return armBuild ? [targetArmId] : [];
          }
          return [];
        }
      );
    }
    it('should recognize actors with muscular arms', () => {
      const actorId = 'test:actor';
      const targetId = 'test:target';

      setupEntitiesWithArms(actorId, targetId, 'muscular');

      // Parse and resolve the scope
      const actorEntity = entityManager.getEntityInstance(actorId);
      const scopeDef = scopeRegistry.getScope(
        'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target'
      );

      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDef.expr);

      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actor: actorEntity,
      };

      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toContain(targetId);
    });

    it('should recognize actors with hulking arms', () => {
      const actorId = 'test:actor';
      const targetId = 'test:garazi';

      setupEntitiesWithArms(actorId, targetId, 'hulking');

      // Parse and resolve the scope
      const actorEntity = entityManager.getEntityInstance(actorId);
      const scopeDef = scopeRegistry.getScope(
        'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target'
      );

      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDef.expr);

      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actor: actorEntity,
      };

      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toContain(targetId);
    });

    it('should not recognize actors with other arm builds', () => {
      const actorId = 'test:actor';
      const targetId = 'test:weak_target';

      setupEntitiesWithArms(actorId, targetId, 'weak');

      // Parse and resolve the scope
      const actorEntity = entityManager.getEntityInstance(actorId);
      const scopeDef = scopeRegistry.getScope(
        'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target'
      );

      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDef.expr);

      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actor: actorEntity,
      };

      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).not.toContain(targetId);
    });

    it('should work with facing conditions - both facing each other', () => {
      const actorId = 'test:actor';
      const targetId = 'test:target';

      // Neither is facing away - they're facing each other
      setupEntitiesWithArms(actorId, targetId, 'hulking', {});

      // Parse and resolve the scope
      const actorEntity = entityManager.getEntityInstance(actorId);
      const scopeDef = scopeRegistry.getScope(
        'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target'
      );

      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDef.expr);

      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actor: actorEntity,
      };

      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toContain(targetId);
    });

    it('should work with facing conditions - actor behind target', () => {
      const actorId = 'test:actor';
      const targetId = 'test:target';

      // Target is facing away from actor (actor is behind target)
      setupEntitiesWithArms(actorId, targetId, 'hulking', {
        targetFacingAway: true,
      });

      // Parse and resolve the scope
      const actorEntity = entityManager.getEntityInstance(actorId);
      const scopeDef = scopeRegistry.getScope(
        'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target'
      );

      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDef.expr);

      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actor: actorEntity,
      };

      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      expect(result).toContain(targetId);
    });

    it('should not match if actor is facing away but target is not', () => {
      const actorId = 'test:actor';
      const targetId = 'test:target';

      // Actor is facing away from target (invalid position)
      setupEntitiesWithArms(actorId, targetId, 'hulking', {
        actorFacingAway: true,
      });

      // Parse and resolve the scope
      const actorEntity = entityManager.getEntityInstance(actorId);
      const scopeDef = scopeRegistry.getScope(
        'caressing:actors_with_muscular_arms_facing_each_other_or_behind_target'
      );

      const parser = new DefaultDslParser({ logger });
      const ast = parser.parse(scopeDef.expr);

      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actor: actorEntity,
      };

      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Should not match because actor is facing away (not behind or facing each other)
      expect(result).not.toContain(targetId);
    });
  });
});
