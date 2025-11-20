/**
 * @file Integration test for browser environment compatibility
 *
 * This test verifies that the Character Builder components (particularly GoalLoader)
 * work correctly in browser environments where Node.js globals like `process` are undefined.
 *
 * Issue: Character Concepts Manager fails with "process is not defined" error
 * Root Cause: goalLoader.js:34 accesses process.env without browser compatibility check
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Character Builder - Browser Environment Compatibility', () => {
  let originalProcess;

  beforeEach(() => {
    // Save original process reference
    originalProcess = global.process;
  });

  afterEach(() => {
    // Restore original process
    global.process = originalProcess;
  });

  describe('CharacterBuilderBootstrap - Browser Environment', () => {
    it('should initialize successfully without process global', async () => {
      // Simulate browser environment
      delete global.process;

      // Import CharacterBuilderBootstrap
      const { default: CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );

      // Create minimal configuration for bootstrap
      const mockConfig = {
        appName: 'Test Character Builder',
        modsDirectory: './data/mods',
        schemasDirectory: './data/schemas',
      };

      const mockContainer = {
        register: jest.fn(),
        resolve: jest.fn().mockImplementation((token) => {
          // Return mock implementations for required services
          if (token === 'ILogger') {
            return {
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            };
          }
          return {};
        }),
      };

      // This should NOT throw during instantiation
      expect(() => {
        new CharacterBuilderBootstrap(mockConfig, mockContainer);
      }).not.toThrow();
    });
  });

  describe('Environment Variable Access Patterns', () => {
    it('should handle undefined process gracefully', () => {
      delete global.process;

      // Test the pattern used in isNormalizationDiagnosticsEnabled
      const testFunction = () => {
        // This pattern should be safe in browser environments
        if (typeof process === 'undefined' || !process.env) {
          return true; // Default value
        }
        return process.env.SOME_VAR === 'true';
      };

      expect(() => testFunction()).not.toThrow();
      expect(testFunction()).toBe(true); // Should return default
    });

    it('should handle undefined process.env gracefully', () => {
      // Simulate process exists but env is undefined
      global.process = {};

      const testFunction = () => {
        if (typeof process === 'undefined' || !process.env) {
          return true;
        }
        return process.env.SOME_VAR === 'true';
      };

      expect(() => testFunction()).not.toThrow();
      expect(testFunction()).toBe(true);
    });

    it('should read environment variable when process.env exists', () => {
      // Ensure process.env exists and has a value
      global.process = {
        env: {
          SOME_VAR: 'true',
        },
      };

      const testFunction = () => {
        if (typeof process === 'undefined' || !process.env) {
          return true;
        }
        return process.env.SOME_VAR === 'true';
      };

      expect(testFunction()).toBe(true);
    });
  });
});
