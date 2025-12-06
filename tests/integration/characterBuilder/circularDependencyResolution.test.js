/**
 * @file Integration tests for circular dependency resolution in character builder
 * @description Verifies that the circular dependency between cacheHelpers.js,
 * CoreMotivationsCacheManager.js, and characterBuilderService.js has been resolved
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Character Builder - Circular Dependency Resolution', () => {
  let cacheHelpersContent;

  beforeEach(() => {
    // Read cacheHelpers.js content for verification
    const cacheHelpersPath = join(
      process.cwd(),
      'src/characterBuilder/cache/cacheHelpers.js'
    );
    cacheHelpersContent = readFileSync(cacheHelpersPath, 'utf8');
  });

  describe('JSDoc Type Import Removal', () => {
    it('should have no JSDoc type imports to CoreMotivationsCacheManager in cacheHelpers.js', () => {
      // Verify no type imports to CoreMotivationsCacheManager
      expect(cacheHelpersContent).not.toContain(
        "import('./CoreMotivationsCacheManager.js')"
      );

      // Verify the problematic JSDoc patterns are gone
      expect(cacheHelpersContent).not.toMatch(
        /@param\s*\{import\(['"]\.*\/CoreMotivationsCacheManager\.js['"]\)/
      );
    });

    it('should have no JSDoc type imports to characterBuilderService in cacheHelpers.js', () => {
      // Verify no type imports to characterBuilderService
      expect(cacheHelpersContent).not.toContain(
        "import('../services/characterBuilderService.js')"
      );

      // Verify the problematic JSDoc patterns are gone
      expect(cacheHelpersContent).not.toMatch(
        /@param\s*\{import\(['"]\.*\/.*\/characterBuilderService\.js['"]\)/
      );
    });

    it('should use generic object types instead of specific type imports', () => {
      // Verify generic object types are used (lowercase per ESLint rules)
      expect(cacheHelpersContent).toContain('@param {object} cache');
      expect(cacheHelpersContent).toContain('@param {object} service');
      expect(cacheHelpersContent).toContain('@param {object} logger');
    });

    it('should have descriptive comments for generic Object types', () => {
      // Verify descriptive comments
      expect(cacheHelpersContent).toContain('Cache manager instance');
      expect(cacheHelpersContent).toContain(
        'Character builder service instance'
      );
      expect(cacheHelpersContent).toContain('Logger instance');
    });
  });

  describe('Module Import Resolution', () => {
    it('should import all three modules without circular dependency', () => {
      // This test passes if imports don't throw
      expect(() => {
        // Import in dependency order
        require('../../../src/characterBuilder/events/characterBuilderEvents.js');
        require('../../../src/characterBuilder/cache/cacheHelpers.js');
        require('../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js');
        require('../../../src/characterBuilder/services/characterBuilderService.js');
      }).not.toThrow();
    });

    it('should import modules in any order without errors', () => {
      // Test reverse order
      expect(() => {
        require('../../../src/characterBuilder/services/characterBuilderService.js');
        require('../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js');
        require('../../../src/characterBuilder/cache/cacheHelpers.js');
        require('../../../src/characterBuilder/events/characterBuilderEvents.js');
      }).not.toThrow();
    });
  });

  describe('Event System Integration', () => {
    it('should use events from dedicated file in cache manager', () => {
      const {
        CHARACTER_BUILDER_EVENTS,
      } = require('../../../src/characterBuilder/events/characterBuilderEvents.js');
      const CoreMotivationsCacheManager =
        require('../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js').default;

      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const mockEventBus = {
        dispatch: jest.fn(),
      };

      const mockSchemaValidator = {
        validate: jest.fn(),
      };

      // Create cache manager - constructor dispatches CACHE_INITIALIZED event
      new CoreMotivationsCacheManager({
        logger: mockLogger,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Verify cache initialized event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CHARACTER_BUILDER_EVENTS.CACHE_INITIALIZED,
        })
      );
    });

    it('should re-export events from characterBuilderService for backward compatibility', () => {
      const {
        CHARACTER_BUILDER_EVENTS: eventsFromFile,
      } = require('../../../src/characterBuilder/events/characterBuilderEvents.js');
      const {
        CHARACTER_BUILDER_EVENTS: eventsFromService,
      } = require('../../../src/characterBuilder/services/characterBuilderService.js');

      // Both should reference the same constants
      expect(eventsFromService.CACHE_INITIALIZED).toBe(
        eventsFromFile.CACHE_INITIALIZED
      );
      expect(eventsFromService.CONCEPT_CREATED).toBe(
        eventsFromFile.CONCEPT_CREATED
      );
      expect(eventsFromService.CLICHES_GENERATED).toBe(
        eventsFromFile.CLICHES_GENERATED
      );
      expect(eventsFromService.CACHE_HIT).toBe(eventsFromFile.CACHE_HIT);
      expect(eventsFromService.CACHE_MISS).toBe(eventsFromFile.CACHE_MISS);
    });

    it('should verify all event constants are identical', () => {
      const {
        CHARACTER_BUILDER_EVENTS: eventsFromFile,
      } = require('../../../src/characterBuilder/events/characterBuilderEvents.js');
      const {
        CHARACTER_BUILDER_EVENTS: eventsFromService,
      } = require('../../../src/characterBuilder/services/characterBuilderService.js');

      // Get all keys from both objects
      const fileKeys = Object.keys(eventsFromFile);
      const serviceKeys = Object.keys(eventsFromService);

      // Verify same number of keys
      expect(serviceKeys.length).toBe(fileKeys.length);

      // Verify all keys match
      fileKeys.forEach((key) => {
        expect(serviceKeys).toContain(key);
        expect(eventsFromService[key]).toBe(eventsFromFile[key]);
      });
    });
  });

  describe('Cache Helpers Functionality', () => {
    it('should use cache helpers with generic types without runtime errors', () => {
      const {
        CacheKeys,
        CacheInvalidation,
      } = require('../../../src/characterBuilder/cache/cacheHelpers.js');

      const mockCache = {
        delete: jest.fn(),
        invalidatePattern: jest.fn(),
      };

      // Test CacheKeys still work
      expect(CacheKeys.concept('test-123')).toBe('concept_test-123');
      expect(CacheKeys.allConcepts()).toBe('all_concepts');

      // Test CacheInvalidation still works with generic types
      expect(() => {
        CacheInvalidation.invalidateConcept(mockCache, 'test-123');
      }).not.toThrow();

      expect(mockCache.delete).toHaveBeenCalledWith('concept_test-123');
      expect(mockCache.delete).toHaveBeenCalledWith('all_concepts');
    });

    it('should handle cache warming with generic types', async () => {
      const {
        CacheWarming,
      } = require('../../../src/characterBuilder/cache/cacheHelpers.js');

      const mockCache = {
        set: jest.fn(),
      };

      const mockService = {
        getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      };

      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      // Should work without type errors
      await expect(
        CacheWarming.warmCache(mockCache, mockService, mockLogger)
      ).resolves.not.toThrow();

      expect(mockCache.set).toHaveBeenCalledWith(
        'all_concepts',
        [],
        'concepts'
      );
    });
  });

  describe('Import Path Verification', () => {
    it('should have CoreMotivationsCacheManager import events from dedicated file', () => {
      const cacheManagerPath = join(
        process.cwd(),
        'src/characterBuilder/cache/CoreMotivationsCacheManager.js'
      );
      const content = readFileSync(cacheManagerPath, 'utf8');

      // Verify correct import path
      expect(content).toContain("from '../events/characterBuilderEvents.js'");

      // Verify no import from service file
      expect(content).not.toContain(
        "from '../services/characterBuilderService.js'"
      );
    });

    it('should have characterBuilderService import and re-export events', () => {
      const servicePath = join(
        process.cwd(),
        'src/characterBuilder/services/characterBuilderService.js'
      );
      const content = readFileSync(servicePath, 'utf8');

      // Verify import from events file
      expect(content).toContain(
        "import { CHARACTER_BUILDER_EVENTS } from '../events/characterBuilderEvents.js'"
      );

      // Verify re-export
      expect(content).toContain('export { CHARACTER_BUILDER_EVENTS }');

      // Verify no constant definition
      expect(content).not.toContain(
        'export const CHARACTER_BUILDER_EVENTS = {'
      );
    });
  });
});
