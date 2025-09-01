/**
 * @file Integration tests for LogMaintenanceScheduler service
 * @description Tests scheduler integration with real LogStorageService and server lifecycle
 * @see logMaintenanceScheduler.js, logStorageService.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import LogMaintenanceScheduler from '../../../src/services/logMaintenanceScheduler.js';
import LogStorageService from '../../../src/services/logStorageService.js';
import { ConsoleLogger } from '../../../src/consoleLogger.js';

const __dirname = path.resolve(path.dirname(''));

/**
 * Mock AppConfigService for integration testing
 */
class IntegrationAppConfigService {
  /**
   *
   * @param overrides
   */
  constructor(overrides = {}) {
    this.config = {
      storage: {
        path: path.join(__dirname, 'test-logs'),
        retentionDays: 1,
        maxFileSize: '1MB',
      },
      performance: {
        writeBufferSize: 5,
        flushInterval: 100,
      },
      scheduler: {
        enabled: true,
        rotationCheckSchedule: '*/1 * * * * *', // Every second for testing
        cleanupSchedule: '*/2 * * * * *', // Every 2 seconds for testing
        enableRetry: true,
        maxRetries: 2,
        retryDelayMs: 100,
      },
      ...overrides,
    };
  }

  /**
   *
   */
  getDebugLoggingConfig() {
    return this.config;
  }

  /**
   *
   */
  isDebugLoggingEnabled() {
    return true;
  }

  /**
   *
   * @param schedulerConfig
   */
  updateSchedulerConfig(schedulerConfig) {
    this.config.scheduler = { ...this.config.scheduler, ...schedulerConfig };
  }
}

/**
 * Helper function to create test log files
 * @param baseDir
 * @param dateDir
 * @param files
 */
async function createTestLogFiles(baseDir, dateDir, files) {
  const fullDir = path.join(baseDir, dateDir);
  await fs.mkdir(fullDir, { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(fullDir, filename);
    await fs.writeFile(filePath, content, 'utf8');
  }
}

/**
 * Helper function to create large test files for rotation testing
 * @param filePath
 * @param sizeInMB
 */
async function createLargeTestFile(filePath, sizeInMB) {
  const content = 'A'.repeat(1024 * 1024 * sizeInMB); // Create file of specified size
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Helper function to clean up test directories
 * @param dir
 */
async function cleanupTestDirectory(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Helper function to wait for scheduler operations
 * @param ms
 */
function waitForScheduler(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper function to wait for a condition with timeout and polling
 * @param {Function} condition - Function that returns true when condition is met
 * @param {number} timeoutMs - Maximum time to wait in milliseconds
 * @param {number} pollIntervalMs - Interval between checks in milliseconds
 * @returns {Promise<boolean>} - Resolves to true if condition met, false if timeout
 */
async function waitForCondition(condition, timeoutMs = 5000, pollIntervalMs = 200) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await condition();
      if (result) {
        return true;
      }
    } catch (error) {
      // Condition check failed, continue polling
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  return false;
}

describe('LogMaintenanceScheduler Integration Tests', () => {
  let logger;
  let appConfigService;
  let logStorageService;
  let scheduler;
  let testLogDir;

  beforeEach(async () => {
    logger = new ConsoleLogger();
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    appConfigService = new IntegrationAppConfigService();
    testLogDir = path.join(__dirname, 'test-logs');

    // Clean up any existing test logs
    await cleanupTestDirectory(testLogDir);

    // Initialize services
    logStorageService = new LogStorageService(logger, appConfigService);
    scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      appConfigService
    );
  });

  afterEach(async () => {
    // Stop scheduler and clean up
    if (scheduler) {
      await scheduler.stop();
    }
    if (logStorageService) {
      await logStorageService.shutdown();
    }
    await cleanupTestDirectory(testLogDir);
    jest.clearAllMocks();
  });

  describe('Service Integration', () => {
    it('should initialize scheduler with real LogStorageService', () => {
      expect(scheduler).toBeInstanceOf(LogMaintenanceScheduler);
      expect(logStorageService).toBeInstanceOf(LogStorageService);

      const status = scheduler.getStatus();
      expect(status.isEnabled).toBe(true);
      expect(status.isRunning).toBe(false);
    });

    it('should start and stop scheduler properly', async () => {
      await scheduler.start();

      let status = scheduler.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.rotationTaskActive).toBe(true);
      expect(status.cleanupTaskActive).toBe(true);

      await scheduler.stop();

      status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should handle LogStorageService integration', async () => {
      // Create test logs
      const testLogs = [
        {
          level: 'info',
          message: 'Test log entry 1',
          timestamp: new Date().toISOString(),
          category: 'general',
        },
        {
          level: 'debug',
          message: 'Test log entry 2',
          timestamp: new Date().toISOString(),
          category: 'engine',
        },
      ];

      await logStorageService.writeLogs(testLogs);
      await logStorageService.flushLogs();

      // Verify logs were written
      const today = new Date().toISOString().split('T')[0];
      const generalLogFile = path.join(testLogDir, today, 'general.jsonl');
      const engineLogFile = path.join(testLogDir, today, 'engine.jsonl');

      const generalContent = await fs.readFile(generalLogFile, 'utf8');
      const engineContent = await fs.readFile(engineLogFile, 'utf8');

      expect(generalContent).toContain('Test log entry 1');
      expect(engineContent).toContain('Test log entry 2');
    });
  });

  describe('File Rotation Integration', () => {
    it('should rotate large files when scheduled', async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayDir = path.join(testLogDir, today);

      // Create large test file that exceeds size limit
      await fs.mkdir(todayDir, { recursive: true });
      const testFile = path.join(todayDir, 'test.jsonl');
      await createLargeTestFile(testFile, 2); // 2MB file, exceeds 1MB limit

      // Verify file exists and is large
      const stats = await fs.stat(testFile);
      expect(stats.size).toBeGreaterThan(1024 * 1024); // > 1MB

      // Manually trigger rotation
      const rotatedCount = await logStorageService.rotateLargeFiles();
      expect(rotatedCount).toBe(1);

      // Verify rotation occurred
      const rotatedFile = path.join(todayDir, 'test.1.jsonl');
      const rotatedStats = await fs.stat(rotatedFile);
      expect(rotatedStats.size).toBe(stats.size);

      // Original file should not exist or be smaller
      try {
        await fs.access(testFile);
        // If file exists, it should be a new empty file
        const newStats = await fs.stat(testFile);
        expect(newStats.size).toBe(0);
      } catch {
        // File doesn't exist, which is also correct
      }
    });

    it('should schedule rotation checks automatically', async () => {
      await scheduler.start();

      // Create a large file that will need rotation
      const today = new Date().toISOString().split('T')[0];
      const todayDir = path.join(testLogDir, today);
      await fs.mkdir(todayDir, { recursive: true });
      const testFile = path.join(todayDir, 'scheduled.jsonl');
      await createLargeTestFile(testFile, 2);

      // Wait for scheduler to run with robust polling (every second in test config)
      const rotatedFile = path.join(todayDir, 'scheduled.1.jsonl');
      const rotationCompleted = await waitForCondition(
        async () => {
          try {
            await fs.access(rotatedFile);
            return true;
          } catch {
            return false;
          }
        },
        5000, // 5 second timeout - much more generous than 1.5s
        200   // check every 200ms
      );

      expect(rotationCompleted).toBe(true);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled rotation check completed'),
        expect.objectContaining({
          rotatedFiles: expect.any(Number),
        })
      );
    });
  });

  describe('Cleanup Integration', () => {
    it('should clean up old directories when scheduled', async () => {
      // Create old log directories (older than retention period)
      const oldDate1 = new Date();
      oldDate1.setDate(oldDate1.getDate() - 3);
      const oldDate2 = new Date();
      oldDate2.setDate(oldDate2.getDate() - 5);

      const oldDir1 = oldDate1.toISOString().split('T')[0];
      const oldDir2 = oldDate2.toISOString().split('T')[0];

      await createTestLogFiles(testLogDir, oldDir1, {
        'general.jsonl': '{"level":"info","message":"old log 1"}\n',
      });
      await createTestLogFiles(testLogDir, oldDir2, {
        'general.jsonl': '{"level":"info","message":"old log 2"}\n',
      });

      // Create current day directory (should not be deleted)
      const today = new Date().toISOString().split('T')[0];
      await createTestLogFiles(testLogDir, today, {
        'general.jsonl': '{"level":"info","message":"current log"}\n',
      });

      // Manually trigger cleanup
      const cleanedCount = await logStorageService.cleanupOldLogs();
      expect(cleanedCount).toBe(2);

      // Verify old directories are gone
      const oldDir1Path = path.join(testLogDir, oldDir1);
      const oldDir2Path = path.join(testLogDir, oldDir2);
      const todayPath = path.join(testLogDir, today);

      const oldDir1Exists = await fs
        .access(oldDir1Path)
        .then(() => true)
        .catch(() => false);
      const oldDir2Exists = await fs
        .access(oldDir2Path)
        .then(() => true)
        .catch(() => false);
      const todayExists = await fs
        .access(todayPath)
        .then(() => true)
        .catch(() => false);

      expect(oldDir1Exists).toBe(false);
      expect(oldDir2Exists).toBe(false);
      expect(todayExists).toBe(true);
    });

    it('should schedule cleanup automatically', async () => {
      await scheduler.start();

      // Create old directories
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2);
      const oldDir = oldDate.toISOString().split('T')[0];

      await createTestLogFiles(testLogDir, oldDir, {
        'scheduled-cleanup.jsonl':
          '{"level":"info","message":"should be cleaned"}\n',
      });

      // Wait for cleanup scheduler to run with robust polling (every 2 seconds in test config)
      const oldDirPath = path.join(testLogDir, oldDir);
      const cleanupCompleted = await waitForCondition(
        async () => {
          try {
            await fs.access(oldDirPath);
            return false; // Directory still exists, cleanup not done
          } catch {
            return true; // Directory doesn't exist, cleanup completed
          }
        },
        6000, // 6 second timeout - more generous than 2.5s
        200   // check every 200ms
      );

      expect(cleanupCompleted).toBe(true);

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Scheduled cleanup completed'),
        expect.objectContaining({
          cleanedDirectories: expect.any(Number),
        })
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle LogStorageService errors gracefully', async () => {
      // Mock LogStorageService to throw error
      const originalRotate = logStorageService.rotateLargeFiles;
      logStorageService.rotateLargeFiles = jest
        .fn()
        .mockRejectedValue(new Error('Storage service error'));

      await scheduler.start();

      // Wait for scheduler to attempt rotation with polling for error logs
      const errorLogged = await waitForCondition(
        () => {
          return logger.error.mock.calls.some(call => 
            call[0].includes('Scheduled rotation check failed')
          );
        },
        3000, // 3 second timeout
        200   // check every 200ms
      );

      expect(errorLogged).toBe(true);

      // Verify error was logged but scheduler continued
      expect(logger.error).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Scheduled rotation check failed',
        expect.objectContaining({
          error: 'Storage service error',
        })
      );

      // Restore original method
      logStorageService.rotateLargeFiles = originalRotate;
    });

    it('should retry operations on failure', async () => {
      let callCount = 0;
      const originalCleanup = logStorageService.cleanupOldLogs;

      // Mock to fail first call, succeed on retry
      logStorageService.cleanupOldLogs = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve(1);
      });

      await scheduler.start();

      // Wait for initial cleanup and retry with polling for retry logs
      const retryLogged = await waitForCondition(
        () => {
          return logger.warn.mock.calls.some(call => 
            call[0].includes('Scheduling retry for cleanup operation')
          );
        },
        5000, // 5 second timeout - enough for cleanup cycle + retry delay
        200   // check every 200ms
      );

      expect(retryLogged).toBe(true);

      // Verify retry was attempted
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Scheduling retry for cleanup operation'),
        expect.objectContaining({
          retryAttempt: 1,
          maxRetries: 2,
        })
      );

      // Restore original method
      logStorageService.cleanupOldLogs = originalCleanup;
    });
  });

  describe('Server Lifecycle Integration', () => {
    it('should integrate with server startup and shutdown patterns', async () => {
      // Simulate server startup
      expect(scheduler.getStatus().isRunning).toBe(false);

      await scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);

      // Simulate server shutdown
      await scheduler.stop();
      await logStorageService.shutdown();

      expect(scheduler.getStatus().isRunning).toBe(false);

      // Verify no errors during lifecycle
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await scheduler.start();
        expect(scheduler.getStatus().isRunning).toBe(true);

        await scheduler.stop();
        expect(scheduler.getStatus().isRunning).toBe(false);
      }

      // Should handle multiple cycles without errors
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Integration', () => {
    it('should respect disabled scheduler configuration', async () => {
      // Create scheduler with disabled configuration
      appConfigService.updateSchedulerConfig({ enabled: false });
      const disabledScheduler = new LogMaintenanceScheduler(
        logger,
        logStorageService,
        appConfigService
      );

      await disabledScheduler.start();

      const status = disabledScheduler.getStatus();
      expect(status.isEnabled).toBe(false);
      expect(status.isRunning).toBe(false);

      await disabledScheduler.stop();
    });

    it('should use custom schedule configuration', async () => {
      // Create scheduler with custom schedules
      appConfigService.updateSchedulerConfig({
        rotationCheckSchedule: '*/5 * * * * *', // Every 5 seconds
        cleanupSchedule: '*/10 * * * * *', // Every 10 seconds
      });

      const customScheduler = new LogMaintenanceScheduler(
        logger,
        logStorageService,
        appConfigService
      );

      await customScheduler.start();

      const status = customScheduler.getStatus();
      expect(status.isRunning).toBe(true);

      await customScheduler.stop();
    });
  });
});
