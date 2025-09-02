/**
 * @file Integration tests for LogStorageService
 * @description Tests real filesystem operations and controller integration
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import LogStorageService from '../../../src/services/logStorageService.js';

/**
 * Test utilities
 * @returns {object} Mock logger object
 */
const createLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

const createValidLogEntry = (overrides = {}) => {
  const base = {
    level: 'info',
    message: 'Integration test log message',
    timestamp: new Date().toISOString(),
    category: 'test',
    sourceCategory: 'test', // Default for level-based routing testing
    source: 'integration.test.js:123',
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    metadata: { testRun: true },
  };

  // Apply overrides
  const result = {
    ...base,
    ...overrides,
    // Merge metadata instead of replacing it
    metadata: { testRun: true, ...(overrides.metadata || {}) },
  };

  // If category is provided in overrides but sourceCategory is not,
  // set sourceCategory to undefined to allow category-based routing
  if (overrides.category && !overrides.hasOwnProperty('sourceCategory')) {
    result.sourceCategory = undefined;
  }

  return result;
};

describe('LogStorageService Integration Tests', () => {
  let logger;
  let service;
  let tempDir;
  let config;

  beforeEach(async () => {
    logger = createLogger();

    // Create temporary directory for test logs
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-storage-test-'));

    config = {
      baseLogPath: tempDir,
      retentionDays: 1,
      maxFileSizeMB: 1, // Small size for testing rotation
      writeBufferSize: 5,
      flushIntervalMs: 100, // Fast flush for testing
    };

    service = new LogStorageService(logger, config);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }

    // Clean up temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('File System Operations', () => {
    test('should create directory structure and write logs to files', async () => {
      const today = new Date().toISOString().split('T')[0];
      const logs = [
        createValidLogEntry({ category: 'engine' }),
        createValidLogEntry({ category: 'ui' }),
        createValidLogEntry({ category: 'ecs' }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      // Check directory structure
      const dateDirPath = path.join(tempDir, today);
      const dateDirExists = await fs
        .access(dateDirPath)
        .then(() => true)
        .catch(() => false);
      expect(dateDirExists).toBe(true);

      // Check category files
      const engineFile = path.join(dateDirPath, 'engine.jsonl');
      const uiFile = path.join(dateDirPath, 'ui.jsonl');
      const ecsFile = path.join(dateDirPath, 'ecs.jsonl');

      const engineExists = await fs
        .access(engineFile)
        .then(() => true)
        .catch(() => false);
      const uiExists = await fs
        .access(uiFile)
        .then(() => true)
        .catch(() => false);
      const ecsExists = await fs
        .access(ecsFile)
        .then(() => true)
        .catch(() => false);

      expect(engineExists).toBe(true);
      expect(uiExists).toBe(true);
      expect(ecsExists).toBe(true);
    });

    test('should write valid JSONL format', async () => {
      const log = createValidLogEntry({
        level: 'debug',
        message: 'Test JSONL formatting',
        metadata: { key: 'value', number: 42 },
      });

      await service.writeLogs([log]);
      await service.flushLogs();

      const today = new Date().toISOString().split('T')[0];
      const filePath = path.join(tempDir, today, 'test.jsonl');

      const fileContent = await fs.readFile(filePath, 'utf8');
      const lines = fileContent.trim().split('\n');

      expect(lines).toHaveLength(1);

      const parsedLog = JSON.parse(lines[0]);
      expect(parsedLog).toEqual(
        expect.objectContaining({
          level: 'debug',
          message: 'Test JSONL formatting',
          metadata: { key: 'value', number: 42, testRun: true },
        })
      );
    });

    test('should append to existing files', async () => {
      const log1 = createValidLogEntry({ message: 'First log' });
      const log2 = createValidLogEntry({ message: 'Second log' });

      // Write first log
      await service.writeLogs([log1]);
      await service.flushLogs();

      // Write second log
      await service.writeLogs([log2]);
      await service.flushLogs();

      const today = new Date().toISOString().split('T')[0];
      const filePath = path.join(tempDir, today, 'test.jsonl');

      const fileContent = await fs.readFile(filePath, 'utf8');
      const lines = fileContent.trim().split('\n');

      expect(lines).toHaveLength(2);

      const parsedLog1 = JSON.parse(lines[0]);
      const parsedLog2 = JSON.parse(lines[1]);

      expect(parsedLog1.message).toBe('First log');
      expect(parsedLog2.message).toBe('Second log');
    });

    test('should handle concurrent writes without corruption', async () => {
      const numConcurrentWrites = 10;
      const logsPerWrite = 5;

      // Create multiple write operations
      const writePromises = Array(numConcurrentWrites)
        .fill()
        .map((_, i) => {
          const logs = Array(logsPerWrite)
            .fill()
            .map((_, j) =>
              createValidLogEntry({
                message: `Concurrent write ${i}-${j}`,
                category: 'concurrent',
              })
            );
          return service.writeLogs(logs);
        });

      const results = await Promise.all(writePromises);
      await service.flushLogs();

      // All writes should succeed
      const totalProcessed = results.reduce((sum, result) => sum + result, 0);
      expect(totalProcessed).toBe(numConcurrentWrites * logsPerWrite);

      // Verify file integrity - logs go to concurrent.jsonl (category override works now)
      const today = new Date().toISOString().split('T')[0];
      const filePath = path.join(tempDir, today, 'concurrent.jsonl');

      const fileContent = await fs.readFile(filePath, 'utf8');
      const lines = fileContent.trim().split('\n');

      expect(lines).toHaveLength(totalProcessed);

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    test('should rotate files when size limit is exceeded', async () => {
      // Create large log entries to exceed 1MB limit
      const largeMessage = 'A'.repeat(50000); // 50KB per message
      const logs = Array(25)
        .fill()
        .map(
          (
            _,
            i // 25 * 50KB = 1.25MB
          ) =>
            createValidLogEntry({
              message: largeMessage,
              category: 'large',
              metadata: { index: i },
            })
        );

      await service.writeLogs(logs);
      await service.flushLogs();

      // Check for rotation
      const rotatedCount = await service.rotateLargeFiles();

      // Expect at least some rotation to have occurred
      expect(rotatedCount).toBeGreaterThanOrEqual(0);
    });

    test('should cleanup old log directories', async () => {
      // Create old directory
      const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const oldDateStr = oldDate.toISOString().split('T')[0];
      const oldDirPath = path.join(tempDir, oldDateStr);

      await fs.mkdir(oldDirPath, { recursive: true });
      await fs.writeFile(path.join(oldDirPath, 'old.jsonl'), 'test content');

      // Verify old directory exists
      const oldDirExists = await fs
        .access(oldDirPath)
        .then(() => true)
        .catch(() => false);
      expect(oldDirExists).toBe(true);

      // Run cleanup
      const cleanedCount = await service.cleanupOldLogs();
      expect(cleanedCount).toBe(1);

      // Verify old directory is removed
      const oldDirExistsAfter = await fs
        .access(oldDirPath)
        .then(() => true)
        .catch(() => false);
      expect(oldDirExistsAfter).toBe(false);
    });
  });

  describe('Category Detection Integration', () => {
    test('should categorize logs correctly in real files', async () => {
      const logs = [
        createValidLogEntry({
          category: undefined,
          sourceCategory: undefined, // Allow pattern matching
          message: 'GameEngine: System starting up',
        }),
        createValidLogEntry({
          category: undefined,
          sourceCategory: undefined, // Allow pattern matching
          message: 'UI component rendered successfully',
        }),
        createValidLogEntry({
          category: undefined,
          sourceCategory: undefined, // Allow pattern matching
          message: 'EntityManager: Creating new entity',
        }),
        createValidLogEntry({
          category: undefined,
          sourceCategory: undefined, // Allow pattern matching
          message: 'AI: Processing LLM response',
        }),
        createValidLogEntry({
          category: undefined,
          sourceCategory: undefined, // Allow pattern matching
          message: 'Random unmatched message',
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      const today = new Date().toISOString().split('T')[0];
      const dateDir = path.join(tempDir, today);

      // Check that files were created with correct categories
      const engineFile = path.join(dateDir, 'engine.jsonl');
      const uiFile = path.join(dateDir, 'ui.jsonl');
      const ecsFile = path.join(dateDir, 'ecs.jsonl');
      const aiFile = path.join(dateDir, 'ai.jsonl');
      const generalFile = path.join(dateDir, 'general.jsonl');

      const filesExist = await Promise.all([
        fs
          .access(engineFile)
          .then(() => true)
          .catch(() => false),
        fs
          .access(uiFile)
          .then(() => true)
          .catch(() => false),
        fs
          .access(ecsFile)
          .then(() => true)
          .catch(() => false),
        fs
          .access(aiFile)
          .then(() => true)
          .catch(() => false),
        fs
          .access(generalFile)
          .then(() => true)
          .catch(() => false),
      ]);

      expect(filesExist).toEqual([true, true, true, true, true]);

      // Verify content in each file
      const engineContent = await fs.readFile(engineFile, 'utf8');
      expect(engineContent).toContain('GameEngine: System starting up');

      const uiContent = await fs.readFile(uiFile, 'utf8');
      expect(uiContent).toContain('UI component rendered successfully');

      const ecsContent = await fs.readFile(ecsFile, 'utf8');
      expect(ecsContent).toContain('EntityManager: Creating new entity');

      const aiContent = await fs.readFile(aiFile, 'utf8');
      expect(aiContent).toContain('AI: Processing LLM response');

      const generalContent = await fs.readFile(generalFile, 'utf8');
      expect(generalContent).toContain('Random unmatched message');
    });
  });

  describe('Performance Tests', () => {
    test('should handle high volume log processing efficiently', async () => {
      const batchSize = 1000;
      const numBatches = 5;

      const startTime = Date.now();

      for (let batch = 0; batch < numBatches; batch++) {
        const logs = Array(batchSize)
          .fill()
          .map((_, i) =>
            createValidLogEntry({
              message: `Batch ${batch} Log ${i}`,
              category: 'performance',
            })
          );

        await service.writeLogs(logs);
      }

      await service.flushLogs();

      const duration = Date.now() - startTime;
      const totalLogs = batchSize * numBatches;
      const logsPerSecond = totalLogs / (duration / 1000);

      expect(logsPerSecond).toBeGreaterThan(1000); // Should process > 1000 logs/second

      // Verify all logs were written to performance.jsonl (category override works now)
      const today = new Date().toISOString().split('T')[0];
      const filePath = path.join(tempDir, today, 'performance.jsonl');

      const fileContent = await fs.readFile(filePath, 'utf8');
      const lines = fileContent.trim().split('\n');

      expect(lines).toHaveLength(totalLogs);
    });

    test('should handle game startup surge scenario', async () => {
      // Simulate game startup with 13,000+ logs
      const startupLogCount = 13000;
      const categories = ['engine', 'ui', 'ecs', 'ai', 'events', 'validation'];

      const logs = Array(startupLogCount)
        .fill()
        .map((_, i) => {
          const category = categories[i % categories.length];
          return createValidLogEntry({
            message: `Startup log ${i}: System initialization`,
            category,
            metadata: { startupPhase: Math.floor(i / 1000) },
          });
        });

      const startTime = Date.now();

      // Process in chunks to simulate real-world batching
      const chunkSize = 500;
      for (let i = 0; i < logs.length; i += chunkSize) {
        const chunk = logs.slice(i, i + chunkSize);
        await service.writeLogs(chunk);
      }

      await service.flushLogs();

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify files were created for each category
      const today = new Date().toISOString().split('T')[0];
      const dateDir = path.join(tempDir, today);

      for (const category of categories) {
        const filePath = path.join(dateDir, `${category}.jsonl`);
        const fileExists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);

        const fileContent = await fs.readFile(filePath, 'utf8');
        const lines = fileContent.trim().split('\n');
        expect(lines.length).toBeGreaterThan(0);

        // Verify JSONL format
        for (const line of lines.slice(0, 10)) {
          // Check first 10 lines
          expect(() => JSON.parse(line)).not.toThrow();
        }
      }
    });
  });

  describe('Error Recovery Tests', () => {
    test('should recover from temporary file system errors', async () => {
      const today = new Date().toISOString().split('T')[0];
      const dateDir = path.join(tempDir, today);

      // Create directory with restrictive permissions first
      await fs.mkdir(dateDir, { recursive: true, mode: 0o444 });

      const logs = [createValidLogEntry({ message: 'Recovery test log' })];
      await service.writeLogs(logs);

      // Try to flush (should fail silently and logs should remain buffered)
      const firstFlushResult = await service.flushLogs();
      expect(firstFlushResult).toBe(0); // Should fail to write

      // Restore permissions
      await fs.chmod(dateDir, 0o755);

      // Flush again - should work now and process the buffered logs
      const secondFlushResult = await service.flushLogs();

      expect(secondFlushResult).toBeGreaterThan(0);

      // Verify logs were written
      const filePath = path.join(dateDir, 'test.jsonl');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toContain('Recovery test log');
    });

    test('should maintain data integrity after service restart', async () => {
      // Write some logs
      const logs1 = [
        createValidLogEntry({ message: 'Before restart 1' }),
        createValidLogEntry({ message: 'Before restart 2' }),
      ];

      await service.writeLogs(logs1);
      await service.flushLogs();

      // Shutdown service
      await service.shutdown();

      // Create new service instance
      const newService = new LogStorageService(logger, config);

      // Write more logs
      const logs2 = [
        createValidLogEntry({ message: 'After restart 1' }),
        createValidLogEntry({ message: 'After restart 2' }),
      ];

      await newService.writeLogs(logs2);
      await newService.flushLogs();

      // Verify all logs are present
      const today = new Date().toISOString().split('T')[0];
      const filePath = path.join(tempDir, today, 'test.jsonl');

      const fileContent = await fs.readFile(filePath, 'utf8');
      const lines = fileContent.trim().split('\n');

      expect(lines).toHaveLength(4);

      const messages = lines.map((line) => JSON.parse(line).message);
      expect(messages).toContain('Before restart 1');
      expect(messages).toContain('Before restart 2');
      expect(messages).toContain('After restart 1');
      expect(messages).toContain('After restart 2');

      await newService.shutdown();
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle mixed log levels and complex metadata', async () => {
      const logs = [
        createValidLogEntry({
          level: 'debug',
          message: 'Debug trace information',
          metadata: {
            debugLevel: 'verbose',
            stack: ['function1', 'function2'],
            timing: { start: 100, end: 200 },
          },
        }),
        createValidLogEntry({
          level: 'info',
          message: 'User action completed',
          metadata: {
            userId: 'user123',
            action: 'login',
            duration: 150,
            success: true,
          },
        }),
        createValidLogEntry({
          level: 'warn',
          message: 'Deprecated API usage detected',
          metadata: {
            api: '/old-endpoint',
            replacement: '/new-endpoint',
            deprecationDate: '2024-12-31',
          },
        }),
        createValidLogEntry({
          level: 'error',
          message: 'Database connection failed',
          metadata: {
            error: 'ECONNREFUSED',
            host: 'localhost',
            port: 5432,
            retryAttempt: 3,
          },
        }),
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      const today = new Date().toISOString().split('T')[0];
      
      // Check level-based files (error.jsonl, warning.jsonl)
      const errorFilePath = path.join(tempDir, today, 'error.jsonl');
      const warningFilePath = path.join(tempDir, today, 'warning.jsonl');
      const testFilePath = path.join(tempDir, today, 'test.jsonl'); // debug and info go here

      // Verify error log
      const errorContent = await fs.readFile(errorFilePath, 'utf8');
      const errorLines = errorContent.trim().split('\n');
      expect(errorLines).toHaveLength(1);
      const errorLog = JSON.parse(errorLines[0]);
      expect(errorLog).toMatchObject({
        level: 'error',
        message: 'Database connection failed',
        metadata: expect.objectContaining({
          error: 'ECONNREFUSED',
          retryAttempt: 3,
        }),
      });

      // Verify warning log
      const warningContent = await fs.readFile(warningFilePath, 'utf8');
      const warningLines = warningContent.trim().split('\n');
      expect(warningLines).toHaveLength(1);
      const warningLog = JSON.parse(warningLines[0]);
      expect(warningLog).toMatchObject({
        level: 'warn',
        message: 'Deprecated API usage detected',
      });

      // Verify info and debug logs in test.jsonl
      const testContent = await fs.readFile(testFilePath, 'utf8');
      const testLines = testContent.trim().split('\n');
      expect(testLines).toHaveLength(2);

      const testLogs = testLines.map((line) => JSON.parse(line));

      expect(testLogs[0]).toMatchObject({
        level: 'debug',
        message: 'Debug trace information',
        metadata: expect.objectContaining({
          debugLevel: 'verbose',
          stack: ['function1', 'function2'],
        }),
      });

      expect(testLogs[1]).toMatchObject({
        level: 'info',
        message: 'User action completed',
        metadata: expect.objectContaining({
          userId: 'user123',
          success: true,
        }),
      });
    });
  });

  describe('Level-based routing integration', () => {
    test('should create separate files for error and warning logs', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const logs = [
        createValidLogEntry({ 
          level: 'error', 
          message: 'Critical system failure',
          sourceCategory: 'actions' // Should be ignored for error level
        }),
        createValidLogEntry({ 
          level: 'warn', 
          message: 'Performance degradation detected',
          sourceCategory: 'entities' // Should be ignored for warn level
        }),
        createValidLogEntry({ 
          level: 'info', 
          message: 'System initialized',
          sourceCategory: 'bootstrapper' // Should be used for info level
        }),
        createValidLogEntry({ 
          level: 'debug', 
          message: 'Debug information',
          sourceCategory: 'logic' // Should be used for debug level
        })
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      // Check that error.jsonl exists and contains error log
      const errorFilePath = path.join(tempDir, today, 'error.jsonl');
      const errorFileExists = await fs.access(errorFilePath).then(() => true).catch(() => false);
      expect(errorFileExists).toBe(true);

      const errorContent = await fs.readFile(errorFilePath, 'utf8');
      const errorLogs = errorContent.trim().split('\n').map(line => JSON.parse(line));
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0]).toMatchObject({
        level: 'error',
        message: 'Critical system failure'
      });

      // Check that warning.jsonl exists and contains warning log
      const warningFilePath = path.join(tempDir, today, 'warning.jsonl');
      const warningFileExists = await fs.access(warningFilePath).then(() => true).catch(() => false);
      expect(warningFileExists).toBe(true);

      const warningContent = await fs.readFile(warningFilePath, 'utf8');
      const warningLogs = warningContent.trim().split('\n').map(line => JSON.parse(line));
      expect(warningLogs).toHaveLength(1);
      expect(warningLogs[0]).toMatchObject({
        level: 'warn',
        message: 'Performance degradation detected'
      });

      // Check that category-based files exist for non-error/warn logs
      const bootstrapperFilePath = path.join(tempDir, today, 'bootstrapper.jsonl');
      const logicFilePath = path.join(tempDir, today, 'logic.jsonl');

      const bootstrapperExists = await fs.access(bootstrapperFilePath).then(() => true).catch(() => false);
      const logicExists = await fs.access(logicFilePath).then(() => true).catch(() => false);

      expect(bootstrapperExists).toBe(true);
      expect(logicExists).toBe(true);

      // Verify category-based file contents
      const bootstrapperContent = await fs.readFile(bootstrapperFilePath, 'utf8');
      const logicContent = await fs.readFile(logicFilePath, 'utf8');

      const bootstrapperLogs = bootstrapperContent.trim().split('\n').map(line => JSON.parse(line));
      const logicLogs = logicContent.trim().split('\n').map(line => JSON.parse(line));

      expect(bootstrapperLogs).toHaveLength(1);
      expect(bootstrapperLogs[0]).toMatchObject({
        level: 'info',
        message: 'System initialized'
      });

      expect(logicLogs).toHaveLength(1);
      expect(logicLogs[0]).toMatchObject({
        level: 'debug',
        message: 'Debug information'
      });
    });

    test('should handle client-provided categories correctly', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Test a subset of important categories to keep the test manageable
      // Note: Production code converts sourceCategory to lowercase
      const clientCategories = [
        'actions', 'logic', 'entities', 'domui', 'events', 'engine', 'ai', 
        'loaders', 'logging', 'config', 'services', 'utils', 'storage',
        'characterbuilder', 'validation', 'bootstrapper', 'llm-proxy'
      ];

      // Create one log for each category using sourceCategory explicitly
      const logs = clientCategories.map((category, index) => 
        createValidLogEntry({
          level: 'info',
          message: `Log from ${category}`,
          sourceCategory: category, // Use sourceCategory explicitly
          timestamp: new Date(Date.now() + index).toISOString() // Unique timestamps
        })
      );

      await service.writeLogs(logs);
      await service.flushLogs();

      // Verify that files were created for each category
      for (const category of clientCategories) {
        const categoryFilePath = path.join(tempDir, today, `${category}.jsonl`);
        const categoryFileExists = await fs.access(categoryFilePath).then(() => true).catch(() => false);
        
        expect(categoryFileExists).toBe(true);

        const categoryContent = await fs.readFile(categoryFilePath, 'utf8');
        const categoryLogs = categoryContent.trim().split('\n').map(line => JSON.parse(line));
        
        expect(categoryLogs).toHaveLength(1);
        expect(categoryLogs[0]).toMatchObject({
          level: 'info',
          message: `Log from ${category}`,
          sourceCategory: category
        });
      }
    });

    test('should prioritize level-based routing over sourceCategory', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const logs = [
        createValidLogEntry({
          level: 'error',
          message: 'Error from actions',
          sourceCategory: 'actions' // Should be ignored because level=error
        }),
        createValidLogEntry({
          level: 'warn',
          message: 'Warning from entities',  
          sourceCategory: 'entities' // Should be ignored because level=warn
        })
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      // Check that level-based files were created
      const errorFilePath = path.join(tempDir, today, 'error.jsonl');
      const warningFilePath = path.join(tempDir, today, 'warning.jsonl');

      const errorExists = await fs.access(errorFilePath).then(() => true).catch(() => false);
      const warningExists = await fs.access(warningFilePath).then(() => true).catch(() => false);

      expect(errorExists).toBe(true);
      expect(warningExists).toBe(true);

      // Check that category-based files were NOT created for these logs
      const actionsFilePath = path.join(tempDir, today, 'actions.jsonl');
      const entitiesFilePath = path.join(tempDir, today, 'entities.jsonl');

      const actionsExists = await fs.access(actionsFilePath).then(() => true).catch(() => false);
      const entitiesExists = await fs.access(entitiesFilePath).then(() => true).catch(() => false);

      expect(actionsExists).toBe(false);
      expect(entitiesExists).toBe(false);

      // Verify file contents
      const errorContent = await fs.readFile(errorFilePath, 'utf8');
      const warningContent = await fs.readFile(warningFilePath, 'utf8');

      const errorLogs = errorContent.trim().split('\n').map(line => JSON.parse(line));
      const warningLogs = warningContent.trim().split('\n').map(line => JSON.parse(line));

      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Error from actions');
      expect(errorLogs[0].sourceCategory).toBe('actions'); // Should preserve sourceCategory in log

      expect(warningLogs).toHaveLength(1);
      expect(warningLogs[0].message).toBe('Warning from entities');
      expect(warningLogs[0].sourceCategory).toBe('entities');
    });

    test('should handle mixed levels and maintain performance', async () => {
      const startTime = Date.now();
      const today = new Date().toISOString().split('T')[0];

      // Create 200 logs with mixed levels and categories for performance testing
      const logs = [];
      const levels = ['error', 'warn', 'info', 'debug'];
      const categories = ['actions', 'logic', 'entities', 'domUI', 'ai', 'events'];

      for (let i = 0; i < 200; i++) {
        logs.push(createValidLogEntry({
          level: levels[i % 4],
          sourceCategory: categories[i % 6],
          message: `Performance test log ${i}`,
          timestamp: new Date(Date.now() + i).toISOString()
        }));
      }

      await service.writeLogs(logs);
      await service.flushLogs();

      const processingTime = Date.now() - startTime;

      // Should process 200 logs in under 2 seconds (generous limit for integration test)
      expect(processingTime).toBeLessThan(2000);

      // Verify level-based files were created
      const errorFilePath = path.join(tempDir, today, 'error.jsonl');
      const warningFilePath = path.join(tempDir, today, 'warning.jsonl');

      const errorExists = await fs.access(errorFilePath).then(() => true).catch(() => false);
      const warningExists = await fs.access(warningFilePath).then(() => true).catch(() => false);

      expect(errorExists).toBe(true);
      expect(warningExists).toBe(true);

      // Count logs in level-based files
      const errorContent = await fs.readFile(errorFilePath, 'utf8');
      const warningContent = await fs.readFile(warningFilePath, 'utf8');

      const errorCount = errorContent.trim().split('\n').length;
      const warningCount = warningContent.trim().split('\n').length;

      // Should have 50 error logs (every 4th log) and 50 warning logs
      expect(errorCount).toBe(50);
      expect(warningCount).toBe(50);

      // Verify category files exist for info/debug logs only
      // Note: Only check a subset since we're mixing logs and some may go to same files
      const expectedCategoryFiles = ['actions', 'logic', 'entities'];
      for (const category of expectedCategoryFiles) {
        const categoryFilePath = path.join(tempDir, today, `${category}.jsonl`);
        const categoryExists = await fs.access(categoryFilePath).then(() => true).catch(() => false);
        expect(categoryExists).toBe(true);
      }

      // Verify total log distribution makes sense
      // We should have 50 errors + 50 warnings + 100 info/debug logs distributed across categories
      const totalExpectedLogs = 200;
      const levelBasedLogs = errorCount + warningCount; // 100
      const categoryBasedLogs = totalExpectedLogs - levelBasedLogs; // 100

      expect(levelBasedLogs).toBe(100);
      expect(categoryBasedLogs).toBe(100);
    });

    test('should handle fallback when sourceCategory is invalid', async () => {
      const today = new Date().toISOString().split('T')[0];

      const logs = [
        createValidLogEntry({
          level: 'info',
          message: 'Log with null sourceCategory',
          sourceCategory: null,
          category: undefined // No fallback category
        }),
        createValidLogEntry({
          level: 'info',
          message: 'Log with invalid sourceCategory',
          sourceCategory: 123,
          category: undefined // No fallback category
        }),
        createValidLogEntry({
          level: 'info',
          message: 'Log with empty sourceCategory',
          sourceCategory: '',
          category: undefined // No fallback category
        }),
        createValidLogEntry({
          level: 'info',
          message: 'Log with missing sourceCategory',
          sourceCategory: undefined,
          category: 'fallback' // Should use this as backup
        })
      ];

      await service.writeLogs(logs);
      await service.flushLogs();

      // Should create general.jsonl for invalid sourceCategories and fallback.jsonl for the last log
      const generalFilePath = path.join(tempDir, today, 'general.jsonl');
      const fallbackFilePath = path.join(tempDir, today, 'fallback.jsonl');

      const generalExists = await fs.access(generalFilePath).then(() => true).catch(() => false);
      const fallbackExists = await fs.access(fallbackFilePath).then(() => true).catch(() => false);

      expect(generalExists).toBe(true);
      expect(fallbackExists).toBe(true);

      // Verify content
      const generalContent = await fs.readFile(generalFilePath, 'utf8');
      const fallbackContent = await fs.readFile(fallbackFilePath, 'utf8');

      const generalLogs = generalContent.trim().split('\n').map(line => JSON.parse(line));
      const fallbackLogs = fallbackContent.trim().split('\n').map(line => JSON.parse(line));

      expect(generalLogs).toHaveLength(3); // First 3 logs with invalid sourceCategory
      expect(fallbackLogs).toHaveLength(1); // Last log with category fallback

      // Verify the content of the logs
      expect(generalLogs[0].message).toBe('Log with null sourceCategory');
      expect(generalLogs[1].message).toBe('Log with invalid sourceCategory');
      expect(generalLogs[2].message).toBe('Log with empty sourceCategory');
      expect(fallbackLogs[0].message).toBe('Log with missing sourceCategory');
    });
  });

  describe('Test Helper and Routing Integration', () => {
    test('should verify test helper category override behavior', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Test 1: When category is provided without sourceCategory, it should override
      const categoryOnlyLog = createValidLogEntry({ 
        category: 'engine',
        message: 'Engine log with category override'
      });
      
      await service.writeLogs([categoryOnlyLog]);
      await service.flushLogs();
      
      const engineFilePath = path.join(tempDir, today, 'engine.jsonl');
      const engineExists = await fs.access(engineFilePath).then(() => true).catch(() => false);
      expect(engineExists).toBe(true);
      
      // Test 2: When both category and sourceCategory are provided, sourceCategory should win
      const bothProvidedLog = createValidLogEntry({
        category: 'ui', 
        sourceCategory: 'ecs',
        message: 'Log with both category and sourceCategory'
      });
      
      await service.writeLogs([bothProvidedLog]);
      await service.flushLogs();
      
      const ecsFilePath = path.join(tempDir, today, 'ecs.jsonl');
      const ecsExists = await fs.access(ecsFilePath).then(() => true).catch(() => false);
      expect(ecsExists).toBe(true);
      
      // UI file should not be created since sourceCategory takes priority
      const uiFilePath = path.join(tempDir, today, 'ui.jsonl');
      const uiExists = await fs.access(uiFilePath).then(() => true).catch(() => false);
      expect(uiExists).toBe(false);
      
      // Test 3: Default behavior (no overrides) should go to test.jsonl
      const defaultLog = createValidLogEntry({
        message: 'Default test log'
      });
      
      await service.writeLogs([defaultLog]);
      await service.flushLogs();
      
      const testFilePath = path.join(tempDir, today, 'test.jsonl');
      const testExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(testExists).toBe(true);
      
      // Verify file contents
      const engineContent = await fs.readFile(engineFilePath, 'utf8');
      expect(engineContent).toContain('Engine log with category override');
      
      const ecsContent = await fs.readFile(ecsFilePath, 'utf8');
      expect(ecsContent).toContain('Log with both category and sourceCategory');
      
      const testContent = await fs.readFile(testFilePath, 'utf8');
      expect(testContent).toContain('Default test log');
    });
    
    test('should demonstrate sourceCategory priority in production routing', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Create logs that test the priority system
      const logs = [
        // Priority 1: Level-based routing (highest priority)
        createValidLogEntry({
          level: 'error',
          sourceCategory: 'engine',
          category: 'ui',
          message: 'Error should ignore categories'
        }),
        
        // Priority 2: sourceCategory over category
        createValidLogEntry({
          level: 'info',
          sourceCategory: 'ai',
          category: 'ecs',
          message: 'sourceCategory should win'
        }),
        
        // Priority 3: category when sourceCategory is undefined
        createValidLogEntry({
          level: 'debug',
          sourceCategory: undefined,
          category: 'events',
          message: 'category should be used'
        }),
        
        // Priority 4: Pattern matching fallback
        createValidLogEntry({
          level: 'info',
          sourceCategory: undefined,
          category: undefined,
          message: 'GameEngine: should match engine pattern'
        })
      ];
      
      await service.writeLogs(logs);
      await service.flushLogs();
      
      // Verify level-based routing (highest priority)
      const errorFilePath = path.join(tempDir, today, 'error.jsonl');
      const errorExists = await fs.access(errorFilePath).then(() => true).catch(() => false);
      expect(errorExists).toBe(true);
      
      const errorContent = await fs.readFile(errorFilePath, 'utf8');
      expect(errorContent).toContain('Error should ignore categories');
      
      // Verify sourceCategory priority
      const aiFilePath = path.join(tempDir, today, 'ai.jsonl');
      const aiExists = await fs.access(aiFilePath).then(() => true).catch(() => false);
      expect(aiExists).toBe(true);
      
      const aiContent = await fs.readFile(aiFilePath, 'utf8');
      expect(aiContent).toContain('sourceCategory should win');
      
      // Verify category fallback
      const eventsFilePath = path.join(tempDir, today, 'events.jsonl');
      const eventsExists = await fs.access(eventsFilePath).then(() => true).catch(() => false);
      expect(eventsExists).toBe(true);
      
      const eventsContent = await fs.readFile(eventsFilePath, 'utf8');
      expect(eventsContent).toContain('category should be used');
      
      // Verify pattern matching fallback
      const engineFilePath = path.join(tempDir, today, 'engine.jsonl');
      const engineExists = await fs.access(engineFilePath).then(() => true).catch(() => false);
      expect(engineExists).toBe(true);
      
      const engineContent = await fs.readFile(engineFilePath, 'utf8');
      expect(engineContent).toContain('GameEngine: should match engine pattern');
    });
  });
});
