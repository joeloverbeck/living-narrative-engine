/**
 * @file Integration tests for fondle_breasts scope evaluation with socket coverage
 * @description Tests that the actors_with_breasts_facing_each_other_or_away scope properly evaluates
 * with custom operators to filter actors based on breast socket coverage
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const breastsScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other_or_away.scope'
  ),
  'utf8'
);

describe('Fondle Breasts Scope Evaluation Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let jsonLogicCustomOperators;
  let mockBodyGraphService;
  let dataRegistry;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    dataRegistry = new InMemoryDataRegistry({ logger });

    // Store the relevant positioning conditions from the file system
    const facingEachOtherCondition = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../data/mods/facing-states/conditions/both-actors-facing-each-other.condition.json'
        ),
        'utf8'
      )
    );
    dataRegistry.store(
      'conditions',
      'facing-states:both-actors-facing-each-other',
      facingEachOtherCondition
    );

    const actorBehindCondition = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../data/mods/facing-states/conditions/actor-is-behind-entity.condition.json'
        ),
        'utf8'
      )
    );
    dataRegistry.store(
      'conditions',
      'facing-states:actor-is-behind-entity',
      actorBehindCondition
    );

    // Mock body graph service for custom operators
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn().mockReturnValue(undefined),
    };

    // Initialize JSON Logic with custom operators
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });

    // Create mock lighting state service
    const mockLightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
      lightingStateService: mockLightingStateService,
    });

    // Register custom operators
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    // Parse and register the scope
    const parser = new DefaultDslParser({ logger });
    const scopeDefinitions = parseScopeDefinitions(
      breastsScopeContent,
      'actors_with_breasts_facing_each_other_or_away.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    scopeRegistry.initialize({
      'sex-breastplay:actors_with_breasts_facing_each_other_or_away':
        scopeDefinitions.get(
          'sex-breastplay:actors_with_breasts_facing_each_other_or_away'
        ),
    });

    scopeEngine = new ScopeEngine();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Helper to set up test entities
   *
   * @param targetClothingConfig
   * @param options
   */
  function setupEntities(targetClothingConfig = {}, options = {}) {
    const { targetFacingAway = false, actorFacingAway = false } = options;
    const entities = [
      {
        id: 'actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'personal-space-states:closeness': {
            partners: ['target1'],
          },
          'facing-states:facing_away': {
            facing_away_from: actorFacingAway ? ['target1'] : [],
          },
        },
      },
      {
        id: 'target1',
        components: {
          'core:actor': { name: 'Target 1' },
          'personal-space-states:closeness': {
            partners: ['actor1'],
          },
          'facing-states:facing_away': {
            facing_away_from: targetFacingAway ? ['actor1'] : [],
          },
          'anatomy:body': {
            body: {
              root: 'torso1',
            },
          },
          ...targetClothingConfig,
        },
      },
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['breast1', 'breast2'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'breast1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'breast',
          },
        },
      },
      {
        id: 'breast2',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'breast',
          },
        },
      },
    ];

    entityManager.setEntities(entities);

    // Mock hasPartOfType to find breasts
    mockBodyGraphService.findPartsByType.mockImplementation(
      (rootId, partType) => {
        if (partType === 'breast') {
          return ['breast1', 'breast2'];
        }
        return [];
      }
    );
  }

  /**
   * Helper to evaluate the scope
   *
   * @param actorId
   */
  function evaluateScope(actorId) {
    const actorEntity = entityManager.getEntityInstance(actorId);
    const scopeDef = scopeRegistry.getScope(
      'sex-breastplay:actors_with_breasts_facing_each_other_or_away'
    );

    // Parse the scope expression
    const parser = new DefaultDslParser({ logger });
    const ast = parser.parse(scopeDef.expr);

    // Create runtime context
    const runtimeCtx = {
      entityManager,
      jsonLogicEval,
      logger,
      actor: actorEntity,
    };

    // Resolve the scope
    return scopeEngine.resolve(ast, actorEntity, runtimeCtx);
  }

  describe('socket coverage scope evaluation', () => {
    it('should exclude targets when both breasts are covered', () => {
      // Arrange - full coverage
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_upper: {
              base: ['shirt1'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_chest', 'right_chest'],
              allowedLayers: ['base', 'outer'],
            },
          },
        },
      });

      // Act
      const resolvedIds = evaluateScope('actor1');

      // Assert
      expect(resolvedIds).toBeInstanceOf(Set);
      expect(resolvedIds.has('target1')).toBe(false);
      expect(resolvedIds.size).toBe(0);
    });

    it('should include targets when both breasts are uncovered', () => {
      // Arrange - no clothing equipment
      setupEntities({});

      // Act
      const resolvedIds = evaluateScope('actor1');

      // Assert
      expect(resolvedIds).toBeInstanceOf(Set);
      expect(resolvedIds.has('target1')).toBe(true);
      expect(resolvedIds.size).toBe(1);
    });

    it('should include targets when one breast is covered and one is uncovered', () => {
      // Arrange - partial coverage
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_partial: {
              base: ['partial_shirt'],
            },
          },
        },
        'clothing:slot_metadata': {
          slotMappings: {
            torso_partial: {
              coveredSockets: ['left_chest'], // Only covers left breast
              allowedLayers: ['base'],
            },
          },
        },
      });

      // Act
      const resolvedIds = evaluateScope('actor1');

      // Assert - should include target because at least one breast is uncovered
      expect(resolvedIds).toBeInstanceOf(Set);
      expect(resolvedIds.has('target1')).toBe(true);
      expect(resolvedIds.size).toBe(1);
    });

    it('should include targets when no clothing equipment component exists', () => {
      // Arrange - no clothing equipment component
      setupEntities({});

      // Act
      const resolvedIds = evaluateScope('actor1');

      // Assert
      expect(resolvedIds).toBeInstanceOf(Set);
      expect(resolvedIds.has('target1')).toBe(true);
      expect(resolvedIds.size).toBe(1);
    });

    it('should include targets when no slot metadata component exists', () => {
      // Arrange - equipment but no metadata
      setupEntities({
        'clothing:equipment': {
          equipped: {
            torso_upper: {
              base: ['shirt1'],
            },
          },
        },
        // No clothing:slot_metadata component
      });

      // Act
      const resolvedIds = evaluateScope('actor1');

      // Assert - should include because no metadata means no coverage info
      expect(resolvedIds).toBeInstanceOf(Set);
      expect(resolvedIds.has('target1')).toBe(true);
      expect(resolvedIds.size).toBe(1);
    });

    it('should properly evaluate facing-states:actor-is-behind-entity condition in isolation', () => {
      // Create test entities
      const actorEntity = { id: 'actor1', components: {} };
      const targetEntity = {
        id: 'target1',
        components: {
          'facing-states:facing_away': {
            facing_away_from: ['actor1'], // Target is facing away from actor
          },
        },
      };

      const evalContext = {
        entity: targetEntity,
        actor: actorEntity,
        location: null,
        components: targetEntity.components,
        id: targetEntity.id,
      };

      const conditionLogic = {
        in: [
          { var: 'actor.id' },
          {
            var: 'entity.components.facing-states:facing_away.facing_away_from',
          },
        ],
      };

      const result = jsonLogicEval.evaluate(conditionLogic, evalContext);

      expect(result).toBe(true);
    });

    it('should properly evaluate facing-states:both-actors-facing-each-other condition when neither actor is turned away', () => {
      const actorEntity = {
        id: 'actor1',
        components: {
          'facing-states:facing_away': { facing_away_from: [] },
        },
      };
      const targetEntity = {
        id: 'target1',
        components: {
          'facing-states:facing_away': { facing_away_from: [] },
        },
      };

      const evalContext = {
        entity: targetEntity,
        actor: actorEntity,
        location: null,
        components: targetEntity.components,
        id: targetEntity.id,
      };

      const conditionLogic = {
        and: [
          {
            '!': {
              in: [
                { var: 'entity.id' },
                {
                  var: 'actor.components.facing-states:facing_away.facing_away_from',
                },
              ],
            },
          },
          {
            '!': {
              in: [
                { var: 'actor.id' },
                {
                  var: 'entity.components.facing-states:facing_away.facing_away_from',
                },
              ],
            },
          },
        ],
      };

      const result = jsonLogicEval.evaluate(conditionLogic, evalContext);
      expect(result).toBe(true);
    });

    it('should include targets when the actor can approach from behind', () => {
      // Arrange - target facing away, breasts exposed
      setupEntities({}, { targetFacingAway: true });

      // Clear any cached state that might interfere
      if (
        jsonLogicCustomOperators &&
        typeof jsonLogicCustomOperators.clearCaches === 'function'
      ) {
        jsonLogicCustomOperators.clearCaches();
      }

      const {
        clearEntityCache,
      } = require('../../../src/scopeDsl/core/entityHelpers.js');
      clearEntityCache();

      // Clear scope registry and re-register to ensure clean state
      scopeRegistry.clear();

      const parser = new DefaultDslParser({ logger });
      const freshScopeDefinitions = parseScopeDefinitions(
        breastsScopeContent,
        'actors_with_breasts_facing_each_other_or_away.scope'
      );

      scopeRegistry.initialize({
        'sex-breastplay:actors_with_breasts_facing_each_other_or_away':
          freshScopeDefinitions.get(
            'sex-breastplay:actors_with_breasts_facing_each_other_or_away'
          ),
      });

      // Mock hasPartOfType to find breasts
      mockBodyGraphService.findPartsByType.mockImplementation(
        (rootId, partType) => {
          if (partType === 'breast') {
            return ['breast1', 'breast2'];
          }
          return [];
        }
      );

      // Act
      const resolvedIds = evaluateScope('actor1');

      // Assert
      expect(resolvedIds).toBeInstanceOf(Set);
      expect(resolvedIds.has('target1')).toBe(true);
      expect(resolvedIds.size).toBe(1);
    });
  });
});
