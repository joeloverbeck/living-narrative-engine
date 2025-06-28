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
  createMockFormatActionCommandFn,
} from '../mockFactories';
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
    formatActionCommandFn: createMockFormatActionCommandFn,
    getActorLocationFn: () => jest.fn(),
    getEntityDisplayNameFn: () => jest.fn(),
  },
  (mocks, overrides = {}) => {
    // Create the ActionCandidateProcessor with the mocked dependencies
    const actionCandidateProcessor =
      overrides.actionCandidateProcessor ??
      new ActionCandidateProcessor({
        prerequisiteEvaluationService: mocks.prerequisiteEvaluationService,
        targetResolutionService: mocks.targetResolutionService,
        entityManager: mocks.entityManager,
        formatActionCommandFn: mocks.formatActionCommandFn,
        safeEventDispatcher: mocks.safeEventDispatcher,
        getEntityDisplayNameFn: mocks.getEntityDisplayNameFn,
        logger: mocks.logger,
      });

    return new ActionDiscoveryService({
      entityManager: mocks.entityManager,
      actionIndex: mocks.actionIndex,
      logger: mocks.logger,
      actionCandidateProcessor,
      traceContextFactory:
        overrides.traceContextFactory ??
        jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      getActorLocationFn: mocks.getActorLocationFn,
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
