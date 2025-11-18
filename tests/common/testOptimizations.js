/**
 * @file Test optimization utilities for performance improvements
 * @description Provides utilities to optimize test execution time without reducing quality
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock debounce function that executes immediately for testing
 * Eliminates timeout delays in tests while preserving debounce behavior
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay (ignored in tests)
 * @param {object} options - Debounce options
 * @returns {Function} Immediate-execution mock debounce function
 */
export function createMockDebounce(fn, delay, options = {}) {
  const { immediate = false } = options;

  let timeoutId = null;
  let lastCallArgs = null;
  let lastCallContext = null;

  const debouncedFn = function (...args) {
    lastCallArgs = args;
    lastCallContext = this;

    // Clear any existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // For tests, execute after minimal delay to preserve async behavior
    // but make it much faster than the original delay
    timeoutId = setTimeout(() => {
      fn.apply(lastCallContext, lastCallArgs);
      timeoutId = null;
    }, 1); // 1ms instead of original delay

    return this;
  };

  // Add cancel method to match real debounce
  debouncedFn.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  // Add flush method to execute immediately
  debouncedFn.flush = function () {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastCallArgs) {
      fn.apply(lastCallContext, lastCallArgs);
    }
  };

  return debouncedFn;
}

/**
 * Mock the BaseCharacterBuilderController _debounce method for fast test execution
 *
 * @param {object} controller - Controller instance to mock
 */
export function mockControllerDebounce(controller) {
  const originalDebounce = controller._debounce;

  controller._debounce = jest.fn().mockImplementation((fn, delay, options) => {
    return createMockDebounce(fn, delay, options);
  });

  // Return cleanup function
  return () => {
    controller._debounce = originalDebounce;
  };
}

/**
 * Creates a fast DOM element setup utility
 * Reuses existing elements when possible instead of recreating
 *
 * @param {string} containerId - Container element ID
 * @returns {object} DOM elements and utilities
 */
export function createOptimizedDOMSetup(containerId = 'test-app') {
  let container = document.getElementById(containerId);
  let elements = {};

  /**
   * Setup DOM elements efficiently
   *
   * @param {object} elementMap - Map of element IDs to selectors/configs
   * @returns {object} Created elements
   */
  function setupElements(elementMap) {
    // Create container if it doesn't exist
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    }

    // Clear existing content but keep container
    container.innerHTML = '';
    elements = {};

    // Create elements efficiently
    Object.entries(elementMap).forEach(([key, config]) => {
      const {
        tag = 'div',
        id,
        className,
        type,
      } = typeof config === 'string' ? { id: config } : config;

      const element = document.createElement(tag);
      if (id) element.id = id;
      if (className) element.className = className;
      if (type) element.type = type;

      // Set default properties for common elements
      if (tag === 'button') {
        element.disabled = false;
        element.onclick = jest.fn();
      }

      if (tag === 'textarea' || tag === 'input') {
        element.value = '';
        element.oninput = jest.fn();
        element.onblur = jest.fn();
      }

      // Add style mock for visibility testing
      element.style = {
        display: 'block',
        ...element.style,
      };

      // Add classList mock
      element.classList = {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false),
        toggle: jest.fn(),
      };

      elements[key] = element;
      container.appendChild(element);
    });

    return elements;
  }

  /**
   * Reset element states without recreating DOM
   */
  function resetElements() {
    Object.values(elements).forEach((element) => {
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value = '';
      }
      if (element.tagName === 'BUTTON') {
        element.disabled = false;
      }
      element.style.display = 'block';
      element.textContent = '';

      // Reset all mocks
      if (element.onclick?.mockClear) element.onclick.mockClear();
      if (element.oninput?.mockClear) element.oninput.mockClear();
      if (element.onblur?.mockClear) element.onblur.mockClear();
      if (element.classList?.add?.mockClear) {
        element.classList.add.mockClear();
        element.classList.remove.mockClear();
        element.classList.contains.mockClear();
        element.classList.toggle.mockClear();
      }
    });
  }

  /**
   * Cleanup DOM completely
   */
  function cleanup() {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    elements = {};
  }

  return {
    setupElements,
    resetElements,
    cleanup,
    getElements: () => elements,
    getContainer: () => container,
  };
}

/**
 * Creates optimized mock service factory
 * Reduces object creation overhead with reusable mocks
 */
export class OptimizedMockFactory {
  constructor() {
    this.mockCache = new Map();
  }

  /**
   * Get or create a mock logger with standard methods
   */
  getMockLogger() {
    if (!this.mockCache.has('logger')) {
      this.mockCache.set('logger', {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      });
    }

    const logger = this.mockCache.get('logger');
    // Reset calls but keep same mock functions
    Object.values(logger).forEach((fn) => fn.mockClear());

    return logger;
  }

  /**
   * Get or create a mock service with specified methods
   *
   * @param {string} serviceName - Name of service for caching
   * @param {string[]} methods - Required methods
   * @returns {object} Mock service
   */
  getMockService(serviceName, methods) {
    const cacheKey = `${serviceName}:${methods.sort().join(',')}`;

    if (!this.mockCache.has(cacheKey)) {
      const mockService = {};
      methods.forEach((method) => {
        mockService[method] = jest.fn();
      });
      this.mockCache.set(cacheKey, mockService);
    }

    const service = this.mockCache.get(cacheKey);
    // Reset all method calls
    Object.values(service).forEach((fn) => fn.mockClear());

    return service;
  }

  /**
   * Clear all cached mocks
   */
  clearCache() {
    this.mockCache.clear();
  }
}

/**
 * Waits for next tick with minimal delay for debounced operations
 * Much faster than original 600ms delays
 */
export function waitForNextTick() {
  return new Promise((resolve) => setTimeout(resolve, 10)); // 10ms to account for debounce
}

/**
 * Fast event simulation that properly triggers both inline handlers and event listeners
 *
 * @param {HTMLElement} element - Target element
 * @param {string} eventType - Event type (input, click, blur, etc.)
 * @param {object} eventData - Additional event data
 */
export function simulateEvent(element, eventType, eventData = {}) {
  // Create a real DOM event for proper testing
  const event = new Event(eventType, { bubbles: true, cancelable: true });
  Object.assign(event, eventData);

  // Call inline event handler if it exists
  const handlerName = `on${eventType}`;
  if (typeof element[handlerName] === 'function') {
    element[handlerName](event);
  }

  // Dispatch the event for addEventListener handlers
  if (element.dispatchEvent) {
    element.dispatchEvent(event);
  }

  return event;
}
