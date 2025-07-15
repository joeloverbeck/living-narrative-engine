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
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../src/actions/errors/fixSuggestionEngine.js';
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
    // Create real error context dependencies
    const fixSuggestionEngine = new FixSuggestionEngine({
      logger: mocks.logger,
      gameDataRepository: mocks.gameDataRepository,
      actionIndex: mocks.actionIndex,
    });

    const actionErrorContextBuilder = new ActionErrorContextBuilder({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
      fixSuggestionEngine: fixSuggestionEngine,
    });

    const traceContextFactory = () => new TraceContext();

    return new ActionCandidateProcessor({
      prerequisiteEvaluationService: mocks.prerequisiteEvaluationService,
      targetResolutionService: mocks.targetResolutionService,
      entityManager: mocks.entityManager,
      actionCommandFormatter: mocks.actionCommandFormatter,
      safeEventDispatcher: mocks.safeEventDispatcher,
      getEntityDisplayNameFn: mocks.getEntityDisplayNameFn,
      logger: mocks.logger,
      actionErrorContextBuilder: actionErrorContextBuilder,
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
