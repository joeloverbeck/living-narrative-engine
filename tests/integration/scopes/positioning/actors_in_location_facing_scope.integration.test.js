/**
 * @file Integration tests for facing-states:actors_in_location_facing scope
 * @description Tests the actors_in_location_facing scope that filters out actors the current actor is facing away from
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { addMockAstsToScopes } from '../../../common/scopeDsl/mockAstGenerator.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('facing-states:actors_in_location_facing scope integration', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    // Initialize test environment
    logger = new ConsoleLogger('ERROR');

    // Create mock GameDataRepository with condition definitions
    const mockGameDataRepository = {
      getConditionDefinition: (conditionId) => {
        const conditions = {
          'core:entity-at-location': {
            logic: {
              '==': [
                { var: 'entity.components.core:position.locationId' },
                { var: 'location.id' },
              ],
            },
          },
          'core:entity-is-not-current-actor': {
            logic: {
              '!=': [{ var: 'entity.id' }, { var: 'actor.id' }],
            },
          },
          'core:entity-has-actor-component': {
            logic: {
              '!!': { var: 'entity.components.core:actor' },
            },
          },
          'facing-states:entity-in-facing-away': {
            logic: {
              in: [
                { var: 'entity.id' },
                {
                  var: 'actor.components.facing-states:facing_away.facing_away_from',
                },
              ],
            },
          },
        };
        return conditions[conditionId] || null;
      },
    };

    // Initialize JSON Logic Evaluation Service
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    // Create scope registry and register the necessary scopes
    scopeRegistry = new ScopeRegistry();

    // Register mock scopes for testing
    const mockScopes = {
      'facing-states:actors_in_location_facing': {
        expr: 'entities(core:position)[][{"and": [{"condition_ref": "core:entity-at-location"}, {"condition_ref": "core:entity-is-not-current-actor"}, {"condition_ref": "core:entity-has-actor-component"}, {"!": {"condition_ref": "facing-states:entity-in-facing-away"}}]}]',
        definition:
          'facing-states:actors_in_location_facing := entities(core:position)[][{"and": [{"condition_ref": "core:entity-at-location"}, {"condition_ref": "core:entity-is-not-current-actor"}, {"condition_ref": "core:entity-has-actor-component"}, {"!": {"condition_ref": "facing-states:entity-in-facing-away"}}]}]',
        modId: 'positioning',
      },
    };

    scopeRegistry.initialize(addMockAstsToScopes(mockScopes));

    // Create scope engine
    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });
  });

  describe('Basic functionality', () => {
    it('should exclude actors that the current actor is facing away from', () => {
      // Create test actors in the same location
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
            'facing-states:facing_away': {
              facing_away_from: ['test:actor2'],
            },
          },
        },
        {
          id: 'test:actor2',
          components: {
            'core:actor': { name: 'Actor 2' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
        {
          id: 'test:actor3',
          components: {
            'core:actor': { name: 'Actor 3' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
      ]);

      const actor1 = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor: actor1,
        jsonLogicEval,
        location: { id: 'test:location1' },
      };

      // Parse and resolve the scope expression
      const scopeDef = scopeRegistry.getScope(
        'facing-states:actors_in_location_facing'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

      // Should include actor3 but not actor2 (facing away from actor2)
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('test:actor3')).toBe(true);
      expect(result.has('test:actor2')).toBe(false);
    });

    it('should include all actors when no facing_away component exists', () => {
      // Create test actors without facing_away component
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
            // No facing_away component
          },
        },
        {
          id: 'test:actor2',
          components: {
            'core:actor': { name: 'Actor 2' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
        {
          id: 'test:actor3',
          components: {
            'core:actor': { name: 'Actor 3' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
      ]);

      const actor1 = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor: actor1,
        jsonLogicEval,
        location: { id: 'test:location1' },
      };

      // Parse and resolve the scope expression
      const scopeDef = scopeRegistry.getScope(
        'facing-states:actors_in_location_facing'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

      // Should include both actor2 and actor3
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has('test:actor2')).toBe(true);
      expect(result.has('test:actor3')).toBe(true);
    });

    it('should return empty set when actor is alone in location', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:lone_actor',
          components: {
            'core:actor': { name: 'Lone Actor' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
        {
          id: 'test:other_actor',
          components: {
            'core:actor': { name: 'Other Actor' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location2' }, // Different location
          },
        },
      ]);

      const loneActor = entityManager.getEntityInstance('test:lone_actor');
      const runtimeCtx = {
        entityManager,
        logger,
        actor: loneActor,
        jsonLogicEval,
        location: { id: 'test:location1' },
      };

      // Parse and resolve the scope expression
      const scopeDef = scopeRegistry.getScope(
        'facing-states:actors_in_location_facing'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, loneActor, runtimeCtx);

      // Should return empty set
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should handle multiple actors in facing_away_from array', () => {
      // Create test actors with multiple entries in facing_away_from
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
            'facing-states:facing_away': {
              facing_away_from: ['test:actor2', 'test:actor3'], // Facing away from both
            },
          },
        },
        {
          id: 'test:actor2',
          components: {
            'core:actor': { name: 'Actor 2' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
        {
          id: 'test:actor3',
          components: {
            'core:actor': { name: 'Actor 3' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
        {
          id: 'test:actor4',
          components: {
            'core:actor': { name: 'Actor 4' },
            [POSITION_COMPONENT_ID]: { locationId: 'test:location1' },
          },
        },
      ]);

      const actor1 = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor: actor1,
        jsonLogicEval,
        location: { id: 'test:location1' },
      };

      // Parse and resolve the scope expression
      const scopeDef = scopeRegistry.getScope(
        'facing-states:actors_in_location_facing'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

      // Should include only actor4 (not facing away from actor4)
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('test:actor4')).toBe(true);
      expect(result.has('test:actor2')).toBe(false);
      expect(result.has('test:actor3')).toBe(false);
    });
  });
});
