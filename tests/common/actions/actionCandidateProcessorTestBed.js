/**
 * @file Provides a minimal test bed for ActionCandidateProcessor with mocked dependencies.
 */

import { jest } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import {
  createMockLogger,
  createMockEntityManager,
  createMockPrerequisiteEvaluationService,
  createMockTargetResolutionService,
  createMockSafeEventDispatcher,
  createMockActionCommandFormatter,
} from '../mockFactories';
import { createServiceFactoryMixin } from '../serviceFactoryTestBedMixin.js';
import { createTestBedHelpers } from '../createTestBedHelpers.js';
import FactoryTestBed from '../factoryTestBed.js';

const ServiceFactoryMixin = createServiceFactoryMixin(
  {
    logger: createMockLogger,
    entityManager: createMockEntityManager,
    prerequisiteEvaluationService: createMockPrerequisiteEvaluationService,
    targetResolutionService: createMockTargetResolutionService,
    safeEventDispatcher: createMockSafeEventDispatcher,
    actionCommandFormatter: createMockActionCommandFormatter,
    getEntityDisplayNameFn: () => jest.fn(),
  },
  (mocks, overrides = {}) =>
    new ActionCandidateProcessor({
      prerequisiteEvaluationService: mocks.prerequisiteEvaluationService,
      targetResolutionService: mocks.targetResolutionService,
      entityManager: mocks.entityManager,
      actionCommandFormatter: mocks.actionCommandFormatter,
      safeEventDispatcher: mocks.safeEventDispatcher,
      getEntityDisplayNameFn: mocks.getEntityDisplayNameFn,
      logger: mocks.logger,
    }),
  'service'
);

/**
 * @class
 * @description Instantiates ActionCandidateProcessor using default mock dependencies.
 */
export class ActionCandidateProcessorTestBed extends ServiceFactoryMixin(
  FactoryTestBed
) {}

/**
 * Defines a test suite with automatic {@link ActionCandidateProcessorTestBed} setup.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(bed: ActionCandidateProcessorTestBed) => void} suiteFn - Callback containing the tests.
 * @param overrides
 * @returns {void}
 */
export const {
  createBed: createActionCandidateProcessorBed,
  describeSuite: describeActionCandidateProcessorSuite,
} = createTestBedHelpers(ActionCandidateProcessorTestBed);

export default ActionCandidateProcessorTestBed;
