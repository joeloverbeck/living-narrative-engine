// src/tests/testUtils.js

import { PrerequisiteEvaluationService } from '../../src/actions/validation/prerequisiteEvaluationService.js';
import { jest } from '@jest/globals';
import { createMockLogger } from '../common/mockFactories';

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
// re-export createMockLogger from common utilities
export { createMockLogger };

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
