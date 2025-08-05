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
