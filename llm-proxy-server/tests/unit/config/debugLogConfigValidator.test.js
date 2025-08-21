import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import * as fs from 'node:fs/promises';
import {
  validatePath,
  parseFileSize,
  validateRetentionDays,
  validateCronSchedule,
  validateDebugLoggingConfig,
} from '../../../src/config/debugLogConfigValidator.js';

// Mock fs module
jest.mock('node:fs/promises');

describe('debugLogConfigValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePath', () => {
    test('returns error for null path', async () => {
      const result = await validatePath(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path must be a non-empty string');
    });

    test('returns error for empty string path', async () => {
      const result = await validatePath('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path must be a non-empty string');
    });

    test('returns success for existing writable directory', async () => {
      const mockStats = { isDirectory: () => true };
      fs.stat.mockResolvedValue(mockStats);
      fs.access.mockResolvedValue(undefined);

      const result = await validatePath('/existing/path');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('/existing/path');
      expect(fs.stat).toHaveBeenCalledWith('/existing/path');
      expect(fs.access).toHaveBeenCalledWith(
        '/existing/path',
        fs.constants.W_OK
      );
    });

    test('returns error for existing file (not directory)', async () => {
      const mockStats = { isDirectory: () => false };
      fs.stat.mockResolvedValue(mockStats);

      const result = await validatePath('/existing/file.txt');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path exists but is not a directory');
    });

    test('creates directory if it does not exist', async () => {
      fs.stat.mockRejectedValue(new Error('Not found'));
      fs.mkdir.mockResolvedValue(undefined);
      fs.access.mockResolvedValue(undefined);

      const result = await validatePath('/new/path');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('/new/path');
      expect(fs.mkdir).toHaveBeenCalledWith('/new/path', { recursive: true });
    });

    test('returns error if directory cannot be created', async () => {
      fs.stat.mockRejectedValue(new Error('Not found'));
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await validatePath('/restricted/path');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot access or create directory');
      expect(result.error).toContain('Permission denied');
    });

    test('returns error if directory is not writable', async () => {
      const mockStats = { isDirectory: () => true };
      fs.stat.mockResolvedValue(mockStats);
      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await validatePath('/readonly/path');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot access or create directory');
    });
  });

  describe('parseFileSize', () => {
    test('returns error for null input', () => {
      const result = parseFileSize(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size must be a non-empty string');
    });

    test('returns error for empty string', () => {
      const result = parseFileSize('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size must be a non-empty string');
    });

    test('parses valid MB size', () => {
      const result = parseFileSize('10MB');

      expect(result.valid).toBe(true);
      expect(result.value).toBe(10 * 1024 * 1024);
    });

    test('parses valid KB size', () => {
      const result = parseFileSize('2048KB'); // 2MB

      expect(result.valid).toBe(true);
      expect(result.value).toBe(2048 * 1024);
    });

    test('parses valid GB size', () => {
      const result = parseFileSize('1GB');

      expect(result.valid).toBe(true);
      expect(result.value).toBe(1024 * 1024 * 1024);
    });

    test('parses size with decimal', () => {
      const result = parseFileSize('1.5MB');

      expect(result.valid).toBe(true);
      expect(result.value).toBe(Math.floor(1.5 * 1024 * 1024));
    });

    test('parses size with spaces', () => {
      const result = parseFileSize('  10 MB  ');

      expect(result.valid).toBe(true);
      expect(result.value).toBe(10 * 1024 * 1024);
    });

    test('returns error for invalid format', () => {
      const result = parseFileSize('10 megabytes');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file size format');
    });

    test('returns error for size less than 1MB', () => {
      const result = parseFileSize('500KB');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size too small');
      expect(result.error).toContain('Minimum is 1MB');
    });

    test('returns error for size greater than 1GB', () => {
      const result = parseFileSize('2GB');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size too large');
      expect(result.error).toContain('Maximum is 1GB');
    });

    test('returns error for zero size', () => {
      const result = parseFileSize('0MB');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file size number');
    });

    test('returns error for negative size', () => {
      const result = parseFileSize('-10MB');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file size format');
    });
  });

  describe('validateRetentionDays', () => {
    test('returns error for non-number input', () => {
      const result = validateRetentionDays('7');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Retention days must be a number');
    });

    test('returns error for non-integer number', () => {
      const result = validateRetentionDays(7.5);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Retention days must be an integer');
    });

    test('returns success for valid retention days', () => {
      const result = validateRetentionDays(7);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(7);
    });

    test('returns success for minimum valid days (1)', () => {
      const result = validateRetentionDays(1);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(1);
    });

    test('returns success for maximum valid days (365)', () => {
      const result = validateRetentionDays(365);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(365);
    });

    test('returns error for days less than 1', () => {
      const result = validateRetentionDays(0);

      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        'Retention days must be between 1 and 365'
      );
    });

    test('returns error for days greater than 365', () => {
      const result = validateRetentionDays(366);

      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        'Retention days must be between 1 and 365'
      );
    });

    test('returns error for negative days', () => {
      const result = validateRetentionDays(-7);

      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        'Retention days must be between 1 and 365'
      );
    });
  });

  describe('validateCronSchedule', () => {
    test('returns error for null input', () => {
      const result = validateCronSchedule(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cron schedule must be a non-empty string');
    });

    test('returns error for empty string', () => {
      const result = validateCronSchedule('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cron schedule must be a non-empty string');
    });

    test('returns success for valid daily cron schedule', () => {
      const result = validateCronSchedule('0 2 * * *');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('0 2 * * *');
    });

    test('returns success for valid hourly cron schedule', () => {
      const result = validateCronSchedule('0 * * * *');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('0 * * * *');
    });

    test('returns success for valid specific day schedule', () => {
      const result = validateCronSchedule('30 3 15 * *');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('30 3 15 * *');
    });

    test('trims whitespace from schedule', () => {
      const result = validateCronSchedule('  0 2 * * *  ');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('0 2 * * *');
    });

    test('returns error for invalid cron format', () => {
      const result = validateCronSchedule('invalid cron');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid cron schedule format');
    });

    test('returns error for too few fields', () => {
      const result = validateCronSchedule('0 2 * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid cron schedule format');
    });

    test('returns error for too many fields', () => {
      const result = validateCronSchedule('0 2 * * * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid cron schedule format');
    });

    test('returns error for invalid hour value', () => {
      const result = validateCronSchedule('0 25 * * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid cron schedule format');
    });

    test('returns error for invalid minute value', () => {
      const result = validateCronSchedule('60 2 * * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid cron schedule format');
    });
  });

  describe('validateDebugLoggingConfig', () => {
    test('returns error for null config', async () => {
      const result = await validateDebugLoggingConfig(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Debug logging configuration must be an object'
      );
    });

    test('returns error for non-object config', async () => {
      const result = await validateDebugLoggingConfig('not an object');

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Debug logging configuration must be an object'
      );
    });

    test('returns success for valid minimal config', async () => {
      const config = {
        enabled: true,
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({
        enabled: true,
        storage: {},
        performance: {},
        cleanup: {},
      });
    });

    test('validates storage path', async () => {
      const mockStats = { isDirectory: () => true };
      fs.stat.mockResolvedValue(mockStats);
      fs.access.mockResolvedValue(undefined);

      const config = {
        enabled: true,
        storage: {
          path: '/log/path',
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value.storage.path).toBe('/log/path');
    });

    test('returns error for invalid storage path', async () => {
      fs.stat.mockRejectedValue(new Error('Not found'));
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const config = {
        enabled: true,
        storage: {
          path: '/invalid/path',
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('storage.path:');
      expect(result.error).toContain('Cannot access or create directory');
    });

    test('validates retention days', async () => {
      const config = {
        enabled: true,
        storage: {
          retentionDays: 14,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value.storage.retentionDays).toBe(14);
    });

    test('returns error for invalid retention days', async () => {
      const config = {
        enabled: true,
        storage: {
          retentionDays: 400,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('storage.retentionDays:');
      expect(result.error).toContain('between 1 and 365');
    });

    test('validates and parses max file size', async () => {
      const config = {
        enabled: true,
        storage: {
          maxFileSize: '20MB',
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value.storage.maxFileSize).toBe('20MB');
      expect(result.value.storage.maxFileSizeBytes).toBe(20 * 1024 * 1024);
    });

    test('returns error for invalid max file size', async () => {
      const config = {
        enabled: true,
        storage: {
          maxFileSize: '2GB',
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('storage.maxFileSize:');
      expect(result.error).toContain('Maximum is 1GB');
    });

    test('validates write buffer size', async () => {
      const config = {
        enabled: true,
        performance: {
          writeBufferSize: 100,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value.performance.writeBufferSize).toBe(100);
    });

    test('returns error for invalid write buffer size', async () => {
      const config = {
        enabled: true,
        performance: {
          writeBufferSize: 20000,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('performance.writeBufferSize:');
      expect(result.error).toContain('between 1 and 10000');
    });

    test('validates flush interval', async () => {
      const config = {
        enabled: true,
        performance: {
          flushInterval: 5000,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value.performance.flushInterval).toBe(5000);
    });

    test('returns error for invalid flush interval', async () => {
      const config = {
        enabled: true,
        performance: {
          flushInterval: 50,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('performance.flushInterval:');
      expect(result.error).toContain('between 100 and 60000ms');
    });

    test('validates max concurrent writes', async () => {
      const config = {
        enabled: true,
        performance: {
          maxConcurrentWrites: 5,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value.performance.maxConcurrentWrites).toBe(5);
    });

    test('returns error for invalid max concurrent writes', async () => {
      const config = {
        enabled: true,
        performance: {
          maxConcurrentWrites: 200,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('performance.maxConcurrentWrites:');
      expect(result.error).toContain('between 1 and 100');
    });

    test('validates cleanup schedule', async () => {
      const config = {
        enabled: true,
        cleanup: {
          schedule: '0 3 * * *',
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value.cleanup.schedule).toBe('0 3 * * *');
    });

    test('returns error for invalid cleanup schedule', async () => {
      const config = {
        enabled: true,
        cleanup: {
          schedule: 'invalid',
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('cleanup.schedule:');
      expect(result.error).toContain('Invalid cron schedule format');
    });

    test('validates complete configuration', async () => {
      const mockStats = { isDirectory: () => true };
      fs.stat.mockResolvedValue(mockStats);
      fs.access.mockResolvedValue(undefined);

      const config = {
        enabled: false,
        storage: {
          path: '/logs',
          retentionDays: 14,
          maxFileSize: '50MB',
          compression: true,
        },
        performance: {
          writeBufferSize: 200,
          flushInterval: 2000,
          maxConcurrentWrites: 10,
        },
        cleanup: {
          schedule: '0 4 * * *',
          enabled: false,
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.value).toEqual({
        enabled: false,
        storage: {
          path: '/logs',
          retentionDays: 14,
          maxFileSize: '50MB',
          maxFileSizeBytes: 50 * 1024 * 1024,
          compression: true,
        },
        performance: {
          writeBufferSize: 200,
          flushInterval: 2000,
          maxConcurrentWrites: 10,
        },
        cleanup: {
          schedule: '0 4 * * *',
          enabled: false,
        },
      });
    });

    test('returns multiple validation errors', async () => {
      const config = {
        enabled: true,
        storage: {
          retentionDays: 500,
          maxFileSize: '2GB',
        },
        performance: {
          writeBufferSize: -1,
        },
        cleanup: {
          schedule: 'bad cron',
        },
      };

      const result = await validateDebugLoggingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('storage.retentionDays:');
      expect(result.error).toContain('storage.maxFileSize:');
      expect(result.error).toContain('performance.writeBufferSize:');
      expect(result.error).toContain('cleanup.schedule:');
    });
  });
});
