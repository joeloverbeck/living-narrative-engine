/**
 * @file Unit tests for entity cache staleness warning (SCODSLROB-004)
 * @description Tests the warning system for when entity cache is used without EventBus invalidation setup
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Entity Cache Staleness Warning', () => {
  let entityHelpersModule;
  let clearEntityCache;
  let createEvaluationContext;
  let setupEntityCacheInvalidation;
  let consoleWarnSpy;

  beforeEach(() => {
    // Reset the module to get fresh state
    jest.resetModules();

    // Re-require the module to get fresh state
    entityHelpersModule = require('../../../../src/scopeDsl/core/entityHelpers.js');
    clearEntityCache = entityHelpersModule.clearEntityCache;
    createEvaluationContext = entityHelpersModule.createEvaluationContext;
    setupEntityCacheInvalidation = entityHelpersModule.setupEntityCacheInvalidation;

    // Clear cache to start fresh
    clearEntityCache();

    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  /**
   * Creates a minimal mock gateway for testing
   *
   * @param entities
   */
  function createMockGateway(entities = {}) {
    return {
      getEntityInstance: jest.fn((id) => entities[id] || null),
      getItemComponents: jest.fn(() => null),
    };
  }

  /**
   * Creates a minimal mock location provider
   */
  function createMockLocationProvider() {
    return {
      getLocation: jest.fn(() => ({ id: 'test-location' })),
    };
  }

  describe('Warning on cache hit without EventBus', () => {
    it('should warn on cache hit when EventBus not connected', () => {
      // Create mock objects
      const gateway = createMockGateway({
        'entity1': { id: 'entity1', components: { 'core:test': {} } },
      });
      const locationProvider = createMockLocationProvider();
      const actorEntity = { id: 'actor1', components: {} };

      // First call - cache miss, populates cache
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // No warning on miss

      // Second call - cache hit, should warn because EventBus not connected
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SCOPE_4001]')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setupEntityCacheInvalidation')
      );
    });

    it('should NOT warn when EventBus is connected', () => {
      // Create mock event bus
      const mockEventBus = {
        subscribe: jest.fn(() => () => {}),
      };

      // Setup EventBus invalidation
      setupEntityCacheInvalidation(mockEventBus);

      // Create mock objects
      const gateway = createMockGateway({
        'entity1': { id: 'entity1', components: { 'core:test': {} } },
      });
      const locationProvider = createMockLocationProvider();
      const actorEntity = { id: 'actor1', components: {} };

      // First call - cache miss
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);

      // Second call - cache hit, should NOT warn because EventBus is connected
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Warning throttling', () => {
    it('should throttle warnings to once per minute', () => {
      // Create mock objects
      const gateway = createMockGateway({
        'entity1': { id: 'entity1', components: { 'core:test': {} } },
        'entity2': { id: 'entity2', components: { 'core:test': {} } },
      });
      const locationProvider = createMockLocationProvider();
      const actorEntity = { id: 'actor1', components: {} };

      // First call - cache miss, populates cache
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity2', actorEntity, gateway, locationProvider);

      // Multiple cache hits - only first should warn
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity2', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity2', actorEntity, gateway, locationProvider);

      // Should only warn once due to throttling
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Warning throttle reset', () => {
    it('should reset warning throttle after clearEntityCache', () => {
      // Create mock objects
      const gateway = createMockGateway({
        'entity1': { id: 'entity1', components: { 'core:test': {} } },
      });
      const locationProvider = createMockLocationProvider();
      const actorEntity = { id: 'actor1', components: {} };

      // First sequence - cache miss then hit with warning
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Clear cache - this should reset the warning throttle
      clearEntityCache();

      // Second sequence - cache miss then hit should warn again
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should NOT reset eventBusConnected after clearEntityCache', () => {
      // Create mock event bus and setup
      const mockEventBus = {
        subscribe: jest.fn(() => () => {}),
      };
      setupEntityCacheInvalidation(mockEventBus);

      // Create mock objects
      const gateway = createMockGateway({
        'entity1': { id: 'entity1', components: { 'core:test': {} } },
      });
      const locationProvider = createMockLocationProvider();
      const actorEntity = { id: 'actor1', components: {} };

      // First sequence - should NOT warn because EventBus is connected
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      // Clear cache
      clearEntityCache();

      // Second sequence - should still NOT warn because EventBus is still connected
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Warning with object items', () => {
    it('should warn on cache hit for object items with ID when EventBus not connected', () => {
      // Create mock objects
      const gateway = createMockGateway({
        'entity1': { id: 'entity1', components: { 'core:test': {} } },
      });
      const locationProvider = createMockLocationProvider();
      const actorEntity = { id: 'actor1', components: {} };
      const objectItem = { id: 'entity1', someProperty: 'value' };

      // First call - cache miss via string
      createEvaluationContext('entity1', actorEntity, gateway, locationProvider);

      // Second call with object - cache hit, should warn
      createEvaluationContext(objectItem, actorEntity, gateway, locationProvider);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
