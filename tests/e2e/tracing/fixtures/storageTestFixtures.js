/**
 * @file Test fixtures for Storage Lifecycle Management E2E tests
 * @description Provides test data, configurations, and scenarios for storage testing
 */

/**
 * Rotation policy configurations for testing
 */
export const ROTATION_CONFIGS = {
  AGE_BASED: {
    policy: 'age',
    maxAge: 3600000, // 1 hour for testing
    rotationInterval: 60000, // Check every minute
    preserveCount: 2, // Always keep 2 most recent
  },
  COUNT_BASED: {
    policy: 'count',
    maxTraceCount: 5,
    rotationInterval: 30000,
    preserveCount: 1,
  },
  SIZE_BASED: {
    policy: 'size',
    maxStorageSize: 50 * 1024, // 50KB
    maxTraceSize: 10 * 1024, // 10KB per trace
    rotationInterval: 45000,
  },
  HYBRID: {
    policy: 'hybrid',
    maxAge: 7200000, // 2 hours
    maxTraceCount: 10,
    maxStorageSize: 100 * 1024, // 100KB
    rotationInterval: 60000,
  },
  COMPRESSION_ENABLED: {
    policy: 'count',
    maxTraceCount: 20,
    compressionEnabled: true,
    compressionAge: 1800000, // 30 minutes
    rotationInterval: 60000,
  },
};

/**
 * Test trace templates with various characteristics
 */
export const TRACE_TEMPLATES = {
  MINIMAL: {
    actionId: 'test:minimal',
    actorId: 'test-actor-min',
    data: { type: 'minimal' },
  },
  STANDARD: {
    actionId: 'test:standard',
    actorId: 'test-actor-std',
    data: {
      type: 'standard',
      payload: {
        action: 'move',
        target: 'north',
        success: true,
      },
      metadata: {
        timestamp: Date.now(),
        version: '1.0.0',
      },
    },
  },
  LARGE: {
    actionId: 'test:large',
    actorId: 'test-actor-large',
    data: {
      type: 'large',
      payload: Array(500).fill({
        field1: 'value1',
        field2: 'value2',
        nested: {
          deep: 'data',
          array: [1, 2, 3, 4, 5],
        },
      }),
    },
  },
  ERROR_TRACE: {
    actionId: 'test:error',
    actorId: 'test-actor-error',
    hasError: true,
    error: {
      message: 'Test error occurred',
      code: 'TEST_ERROR',
      stack: 'Error: Test error\n  at testFunction()',
    },
    data: {
      type: 'error',
      context: 'Test error scenario',
    },
  },
  PERFORMANCE_TRACE: {
    actionId: 'test:performance',
    actorId: 'test-actor-perf',
    data: {
      type: 'performance',
      metrics: {
        duration: 1234.56,
        phases: {
          init: 100.23,
          execution: 1000.45,
          cleanup: 133.88,
        },
        memory: {
          before: 1000000,
          after: 1500000,
          peak: 2000000,
        },
      },
    },
  },
};

/**
 * Directory path test scenarios
 */
export const DIRECTORY_SCENARIOS = {
  VALID_PATHS: [
    'traces/2024/01',
    'action-traces/daily',
    'output/traces/session-1',
    'test-traces',
  ],
  INVALID_PATHS: [
    '../../../etc/passwd', // Path traversal
    'traces\0null', // Null byte injection
    'con', // Reserved name
    'traces/<script>', // Invalid characters
    'a'.repeat(300), // Too long
  ],
  EDGE_CASES: [
    'traces/../traces', // Self-referencing
    'traces//double', // Double slashes
    './traces', // Relative path
    'traces/', // Trailing slash
  ],
};

/**
 * File naming test cases
 */
export const FILE_NAME_SCENARIOS = {
  STANDARD: {
    actionId: 'move-north',
    actorId: 'player-1',
    expected:
      /trace_move-north_player-1_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\d{3}Z\.json/,
  },
  SPECIAL_CHARS: {
    actionId: 'test:action/special',
    actorId: 'actor@domain.com',
    expected: /trace_test_action_special_actor_domain_com_.*\.json/,
  },
  LONG_IDS: {
    actionId: 'a'.repeat(100),
    actorId: 'b'.repeat(100),
    expected: /trace_a{100}_b{100}_.*\.json/,
  },
  COLLISION_TEST: {
    actionId: 'duplicate',
    actorId: 'duplicate',
    count: 10, // Generate 10 with same IDs
  },
};

/**
 * Storage load scenarios for stress testing
 */
export const LOAD_SCENARIOS = {
  LIGHT_LOAD: {
    traceCount: 10,
    traceSizes: ['small', 'small', 'medium'],
    interval: 100, // ms between traces
    duration: 1000, // Total test duration
  },
  MEDIUM_LOAD: {
    traceCount: 50,
    traceSizes: ['small', 'medium', 'large'],
    interval: 50,
    duration: 3000,
  },
  HEAVY_LOAD: {
    traceCount: 200,
    traceSizes: ['medium', 'large', 'large'],
    interval: 10,
    duration: 5000,
  },
  BURST_LOAD: {
    traceCount: 100,
    traceSizes: ['large'],
    interval: 0, // All at once
    duration: 1000,
  },
};

/**
 * Performance expectations for storage operations
 */
export const STORAGE_PERFORMANCE = {
  WRITE_LATENCY: {
    small: 10, // ms
    medium: 20,
    large: 50,
  },
  ROTATION_TIME: {
    light: 100, // ms for <50 traces
    medium: 300, // ms for 50-200 traces
    heavy: 1000, // ms for >200 traces
  },
  COMPRESSION_RATIO: {
    minimum: 0.3, // At least 30% compression
    typical: 0.5, // Typical 50% compression
    maximum: 0.8, // Up to 80% compression
  },
  MEMORY_LIMITS: {
    perTrace: 1024 * 10, // 10KB average
    totalStorage: 1024 * 1024 * 5, // 5MB limit
  },
};

/**
 * Cleanup validation expectations
 */
export const CLEANUP_EXPECTATIONS = {
  NO_TRACES: {
    traces: 0,
    storageKeys: 0,
    files: 0,
  },
  NO_TIMERS: {
    activeTimers: false,
  },
  NO_HANDLES: {
    directoryHandles: 0,
    fileHandles: 0,
  },
  MEMORY_RESTORED: {
    maxIncrease: 1024 * 1024, // 1MB max increase after cleanup
  },
};

/**
 * Helper to generate batch of test traces
 *
 * @param count
 * @param template
 */
export function generateTestTraces(count, template = TRACE_TEMPLATES.STANDARD) {
  const traces = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    traces.push({
      ...template,
      id: `trace-${i}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: baseTime - i * 60000, // Stagger by 1 minute each
      index: i,
    });
  }

  return traces;
}

/**
 * Helper to generate traces with specific age distribution
 *
 * @param distribution
 */
export function generateAgedTraces(distribution) {
  const traces = [];
  const now = Date.now();

  for (const [ageHours, count] of Object.entries(distribution)) {
    const ageMs = parseInt(ageHours) * 3600000; // Convert hours to ms
    for (let i = 0; i < count; i++) {
      traces.push({
        ...TRACE_TEMPLATES.STANDARD,
        id: `aged-${ageHours}h-${i}`,
        timestamp: now - ageMs,
        age: `${ageHours}h`,
      });
    }
  }

  return traces;
}

/**
 * Helper to calculate total size of traces
 *
 * @param trace
 */
export function calculateTraceSize(trace) {
  try {
    const jsonString = JSON.stringify(trace);
    return jsonString.length * 2; // Rough estimate for UTF-16
  } catch {
    return 1024; // Default 1KB if serialization fails
  }
}

/**
 * Helper to validate trace structure after storage
 *
 * @param trace
 */
export function validateStoredTrace(trace) {
  const required = ['id', 'timestamp', 'actionId', 'actorId'];
  const missing = required.filter((field) => !(field in trace));

  return {
    isValid: missing.length === 0,
    missing,
    hasData: 'data' in trace,
    hasError: trace.hasError === true,
    size: calculateTraceSize(trace),
  };
}

/**
 * Mock File System API handles for testing
 */
export class MockFileSystemHandles {
  constructor() {
    this.directories = new Map();
    this.files = new Map();
    this.createdHandles = new Set();
  }

  createDirectoryHandle(name) {
    const handle = {
      name,
      kind: 'directory',
      getDirectoryHandle: async (subName, options = {}) => {
        const fullPath = `${name}/${subName}`;
        if (options.create) {
          const subHandle = this.createDirectoryHandle(fullPath);
          this.createdHandles.add(fullPath);
          return subHandle;
        }
        return this.directories.get(fullPath) || null;
      },
      getFileHandle: async (fileName, options = {}) => {
        const fullPath = `${name}/${fileName}`;
        if (options.create) {
          const fileHandle = this.createFileHandle(fullPath);
          this.createdHandles.add(fullPath);
          return fileHandle;
        }
        return this.files.get(fullPath) || null;
      },
    };
    this.directories.set(name, handle);
    return handle;
  }

  createFileHandle(name) {
    const handle = {
      name,
      kind: 'file',
      createWritable: async () => ({
        write: async (content) => {
          this.files.set(name, { content, timestamp: Date.now() });
        },
        close: async () => {},
      }),
      getFile: async () => ({
        text: async () => this.files.get(name)?.content || '',
      }),
    };
    this.files.set(name, handle);
    return handle;
  }

  cleanup() {
    this.directories.clear();
    this.files.clear();
    this.createdHandles.clear();
  }

  getCreatedPaths() {
    return Array.from(this.createdHandles);
  }
}

/**
 * Test expectation helpers - import expect from Jest
 */
import { expect } from '@jest/globals';

/**
 * Verify no test artifacts remain
 *
 * @param {object} cleanupResult - Cleanup operation result
 */
export function expectNoTestArtifacts(cleanupResult) {
  expect(cleanupResult.tracesCleared).toBeGreaterThanOrEqual(0);
  expect(cleanupResult.errors).toHaveLength(0);
}

/**
 * Verify storage is completely clean
 *
 * @param {object} validationResult - Storage validation result
 */
export function expectCleanStorage(validationResult) {
  expect(validationResult.hasTraces).toBe(false);
  expect(validationResult.tracesCount).toBe(0);
  expect(validationResult.storageKeys).toBe(0);
  expect(validationResult.filesCreated).toBe(0);
  expect(validationResult.hasActiveTimers).toBe(false);
}

/**
 * Verify rotation operation succeeded
 *
 * @param {object} rotationResult - Rotation operation result
 */
export function expectRotationSuccess(rotationResult) {
  expect(rotationResult.deleted).toBeGreaterThanOrEqual(0);
  expect(rotationResult.errors).toBe(0);
  expect(rotationResult.duration).toBeLessThan(
    STORAGE_PERFORMANCE.ROTATION_TIME.heavy
  );
}
