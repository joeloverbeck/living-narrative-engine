/**
 * @file Unit tests for TimeoutConfiguration
 * Tests all configuration scenarios, validation logic, and error handling
 */

import { describe, it, expect } from '@jest/globals';
import TimeoutConfiguration from '../../../../src/turns/config/timeoutConfiguration.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('TimeoutConfiguration', () => {
  describe('Environment-Based Configuration', () => {
    it('should return 30-second timeout for production environment', () => {
      // Arrange
      const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
      const config = new TimeoutConfiguration({
        environmentProvider: productionProvider,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(30_000);
    });

    it('should return 3-second timeout for development environment', () => {
      // Arrange
      const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
      const config = new TimeoutConfiguration({
        environmentProvider: developmentProvider,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(3_000);
    });
  });

  describe('Explicit Timeout Override', () => {
    it('should use explicit timeout over production default', () => {
      // Arrange
      const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
      const config = new TimeoutConfiguration({
        timeoutMs: 5_000,
        environmentProvider: productionProvider,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(5_000); // Not 30_000
    });

    it('should use explicit timeout over development default', () => {
      // Arrange
      const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
      const config = new TimeoutConfiguration({
        timeoutMs: 10_000,
        environmentProvider: developmentProvider,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(10_000); // Not 3_000
    });
  });

  describe('Invalid Timeout Validation', () => {
    it('should throw InvalidArgumentError for NaN timeout', () => {
      // Arrange
      const config = new TimeoutConfiguration({ timeoutMs: NaN });

      // Act & Assert
      /* eslint-disable jest/no-conditional-expect */
      try {
        config.getTimeoutMs();
        throw new Error('Expected getTimeoutMs to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidArgumentError);
        expect(err.message).toMatch(/timeoutMs must be a positive finite number.*NaN/);
      }
      /* eslint-enable jest/no-conditional-expect */
    });

    it('should throw InvalidArgumentError for negative timeout', () => {
      // Arrange
      const config = new TimeoutConfiguration({ timeoutMs: -1000 });

      // Act & Assert
      /* eslint-disable jest/no-conditional-expect */
      try {
        config.getTimeoutMs();
        throw new Error('Expected getTimeoutMs to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidArgumentError);
        expect(err.message).toMatch(/-1000/);
      }
      /* eslint-enable jest/no-conditional-expect */
    });

    it('should throw InvalidArgumentError for Infinity timeout', () => {
      // Arrange
      const config = new TimeoutConfiguration({ timeoutMs: Infinity });

      // Act & Assert
      /* eslint-disable jest/no-conditional-expect */
      try {
        config.getTimeoutMs();
        throw new Error('Expected getTimeoutMs to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidArgumentError);
        expect(err.message).toMatch(/Infinity/);
      }
      /* eslint-enable jest/no-conditional-expect */
    });

    it('should throw InvalidArgumentError for zero timeout', () => {
      // Arrange
      const config = new TimeoutConfiguration({ timeoutMs: 0 });

      // Act & Assert
      /* eslint-disable jest/no-conditional-expect */
      try {
        config.getTimeoutMs();
        throw new Error('Expected getTimeoutMs to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidArgumentError);
        expect(err.message).toMatch(/timeoutMs must be a positive finite number.*0/);
      }
      /* eslint-enable jest/no-conditional-expect */
    });

    it('should throw InvalidArgumentError for negative Infinity timeout', () => {
      // Arrange
      const config = new TimeoutConfiguration({ timeoutMs: -Infinity });

      // Act & Assert
      /* eslint-disable jest/no-conditional-expect */
      try {
        config.getTimeoutMs();
        throw new Error('Expected getTimeoutMs to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidArgumentError);
        expect(err.message).toMatch(/-Infinity/);
      }
      /* eslint-enable jest/no-conditional-expect */
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should fall back to production timeout when provider throws error', () => {
      // Arrange
      const mockLogger = { warn: jest.fn() };
      const errorProvider = {
        getEnvironment: () => {
          throw new Error('Provider failed');
        },
      };
      const config = new TimeoutConfiguration({
        environmentProvider: errorProvider,
        logger: mockLogger,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(30_000); // Fail-safe to production
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Environment provider failed/),
        expect.any(Error)
      );
    });

    it('should fall back to production timeout when provider returns null', () => {
      // Arrange
      const malformedProvider = {
        getEnvironment: () => null,
      };
      const config = new TimeoutConfiguration({
        environmentProvider: malformedProvider,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(30_000); // env?.IS_PRODUCTION ?? true
    });

    it('should fall back to production timeout when provider returns undefined', () => {
      // Arrange
      const malformedProvider = {
        getEnvironment: () => undefined,
      };
      const config = new TimeoutConfiguration({
        environmentProvider: malformedProvider,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(30_000); // env?.IS_PRODUCTION ?? true
    });
  });

  describe('Lazy Resolution and Caching', () => {
    it('should cache resolved timeout and not call provider again', () => {
      // Arrange
      const mockProvider = {
        getEnvironment: jest.fn(() => ({ IS_PRODUCTION: true })),
      };
      const config = new TimeoutConfiguration({
        environmentProvider: mockProvider,
      });

      // Act
      const timeout1 = config.getTimeoutMs();
      const timeout2 = config.getTimeoutMs();
      const timeout3 = config.getTimeoutMs();

      // Assert
      expect(timeout1).toBe(30_000);
      expect(timeout2).toBe(30_000);
      expect(timeout3).toBe(30_000);
      expect(mockProvider.getEnvironment).toHaveBeenCalledTimes(1); // Only once
    });

    it('should resolve timeout only once even with invalid value', () => {
      // Arrange
      const mockProvider = {
        getEnvironment: jest.fn(() => ({ IS_PRODUCTION: true })),
      };
      const config = new TimeoutConfiguration({
        timeoutMs: -1000,
        environmentProvider: mockProvider,
      });

      // Act & Assert
      /* eslint-disable jest/no-conditional-expect */
      // First call should throw
      try {
        config.getTimeoutMs();
        throw new Error('Expected first call to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidArgumentError);
      }
      /* eslint-enable jest/no-conditional-expect */

      // Second call should return cached invalid value (validation already done)
      // The implementation caches the resolved value before validation,
      // so subsequent calls skip both resolution and validation
      const secondCallResult = config.getTimeoutMs();
      expect(secondCallResult).toBe(-1000);

      // Provider should not be called when explicit timeout is provided
      expect(mockProvider.getEnvironment).not.toHaveBeenCalled();
    });
  });

  describe('Default Provider Behavior', () => {
    it('should work with no constructor arguments', () => {
      // Arrange & Act
      const config = new TimeoutConfiguration();
      const timeout = config.getTimeoutMs();

      // Assert
      // Should use ProcessEnvironmentProvider and resolve based on actual NODE_ENV
      expect(timeout).toBeGreaterThan(0);
      expect([3_000, 30_000]).toContain(timeout);
    });

    it('should use ProcessEnvironmentProvider by default when no provider given', () => {
      // Arrange
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        process.env.NODE_ENV = 'production';

        const config = new TimeoutConfiguration({
          // No environmentProvider
        });

        // Act
        const timeout = config.getTimeoutMs();

        // Assert
        expect(timeout).toBe(30_000); // Uses real ProcessEnvironmentProvider
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should respect development environment with default provider', () => {
      // Arrange
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        process.env.NODE_ENV = 'development';

        const config = new TimeoutConfiguration({
          // No environmentProvider
        });

        // Act
        const timeout = config.getTimeoutMs();

        // Assert
        expect(timeout).toBe(3_000); // Uses real ProcessEnvironmentProvider
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle null explicit timeout as undefined', () => {
      // Arrange
      const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
      const config = new TimeoutConfiguration({
        timeoutMs: null,
        environmentProvider: developmentProvider,
      });

      // Act
      const timeout = config.getTimeoutMs();

      // Assert
      expect(timeout).toBe(3_000); // Falls back to environment
    });

    it('should validate timeout even when explicitly set', () => {
      // Arrange
      const config = new TimeoutConfiguration({
        timeoutMs: 0,
      });

      // Act & Assert
      expect(() => config.getTimeoutMs()).toThrow(InvalidArgumentError);
    });

    it('should throw error with detailed type information', () => {
      // Arrange
      const config = new TimeoutConfiguration({
        timeoutMs: 'invalid',
      });

      // Act & Assert
      /* eslint-disable jest/no-conditional-expect */
      try {
        config.getTimeoutMs();
        throw new Error('Expected getTimeoutMs to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidArgumentError);
        expect(err.message).toMatch(/type: string/);
      }
      /* eslint-enable jest/no-conditional-expect */
    });
  });

  describe('Static Constants', () => {
    it('should expose correct production timeout constant', () => {
      expect(TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION).toBe(30_000);
    });

    it('should expose correct development timeout constant', () => {
      expect(TimeoutConfiguration.DEFAULT_TIMEOUT_DEVELOPMENT).toBe(3_000);
    });
  });
});
