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
  createMockActionErrorContextBuilder,
} from '../mockFactories';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
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
    actionErrorContextBuilder: createMockActionErrorContextBuilder,
    getEntityDisplayNameFn: () => jest.fn(),
    gameDataRepository: () => ({
      getComponentDefinition: jest.fn(),
      getConditionDefinition: jest.fn(),
    }),
    actionIndex: () => ({
      getCandidateActions: jest.fn(),
    }),
  },
  (mocks, overrides = {}) => {
    const traceContextFactory = () => new TraceContext();

    return new ActionCandidateProcessor({
      prerequisiteEvaluationService: mocks.prerequisiteEvaluationService,
      targetResolutionService: mocks.targetResolutionService,
      entityManager: mocks.entityManager,
      actionCommandFormatter: mocks.actionCommandFormatter,
      safeEventDispatcher: mocks.safeEventDispatcher,
      getEntityDisplayNameFn: mocks.getEntityDisplayNameFn,
      logger: mocks.logger,
      actionErrorContextBuilder: mocks.actionErrorContextBuilder,
      traceContextFactory: traceContextFactory,
      ...overrides,
    });
  },
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
