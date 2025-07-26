/**
 * @file Testing Utilities - Central Export
 * @description Provides a unified export point for all testing utilities including facades and builders.
 * This centralizes all testing helpers for easy discovery and import.
 */

// Export all facades
export * from './facades/index.js';

// Export all builders - builders have been moved to tests/common/testing/builders/
// export * from './builders/index.js';

// Export facade registration and creation functions
export {
  registerTestingFacades,
  createMockFacades,
  createTestModules,
} from './facades/testingFacadeRegistrations.js';
