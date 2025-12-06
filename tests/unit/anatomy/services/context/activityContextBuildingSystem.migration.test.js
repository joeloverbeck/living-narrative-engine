/**
 * @file Migration tests for ActivityContextBuildingSystem
 * @description Migrated from activityDescriptionService.characterization.test.js
 *              Batch 4 of 5: Context building system tests (10-12 tests, 3 hooks)
 * @see src/anatomy/services/context/activityContextBuildingSystem.js
 * @see tests/unit/anatomy/services/activityDescriptionService.characterization.test.js (lines 1318-1451)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActivityContextBuildingSystem from '../../../../../src/anatomy/services/context/activityContextBuildingSystem.js';

describe('ActivityContextBuildingSystem - Migrated Characterization Tests', () => {
  let system;
  let mockEntityManager;
  let mockLogger;
  let mockNLGSystem;

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a mock entity with optional component data
   *
   * @param {string} id - Entity ID
   * @param {Map} components - Map of componentId -> componentData
   * @returns {object} Mock entity instance
   */
  function createMockEntity(id, components = new Map()) {
    return {
      id,
      getComponentData: jest.fn((componentId) => {
        return components.get(componentId) ?? null;
      }),
    };
  }

  /**
   * Create a mock activity object with defaults
   *
   * @param {object} overrides - Properties to override defaults
   * @returns {object} Activity object
   */
  function createMockActivity(overrides = {}) {
    return {
      priority: 50,
      targetEntityId: null,
      ...overrides,
    };
  }

  /**
   * Create a mock EntityManager that returns entities from a map
   *
   * @param {Map<string, object>} entityMap - Map of entityId -> entity
   * @returns {object} Mock EntityManager
   */
  function createMockEntityManager(entityMap = new Map()) {
    return {
      getEntityInstance: jest.fn((id) => entityMap.get(id) ?? null),
    };
  }

  /**
   * Create a mock NLG system with standard behavior
   *
   * @returns {object} Mock NLG system
   */
  function createMockNLGSystem() {
    return {
      detectEntityGender: jest.fn(() => 'male'),
      mergeAdverb: jest.fn((current, injected) => `${current} ${injected}`),
      injectSoftener: jest.fn(
        (template, descriptor) => `${template} [${descriptor}]`
      ),
    };
  }

  /**
   * Create a standard mock logger
   *
   * @returns {object} Mock logger
   */
  function createMockLogger() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  }

  // ============================================================================
  // Test Lifecycle
  // ============================================================================

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();
    mockLogger = createMockLogger();
    mockNLGSystem = createMockNLGSystem();

    system = new ActivityContextBuildingSystem({
      entityManager: mockEntityManager,
      logger: mockLogger,
      nlgSystem: mockNLGSystem,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Hook 1: buildActivityContext (3 tests, lines 1318-1358)
  // ============================================================================

  describe('buildActivityContext - Relationship Detection', () => {
    it('should detect closeness_partner relationship', () => {
      // Create entity with closeness component
      const actor = createMockEntity(
        'actor1',
        new Map([['positioning:closeness', { partners: ['target1'] }]])
      );

      // Setup entity manager to return our actor
      const entityMap = new Map([['actor1', actor]]);
      mockEntityManager = createMockEntityManager(entityMap);

      // Recreate system with updated entity manager
      system = new ActivityContextBuildingSystem({
        entityManager: mockEntityManager,
        logger: mockLogger,
        nlgSystem: mockNLGSystem,
      });

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('closeness_partner');
    });

    it('should detect no relationship when closeness component missing', () => {
      // Create entity without closeness component
      const actor = createMockEntity('actor1');

      // Setup entity manager to return our actor
      const entityMap = new Map([['actor1', actor]]);
      mockEntityManager = createMockEntityManager(entityMap);

      // Recreate system with updated entity manager
      system = new ActivityContextBuildingSystem({
        entityManager: mockEntityManager,
        logger: mockLogger,
        nlgSystem: mockNLGSystem,
      });

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('neutral');
    });

    it('should handle activities without target', () => {
      // Create entity without closeness component
      const actor = createMockEntity('actor1');

      // Setup entity manager to return our actor
      const entityMap = new Map([['actor1', actor]]);
      mockEntityManager = createMockEntityManager(entityMap);

      // Recreate system with updated entity manager
      system = new ActivityContextBuildingSystem({
        entityManager: mockEntityManager,
        logger: mockLogger,
        nlgSystem: mockNLGSystem,
      });

      const activity = { targetEntityId: null };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('neutral');
    });
  });

  // ============================================================================
  // Hook 2: determineActivityIntensity (5 tests, lines 1364-1404)
  // ============================================================================

  describe('Activity Intensity Mapping', () => {
    it('should determine casual intensity for low priority', () => {
      const priority = 10;
      const intensity = system.determineActivityIntensity(priority);

      expect(intensity).toBe('casual');
    });

    it('should determine elevated intensity for medium priority', () => {
      const priority = 75;
      const intensity = system.determineActivityIntensity(priority);

      expect(intensity).toBe('elevated');
    });

    it('should determine intense intensity for high priority', () => {
      const priority = 90;
      const intensity = system.determineActivityIntensity(priority);

      expect(intensity).toBe('intense');
    });

    it('should handle boundary values', () => {
      expect(system.determineActivityIntensity(0)).toBe('casual');
      expect(system.determineActivityIntensity(100)).toBe('intense');
    });

    it('should handle negative priorities gracefully', () => {
      const intensity = system.determineActivityIntensity(-10);

      expect(intensity).toBeDefined();
    });
  });

  // ============================================================================
  // Hook 3: applyContextualTone (2 tests, lines 1410-1447)
  // ============================================================================

  describe('Contextual Tone Application', () => {
    it('should apply relationship tone to activity context', () => {
      // Create entity with closeness component
      const actor = createMockEntity(
        'actor1',
        new Map([['positioning:closeness', { partners: ['target1'] }]])
      );

      // Setup entity manager to return our actor
      const entityMap = new Map([['actor1', actor]]);
      mockEntityManager = createMockEntityManager(entityMap);

      // Recreate system with updated entity manager
      system = new ActivityContextBuildingSystem({
        entityManager: mockEntityManager,
        logger: mockLogger,
        nlgSystem: mockNLGSystem,
      });

      const activity = {
        targetEntityId: 'target1',
        priority: 60,
      };

      const context = system.buildActivityContext('actor1', activity);

      expect(context).toHaveProperty('relationshipTone');
      expect(context).toHaveProperty('intensity');
    });

    it('should build complete context with all properties', () => {
      // Create entity without closeness component
      const actor = createMockEntity('actor1');

      // Setup entity manager to return our actor
      const entityMap = new Map([['actor1', actor]]);
      mockEntityManager = createMockEntityManager(entityMap);

      // Recreate system with updated entity manager
      system = new ActivityContextBuildingSystem({
        entityManager: mockEntityManager,
        logger: mockLogger,
        nlgSystem: mockNLGSystem,
      });

      const activity = {
        targetEntityId: 'target1',
        priority: 50,
        verb: 'touching',
      };

      const context = system.buildActivityContext('actor1', activity);

      expect(context).toBeDefined();
      expect(context).toHaveProperty('intensity');
    });
  });
});
