/**
 * @file Global setup for integration tests to ensure proper cleanup
 * @description Provides global beforeAll/afterAll hooks to prevent resource leaks
 */

import { beforeAll, afterAll } from '@jest/globals';

// Global cleanup to catch any missed timer cleanup
beforeAll(() => {
  // Ensure we start with clean timers
  jest.clearAllTimers();
});

// Global cleanup after all tests complete
afterAll(() => {
  // Final cleanup - force clear any remaining timers
  try {
    jest.clearAllTimers();
    jest.useRealTimers();
  } catch (error) {
    // Log but don't fail - we're in cleanup mode
    console.warn('Global timer cleanup encountered error:', error.message);
  }

  // Force garbage collection if available (helps detect memory leaks)
  if (global.gc) {
    global.gc();
  }
});

// Handle any uncaught promise rejections that could keep Node.js alive
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.warn('Uncaught Exception:', error.message);
});
