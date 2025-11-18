/**
 * @file Factory helpers for action-related mocks used in tests.
 * @see tests/common/mockFactories/actions.js
 */

import { jest } from '@jest/globals';
import { createSimpleMock } from './coreServices.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';

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
 * @description Simplified mock to resolve action targets in tests that returns ActionResult.
 * @returns {{ resolveTargets: jest.Mock }} Mock target resolution service
 */
export const createMockTargetResolutionService = () => {
  const {
    ActionTargetContext,
  } = require('../../../src/models/actionTargetContext.js');
  return createSimpleMock(['resolveTargets'], {
    resolveTargets: jest.fn(() =>
      ActionResult.success([ActionTargetContext.noTarget()])
    ),
  });
};

/**
 * Creates a mock action error context builder with a `buildErrorContext` method.
 *
 * @description Returns a mock ActionErrorContextBuilder for tests.
 * @param {object} [options] - Optional configuration
 * @param {number} [options.fixedTimestamp] - Fixed timestamp to use instead of Date.now()
 * @returns {{ buildErrorContext: jest.Mock }} Mock action error context builder
 */
export const createMockActionErrorContextBuilder = (options = {}) => {
  const { fixedTimestamp = 1234567890 } = options;

  return {
    buildErrorContext: jest.fn((params) => {
      // If the error already has timestamp, preserve it
      const timestamp = params?.error?.timestamp || fixedTimestamp;

      return {
        actionId: params?.actionDef?.id || 'test',
        targetId: params?.targetId || null,
        error: params?.error || new Error('Test error'),
        actionDefinition: params?.actionDef || {},
        actorSnapshot: params?.actorSnapshot || {},
        evaluationTrace: {
          steps: [],
          failurePoint: 'Unknown',
          finalContext: {},
        },
        suggestedFixes: [],
        environmentContext: params?.additionalContext || {},
        timestamp: timestamp,
        phase: params?.phase || 'resolution',
      };
    }),
  };
};

/**
 * Creates a mock target resolution service with actionErrorContextBuilder dependency.
 *
 * @description Creates a mock TargetResolutionService that includes the actionErrorContextBuilder and returns ActionResult.
 * @param {object} [options] - Optional configuration
 * @param {number} [options.fixedTimestamp] - Fixed timestamp to use for error contexts
 * @returns {{ resolveTargets: jest.Mock, actionErrorContextBuilder: object }} Mock target resolution service
 */
export const createMockTargetResolutionServiceWithErrorContext = (
  options = {}
) => {
  const mockActionErrorContextBuilder =
    createMockActionErrorContextBuilder(options);

  return {
    resolveTargets: jest.fn(() => ActionResult.success([])),
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

/**
 * Creates a mock TargetRequiredComponentsValidator with a `validateTargetRequirements` method.
 *
 * @description Returns a mock validator that checks if target entities have required components.
 * By default, returns valid:true to not break existing tests. Can be configured for specific test needs.
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.valid] - Default validation result
 * @param {string[]} [options.missingComponents] - Default missing components
 * @returns {{ validateTargetRequirements: jest.Mock }} Mock validator instance
 */
export const createMockTargetRequiredComponentsValidator = (options = {}) => {
  const { valid = true, missingComponents = [] } = options;

  return {
    validateTargetRequirements: jest
      .fn()
      .mockReturnValue({ valid, missingComponents }),
  };
};
