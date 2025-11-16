/**
 * @file Integration tests for BaseCharacterBuilderController DOM caching functionality
 * @description Tests DOM element caching map, cache invalidation, and memory management
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerIntegrationTestBase } from './BaseCharacterBuilderController.integration.testbase.js';
import BaseCharacterBuilderController from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class DOMCachingTestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
  }

  async initialize() {
    // Override to bypass heavy initialization
  }

  cacheElement(key, selector, required = true) {
    return this._cacheElement(key, selector, required);
  }

  getCachedElement(key) {
    return this._getCachedElement(key);
  }

  hasCachedElement(key) {
    return this._hasCachedElement(key);
  }

  clearElementCache(keyPattern) {
    this._clearElementCache(keyPattern);
  }

  getCacheSize() {
    return this._getCacheSize ? this._getCacheSize() : 0;
  }
}

describe('BaseCharacterBuilderController - DOM Caching Integration', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerIntegrationTestBase();
    await testBase.setup({ includeFullDOM: true });

    controller = new DOMCachingTestController(testBase.getDependencies());
  });

  afterEach(async () => {
    if (controller && typeof controller.destroy === 'function') {
      await controller.destroy();
    }
    await testBase.cleanup();
  });

  describe('Element Caching', () => {
    it('should cache DOM elements on first access', () => {
      const element = controller.cacheElement('generate-btn', '#generate-first-btn');

      expect(element).toBeTruthy();
      expect(element.id).toBe('create-first-btn');
      expect(controller.hasCachedElement('generate-btn')).toBe(true);
    });

    it('should return cached element on subsequent access', () => {
      const firstAccess = controller.cacheElement('empty-state', '#empty-state');
      const secondAccess = controller.getCachedElement('empty-state');

      expect(firstAccess).toBe(secondAccess);
      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cached element')
      );
    });

    it('should handle required vs optional elements correctly', () => {
      // Required element that exists - should succeed
      const requiredElement = controller.cacheElement('empty-state', '#empty-state', true);
      expect(requiredElement).toBeTruthy();

      // Optional element that doesn't exist - should not throw
      const optionalElement = controller.cacheElement('non-existent', '#does-not-exist', false);
      expect(optionalElement).toBeNull();
      expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Optional element not found')
      );
    });

    it('should throw for required elements that do not exist', () => {
      expect(() => {
        controller.cacheElement('missing', '#missing-element', true);
      }).toThrow();

      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Required element not found')
      );
    });

    it('should cache multiple elements with different keys', () => {
      controller.cacheElement('empty-state', '#empty-state');
      controller.cacheElement('loading-state', '#loading-state');
      controller.cacheElement('error-state', '#error-state');
      controller.cacheElement('results-state', '#results-state');

      expect(controller.hasCachedElement('empty-state')).toBe(true);
      expect(controller.hasCachedElement('loading-state')).toBe(true);
      expect(controller.hasCachedElement('error-state')).toBe(true);
      expect(controller.hasCachedElement('results-state')).toBe(true);
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(() => {
      // Setup cache with multiple elements
      controller.cacheElement('empty-state', '#empty-state');
      controller.cacheElement('loading-state', '#loading-state');
      controller.cacheElement('error-state', '#error-state');
      controller.cacheElement('results-state', '#results-state');
    });

    it('should clear specific cached element', () => {
      expect(controller.hasCachedElement('empty-state')).toBe(true);

      controller.clearElementCache('empty-state');

      expect(controller.hasCachedElement('empty-state')).toBe(false);
      expect(controller.hasCachedElement('loading-state')).toBe(true);
    });

    it('should clear cache entries matching pattern', () => {
      controller.cacheElement('state-header-1', '#empty-state');
      controller.cacheElement('state-header-2', '#loading-state');
      controller.cacheElement('button-submit', '#modal-confirm-btn');

      controller.clearElementCache('state-');

      expect(controller.hasCachedElement('state-header-1')).toBe(false);
      expect(controller.hasCachedElement('state-header-2')).toBe(false);
      expect(controller.hasCachedElement('button-submit')).toBe(true);
    });

    it('should clear all cache when pattern is null or undefined', () => {
      expect(controller.hasCachedElement('empty-state')).toBe(true);
      expect(controller.hasCachedElement('loading-state')).toBe(true);

      controller.clearElementCache();

      expect(controller.hasCachedElement('empty-state')).toBe(false);
      expect(controller.hasCachedElement('loading-state')).toBe(false);
    });
  });

  describe('Cache Performance and Memory', () => {
    it('should prevent memory leaks by clearing cache on destroy', async () => {
      controller.cacheElement('empty-state', '#empty-state');
      controller.cacheElement('loading-state', '#loading-state');
      controller.cacheElement('error-state', '#error-state');

      expect(controller.hasCachedElement('empty-state')).toBe(true);

      await controller.destroy();

      // After destroy, cache should be cleared
      expect(controller.hasCachedElement('empty-state')).toBe(false);
      expect(controller.hasCachedElement('loading-state')).toBe(false);
      expect(controller.hasCachedElement('error-state')).toBe(false);
    });

    it('should handle rapid cache access efficiently', () => {
      const startTime = Date.now();

      // Cache element once
      controller.cacheElement('results-state', '#results-state');

      // Access 100 times
      for (let i = 0; i < 100; i++) {
        controller.getCachedElement('results-state');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be extremely fast (< 10ms for 100 accesses)
      expect(duration).toBeLessThan(10);
    });

    it('should support concurrent caching of multiple elements', () => {
      const elements = [
        { key: 'elem-1', selector: '#empty-state' },
        { key: 'elem-2', selector: '#loading-state' },
        { key: 'elem-3', selector: '#error-state' },
        { key: 'elem-4', selector: '#results-state' },
        { key: 'elem-5', selector: '#search-input' },
      ];

      // Cache all elements concurrently
      const cachedElements = elements.map(({ key, selector }) =>
        controller.cacheElement(key, selector)
      );

      // All should be successfully cached
      expect(cachedElements.every((el) => el !== null)).toBe(true);
      expect(elements.every(({ key }) => controller.hasCachedElement(key))).toBe(true);
    });
  });

  describe('Integration with DOMElementManager', () => {
    it('should delegate element queries to DOMElementManager', () => {
      const element = controller.cacheElement('modal-title', '#modal-title');

      expect(element).toBeTruthy();
      expect(element.textContent).toBe('Confirm Action');
    });

    it('should handle dynamic DOM updates correctly', () => {
      // Cache element
      const originalElement = controller.cacheElement('results-content', '#results-content');
      expect(originalElement).toBeTruthy();

      // Simulate DOM update by modifying the element
      originalElement.innerHTML = '<p>New content</p>';

      // Cached reference should still point to updated element
      const cachedElement = controller.getCachedElement('results-content');
      expect(cachedElement.innerHTML).toBe('<p>New content</p>');
    });

    it('should handle element removal from DOM', () => {
      // Cache element
      const element = controller.cacheElement('notification-success', '#success-notification');
      expect(element).toBeTruthy();

      // Remove element from DOM
      element.remove();

      // Cached reference should still exist but be detached
      const cachedElement = controller.getCachedElement('notification-success');
      expect(cachedElement).toBeTruthy();
      expect(cachedElement.parentNode).toBeNull();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should recover from invalid selector errors', () => {
      expect(() => {
        controller.cacheElement('invalid', '###invalid-selector###', false);
      }).not.toThrow();

      expect(testBase.mocks.logger.warn).toHaveBeenCalled();
    });

    it('should handle null or undefined selectors gracefully', () => {
      const nullElement = controller.cacheElement('null-selector', null, false);
      const undefinedElement = controller.cacheElement('undefined-selector', undefined, false);

      expect(nullElement).toBeNull();
      expect(undefinedElement).toBeNull();
      expect(testBase.mocks.logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should log cache statistics on destroy', async () => {
      controller.cacheElement('elem-1', '#empty-state');
      controller.cacheElement('elem-2', '#loading-state');
      controller.cacheElement('elem-3', '#error-state');

      await controller.destroy();

      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Clearing')
      );
    });
  });
});
