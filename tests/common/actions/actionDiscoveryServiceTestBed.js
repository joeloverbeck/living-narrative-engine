/**
 * @file Provides a minimal test bed for ActionDiscoveryService with mocked dependencies.
 */

import { jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import {
  createMockLogger,
  createMockEntityManager,
  createMockPrerequisiteEvaluationService,
  createMockActionIndex,
  createMockTargetResolutionService,
  createMockSafeEventDispatcher,
  createMockActionCommandFormatter,
} from '../mockFactories';
import { createMockUnifiedScopeResolver } from '../mocks/mockUnifiedScopeResolver.js';
import { createMockTargetContextBuilder } from '../mocks/mockTargetContextBuilder.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../src/actions/errors/fixSuggestionEngine.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { createServiceFactoryMixin } from '../serviceFactoryTestBedMixin.js';
import { createTestBedHelpers } from '../createTestBedHelpers.js';
import FactoryTestBed from '../factoryTestBed.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';

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
    const traceContextFactory = () => new TraceContext();

    // Helper function to create proper actor snapshot
    const createActorSnapshot = (actorId) => {
      try {
        const actorEntity = mocks.entityManager.getEntity(actorId);
        const components = mocks.entityManager.getAllComponents(actorId);
        const locationComponent = components['core:location'];
        const location = locationComponent?.value || 'none';

        return {
          id: actorId,
          components,
          location,
          metadata: {
            entityType: actorEntity.type || 'unknown',
            capturedAt: Date.now(),
          },
        };
      } catch (err) {
        return {
          id: actorId,
          components: {},
          location: 'unknown',
          metadata: {
            error: 'Failed to capture snapshot',
            capturedAt: Date.now(),
          },
        };
      }
    };

    // Create a mock ActionPipelineOrchestrator that mimics the old behavior for test compatibility
    const actionPipelineOrchestrator = overrides.actionPipelineOrchestrator ?? {
      discoverActions: jest
        .fn()
        .mockImplementation(async (actor, context, options = {}) => {
          const { trace } = options;
          const actions = [];
          const errors = [];

          try {
            // Get candidate actions from the action index
            const candidateActions = mocks.actionIndex.getCandidateActions(
              actor,
              context
            );

            for (const actionDef of candidateActions) {
              try {
                // Check prerequisites - skip if action has no prerequisites (matching production behavior)
                if (
                  !actionDef.prerequisites ||
                  actionDef.prerequisites.length === 0
                ) {
                  // Action has no prerequisites, so it automatically passes
                  // This matches the behavior in PrerequisiteEvaluationStage
                } else {
                  let passesPrerequisites;
                  try {
                    passesPrerequisites =
                      mocks.prerequisiteEvaluationService.evaluate(
                        context,
                        actionDef
                      );
                  } catch (prereqError) {
                    // If prerequisite evaluation throws, add to errors
                    errors.push({
                      actionId: actionDef.id,
                      targetId: null,
                      error: prereqError,
                      phase: ERROR_PHASES.DISCOVERY,
                      timestamp: Date.now(),
                      actorSnapshot: createActorSnapshot(actor.id),
                      environmentContext: {
                        errorName: prereqError.name,
                        phase: ERROR_PHASES.DISCOVERY,
                      },
                      evaluationTrace: {
                        steps: [],
                        finalContext: {},
                        failurePoint: 'Unknown',
                      },
                      suggestedFixes: [],
                    });
                    // Log the error as expected by test
                    mocks.logger.error(
                      `Error evaluating prerequisites for action '${actionDef.id}':`,
                      prereqError
                    );
                    continue;
                  }

                  if (!passesPrerequisites) {
                    continue;
                  }
                }

                // Resolve targets - handle both legacy 'scope' and new 'targets' format
                const scopeValue =
                  actionDef.scope ||
                  (typeof actionDef.targets === 'string'
                    ? actionDef.targets
                    : null);

                const targetResult =
                  mocks.targetResolutionService.resolveTargets(
                    scopeValue,
                    actor,
                    context,
                    trace,
                    actionDef.id
                  );

                if (!targetResult.success) {
                  continue;
                }

                // For each resolved target, try to format the command
                for (const target of targetResult.value) {
                  try {
                    const formatResult = mocks.actionCommandFormatter.format(
                      actionDef,
                      target,
                      context
                    );

                    if (formatResult.ok) {
                      actions.push({
                        id: actionDef.id,
                        name: actionDef.name,
                        command: formatResult.value,
                        description: actionDef.description || '',
                        // Include params as expected by tests
                        params: target.entityId
                          ? { targetId: target.entityId }
                          : {},
                      });
                    } else {
                      // Log formatting errors as the real pipeline would
                      mocks.logger.warn(
                        `Failed to format command for action '${actionDef.id}' with target '${target.entityId}'`,
                        {
                          actionDef,
                          formatResult,
                          targetContext: target,
                        }
                      );

                      errors.push({
                        actionId: actionDef.id,
                        targetId: target.entityId,
                        error: formatResult.error,
                      });
                    }
                  } catch (formatError) {
                    // Handle exceptions thrown during formatting
                    const targetId =
                      formatError.target?.entityId ||
                      formatError.entityId ||
                      target.entityId;

                    errors.push({
                      actionId: actionDef.id,
                      targetId: targetId,
                      error: formatError,
                      phase: ERROR_PHASES.DISCOVERY,
                      timestamp: Date.now(),
                      actorSnapshot: createActorSnapshot(actor.id),
                      environmentContext: {
                        errorName: formatError.name,
                        phase: ERROR_PHASES.DISCOVERY,
                      },
                      evaluationTrace: {
                        steps: [],
                        finalContext: {},
                        failurePoint: 'Unknown',
                      },
                      suggestedFixes: [],
                    });
                  }
                }
              } catch (actionError) {
                // Handle errors from action processing
                errors.push({
                  actionId: actionDef.id,
                  targetId: null,
                  error: actionError,
                  phase: ERROR_PHASES.DISCOVERY,
                  timestamp: Date.now(),
                  // Add context properties that tests expect
                  actorSnapshot: createActorSnapshot(actor.id),
                  environmentContext: {
                    errorName: actionError.name,
                    phase: ERROR_PHASES.DISCOVERY,
                  },
                  evaluationTrace: {
                    steps: [],
                    finalContext: {},
                    failurePoint: 'Unknown',
                  },
                  suggestedFixes: [],
                });
              }
            }
          } catch (candidateError) {
            // Handle errors from candidate retrieval
            mocks.logger.error(
              'Error retrieving candidate actions',
              candidateError
            );
            errors.push({
              actionId: 'candidateRetrieval',
              targetId: null,
              error: candidateError,
              phase: ERROR_PHASES.DISCOVERY,
              timestamp: Date.now(),
              actorSnapshot: createActorSnapshot(actor.id),
              environmentContext: {
                errorName: candidateError.name,
                phase: ERROR_PHASES.DISCOVERY,
              },
              evaluationTrace: {
                steps: [],
                finalContext: {},
                failurePoint: 'Unknown',
              },
              suggestedFixes: [],
            });
          }

          return { actions, errors, trace };
        }),
    };

    return new ActionDiscoveryService({
      entityManager: mocks.entityManager,
      logger: mocks.logger,
      actionPipelineOrchestrator,
      traceContextFactory: overrides.traceContextFactory ?? traceContextFactory,
      actionAwareTraceFactory: overrides.actionAwareTraceFactory ?? null,
      actionTraceFilter: overrides.actionTraceFilter ?? null,
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
) {
  #lastCreatedTraceType = 'Unknown';
  #currentService = null;
  #capturedLogs = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  /**
   * Create discovery service with action tracing support
   * 
   * @param {object} options - Configuration options
   * @returns {ActionDiscoveryService} Configured discovery service
   */
  createDiscoveryServiceWithTracing(options = {}) {
    const {
      actionTracingEnabled = false,
      tracedActions = ['*'],
      verbosity = 'standard',
      hasActionAwareTraceFactory = true,
      hasActionTraceFilter = true,
      actionAwareTraceFactoryFailure = false,
      actionTraceFilterFailure = null,
      traceContextFactoryFailure = false,
    } = options;

    // Reset captured logs
    this.#capturedLogs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };

    // Create mock logger that captures logs
    const mockLogger = {
      debug: jest.fn((msg, ...args) => {
        this.#capturedLogs.debug.push(msg);
      }),
      info: jest.fn((msg, ...args) => {
        this.#capturedLogs.info.push(msg);
      }),
      warn: jest.fn((msg, ...args) => {
        this.#capturedLogs.warn.push(msg);
      }),
      error: jest.fn((msg, ...args) => {
        this.#capturedLogs.error.push(msg);
      }),
    };

    // Create optional action tracing mocks
    const mockActionAwareTraceFactory = hasActionAwareTraceFactory
      ? this.#createMockActionAwareTraceFactory(actionAwareTraceFactoryFailure)
      : null;

    const mockActionTraceFilter = hasActionTraceFilter
      ? this.#createMockActionTraceFilter({
          enabled: actionTracingEnabled,
          tracedActions,
          verbosity,
          failure: actionTraceFilterFailure,
        })
      : null;

    // Create trace context factory
    const traceContextFactory = traceContextFactoryFailure
      ? () => { throw new Error('TraceContextFactory failed'); }
      : () => {
          this.#lastCreatedTraceType = 'StructuredTrace';
          return {
            info: jest.fn(),
            step: jest.fn(),
            withSpanAsync: jest.fn().mockImplementation(async (name, fn) => fn()),
          };
        };

    // Directly create the service using the mocks from the parent class
    const parentMocks = this.mocks;
    
    // Create the ActionDiscoveryService directly with our custom dependencies
    const service = new ActionDiscoveryService({
      entityManager: parentMocks.entityManager,
      logger: mockLogger,
      actionPipelineOrchestrator: parentMocks.actionPipelineOrchestrator || 
        this.#createMockActionPipelineOrchestrator(),
      traceContextFactory,
      actionAwareTraceFactory: mockActionAwareTraceFactory,
      actionTraceFilter: mockActionTraceFilter,
      getActorLocationFn: parentMocks.getActorLocationFn,
    });
    
    // Store reference so we can track state
    this.#currentService = service;
    
    return service;
  }

  /**
   * Create a standard discovery service without tracing
   */
  createStandardDiscoveryService() {
    // Use the same parent mocks to ensure consistency
    const parentMocks = this.mocks;
    
    return new ActionDiscoveryService({
      entityManager: parentMocks.entityManager,
      logger: parentMocks.logger,
      actionPipelineOrchestrator: parentMocks.actionPipelineOrchestrator || 
        this.#createMockActionPipelineOrchestrator(),
      traceContextFactory: () => ({
        info: jest.fn(),
        step: jest.fn(),
        withSpanAsync: jest.fn().mockImplementation(async (name, fn) => fn()),
      }),
      getActorLocationFn: parentMocks.getActorLocationFn,
    });
  }

  /**
   * Create a mock actor for testing
   *
   * @param actorId
   */
  createMockActor(actorId) {
    return {
      id: actorId,
      components: {},
    };
  }

  /**
   * Create a mock context for testing
   */
  createMockContext() {
    return {
      currentLocation: 'test-location',
    };
  }

  #createMockActionAwareTraceFactory(shouldFail = false) {
    return jest.fn().mockImplementation((options) => {
      if (shouldFail) {
        throw new Error('ActionAwareTraceFactory creation failed');
      }

      this.#lastCreatedTraceType = 'ActionAwareStructuredTrace';

      return {
        captureActionData: jest.fn(),
        getTracedActions: jest.fn().mockReturnValue(new Map()),
        getTracingSummary: jest.fn().mockReturnValue({
          tracedActionCount: 0,
          totalStagesTracked: 0,
          sessionDuration: 0,
        }),
        step: jest.fn(),
        info: jest.fn(),
        withSpanAsync: jest
          .fn()
          .mockImplementation(async (name, fn) => fn()),
      };
    });
  }

  #createMockActionPipelineOrchestrator() {
    return {
      discoverActions: jest.fn().mockImplementation(async (actor, context, options) => {
        return {
          actions: [
            { id: 'core:go', name: 'Go' },
            { id: 'core:look', name: 'Look' },
          ],
          errors: [],
        };
      }),
    };
  }

  #createMockActionTraceFilter(config = {}) {
    const {
      enabled = false,
      tracedActions = [],
      verbosity = 'standard',
      failure = null,
    } = config;

    return {
      isEnabled: jest.fn().mockImplementation(() => {
        if (failure === 'isEnabled') {
          throw new Error('ActionTraceFilter.isEnabled() failed');
        }
        return enabled;
      }),
      shouldTrace: jest.fn().mockImplementation((actionId) => {
        if (tracedActions.includes('*')) return true;
        return tracedActions.includes(actionId);
      }),
      getVerbosityLevel: jest.fn().mockReturnValue(verbosity),
      getInclusionConfig: jest.fn().mockReturnValue({
        componentData: true,
        prerequisites: true,
        targets: true,
      }),
    };
  }

  getCreatedTraceType() {
    return this.#lastCreatedTraceType;
  }

  getDebugLogs() {
    return this.#capturedLogs.debug;
  }

  getInfoLogs() {
    return this.#capturedLogs.info;
  }

  getWarningLogs() {
    return this.#capturedLogs.warn;
  }

  getErrorLogs() {
    return this.#capturedLogs.error;
  }

  cleanup() {
    super.cleanup();
    this.#lastCreatedTraceType = 'Unknown';
    this.#capturedLogs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }
}
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
