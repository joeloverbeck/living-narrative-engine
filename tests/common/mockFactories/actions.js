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
  createSimpleMock(['resolveTargets'], {
    resolveTargets: jest.fn(() => ({ targets: [] })),
  });

/**
 * Creates a mock action error context builder with a `buildErrorContext` method.
 *
 * @description Returns a mock ActionErrorContextBuilder for tests.
 * @returns {{ buildErrorContext: jest.Mock }} Mock action error context builder
 */
export const createMockActionErrorContextBuilder = () => ({
  buildErrorContext: jest.fn(() => ({
    actionId: 'test',
    targetId: null,
    error: new Error('Test error'),
    actionDefinition: {},
    actorSnapshot: {},
    evaluationTrace: { steps: [], failurePoint: 'Unknown', finalContext: {} },
    suggestedFixes: [],
    environmentContext: {},
    timestamp: Date.now(),
    phase: 'resolution',
  })),
});

/**
 * Creates a mock target resolution service with actionErrorContextBuilder dependency.
 *
 * @description Creates a mock TargetResolutionService that includes the actionErrorContextBuilder.
 * @returns {{ resolveTargets: jest.Mock, actionErrorContextBuilder: object }} Mock target resolution service
 */
export const createMockTargetResolutionServiceWithErrorContext = () => {
  const mockActionErrorContextBuilder = createMockActionErrorContextBuilder();

  return {
    resolveTargets: jest.fn(() => ({ targets: [] })),
    actionErrorContextBuilder: mockActionErrorContextBuilder,
  };
};

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

/**
 * Creates a mock fix suggestion engine with a `suggestFixes` method.
 *
 * @description Returns a mock FixSuggestionEngine for tests.
 * @returns {{ suggestFixes: jest.Mock }} Mock fix suggestion engine
 */
export const createMockFixSuggestionEngine = () => ({
  suggestFixes: jest.fn(() => []),
});
