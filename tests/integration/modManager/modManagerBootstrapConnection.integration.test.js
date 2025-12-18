/**
 * @file Integration tests for ModManagerBootstrap API connection
 * @description Tests that ModManagerBootstrap correctly wires up services
 *              and connects to the backend API to load mod data.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock ConsoleLogger
const mockLoggerInstance = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../src/logging/consoleLogger.js', () => {
  return jest.fn(() => mockLoggerInstance);
});

import { ModManagerBootstrap } from '../../../src/modManager/ModManagerBootstrap.js';

describe('ModManagerBootstrap Connection Integration', () => {
  let bootstrap;
  let mockLoadingIndicators;

  // Mock API responses
  const mockModsResponse = {
    success: true,
    mods: [
      {
        id: 'core',
        name: 'Core',
        version: '1.0.0',
        description: 'Core game mechanics',
        author: 'System',
        dependencies: [],
        conflicts: [],
        hasWorlds: true,
      },
      {
        id: 'test_mod',
        name: 'Test Mod',
        version: '1.0.0',
        description: 'A test mod',
        author: 'Tester',
        dependencies: [{ id: 'core', version: '*' }],
        conflicts: [],
        hasWorlds: false,
      },
    ],
    count: 2,
    scannedAt: new Date().toISOString(),
  };

  const mockConfigResponse = {
    success: true,
    config: {
      mods: ['core'],
      startWorld: 'core:core',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock document using jest.spyOn
    mockLoadingIndicators = [{ textContent: '' }, { textContent: '' }];
    jest.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector === '.loading-indicator') {
        return mockLoadingIndicators;
      }
      return [];
    });

    // Setup default fetch mock to return successful responses
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/mods')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModsResponse),
        });
      }
      if (url.includes('/api/game-config/current')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfigResponse),
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    bootstrap = new ModManagerBootstrap();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (bootstrap) {
      bootstrap.destroy();
    }
  });

  describe('successful initialization', () => {
    it('should create bootstrap instance', () => {
      expect(bootstrap).toBeInstanceOf(ModManagerBootstrap);
    });

    it('should call API endpoints during initialization', async () => {
      await bootstrap.initialize();

      // Should have called both API endpoints
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mods')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/game-config/current')
      );
    });

    it('should update loading indicators with mod count after successful load', async () => {
      await bootstrap.initialize();

      // At least one indicator should show loaded mod count
      const hasLoadedMessage = mockLoadingIndicators.some(
        (indicator) =>
          indicator.textContent.includes('Loaded') ||
          indicator.textContent.includes('2 mods')
      );
      expect(hasLoadedMessage).toBe(true);
    });

    it('should not show "Services not connected" message after successful load', async () => {
      await bootstrap.initialize();

      // No indicator should have the placeholder message
      const hasPlaceholder = mockLoadingIndicators.some((indicator) =>
        indicator.textContent.includes('Services not connected')
      );
      expect(hasPlaceholder).toBe(false);
    });

    it('should log successful initialization', async () => {
      await bootstrap.initialize();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Mod Manager initialized successfully'
      );
    });
  });

  describe('error handling', () => {
    it('should show error state when mods API fails', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/mods')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        if (url.includes('/api/game-config/current')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockConfigResponse),
          });
        }
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });

      // Controller handles errors gracefully by updating state, not throwing
      await bootstrap.initialize();

      // Should show error state (controller sets error in state)
      const hasErrorMessage = mockLoadingIndicators.some(
        (indicator) =>
          indicator.textContent.includes('Failed') ||
          indicator.textContent.includes('error') ||
          indicator.textContent.includes('Error')
      );
      expect(hasErrorMessage).toBe(true);
    });

    it('should show error state when config API fails', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/mods')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockModsResponse),
          });
        }
        if (url.includes('/api/game-config/current')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });

      // Controller handles errors gracefully by updating state, not throwing
      await bootstrap.initialize();

      // Should show error state
      const hasErrorMessage = mockLoadingIndicators.some(
        (indicator) =>
          indicator.textContent.includes('Failed') ||
          indicator.textContent.includes('error') ||
          indicator.textContent.includes('Error')
      );
      expect(hasErrorMessage).toBe(true);
    });

    it('should show error state when network request fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Controller handles errors gracefully by updating state, not throwing
      await bootstrap.initialize();

      // Should show error state
      const hasErrorMessage = mockLoadingIndicators.some(
        (indicator) =>
          indicator.textContent.includes('Failed') ||
          indicator.textContent.includes('error') ||
          indicator.textContent.includes('Error')
      );
      expect(hasErrorMessage).toBe(true);
    });

    it('should log error on initialization failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Controller handles errors gracefully by updating state, not throwing
      await bootstrap.initialize();

      // Controller logs error when initialization fails
      expect(mockLoggerInstance.error).toHaveBeenCalled();
    });
  });

  describe('service registration', () => {
    it('should register all required services', async () => {
      await bootstrap.initialize();

      // Verify logging shows service registration occurred
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Registering services...'
      );
    });

    it('should initialize controller with services', async () => {
      await bootstrap.initialize();

      // Verify logging shows controller initialization occurred
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Initializing controller...'
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      await bootstrap.initialize();

      expect(() => bootstrap.destroy()).not.toThrow();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Destroying Mod Manager...'
      );
    });

    it('should handle destroy without initialization', () => {
      expect(() => bootstrap.destroy()).not.toThrow();
    });
  });
});

describe('ModManagerBootstrap API URL Configuration', () => {
  let bootstrap;

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);

    // Reset fetch mock
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/mods')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              mods: [],
              count: 0,
              scannedAt: new Date().toISOString(),
            }),
        });
      }
      if (url.includes('/api/game-config/current')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              config: { mods: ['core'], startWorld: 'core:core' },
            }),
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    bootstrap = new ModManagerBootstrap();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (bootstrap) {
      bootstrap.destroy();
    }
  });

  it('should use default localhost:3001 URL', async () => {
    await bootstrap.initialize();

    // Verify calls go to localhost:3001
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('localhost:3001')
    );
  });
});
