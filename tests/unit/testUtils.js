// src/tests/testUtils.js

import { PrerequisiteEvaluationService } from '../../src/actions/validation/prerequisiteEvaluationService.js';
import { jest } from '@jest/globals';

// --- Mock PrerequisiteEvaluationService ---
jest.mock('../../src/actions/validation/prerequisiteEvaluationService.js'); // Mock needs to be in the utility or called before import in test

/**
 *
 */
export function createMockPrerequisiteEvaluationService() {
  const mockInstance = new PrerequisiteEvaluationService();

  // Ensure evaluate exists as a mock fn
  if (!mockInstance.evaluate || !jest.isMockFunction(mockInstance.evaluate)) {
    mockInstance.evaluate = jest.fn();
  }

  // Fix the length property
  Object.defineProperty(mockInstance.evaluate, 'length', {
    value: 4,
    writable: false,
  });

  // Set a default behavior (optional, can be done in test)
  mockInstance.evaluate.mockReturnValue(true);

  return mockInstance;
}

// --- Mock Logger ---
/**
 * Creates a mock logger object with Jest mock functions for standard levels.
 *
 * @returns {{info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock}}
 */
export function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates a mock SaveValidationService with noop methods.
 *
 * @returns {{validateStructure: jest.Mock, verifyChecksum: jest.Mock, validateLoadedSaveObject: jest.Mock}}
 */
export function createMockSaveValidationService() {
  return {
    validateStructure: jest.fn().mockReturnValue({ success: true }),
    verifyChecksum: jest.fn().mockResolvedValue({ success: true }),
    validateLoadedSaveObject: jest.fn().mockResolvedValue({ success: true }),
  };
}
