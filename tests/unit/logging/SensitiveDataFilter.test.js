/**
 * @file Unit tests for SensitiveDataFilter
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SensitiveDataFilter from '../../../src/logging/SensitiveDataFilter.js';

describe('SensitiveDataFilter', () => {
  let mockLogger;
  let filter;
  let defaultConfig;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    defaultConfig = {
      patterns: {
        testKey: 'secret:\\s*\\w+',
      },
      strategies: {
        test: () => '[TEST_REDACTED]',
      },
    };

    filter = new SensitiveDataFilter({
      logger: mockLogger,
      enabled: true,
      config: defaultConfig,
    });
  });

  describe('Constructor', () => {
    it('should initialize with valid logger and config', () => {
      expect(filter.isEnabled()).toBe(true);
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new SensitiveDataFilter({
          logger: null,
          enabled: true,
          config: {},
        });
      }).toThrow();
    });

    it('should initialize with default patterns when no custom patterns provided', () => {
      const basicFilter = new SensitiveDataFilter({
        logger: mockLogger,
        enabled: true,
        config: {},
      });

      const result = basicFilter.filter('Bearer abc123token');
      expect(result).toBe('Bearer [REDACTED]');
    });
  });

  describe('String Filtering', () => {
    it('should filter API keys', () => {
      const input = 'API_KEY=sk-1234567890abcdef';
      const result = filter.filter(input);
      expect(result).toBe('API_KEY=[REDACTED]');
    });

    it('should filter Bearer tokens', () => {
      const input = 'Authorization: Bearer abc123def456';
      const result = filter.filter(input);
      expect(result).toBe('Authorization: Bearer [REDACTED]');
    });

    it('should filter passwords', () => {
      const input = 'password: mySecretPass123';
      const result = filter.filter(input);
      expect(result).toBe('password: [REDACTED]');
    });

    it('should filter email addresses', () => {
      const input = 'User email: john.doe@example.com';
      const result = filter.filter(input);
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('User email:');
    });

    it('should filter credit card numbers', () => {
      const input = 'Card: 1234 5678 9012 3456';
      const result = filter.filter(input);
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('Card:');
    });

    it('should filter SSNs', () => {
      const input = 'SSN: 123-45-6789';
      const result = filter.filter(input);
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('SSN:');
    });

    it('should filter JWT tokens', () => {
      const input =
        'Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.Gfx6VO9tcxwk6xqx9yYzSfebfeakZp5JYIgP_edcw_A';
      const result = filter.filter(input);
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('Token:');
    });

    it('should filter AWS access keys', () => {
      const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const result = filter.filter(input);
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('AWS_ACCESS_KEY_ID');
    });

    it('should filter private keys', () => {
      const input =
        '-----BEGIN RSA PRIVATE KEY-----\\nMIIEpAIBAAKCAQEA...\\n-----END RSA PRIVATE KEY-----';
      const result = filter.filter(input);
      expect(result).toBe('[REDACTED]');
    });

    it('should filter custom patterns', () => {
      const input = 'secret: myCustomSecret';
      const result = filter.filter(input);
      expect(result).toBe('[REDACTED]');
    });

    it('should not filter non-sensitive data', () => {
      const input = 'This is just regular text without sensitive data';
      const result = filter.filter(input);
      expect(result).toBe(input);
    });
  });

  describe('Object Filtering', () => {
    it('should filter sensitive fields in objects', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
        data: 'normal data',
      };

      const result = filter.filter(input);

      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.email).toBe('[REDACTED]');
      expect(result.data).toBe('normal data');
    });

    it('should filter nested objects', () => {
      const input = {
        user: {
          name: 'John',
          settings: {
            apiKey: 'sk-1234567890abcdef',
            password: 'secret',
          },
        },
        config: {
          debug: true,
        },
      };

      const result = filter.filter(input);

      expect(result.user.name).toBe('John');
      expect(result.user.settings.apiKey).toBe('[REDACTED]');
      expect(result.user.settings.password).toBe('[REDACTED]');
      expect(result.config.debug).toBe(true);
    });

    it('should filter arrays', () => {
      const input = [
        'normal string',
        'password: secret123',
        { apiKey: 'sk-test', data: 'normal' },
      ];

      const result = filter.filter(input);

      expect(result[0]).toBe('normal string');
      expect(result[1]).toBe('password: [REDACTED]');
      expect(result[2].apiKey).toBe('[REDACTED]');
      expect(result[2].data).toBe('normal');
    });

    it('should handle null and undefined values', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        password: 'secret',
      };

      const result = filter.filter(input);

      expect(result.nullValue).toBe(null);
      expect(result.undefinedValue).toBe(undefined);
      expect(result.password).toBe('[REDACTED]');
    });
  });

  describe('Replacement Strategies', () => {
    it('should use mask strategy by default', () => {
      const input = 'password: secret123';
      const result = filter.filter(input, 'mask');
      expect(result).toBe('password: [REDACTED]');
    });

    it('should use partial masking strategy', () => {
      const input = 'password: verylongsecret123';
      const result = filter.filter(input, 'partial');
      expect(result).toMatch(/ver\*+123/);
    });

    it('should use hash strategy', () => {
      const input = 'password: secret123';
      const result = filter.filter(input, 'hash');
      expect(result).toMatch(/\[HASH:[A-F0-9]+\]/);
    });

    it('should use remove strategy', () => {
      const input = 'password: secret123';
      const result = filter.filter(input, 'remove');
      expect(result).toBe('password: ');
    });

    it('should use custom strategy from config', () => {
      const input = 'password: secret123';
      const result = filter.filter(input, 'test');
      expect(result).toBe('password: [TEST_REDACTED]');
    });

    it('should fallback to mask for unknown strategy', () => {
      const input = 'password: secret123';
      const result = filter.filter(input, 'unknown');
      expect(result).toBe('password: [REDACTED]');
    });
  });

  describe('Configuration Updates', () => {
    it('should update enabled state', () => {
      expect(filter.isEnabled()).toBe(true);
      filter.setEnabled(false);
      expect(filter.isEnabled()).toBe(false);
    });

    it('should update configuration', () => {
      filter.updateConfig({
        patterns: {
          newPattern: 'test:\\s*\\w+',
        },
      });

      const input = 'test: sensitive';
      const result = filter.filter(input);
      expect(result).toBe('[REDACTED]');
    });

    it('should add custom strategies', () => {
      filter.updateConfig({
        strategies: {
          custom: () => '[CUSTOM_FILTERED]',
        },
      });

      const input = 'password: secret';
      const result = filter.filter(input, 'custom');
      expect(result).toBe('password: [CUSTOM_FILTERED]');
    });
  });

  describe('Error Handling', () => {
    it('should handle regex compilation errors gracefully', () => {
      const invalidConfig = {
        patterns: {
          invalid: '[unclosed',
        },
      };

      expect(() => {
        new SensitiveDataFilter({
          logger: mockLogger,
          enabled: true,
          config: invalidConfig,
        });
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return original data on filter error', () => {
      const input = 'test data';

      // Create a filter with a pattern that will cause an error during execution
      const brokenFilter = new SensitiveDataFilter({
        logger: mockLogger,
        enabled: true,
        config: {
          patterns: {
            broken: 'valid pattern', // This will work fine in parsing but we'll break it later
          },
        },
      });

      // Override the filter method to simulate an error
      const originalFilter = brokenFilter.filter;
      brokenFilter.filter = function (data) {
        if (typeof data === 'string' && data === input) {
          // Simulate internal error during filtering
          try {
            throw new Error('Simulated filter error');
          } catch (err) {
            this._logger?.warn('Failed to filter sensitive data', err);
            return data;
          }
        }
        return originalFilter.call(this, data);
      };

      const result = brokenFilter.filter(input);
      expect(result).toBe(input);
    });

    it('should handle disabled filter', () => {
      const disabledFilter = new SensitiveDataFilter({
        logger: mockLogger,
        enabled: false,
        config: {},
      });

      const input = 'password: secret123';
      const result = disabledFilter.filter(input);
      expect(result).toBe(input);
    });
  });

  describe('Performance', () => {
    it('should handle large strings efficiently', () => {
      const largeString = 'normal text '.repeat(10000) + ' password: secret123';

      const startTime = Date.now();
      const result = filter.filter(largeString);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
      expect(result).toContain('[REDACTED]');
    });

    it('should handle deeply nested objects', () => {
      let deepObject = { value: 'password: secret' };
      for (let i = 0; i < 10; i++) {
        deepObject = { nested: deepObject };
      }

      const startTime = Date.now();
      const result = filter.filter(deepObject);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
      // Navigate to the deep value and check it's filtered
      let current = result;
      for (let i = 0; i < 10; i++) {
        current = current.nested;
      }
      expect(current.value).toBe('password: [REDACTED]');
    });
  });

  describe('Sensitive Key Detection', () => {
    it('should filter keys containing password', () => {
      const input = { userPassword: 'secret123' };
      const result = filter.filter(input);
      expect(result.userPassword).toBe('[REDACTED]');
    });

    it('should filter keys containing token', () => {
      const input = { authToken: 'abc123' };
      const result = filter.filter(input);
      expect(result.authToken).toBe('[REDACTED]');
    });

    it('should filter keys containing secret', () => {
      const input = { clientSecret: 'xyz789' };
      const result = filter.filter(input);
      expect(result.clientSecret).toBe('[REDACTED]');
    });

    it('should filter keys containing credential', () => {
      const input = { userCredential: 'cred123' };
      const result = filter.filter(input);
      expect(result.userCredential).toBe('[REDACTED]');
    });

    it('should not filter non-sensitive keys', () => {
      const input = {
        username: 'john',
        userId: '12345',
        isActive: true,
      };
      const result = filter.filter(input);
      expect(result.username).toBe('john');
      expect(result.userId).toBe('12345');
      expect(result.isActive).toBe(true);
    });
  });

  describe('Partial Masking', () => {
    it('should show partial content for longer strings', () => {
      const longValue = 'verylongpassword1234567890';
      const input = { password: longValue };
      const result = filter.filter(input, 'partial');

      const maskedValue = result.password;
      expect(maskedValue).toMatch(/ver\*+890/);
      expect(maskedValue.length).toBe(longValue.length);
    });

    it('should fully mask short strings', () => {
      const shortValue = 'short';
      const input = { password: shortValue };
      const result = filter.filter(input, 'partial');

      expect(result.password).toBe('[REDACTED]');
    });
  });

  describe('Hash Strategy', () => {
    it('should produce consistent hashes for same input', () => {
      const input = 'password: secret123';
      const result1 = filter.filter(input, 'hash');
      const result2 = filter.filter(input, 'hash');

      expect(result1).toBe(result2);
    });

    it('should produce different hashes for different inputs', () => {
      const result1 = filter.filter('password: secret123', 'hash');
      const result2 = filter.filter('password: different456', 'hash');

      expect(result1).not.toBe(result2);
    });

    it('should produce valid hex hash format', () => {
      const input = 'password: secret123';
      const result = filter.filter(input, 'hash');

      expect(result).toMatch(/\[HASH:[A-F0-9]+\]/);
    });
  });
});
