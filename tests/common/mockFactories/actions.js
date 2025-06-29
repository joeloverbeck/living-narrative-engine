/**
 * @file Factory helpers for action-related mocks used in tests.
 * @see tests/common/mockFactories/actions.js
 */

import { jest } from '@jest/globals';
import { createSimpleMock } from './coreServices.js';

/**
 * Creates a mock prerequisite evaluation service with an `evaluate` method.
 *
 * @description Convenience factory for tests needing a simple prerequisite evaluation service.
 * @returns {{ evaluate: jest.Mock }} Mock service instance
 */
export const createMockPrerequisiteEvaluationService = () =>
  createSimpleMock(['evaluate']);

/**
 * Creates a mock action index with a `getCandidateActions` method.
 *
 * @description Returns a simple mock for retrieving candidate actions.
 * @returns {{ getCandidateActions: jest.Mock }} Mock action index
 */
export const createMockActionIndex = () =>
  createSimpleMock(['getCandidateActions']);

/**
 * Creates a mock target resolution service with a `resolveTargets` method.
 *
 * @description Simplified mock to resolve action targets in tests.
 * @returns {{ resolveTargets: jest.Mock }} Mock target resolution service
 */
export const createMockTargetResolutionService = () =>
  createSimpleMock(['resolveTargets']);

/**
 * Creates a mock formatActionCommand function.
 *
 * @description Returns a jest.fn used to format action commands in tests.
 * @returns {jest.Mock} Mock formatting function
 */

/**
 * Creates a mock action command formatter implementing a `format` method.
 *
 * @returns {{ format: jest.Mock }} Mock formatter instance
 */
export const createMockActionCommandFormatter = () => ({
  format: jest.fn(),
});
