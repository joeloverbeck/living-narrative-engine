/**
 * @file Unit tests for LogStorageService
 * @description Comprehensive unit tests for log storage service functionality
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import * as fs from 'node:fs/promises';
import LogStorageService from '../../../src/services/logStorageService.js';

// Mock fs module
jest.mock('node:fs/promises');

/**
 * Test utilities
 * @returns {object} Mock logger object
 */
const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createTestConfig = () => ({
  baseLogPath: 'test-logs',
  retentionDays: 3,
  maxFileSizeMB: 5,
  writeBufferSize: 10,
  flushIntervalMs: 1000,
});

const createValidLogEntry = (overrides = {}) => ({
  level: 'info',
  message: 'Test log message',
  timestamp: '2024-01-15T10:30:00.000Z',
  category: 'test',
  source: 'test.js:123',
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  metadata: { userId: 'test-user' },
  ...overrides,
});

describe('LogStorageService', () => {
  let logger;
  let service;
  let config;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createLogger();
    config = createTestConfig();
    service = new LogStorageService(logger, config);

    // Mock fs operations
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.appendFile.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue('test-content');
    fs.access.mockResolvedValue(undefined);
    fs.rename.mockResolvedValue(undefined);
    fs.unlink.mockResolvedValue(undefined);
    fs.readdir.mockResolvedValue([]);
    fs.stat.mockResolvedValue({ size: 1024 });
    fs.rm.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Constructor', () => {
    test('should create instance with valid logger', () => {
      expect(service).toBeInstanceOf(LogStorageService);
      expect(logger.debug).toHaveBeenCalledWith(
        'LogStorageService: Instance created',
        expect.objectContaining({ config })
      );
    });

    test('should create instance with default config when none provided', () => {
      const serviceWithDefaults = new LogStorageService(logger);
      expect(serviceWithDefaults).toBeInstanceOf(LogStorageService);
      expect(logger.debug).toHaveBeenLastCalledWith(
        'LogStorageService: Instance created',
        expect.objectContaining({
          config: expect.objectContaining({
            baseLogPath: 'logs',
            retentionDays: 7,
            maxFileSizeMB: 10,
            writeBufferSize: 100,
            flushIntervalMs: 5000,
          }),
        })
      );
    });

    test('should use ensureValidLogger fallback for invalid logger', () => {
      const invalidLogger = { info: 'not-a-function' };
      const serviceWithInvalidLogger = new LogStorageService(invalidLogger);
      expect(serviceWithInvalidLogger).toBeInstanceOf(LogStorageService);
    });

    test('should merge custom config with defaults', () => {
      const customConfig = { maxFileSizeMB: 20, customField: 'test' };
      const serviceWithCustomConfig = new LogStorageService(
        logger,
        customConfig
      );
      expect(serviceWithCustomConfig).toBeInstanceOf(LogStorageService);
      expect(logger.debug).toHaveBeenLastCalledWith(
        'LogStorageService: Instance created',
        expect.objectContaining({
          config: expect.objectContaining({
            maxFileSizeMB: 20,
            customField: 'test',
            retentionDays: 7, // default preserved
          }),
        })
      );
    });
  });

  describe('writeLogs()', () => {
    test('should handle empty array gracefully', async () => {
      const result = await service.writeLogs([]);
      expect(result).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith(
        'LogStorageService.writeLogs: No logs provided or empty array'
      );
    });

    test('should handle null/undefined input gracefully', async () => {
      const nullResult = await service.writeLogs(null);
      const undefinedResult = await service.writeLogs(undefined);

      expect(nullResult).toBe(0);
      expect(undefinedResult).toBe(0);
    });

    test('should process valid log entries', async () => {
      const logs = [
        createValidLogEntry(),
        createValidLogEntry({ level: 'error', message: 'Error message' }),
      ];

      const result = await service.writeLogs(logs);

      expect(result).toBe(2);
      expect(logger.debug).toHaveBeenCalledWith(
        'LogStorageService.writeLogs: Processing 2 logs'
      );
    });

    test('should group logs by date and category', async () => {
      const logs = [
        createValidLogEntry({
          category: 'engine',
          timestamp: '2024-01-15T10:30:00.000Z',
        }),
        createValidLogEntry({
          category: 'ui',
          timestamp: '2024-01-15T10:31:00.000Z',
        }),
        createValidLogEntry({
          category: 'engine',
          timestamp: '2024-01-16T10:30:00.000Z',
        }),
      ];

      const result = await service.writeLogs(logs);

      expect(result).toBe(3);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Buffered 3 logs'),
        expect.objectContaining({
          bufferGroups: 3, // 2024-01-15:engine, 2024-01-15:ui, 2024-01-16:engine
        })
      );
    });

    test('should handle malformed timestamp gracefully', async () => {
      const logs = [
        createValidLogEntry({ timestamp: 'invalid-timestamp' }),
        createValidLogEntry({ timestamp: '2024-01-15T10:30:00.000Z' }),
      ];

      const result = await service.writeLogs(logs);

      // Should still process the valid log
      expect(result).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'LogStorageService.#groupLogsByDateAndCategory: Failed to group log',
        expect.objectContaining({
          logLevel: 'info',
        })
      );
    });

    test('should trigger immediate flush when buffer is full', async () => {
      // Create more logs than buffer size
      const logs = Array(15)
        .fill()
        .map((_, i) => createValidLogEntry({ message: `Log ${i}` }));

      const result = await service.writeLogs(logs);

      expect(result).toBe(15);
      expect(fs.mkdir).toHaveBeenCalled(); // Directory creation for flush
      expect(fs.writeFile).toHaveBeenCalled(); // File writing for flush
    });
  });

  describe('Category Detection', () => {
    test('should use explicit category when provided', async () => {
      const logs = [createValidLogEntry({ category: 'custom' })];
      await service.writeLogs(logs);

      // Flush to trigger file writing
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('custom.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should detect engine category from message patterns', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          message: 'GameEngine: Starting up',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('engine.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should detect ui category from message patterns', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          message: 'UI: Rendering component',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('ui.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should detect ecs category from message patterns', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          message: 'EntityManager: Creating entity',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('ecs.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should detect ai category from message patterns', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          message: 'AI: Processing LLM response',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('ai.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should detect category from source field', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          message: 'Some message',
          source: 'entityManager.js:123',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('ecs.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should fallback to general category when no pattern matches', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          message: 'Random message with no patterns',
          source: 'unknown.js:123',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('general.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });

    test('should handle case-insensitive pattern matching', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          message: 'gameengine is starting up',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('engine.jsonl'),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('JSONL Formatting', () => {
    test('should format log entry as valid JSONL', async () => {
      const log = createValidLogEntry();
      await service.writeLogs([log]);
      await service.flushLogs();

      const expectedJsonl = JSON.stringify(log) + '\n';
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expectedJsonl,
        expect.any(Object)
      );
    });

    test('should handle log entries with special characters', async () => {
      const log = createValidLogEntry({
        message: 'Message with "quotes" and \n newlines \t tabs',
        metadata: { special: 'chars: äöü 中文 🎮' },
      });

      await service.writeLogs([log]);
      await service.flushLogs();

      // Should not throw and should escape properly
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"quotes"'),
        expect.any(Object)
      );
    });

    test('should handle circular references gracefully', async () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      const log = createValidLogEntry({
        metadata: circularObj,
      });

      await service.writeLogs([log]);
      await service.flushLogs();

      expect(logger.warn).toHaveBeenCalledWith(
        'LogStorageService.#formatLogEntry: Failed to serialize log entry',
        expect.objectContaining({
          logLevel: 'info',
        })
      );

      // Should write fallback entry
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[SERIALIZATION_ERROR]'),
        expect.any(Object)
      );
    });
  });

  describe('File Management', () => {
    test('should create directory structure', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.mkdir).toHaveBeenCalledWith('test-logs/2024-01-15', {
        recursive: true,
        mode: 0o755,
      });
    });

    test('should handle existing directory gracefully', async () => {
      const existsError = new Error('Directory exists');
      existsError.code = 'EEXIST';
      fs.mkdir.mockRejectedValueOnce(existsError);

      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);
      await service.flushLogs();

      // Should not throw and should continue with file writing
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('should perform atomic write operation', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);
      await service.flushLogs();

      // Should write to temp file first
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.any(String),
        expect.objectContaining({
          encoding: 'utf8',
          flag: 'w',
          mode: 0o644,
        })
      );
    });

    test('should append to existing file', async () => {
      // Mock file exists
      fs.access.mockResolvedValueOnce(undefined);

      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.appendFile).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });

    test('should rename temp file for new file', async () => {
      // Mock file doesn't exist
      const notFoundError = new Error('File not found');
      notFoundError.code = 'ENOENT';
      fs.access.mockRejectedValueOnce(notFoundError);

      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);
      await service.flushLogs();

      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining('.jsonl')
      );
    });

    test('should clean up temp file on write failure', async () => {
      const writeError = new Error('Write failed');
      fs.writeFile.mockRejectedValueOnce(writeError);

      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      // Flush should handle the error
      await expect(service.flushLogs()).resolves.not.toThrow();

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });
  });

  describe('flushLogs()', () => {
    test('should return 0 when no logs buffered', async () => {
      const result = await service.flushLogs();
      expect(result).toBe(0);
    });

    test('should flush buffered logs', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      const result = await service.flushLogs();

      expect(result).toBe(1);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('should handle concurrent flush attempts', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      // Start multiple flushes simultaneously
      const flushPromises = [
        service.flushLogs(),
        service.flushLogs(),
        service.flushLogs(),
      ];

      const results = await Promise.all(flushPromises);

      // Only one should actually flush, others should return 0
      const totalFlushed = results.reduce((sum, result) => sum + result, 0);
      expect(totalFlushed).toBe(1);
    });
  });

  describe('rotateLargeFiles()', () => {
    test('should return 0 when directory does not exist', async () => {
      const notFoundError = new Error('Directory not found');
      notFoundError.code = 'ENOENT';
      fs.access.mockRejectedValueOnce(notFoundError);

      const result = await service.rotateLargeFiles();

      expect(result).toBe(0);
    });

    test('should rotate files exceeding size limit', async () => {
      const maxSize = config.maxFileSizeMB * 1024 * 1024;
      const largeFileSize = maxSize + 1024;

      fs.readdir.mockResolvedValueOnce(['test.jsonl', 'other.txt']);
      fs.stat.mockResolvedValueOnce({ size: largeFileSize });

      const result = await service.rotateLargeFiles();

      expect(result).toBe(1);
      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringContaining('test.jsonl'),
        expect.stringContaining('test.1.jsonl')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Rotated 1 files')
      );
    });

    test('should skip non-jsonl files', async () => {
      fs.readdir.mockResolvedValueOnce(['test.txt', 'other.log']);

      const result = await service.rotateLargeFiles();

      expect(result).toBe(0);
      expect(fs.stat).not.toHaveBeenCalled();
    });

    test('should find next available rotation number', async () => {
      fs.readdir.mockResolvedValueOnce(['test.jsonl']);
      fs.stat.mockResolvedValueOnce({ size: 20 * 1024 * 1024 }); // Large file

      // Mock existing rotated files
      fs.access
        .mockRejectedValueOnce() // test.1.jsonl doesn't exist
        .mockResolvedValueOnce() // test.1.jsonl exists
        .mockRejectedValueOnce(); // test.2.jsonl doesn't exist

      const result = await service.rotateLargeFiles();

      expect(result).toBe(1);
      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringContaining('test.jsonl'),
        expect.stringContaining('test.2.jsonl')
      );
    });

    test('should handle rotation errors gracefully', async () => {
      fs.readdir.mockResolvedValueOnce(['test.jsonl']);
      fs.stat.mockResolvedValueOnce({ size: 20 * 1024 * 1024 });
      fs.rename.mockRejectedValueOnce(new Error('Rename failed'));

      const result = await service.rotateLargeFiles();

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'LogStorageService.rotateLargeFiles: Failed to rotate files',
        expect.objectContaining({
          error: 'Rename failed',
        })
      );
    });
  });

  describe('cleanupOldLogs()', () => {
    test('should return 0 when base directory does not exist', async () => {
      const notFoundError = new Error('Directory not found');
      notFoundError.code = 'ENOENT';
      fs.access.mockRejectedValueOnce(notFoundError);

      const result = await service.cleanupOldLogs();

      expect(result).toBe(0);
    });

    test('should remove directories older than retention period', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      const mockEntries = [
        { name: oldDate.toISOString().split('T')[0], isDirectory: () => true },
        {
          name: recentDate.toISOString().split('T')[0],
          isDirectory: () => true,
        },
        { name: 'invalid-date', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ];

      fs.readdir.mockResolvedValueOnce(mockEntries);

      const result = await service.cleanupOldLogs();

      expect(result).toBe(1); // Only old directory removed
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining(oldDate.toISOString().split('T')[0]),
        { recursive: true, force: true }
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned 1 directories')
      );
    });

    test('should skip non-directories and invalid date formats', async () => {
      const mockEntries = [
        { name: 'not-a-date', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ];

      fs.readdir.mockResolvedValueOnce(mockEntries);

      const result = await service.cleanupOldLogs();

      expect(result).toBe(0);
      expect(fs.rm).not.toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const mockEntries = [
        { name: oldDate.toISOString().split('T')[0], isDirectory: () => true },
      ];

      fs.readdir.mockResolvedValueOnce(mockEntries);
      fs.rm.mockRejectedValueOnce(new Error('Remove failed'));

      const result = await service.cleanupOldLogs();

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'LogStorageService.cleanupOldLogs: Failed to cleanup old logs',
        expect.objectContaining({
          error: 'Remove failed',
        })
      );
    });
  });

  describe('shutdown()', () => {
    test('should flush remaining logs and clear timer', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      await service.shutdown();

      expect(fs.writeFile).toHaveBeenCalled(); // Flush occurred
      expect(logger.info).toHaveBeenCalledWith(
        'LogStorageService.shutdown: Service shutdown complete'
      );
    });

    test('should handle shutdown when no logs buffered', async () => {
      await service.shutdown();

      expect(logger.info).toHaveBeenCalledWith(
        'LogStorageService.shutdown: Service shutdown complete'
      );
    });

    test('should handle shutdown errors gracefully', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      fs.writeFile.mockRejectedValueOnce(
        new Error('Write failed during shutdown')
      );

      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors during write', async () => {
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      const result = await service.flushLogs();

      // Should handle error gracefully
      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write group'),
        expect.objectContaining({
          error: 'Permission denied',
        })
      );
    });

    test('should re-buffer failed logs for retry', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      // First flush fails
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      const firstResult = await service.flushLogs();
      expect(firstResult).toBe(0);

      // Second flush should retry the same logs
      fs.mkdir.mockResolvedValueOnce(undefined);
      const secondResult = await service.flushLogs();
      expect(secondResult).toBe(1);
    });

    test('should handle critical flush errors', async () => {
      const logs = [createValidLogEntry()];
      await service.writeLogs(logs);

      // Mock a critical error in flush
      Object.defineProperty(service, '_LogStorageService__writeBuffer', {
        get: () => {
          throw new Error('Critical error');
        },
      });

      const result = await service.flushLogs();

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'LogStorageService.#flushWriteBuffer: Critical flush error',
        expect.objectContaining({
          error: 'Critical error',
        })
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large batch of logs efficiently', async () => {
      const largeBatch = Array(1000)
        .fill()
        .map((_, i) => createValidLogEntry({ message: `Log ${i}` }));

      const start = Date.now();
      const result = await service.writeLogs(largeBatch);
      const duration = Date.now() - start;

      expect(result).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle logs with missing required fields', async () => {
      const malformedLogs = [
        { level: 'info' }, // missing message and timestamp
        { message: 'test' }, // missing level and timestamp
        null,
        undefined,
        {},
      ];

      const result = await service.writeLogs(malformedLogs);

      // Should handle gracefully, at least some processing should occur
      expect(result).toBeGreaterThanOrEqual(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    test('should handle extremely long log messages', async () => {
      const longMessage = 'A'.repeat(100000); // 100KB message
      const log = createValidLogEntry({ message: longMessage });

      const result = await service.writeLogs([log]);

      expect(result).toBe(1);
      await service.flushLogs();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
