/**
 * @file Test utilities for managing server instances and process mocking in tests
 * @description Provides centralized utilities to prevent resource leaks in Jest tests
 */

import { jest } from '@jest/globals';

/**
 * Manages server instances and cleanup for tests
 */
export class TestServerManager {
  /**
   *
   */
  constructor() {
    this.serverInstances = [];
    this.originalProcessMethods = {};
    this.timers = [];
  }

  /**
   * Creates a mock server instance with proper cleanup tracking
   * @param {object} options - Configuration options
   * @returns {object} Mock server instance
   */
  createMockServer(options = {}) {
    const mockServer = {
      close: jest.fn((callback) => {
        // Simulate async server close
        setTimeout(() => {
          if (callback) callback();
        }, 0);
      }),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return mockServer;
      }),
      address: jest.fn(() => ({ port: options.port || 3000 })),
      ...options.additionalMethods,
    };

    this.serverInstances.push(mockServer);
    return mockServer;
  }

  /**
   * Mocks app.listen to return a controlled server instance
   * @param {object} app - Express app mock
   * @param {object} options - Configuration options
   * @returns {object} Mock server instance
   */
  mockAppListen(app, options = {}) {
    const mockServer = this.createMockServer(options);

    app.listen = jest.fn((port, callback) => {
      if (callback) {
        // Use setTimeout to simulate async behavior
        setTimeout(callback, 0);
      }
      return mockServer;
    });

    return mockServer;
  }

  /**
   * Backs up and mocks process signal handlers
   */
  mockProcessSignals() {
    this.originalProcessMethods = {
      on: process.on,
      exit: process.exit,
    };

    process.on = jest.fn();
    process.exit = jest.fn();
  }

  /**
   * Restores original process signal handlers
   */
  restoreProcessSignals() {
    if (this.originalProcessMethods.on) {
      process.on = this.originalProcessMethods.on;
    }
    if (this.originalProcessMethods.exit) {
      process.exit = this.originalProcessMethods.exit;
    }
    this.originalProcessMethods = {};
  }

  /**
   * Tracks a timer for cleanup
   * @param {number} timerId - Timer ID to track
   */
  trackTimer(timerId) {
    this.timers.push(timerId);
  }

  /**
   * Cleans up all tracked resources
   */
  cleanup() {
    // Clean up server instances
    this.serverInstances.forEach((server) => {
      if (server.close && typeof server.close === 'function') {
        try {
          server.close();
        } catch (_error) {
          // Ignore cleanup errors
        }
      }
    });
    this.serverInstances = [];

    // Clear all tracked timers
    this.timers.forEach((timerId) => {
      try {
        clearTimeout(timerId);
      } catch (_error) {
        // Ignore cleanup errors
      }
    });
    this.timers = [];

    // Restore process methods
    this.restoreProcessSignals();
  }
}

/**
 * Helper for managing Jest timers consistently
 */
export class TestTimerManager {
  /**
   *
   */
  constructor() {
    this.usingFakeTimers = false;
  }

  /**
   * Sets up fake timers
   */
  setupFakeTimers() {
    if (!this.usingFakeTimers) {
      jest.useFakeTimers();
      this.usingFakeTimers = true;
    }
  }

  /**
   * Runs pending timers and cleans up
   */
  cleanup() {
    if (this.usingFakeTimers) {
      try {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      } catch (_error) {
        // Try to restore real timers even if running pending timers fails
        try {
          jest.useRealTimers();
        } catch (_restoreError) {
          // Ignore restore errors
        }
      }
      this.usingFakeTimers = false;
    }
  }
}

/**
 * Helper for managing environment variables in tests
 */
export class TestEnvironmentManager {
  /**
   *
   */
  constructor() {
    this.originalEnv = {};
  }

  /**
   * Backs up current environment variables
   */
  backupEnvironment() {
    this.originalEnv = { ...process.env };
  }

  /**
   * Sets environment variables for test
   * @param {object} envVars - Environment variables to set
   */
  setEnvironment(envVars) {
    Object.assign(process.env, envVars);
  }

  /**
   * Restores original environment variables
   */
  restoreEnvironment() {
    process.env = { ...this.originalEnv };
    this.originalEnv = {};
  }

  /**
   * Completely cleans environment (for isolated tests)
   */
  cleanEnvironment() {
    process.env = {};
  }
}

/**
 * Complete test setup and teardown manager
 * Combines all utility classes for easy use
 */
export class TestManager {
  /**
   *
   */
  constructor() {
    this.serverManager = new TestServerManager();
    this.timerManager = new TestTimerManager();
    this.envManager = new TestEnvironmentManager();
  }

  /**
   * Sets up complete test environment
   * @param {object} options - Setup options
   */
  setup(options = {}) {
    if (options.mockProcessSignals !== false) {
      this.serverManager.mockProcessSignals();
    }

    if (options.useFakeTimers !== false) {
      this.timerManager.setupFakeTimers();
    }

    if (options.backupEnvironment !== false) {
      this.envManager.backupEnvironment();
    }
  }

  /**
   * Creates mock server with integrated management
   * @param {object} app - Express app mock
   * @param {object} options - Server options
   * @returns {object} Mock server instance
   */
  createMockServer(app, options = {}) {
    return this.serverManager.mockAppListen(app, options);
  }

  /**
   * Cleans up all managed resources
   */
  cleanup() {
    this.serverManager.cleanup();
    this.timerManager.cleanup();
    this.envManager.restoreEnvironment();
  }
}

/**
 * Factory function for quick test manager creation
 * @param {object} options - Setup options
 * @returns {TestManager} Configured test manager instance
 */
export function createTestManager(options = {}) {
  const manager = new TestManager();
  manager.setup(options);
  return manager;
}
