/**
 * @file Provides a minimal test bed for ActionDiscoveryService with mocked dependencies.
 */

import { jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import {
  createMockLogger,
  createMockEntityManager,
  createMockPrerequisiteEvaluationService,
  createMockActionIndex,
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
    actionIndex: createMockActionIndex,
    targetResolutionService: createMockTargetResolutionService,
    safeEventDispatcher: createMockSafeEventDispatcher,
    actionCommandFormatter: createMockActionCommandFormatter,
    getActorLocationFn: () => jest.fn(),
    getEntityDisplayNameFn: () => jest.fn(),
    gameDataRepository: () => ({
      getComponentDefinition: jest.fn(),
      getConditionDefinition: jest.fn(),
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

    // Create the ActionCandidateProcessor with the mocked dependencies
    const actionCandidateProcessor =
      overrides.actionCandidateProcessor ??
      new ActionCandidateProcessor({
        prerequisiteEvaluationService: mocks.prerequisiteEvaluationService,
        targetResolutionService: mocks.targetResolutionService,
        entityManager: mocks.entityManager,
        actionCommandFormatter: mocks.actionCommandFormatter,
        safeEventDispatcher: mocks.safeEventDispatcher,
        getEntityDisplayNameFn: mocks.getEntityDisplayNameFn,
        logger: mocks.logger,
        actionErrorContextBuilder: actionErrorContextBuilder,
        traceContextFactory: traceContextFactory,
      });

    return new ActionDiscoveryService({
      entityManager: mocks.entityManager,
      actionIndex: mocks.actionIndex,
      logger: mocks.logger,
      actionCandidateProcessor,
      traceContextFactory: overrides.traceContextFactory ?? traceContextFactory,
      getActorLocationFn: mocks.getActorLocationFn,
      actionErrorContextBuilder: actionErrorContextBuilder,
    });
  },
  'service'
);

/**
 * @class
 * @description Instantiates ActionDiscoveryService using default mock dependencies.
 */
export class ActionDiscoveryServiceTestBed extends ServiceFactoryMixin(
  FactoryTestBed
) {}
/**
 * Defines a test suite with automatic {@link ActionDiscoveryServiceTestBed} setup.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(bed: ActionDiscoveryServiceTestBed) => void} suiteFn - Callback containing the tests.
 * @param overrides
 * @returns {void}
 */
export const {
  createBed: createActionDiscoveryBed,
  describeSuite: describeActionDiscoverySuite,
} = createTestBedHelpers(ActionDiscoveryServiceTestBed);

export default ActionDiscoveryServiceTestBed;
