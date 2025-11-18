/**
 * @file Storage Test Bed for Storage Lifecycle Management E2E Tests
 * @description Provides comprehensive test infrastructure for testing trace storage,
 * rotation, directory management, and file output with automatic cleanup
 */

import { jest } from '@jest/globals';
import StorageRotationManager from '../../../../src/actions/tracing/storageRotationManager.js';
import FileTraceOutputHandler from '../../../../src/actions/tracing/fileTraceOutputHandler.js';

/**
 * Mock storage adapter for controlled testing with automatic cleanup tracking
 */
export class MockStorageAdapter {
  constructor() {
    this.storage = new Map();
    this.operationLog = [];
    this.accessedKeys = new Set();
  }

  async getItem(key) {
    this.accessedKeys.add(key);
    this.operationLog.push({ type: 'get', key, timestamp: Date.now() });
    return this.storage.get(key) || null;
  }

  async setItem(key, value) {
    this.accessedKeys.add(key);
    this.operationLog.push({ type: 'set', key, timestamp: Date.now() });
    this.storage.set(key, value);
  }

  async removeItem(key) {
    this.accessedKeys.add(key);
    this.operationLog.push({ type: 'remove', key, timestamp: Date.now() });
    this.storage.delete(key);
  }

  async clear() {
    this.operationLog.push({ type: 'clear', timestamp: Date.now() });
    this.storage.clear();
    this.accessedKeys.clear();
  }

  // Test utilities
  getStorageSize() {
    return this.storage.size;
  }

  getAllKeys() {
    return Array.from(this.storage.keys());
  }

  getAccessedKeys() {
    return Array.from(this.accessedKeys);
  }

  getOperationCount() {
    return this.operationLog.length;
  }

  // Cleanup helper - ensures all test data is removed
  async cleanup() {
    const keysToClean = Array.from(this.accessedKeys);
    for (const key of keysToClean) {
      await this.removeItem(key);
    }
    this.storage.clear();
    this.operationLog = [];
    this.accessedKeys.clear();
  }
}

/**
 * Mock storage provider for browser storage operations
 */
export class MockStorageProvider {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
    this.createdPaths = new Set();
  }

  async writeFileAtomically(path, content) {
    this.files.set(path, content);
    this.createdPaths.add(path);
    return { success: true, path };
  }

  async listFiles(directory) {
    const files = [];
    for (const [path] of this.files) {
      if (path.startsWith(directory)) {
        files.push(path);
      }
    }
    return files;
  }

  async readFile(path) {
    return this.files.get(path) || null;
  }

  async deleteFile(path) {
    this.files.delete(path);
    this.createdPaths.delete(path);
  }

  async createDirectory(path) {
    this.directories.add(path);
    this.createdPaths.add(path);
    return true;
  }

  // Cleanup helper
  async cleanup() {
    // Remove all created files
    for (const path of this.createdPaths) {
      this.files.delete(path);
    }
    this.files.clear();
    this.directories.clear();
    this.createdPaths.clear();
  }

  getCreatedPaths() {
    return Array.from(this.createdPaths);
  }
}

/**
 * Mock timer service for controlled rotation scheduling
 */
export class MockTimerService {
  constructor() {
    this.timers = new Map();
    this.nextId = 1;
    this.activeTimers = new Set();
  }

  setInterval(callback, delay) {
    const id = this.nextId++;
    this.timers.set(id, { callback, delay, type: 'interval' });
    this.activeTimers.add(id);
    return id;
  }

  clearInterval(timerId) {
    if (timerId && this.timers.has(timerId)) {
      this.timers.delete(timerId);
      this.activeTimers.delete(timerId);
    }
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.timers.set(id, { callback, delay, type: 'timeout' });
    this.activeTimers.add(id);
    return id;
  }

  clearTimeout(timerId) {
    if (timerId && this.timers.has(timerId)) {
      this.timers.delete(timerId);
      this.activeTimers.delete(timerId);
    }
  }

  // Test utility to manually trigger timers
  async triggerTimer(timerId) {
    const timer = this.timers.get(timerId);
    if (timer) {
      await timer.callback();
    }
  }

  // Cleanup all timers
  cleanup() {
    for (const timerId of this.activeTimers) {
      if (this.timers.get(timerId)?.type === 'interval') {
        this.clearInterval(timerId);
      } else {
        this.clearTimeout(timerId);
      }
    }
    this.timers.clear();
    this.activeTimers.clear();
  }

  hasActiveTimers() {
    return this.activeTimers.size > 0;
  }
}

/**
 * Storage Test Bed for comprehensive storage lifecycle testing
 */
export class StorageTestBed {
  constructor() {
    this.logger = this.#createTestLogger();
    this.storageAdapter = new MockStorageAdapter();
    this.storageProvider = new MockStorageProvider();
    this.timerService = new MockTimerService();
    this.managers = new Map();
    this.cleanupTasks = [];
    this.testStartTime = Date.now();
  }

  /**
   * Initialize the test bed with storage components
   */
  async initialize() {
    // Create a mock directory manager for testing since real one requires browser APIs
    this.directoryManager = this.#createMockDirectoryManager();
    this.managers.set('directory', this.directoryManager);

    // Create rotation manager with mock timer
    this.rotationManager = new StorageRotationManager({
      storageAdapter: this.storageAdapter,
      logger: this.logger,
      config: {
        rotationInterval: 60000, // 1 minute for testing
        maxTraceCount: 10,
      },
      timerService: this.timerService,
    });
    this.managers.set('rotation', this.rotationManager);

    // Create file output handler
    this.fileOutputHandler = new FileTraceOutputHandler({
      outputDirectory: './test-traces',
      traceDirectoryManager: this.directoryManager,
      logger: this.logger,
    });
    this.managers.set('fileOutput', this.fileOutputHandler);

    await this.fileOutputHandler.initialize();

    return true;
  }

  /**
   * Create test traces with various characteristics
   *
   * @param options
   */
  createTestTrace(options = {}) {
    const {
      id = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      actionId = 'test:action',
      actorId = 'test-actor',
      timestamp = Date.now(),
      size = 'small',
      hasError = false,
    } = options;

    const baseTrace = {
      id,
      actionId,
      actorId,
      timestamp,
      isComplete: !hasError,
      hasError,
      duration: Math.random() * 100,
    };

    // Add data based on size
    switch (size) {
      case 'small':
        baseTrace.data = { message: 'Small trace data' };
        break;
      case 'medium':
        baseTrace.data = {
          message: 'Medium trace data',
          payload: Array(100).fill('data'),
        };
        break;
      case 'large':
        baseTrace.data = {
          message: 'Large trace data',
          payload: Array(1000).fill('data'),
          nested: {
            deep: Array(500).fill({ key: 'value' }),
          },
        };
        break;
    }

    if (hasError) {
      baseTrace.error = {
        message: 'Test error',
        stack: 'Error stack trace here',
      };
    }

    return baseTrace;
  }

  /**
   * Store traces directly in storage
   *
   * @param traces
   */
  async storeTraces(traces) {
    const currentTraces =
      (await this.storageAdapter.getItem('actionTraces')) || [];
    currentTraces.push(...traces);
    await this.storageAdapter.setItem('actionTraces', currentTraces);
    return currentTraces.length;
  }

  /**
   * Get all stored traces
   */
  async getStoredTraces() {
    return (await this.storageAdapter.getItem('actionTraces')) || [];
  }

  /**
   * Configure rotation manager with specific policies
   *
   * @param config
   */
  configureRotation(config) {
    this.rotationManager.updateConfig(config);
  }

  /**
   * Trigger rotation manually
   */
  async triggerRotation() {
    return await this.rotationManager.forceRotation();
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    return {
      rotation: await this.rotationManager.getStatistics(),
      storage: {
        totalKeys: this.storageAdapter.getAllKeys().length,
        accessedKeys: this.storageAdapter.getAccessedKeys().length,
        operations: this.storageAdapter.getOperationCount(),
      },
      files: {
        totalFiles: this.storageProvider.files.size,
        createdPaths: this.storageProvider.getCreatedPaths(),
      },
      timers: {
        activeTimers: this.timerService.hasActiveTimers(),
      },
    };
  }

  /**
   * Validate no test artifacts remain
   */
  async validateCleanState() {
    const traces = await this.getStoredTraces();
    const stats = await this.getStorageStats();

    return {
      hasTraces: traces.length > 0,
      tracesCount: traces.length,
      storageKeys: stats.storage.totalKeys,
      filesCreated: stats.files.totalFiles,
      hasActiveTimers: stats.timers.activeTimers,
      createdPaths: stats.files.createdPaths,
    };
  }

  /**
   * Comprehensive cleanup of all test artifacts
   */
  async cleanup() {
    const cleanupResults = {
      tracesCleared: 0,
      filesDeleted: 0,
      directoriesRemoved: 0,
      timersCleared: 0,
      errors: [],
    };

    try {
      // 1. Clear all traces from storage
      const traces = await this.getStoredTraces();
      cleanupResults.tracesCleared = traces.length;
      await this.storageAdapter.setItem('actionTraces', []);

      // 2. Cleanup storage adapter
      await this.storageAdapter.cleanup();

      // 3. Cleanup storage provider (files and directories)
      const createdPaths = this.storageProvider.getCreatedPaths();
      cleanupResults.filesDeleted = createdPaths.length;
      await this.storageProvider.cleanup();

      // 4. Clear directory manager cache
      if (this.directoryManager) {
        this.directoryManager.clearCache();
      }

      // 5. Shutdown rotation manager
      if (this.rotationManager) {
        this.rotationManager.shutdown();
      }

      // 6. Clear all timers
      if (this.timerService.hasActiveTimers()) {
        cleanupResults.timersCleared = this.timerService.activeTimers.size;
        this.timerService.cleanup();
      }

      // 7. Run any additional cleanup tasks
      for (const task of this.cleanupTasks) {
        try {
          await task();
        } catch (error) {
          cleanupResults.errors.push(error.message);
        }
      }

      // 8. Validate clean state
      const finalState = await this.validateCleanState();
      if (finalState.hasTraces || finalState.filesCreated > 0) {
        cleanupResults.errors.push(
          `Cleanup incomplete: ${finalState.tracesCount} traces, ${finalState.filesCreated} files remain`
        );
      }
    } catch (error) {
      cleanupResults.errors.push(`Cleanup error: ${error.message}`);
    }

    return cleanupResults;
  }

  /**
   * Register additional cleanup task
   *
   * @param task
   */
  addCleanupTask(task) {
    this.cleanupTasks.push(task);
  }

  /**
   * Create test logger
   *
   * @returns {object} Mock logger
   */
  #createTestLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }

  /**
   * Create mock directory manager for testing
   *
   * @returns {object} Mock directory manager
   */
  #createMockDirectoryManager() {
    const cachedDirectories = new Set();

    return {
      ensureDirectoryExists: jest.fn(async (directoryPath) => {
        // Simple mock that succeeds for valid paths
        const normalizedPath = directoryPath
          .replace(/\\/g, '/')
          .replace(/^\.\//, '')
          .replace(/\/+/g, '/')
          .replace(/\/$/, '');

        // Validate for invalid patterns
        if (normalizedPath.includes('../') || normalizedPath.includes('\0')) {
          return {
            success: false,
            path: normalizedPath,
            existed: false,
            created: false,
            writable: false,
            error: 'Path contains invalid characters',
            errors: ['Path contains directory traversal sequences'],
          };
        }

        const cached = cachedDirectories.has(normalizedPath);
        if (!cached) {
          cachedDirectories.add(normalizedPath);
        }

        const result = {
          success: true,
          path: normalizedPath,
          existed: cached,
          created: !cached,
          writable: true,
        };

        // Only add cached property if it's true
        if (cached) {
          result.cached = true;
        }

        return result;
      }),

      validateDirectoryPath: jest.fn((directoryPath) => {
        const normalizedPath = directoryPath
          .replace(/\\/g, '/')
          .replace(/^\.\//, '')
          .replace(/\/+/g, '/')
          .replace(/\/$/, '');

        const errors = [];

        if (normalizedPath.includes('../')) {
          errors.push('Path contains directory traversal sequences');
        }

        if (normalizedPath.includes('\0')) {
          errors.push('Path contains null bytes');
        }

        if (normalizedPath.length > 255) {
          errors.push('Path exceeds maximum length (255 characters)');
        }

        const invalidChars = /[<>:"|?*\0]/;
        if (invalidChars.test(normalizedPath)) {
          errors.push('Path contains invalid characters');
        }

        // Check for reserved names
        const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];
        const segments = normalizedPath.split('/');
        for (const segment of segments) {
          if (reservedNames.includes(segment.toLowerCase())) {
            errors.push(`Path contains reserved name: ${segment}`);
          }
        }

        return {
          isValid: errors.length === 0,
          errors,
          normalizedPath,
        };
      }),

      selectDirectory: jest.fn(async () => {
        return {
          name: 'test-directory',
          kind: 'directory',
        };
      }),

      ensureSubdirectoryExists: jest.fn(async (parentHandle, subdirName) => {
        return {
          name: `${parentHandle.name || 'parent'}/${subdirName}`,
          kind: 'directory',
        };
      }),

      clearCache: jest.fn(() => {
        cachedDirectories.clear();
      }),

      getCachedDirectories: jest.fn(() => {
        return Array.from(cachedDirectories);
      }),
    };
  }

  /**
   * Wait for async operations to complete
   *
   * @param timeout
   */
  async waitForOperations(timeout = 100) {
    return new Promise((resolve) => setTimeout(resolve, timeout));
  }

  /**
   * Simulate time passage for rotation testing
   *
   * @param milliseconds
   */
  async simulateTimePassage(milliseconds) {
    const originalNow = Date.now;
    const startTime = originalNow();
    Date.now = jest.fn(() => startTime + milliseconds);

    // Register cleanup to restore Date.now
    this.addCleanupTask(() => {
      Date.now = originalNow;
    });

    return startTime + milliseconds;
  }
}

export default StorageTestBed;
