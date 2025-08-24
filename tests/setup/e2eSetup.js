/**
 * @file Global E2E test setup for traits generator testing
 * @description Provides comprehensive mocking and setup for end-to-end tests
 * including LLM proxy server mocking, browser APIs, and performance monitoring
 */

import { jest } from '@jest/globals';

/**
 * Setup LLM proxy server mocking for E2E tests
 * CRITICAL: All E2E tests MUST mock calls to prevent actual LLM API requests
 *
 * @param {Function} fetchMock - Jest mock function for fetch
 * @returns {Function} Configured fetch mock
 */
export const setupLLMProxyMocks = (fetchMock) => {
  return fetchMock.mockImplementation((url, options) => {
    // Mock successful LLM generation response
    if (
      url.includes('http://localhost:3001/api/llm/generate') ||
      url.includes('generate-traits')
    ) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            names: [
              {
                name: 'Aria Blackthorn',
                justification: 'Strong, memorable fantasy name with depth',
              },
              {
                name: 'Marcus Shadowend',
                justification: 'Evokes mystery and emotional complexity',
              },
              {
                name: 'Elena Stormwright',
                justification: 'Powerful name suggesting inner strength',
              },
            ],
            physicalDescription:
              'A weathered figure with determined eyes and silver-streaked hair, carrying the weight of countless decisions. Scars tell stories of battles both physical and emotional, while their posture suggests someone who has learned to bear burdens with grace.',
            personality: [
              {
                trait: 'Resilient',
                explanation:
                  'Bounces back from adversity with remarkable strength',
                behavioral_examples: [
                  'Maintains composure during crises',
                  'Finds solutions under pressure',
                ],
              },
              {
                trait: 'Introspective',
                explanation: 'Deeply reflective about actions and motivations',
                behavioral_examples: [
                  'Spends time alone processing events',
                  'Questions own decisions carefully',
                ],
              },
            ],
            strengths: [
              {
                strength: 'Strategic thinking',
                explanation: 'Ability to see multiple moves ahead',
                application_examples: [
                  'Plans for various contingencies',
                  'Anticipates opponent responses',
                ],
              },
              {
                strength: 'Emotional intelligence',
                explanation:
                  'Deep understanding of human nature and motivations',
                application_examples: [
                  'Reads people accurately',
                  'Provides comfort when needed',
                ],
              },
            ],
            weaknesses: [
              {
                weakness: 'Overthinking',
                explanation: 'Tendency to analyze situations to paralysis',
                manifestation_examples: [
                  'Delays decisions due to endless analysis',
                  'Second-guesses successful choices',
                ],
              },
              {
                weakness: 'Trust issues',
                explanation: 'Difficulty opening up to others completely',
                manifestation_examples: [
                  'Keeps important secrets',
                  'Tests others before trusting',
                ],
              },
            ],
            likes: [
              'Quiet moments of reflection',
              'Meaningful conversations',
              'Simple pleasures like tea',
              'Watching sunsets',
            ],
            dislikes: [
              'Superficial interactions',
              'Betrayal of trust',
              'Unnecessary violence',
              'Political manipulation',
            ],
            fears: [
              {
                fear: 'Losing loved ones',
                root_cause: 'Past experiences of loss',
                behavioral_impact:
                  'Becomes overprotective of close relationships',
              },
              {
                fear: 'Failing in crucial moments',
                root_cause: 'Previous failures with serious consequences',
                behavioral_impact: 'Over-prepares and second-guesses decisions',
              },
            ],
            goals: [
              {
                goal: 'Find inner peace',
                motivation: 'Years of conflict have taken their toll',
                obstacles: ['Past trauma', 'Self-doubt', 'External pressures'],
              },
              {
                goal: 'Protect the innocent',
                motivation: 'Strong moral compass and sense of duty',
                obstacles: [
                  'Limited resources',
                  'Powerful enemies',
                  'Moral complexity',
                ],
              },
            ],
            notes:
              'Carries a hidden burden from past decisions that shaped their worldview. Has learned that sometimes doing the right thing comes at a personal cost, but maintains hope for redemption.',
            profile:
              'A complex character who balances strength with vulnerability, wisdom with uncertainty. Their journey represents the ongoing struggle between personal desires and moral obligations.',
            secrets: [
              {
                secret: 'Former identity as royal guard',
                reason_for_hiding:
                  'Past political associations could endanger current mission',
                consequences_if_revealed:
                  'Would expose them to old enemies and complicate relationships',
              },
              {
                secret: 'Possesses limited magical abilities',
                reason_for_hiding:
                  'Magic is feared or outlawed in current location',
                consequences_if_revealed:
                  'Could face persecution or unwanted attention from magical authorities',
              },
            ],
          }),
      });
    }

    // Mock timeout simulation for performance testing
    if (options?.timeout || options?.simulateTimeout) {
      return new Promise((resolve, reject) => {
        setTimeout(
          () => reject(new Error('Request timeout')),
          options.timeout || 1000
        );
      });
    }

    // Mock network errors for error handling tests
    if (options?.simulateNetworkError) {
      return Promise.reject(new Error('Network error: Connection failed'));
    }

    // Mock server errors for error handling tests
    if (options?.simulateServerError) {
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () =>
          Promise.resolve({
            error: 'Internal server error',
            message: 'LLM service temporarily unavailable',
          }),
      });
    }

    // Mock thematic directions response
    if (url.includes('thematic-directions') || url.includes('directions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'test-direction-1',
              title: 'The Reluctant Hero',
              description: 'A character forced into heroism against their will',
              theme: 'Reluctant heroism and personal growth',
              coreTension: 'Duty versus personal desires',
              uniqueTwist: 'Hero questions the nature of heroism itself',
            },
            {
              id: 'test-direction-2',
              title: 'Path to Redemption',
              description: 'A journey from darkness to light through atonement',
              theme: 'Redemption and second chances',
              coreTension: 'Past mistakes versus future possibilities',
              uniqueTwist: 'Redemption comes through helping former enemies',
            },
          ]),
      });
    }

    // Mock core motivations response
    if (url.includes('core-motivations') || url.includes('motivations')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'motivation-1',
              coreMotivation:
                'To atone for past mistakes by protecting the innocent',
              internalContradiction:
                'Believes they deserve punishment yet knows others need protection',
              centralQuestion:
                'Can someone who has caused great harm ever truly be redeemed?',
              directionId: 'test-direction-1',
            },
          ]),
      });
    }

    // Mock clichés response
    if (url.includes('cliches')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 'cliche-1', text: 'Brooding antihero with mysterious past' },
            { id: 'cliche-2', text: 'Reluctant mentor who has lost faith' },
            { id: 'cliche-3', text: 'Sacrificial hero complex' },
          ]),
      });
    }

    // Default fallback for unhandled requests
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Endpoint not found' }),
    });
  });
};

/**
 * Setup browser API mocks for E2E testing
 *
 * @param {Window} window - JSDOM window object
 */
export const setupBrowserAPIMocks = (window) => {
  // Mock URL constructor and createObjectURL for export functionality
  if (!window.URL) {
    window.URL = {
      createObjectURL: jest.fn(() => 'mock-blob-url-' + Date.now()),
      revokeObjectURL: jest.fn(),
    };
  }

  // Mock performance API with realistic timing
  if (!window.performance) {
    let performanceStart = Date.now();
    window.performance = {
      now: jest.fn(() => Date.now() - performanceStart),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn(() => []),
      memory: {
        usedJSHeapSize: 1024 * 1024, // 1MB
        totalJSHeapSize: 2 * 1024 * 1024, // 2MB
        jsHeapSizeLimit: 4 * 1024 * 1024, // 4MB
      },
    };
  }

  // Mock clipboard API for export testing
  if (!window.navigator.clipboard) {
    window.navigator.clipboard = {
      writeText: jest.fn().mockResolvedValue(),
      readText: jest.fn().mockResolvedValue(''),
    };
  }

  // Mock IndexedDB for data storage tests
  if (!window.indexedDB) {
    const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
    window.indexedDB = new FDBFactory();
  }

  // Mock localStorage for settings persistence
  if (!window.localStorage) {
    const localStorageMock = {
      store: new Map(),
      getItem: jest.fn(function (key) {
        return this.store.get(key) || null;
      }),
      setItem: jest.fn(function (key, value) {
        this.store.set(key, value.toString());
      }),
      removeItem: jest.fn(function (key) {
        this.store.delete(key);
      }),
      clear: jest.fn(function () {
        this.store.clear();
      }),
      get length() {
        return this.store.size;
      },
      key: jest.fn(function (index) {
        return Array.from(this.store.keys())[index] || null;
      }),
    };
    window.localStorage = localStorageMock;
  }

  // Mock scroll behavior for accessibility tests
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  }

  // Mock focus management for accessibility tests
  const originalFocus = window.HTMLElement.prototype.focus;
  window.HTMLElement.prototype.focus = jest.fn(function () {
    this.setAttribute('data-focused', 'true');
    if (originalFocus) originalFocus.call(this);
  });

  const originalBlur = window.HTMLElement.prototype.blur;
  window.HTMLElement.prototype.blur = jest.fn(function () {
    this.removeAttribute('data-focused');
    if (originalBlur) originalBlur.call(this);
  });

  // Mock ResizeObserver for responsive design tests
  window.ResizeObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock IntersectionObserver for performance tests
  window.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
};

/**
 * Setup console mocking to track errors and warnings
 *
 * @returns {object} Console spies for verification
 */
export const setupConsoleMocks = () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  return {
    errorSpy: consoleErrorSpy,
    warnSpy: consoleWarnSpy,
    logSpy: consoleLogSpy,
    restore: () => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    },
  };
};

/**
 * Create JSDOM instance with comprehensive E2E configuration
 *
 * @param {string} htmlContent - HTML content to load
 * @param {object} options - Additional JSDOM options
 * @returns {object} Configured JSDOM instance
 */
export const createE2EDOM = (htmlContent, options = {}) => {
  const { JSDOM } = require('jsdom');

  return new JSDOM(htmlContent, {
    url: 'http://127.0.0.1:8080/traits-generator.html',
    runScripts: 'outside-only',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      // Setup environment variables
      window.process = { env: { NODE_ENV: 'test' } };

      // Setup browser API mocks
      setupBrowserAPIMocks(window);

      // Setup fetch mock
      const fetchMock = jest.fn();
      window.fetch = fetchMock;
      setupLLMProxyMocks(fetchMock);

      // Custom beforeParse from options
      if (options.beforeParse) {
        options.beforeParse(window);
      }
    },
    ...options,
  });
};

// Global test setup for E2E tests
beforeEach(() => {
  // Reset DOM environment globals
  if (global.document) {
    global.document.body.innerHTML = '';
  }

  // Reset performance markers
  if (global.performance) {
    global.performance.clearMarks?.();
    global.performance.clearMeasures?.();
  }
});

afterEach(() => {
  // Clean up global mocks
  jest.clearAllMocks();

  // Reset timers
  jest.clearAllTimers();

  // Clean up any remaining timeouts
  jest.runOnlyPendingTimers();
});
