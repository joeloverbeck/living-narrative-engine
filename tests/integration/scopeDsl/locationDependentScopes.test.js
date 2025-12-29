/**
 * @file Location-Dependent Scope Integration Tests
 * @description Tests that validate scope DSL expressions using `location.*` patterns.
 * Ensures location-based scopes:
 * - Return correct entities when location is provided
 * - Return empty Set when location is null/missing (graceful degradation)
 * - Support complex chains like `location.component[filter].field`
 * @see specs/scope-resolution-runtime-context-robustness.md
 * @see tickets/SCORESRUNCONROB-003-location-dependent-scope-integration.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeFile } from '../../../src/scopeDsl/parser/parser.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

/**
 * Creates a test logger with Jest mock functions.
 *
 * @returns {{error: jest.Mock, warn: jest.Mock, info: jest.Mock, debug: jest.Mock}} Mock logger
 */
function createTestLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a test harness for location-dependent scope tests.
 *
 * @param {object} options - Configuration options
 * @param {object|null} [options.locationEntity] - The location entity to inject into runtime context
 * @param {boolean} [options.omitLocationProperty] - If true, location property is omitted from runtimeCtx
 * @param {Array<object>} [options.entities] - Seed entities for the entity manager
 * @returns {{scopeEngine: ScopeEngine, runtimeCtx: object, actorEntity: object, entityManager: SimpleEntityManager, logger: object}} Test harness
 */
function createLocationScopeHarness({
  locationEntity = null,
  omitLocationProperty = false,
  entities = [],
} = {}) {
  const logger = createTestLogger();
  const scopeEngine = new ScopeEngine();

  // Always include actor entity
  const baseEntities = [
    {
      id: 'actor:test-hero',
      components: {
        'core:actor': { name: 'Test Hero' },
      },
    },
    ...entities,
  ];

  const entityManager = new SimpleEntityManager(baseEntities);
  const jsonLogicEval = new JsonLogicEvaluationService({ logger });

  const runtimeCtx = {
    entityManager,
    jsonLogicEval,
    logger,
  };

  // Only add location property if not explicitly omitted
  if (!omitLocationProperty) {
    runtimeCtx.location = locationEntity;
  }

  const actorEntity = entityManager.getEntityInstance('actor:test-hero');

  return {
    scopeEngine,
    runtimeCtx,
    actorEntity,
    entityManager,
    logger,
  };
}

describe('Location-Dependent Scope Integration', () => {
  let locationWithExits;
  let exitTarget1;
  let exitTarget2;

  beforeEach(() => {
    // Create a location entity with exits component
    exitTarget1 = {
      id: 'location:forest',
      components: {
        'core:location': { name: 'Dark Forest' },
      },
    };

    exitTarget2 = {
      id: 'location:village',
      components: {
        'core:location': { name: 'Quiet Village' },
      },
    };

    locationWithExits = {
      id: 'location:central-hub',
      components: {
        'core:location': { name: 'Central Hub' },
        'locations:exits': [
          { target: 'location:forest', direction: 'north', isPortal: true },
          { target: 'location:village', direction: 'south', isPortal: false },
        ],
      },
    };
  });

  describe('Basic location source resolution', () => {
    it('should return matching entities when location is provided', () => {
      // Arrange
      const { scopeEngine, runtimeCtx, actorEntity, entityManager } =
        createLocationScopeHarness({
          locationEntity: locationWithExits,
          entities: [exitTarget1, exitTarget2],
        });

      // Set up the location entity in entity manager
      entityManager.entitiesMap.set(locationWithExits.id, locationWithExits);

      // Parse a simple location scope
      const ast = parseScopeFile('location', 'location_test').expr;

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('location:central-hub')).toBe(true);
    });

    it('should return empty Set when location is null', () => {
      // Arrange
      const { scopeEngine, runtimeCtx, actorEntity } =
        createLocationScopeHarness({
          locationEntity: null,
        });

      const ast = parseScopeFile('location', 'location_test').expr;

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should not throw when location property is missing from runtimeCtx', () => {
      // Arrange
      const { scopeEngine, runtimeCtx, actorEntity } =
        createLocationScopeHarness({
          omitLocationProperty: true,
        });

      const ast = parseScopeFile('location', 'location_test').expr;

      // Act & Assert - should not throw
      expect(() => {
        const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      }).not.toThrow();
    });
  });

  describe('Location component access chains', () => {
    it('should correctly chain location.component access', () => {
      // Arrange
      const { scopeEngine, runtimeCtx, actorEntity, entityManager } =
        createLocationScopeHarness({
          locationEntity: locationWithExits,
          entities: [exitTarget1, exitTarget2],
        });

      entityManager.entitiesMap.set(locationWithExits.id, locationWithExits);

      // Parse scope: location.locations:exits[]
      const ast = parseScopeFile(
        'location.locations:exits[]',
        'location_exits'
      ).expr;

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert - should return the exit objects (not entity IDs)
      expect(result).toBeInstanceOf(Set);
      // The result contains the raw exit objects, not entity IDs
      expect(result.size).toBe(2);
    });

    it('should correctly chain location.component[filter].field', () => {
      // Arrange
      const { scopeEngine, runtimeCtx, actorEntity, entityManager } =
        createLocationScopeHarness({
          locationEntity: locationWithExits,
          entities: [exitTarget1, exitTarget2],
        });

      entityManager.entitiesMap.set(locationWithExits.id, locationWithExits);

      // Parse scope with filter: location.locations:exits[{filter}].target
      // Filter: only exits where isPortal is true
      // Note: For plain objects without 'id' property, the filter context exposes
      // the object as 'entity', so we use {"var": "entity.isPortal"}
      const scopeExpr =
        'location.locations:exits[][{"==": [{"var": "entity.isPortal"}, true]}].target';
      const ast = parseScopeFile(scopeExpr, 'portal_exits').expr;

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert - should return only the portal exit's target
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('location:forest')).toBe(true);
    });

    it('should return empty Set for location.component when location is null', () => {
      // Arrange
      const { scopeEngine, runtimeCtx, actorEntity } =
        createLocationScopeHarness({
          locationEntity: null,
        });

      const ast = parseScopeFile(
        'location.locations:exits[]',
        'location_exits'
      ).expr;

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle location entity with missing component gracefully', () => {
      // Arrange - location without the expected component
      const locationWithoutExits = {
        id: 'location:empty',
        components: {
          'core:location': { name: 'Empty Location' },
        },
      };

      const { scopeEngine, runtimeCtx, actorEntity } =
        createLocationScopeHarness({
          locationEntity: locationWithoutExits,
        });

      const ast = parseScopeFile(
        'location.locations:exits[]',
        'location_exits'
      ).expr;

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert - should return empty set, not throw
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should handle location as string ID', () => {
      // Arrange - location as string ID instead of object
      const { scopeEngine, actorEntity, entityManager } =
        createLocationScopeHarness({
          entities: [locationWithExits],
        });

      entityManager.entitiesMap.set(locationWithExits.id, locationWithExits);

      // Create runtimeCtx with string location
      const runtimeCtx = {
        entityManager,
        jsonLogicEval: new JsonLogicEvaluationService({
          logger: createTestLogger(),
        }),
        location: 'location:central-hub', // String instead of object
      };

      const ast = parseScopeFile('location', 'location_test').expr;

      // Act
      const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

      // Assert - should handle string location
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('location:central-hub')).toBe(true);
    });

    it('should handle undefined location provider', () => {
      // Arrange - simulate scenario where locationProvider returns undefined
      const { scopeEngine, actorEntity, entityManager } =
        createLocationScopeHarness();

      // Create runtimeCtx without location property
      const runtimeCtx = {
        entityManager,
        jsonLogicEval: new JsonLogicEvaluationService({
          logger: createTestLogger(),
        }),
        // No location property at all
      };

      const ast = parseScopeFile('location', 'location_test').expr;

      // Act & Assert - should not throw
      expect(() => {
        const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      }).not.toThrow();
    });
  });

  describe('Empty Set semantics invariant', () => {
    it('should return empty Set for all missing location scenarios', () => {
      const testCases = [
        { description: 'null location', locationEntity: null },
        { description: 'undefined location', locationEntity: undefined },
        {
          description: 'missing location property',
          omitLocationProperty: true,
        },
      ];

      for (const testCase of testCases) {
        // Arrange
        const { scopeEngine, runtimeCtx, actorEntity } =
          createLocationScopeHarness({
            locationEntity: testCase.locationEntity,
            omitLocationProperty: testCase.omitLocationProperty || false,
          });

        const ast = parseScopeFile('location', 'location_test').expr;

        // Act
        const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);

        // Assert
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      }
    });
  });
});
