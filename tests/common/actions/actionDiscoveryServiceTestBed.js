/**
 * @file Provides a minimal test bed for ActionDiscoveryService with mocked dependencies.
 */

import { jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
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
  (mocks, overrides = {}) =>
    new ActionDiscoveryService({
      entityManager: mocks.entityManager,
      prerequisiteEvaluationService: mocks.prerequisiteEvaluationService,
      actionIndex: mocks.actionIndex,
      logger: mocks.logger,
      formatActionCommandFn: mocks.formatActionCommandFn,
      safeEventDispatcher: mocks.safeEventDispatcher,
      targetResolutionService: mocks.targetResolutionService,
      traceContextFactory:
        overrides.traceContextFactory ??
        jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      getActorLocationFn: mocks.getActorLocationFn,
      getEntityDisplayNameFn: mocks.getEntityDisplayNameFn,
    }),
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
