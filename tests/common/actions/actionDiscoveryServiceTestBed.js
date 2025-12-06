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
import { ModEntityBuilder } from '../mods/ModEntityBuilder.js';
import SimpleEntityManager from '../entities/simpleEntityManager.js';

const ServiceFactoryMixin = createServiceFactoryMixin(
  {
    logger: createMockLogger,
    entityManager: createMockEntityManager,
    prerequisiteEvaluationService: () => {
      const mock = createMockPrerequisiteEvaluationService();
      // Configure to pass prerequisites by default
      mock.evaluate = jest.fn().mockReturnValue(true);
      return mock;
    },
    actionIndex: () => {
      const mock = createMockActionIndex();
      // Configure default behavior to return sample action definitions
      mock.getCandidateActions = jest.fn().mockReturnValue([
        {
          id: 'movement:go',
          name: 'Go',
          scope: 'actor.location.exits[]',
          prerequisites: [],
          template: 'Go {target}',
        },
        {
          id: 'core:look',
          name: 'Look',
          scope: 'self',
          prerequisites: [],
          template: 'Look around',
        },
        {
          id: 'core:take',
          name: 'Take',
          scope: 'actor.location.items[]',
          prerequisites: [],
          template: 'Take {target}',
        },
      ]);
      return mock;
    },
    targetResolutionService: () => {
      const mock = createMockTargetResolutionService();
      // Configure to return successful resolution with mock targets
      mock.resolveTargets = jest.fn().mockReturnValue({
        success: true,
        value: [
          {
            entityId: 'target-1',
            displayName: 'Target 1',
            components: {},
          },
        ],
      });
      return mock;
    },
    safeEventDispatcher: createMockSafeEventDispatcher,
    actionCommandFormatter: () => {
      const mock = createMockActionCommandFormatter();
      // Configure default behavior to successfully format commands
      mock.format = jest.fn().mockReturnValue({
        ok: true,
        value: 'Formatted command',
      });
      return mock;
    },
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
      } catch (_err) {
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

    // Store the orchestrator in mocks so createStandardDiscoveryService can access it
    mocks.actionPipelineOrchestrator = actionPipelineOrchestrator;

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
      debug: jest.fn((msg, ..._args) => {
        this.#capturedLogs.debug.push(msg);
      }),
      info: jest.fn((msg, ..._args) => {
        this.#capturedLogs.info.push(msg);
      }),
      warn: jest.fn((msg, ..._args) => {
        this.#capturedLogs.warn.push(msg);
      }),
      error: jest.fn((msg, ..._args) => {
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
      ? () => {
          throw new Error('TraceContextFactory failed');
        }
      : () => {
          this.#lastCreatedTraceType = 'StructuredTrace';
          return {
            info: jest.fn(),
            step: jest.fn(),
            withSpanAsync: jest
              .fn()
              .mockImplementation(async (name, fn) => fn()),
          };
        };

    // Directly create the service using the mocks from the parent class
    const parentMocks = this.mocks;

    // Create the ActionDiscoveryService directly with our custom dependencies
    const service = new ActionDiscoveryService({
      entityManager: parentMocks.entityManager,
      logger: mockLogger,
      actionPipelineOrchestrator:
        parentMocks.actionPipelineOrchestrator ||
        this.#createMockActionPipelineOrchestrator(),
      traceContextFactory,
      actionAwareTraceFactory: mockActionAwareTraceFactory,
      actionTraceFilter: mockActionTraceFilter,
      getActorLocationFn: parentMocks.getActorLocationFn,
    });

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
      actionPipelineOrchestrator:
        parentMocks.actionPipelineOrchestrator ||
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
    return jest.fn().mockImplementation((_options) => {
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
        withSpanAsync: jest.fn().mockImplementation(async (name, fn) => fn()),
      };
    });
  }

  #createMockActionPipelineOrchestrator() {
    return {
      discoverActions: jest
        .fn()
        .mockImplementation(async (actor, context, options) => {
          return {
            actions: [
              { id: 'movement:go', name: 'Go' },
              { id: 'core:look', name: 'Look' },
            ],
            errors: [],
            trace: options?.trace ? {} : undefined, // Return trace if requested
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

  /**
   * Create actor with automatic entity structure validation.
   *
   * @param {string} actorId - Actor entity ID
   * @param {object} options - Actor configuration
   * @param {object} [options.components] - Custom components to add
   * @param {string} [options.location] - Location ID for the actor
   * @returns {object} Validated actor entity
   */
  createActorWithValidation(
    actorId,
    { components = {}, location = 'test-location' } = {}
  ) {
    // Use ModEntityBuilder for creation
    const builder = new ModEntityBuilder(actorId).asActor();

    // Add location if specified
    if (location) {
      builder.atLocation(location).withLocationComponent(location);
    }

    // Add components
    for (const [componentId, data] of Object.entries(components)) {
      builder.withComponent(componentId, data);
    }

    // Build and validate (uses enhanced validation from INTTESDEB-001)
    const entity = builder.validate().build();

    // Add to entity manager
    // Note: Requires SimpleEntityManager for integration tests (has addEntity method)
    this.mocks.entityManager.addEntity(entity);

    return entity;
  }

  /**
   * Establish closeness relationship with validation.
   *
   * @param {object|string} actor - Actor entity or ID
   * @param {object|string} target - Target entity or ID
   */
  establishClosenessWithValidation(actor, target) {
    const actorId = typeof actor === 'string' ? actor : actor.id;
    const targetId = typeof target === 'string' ? target : target.id;

    // Validate entities exist
    // Note: SimpleEntityManager uses getEntityInstance(), mock uses getEntity()
    const getEntityFn =
      this.mocks.entityManager.getEntityInstance ||
      this.mocks.entityManager.getEntity;
    const actorEntity = getEntityFn.call(this.mocks.entityManager, actorId);
    const targetEntity = getEntityFn.call(this.mocks.entityManager, targetId);

    if (!actorEntity) {
      throw new Error(
        `Cannot establish closeness: Actor '${actorId}' not found in entity manager`
      );
    }
    if (!targetEntity) {
      throw new Error(
        `Cannot establish closeness: Target '${targetId}' not found in entity manager`
      );
    }

    // Get or create closeness components
    const actorCloseness = actorEntity.components['positioning:closeness'] || {
      partners: [],
    };
    const targetCloseness = targetEntity.components[
      'positioning:closeness'
    ] || { partners: [] };

    // Add bidirectional relationship
    if (!actorCloseness.partners.includes(targetId)) {
      actorCloseness.partners.push(targetId);
    }
    if (!targetCloseness.partners.includes(actorId)) {
      targetCloseness.partners.push(actorId);
    }

    // Update entities
    // Note: Requires SimpleEntityManager for integration tests (has addComponent method)
    this.mocks.entityManager.addComponent(
      actorId,
      'positioning:closeness',
      actorCloseness
    );
    this.mocks.entityManager.addComponent(
      targetId,
      'positioning:closeness',
      targetCloseness
    );
  }

  /**
   * Discover actions with detailed diagnostics
   *
   * @param {object|string} actor - Actor entity or ID
   * @param {object} options - Discovery options
   * @param {boolean} [options.includeDiagnostics] - Include trace diagnostics
   * @param {boolean} [options.traceScopeResolution] - Use traced scope resolver
   * @returns {Promise<object>} Result with actions and optional diagnostics
   * @example
   * // Basic discovery
   * const result = await testBed.discoverActionsWithDiagnostics(actor);
   * expect(result.actions).toHaveLength(3);
   * @example
   * // With diagnostics
   * const result = await testBed.discoverActionsWithDiagnostics(actor, {
   *   includeDiagnostics: true,
   * });
   * console.log(result.diagnostics.scopeEvaluations);
   * @example
   * // With scope tracing
   * const result = await testBed.discoverActionsWithDiagnostics(actor, {
   *   includeDiagnostics: true,
   *   traceScopeResolution: true,
   * });
   * console.log(testBed.formatDiagnosticSummary(result.diagnostics));
   */
  async discoverActionsWithDiagnostics(
    actor,
    { includeDiagnostics = false, traceScopeResolution = false } = {}
  ) {
    const actorId = typeof actor === 'string' ? actor : actor.id;
    // Note: SimpleEntityManager uses getEntityInstance(), mock uses getEntity()
    const getEntityFn =
      this.mocks.entityManager.getEntityInstance ||
      this.mocks.entityManager.getEntity;
    const actorEntity = getEntityFn.call(this.mocks.entityManager, actorId);

    if (!actorEntity) {
      throw new Error(`Cannot discover actions: Actor '${actorId}' not found`);
    }

    // Create trace context if diagnostics requested
    const traceContext = includeDiagnostics ? new TraceContext() : null;

    // Optionally use traced scope resolver
    if (traceScopeResolution && traceContext && this.mocks.scopeResolver) {
      const { createTracedScopeResolver } = await import(
        '../scopeDsl/scopeTracingHelpers.js'
      );
      this.mocks.scopeResolver = createTracedScopeResolver(
        this.mocks.scopeResolver,
        traceContext
      );
    }

    // Call service - ActionDiscoveryService uses getValidActions method
    const service = this.service || this.createStandardDiscoveryService();
    const result = await service.getValidActions(
      actorEntity,
      {},
      {
        trace: traceContext,
      }
    );

    if (includeDiagnostics) {
      return {
        actions: result.actions || result,
        diagnostics: {
          logs: traceContext.logs,
          operatorEvaluations: traceContext.getOperatorEvaluations(),
          scopeEvaluations: traceContext.getScopeEvaluations(), // Method exists (validated)
        },
      };
    }

    return { actions: result.actions || result };
  }

  /**
   * Format diagnostic output into readable summary
   *
   * @param {object} diagnostics - Diagnostics from discoverActionsWithDiagnostics
   * @returns {string} Formatted diagnostic summary
   * @example
   * const result = await testBed.discoverActionsWithDiagnostics(actor, {
   *   includeDiagnostics: true,
   * });
   * console.log(testBed.formatDiagnosticSummary(result.diagnostics));
   */
  formatDiagnosticSummary(diagnostics) {
    const lines = ['', '=== Action Discovery Diagnostics ===', ''];

    // Trace logs summary
    lines.push(`Trace Logs: ${diagnostics.logs.length} entries`);
    const errorLogs = diagnostics.logs.filter((log) => log.type === 'error');
    if (errorLogs.length > 0) {
      lines.push(`  Errors: ${errorLogs.length}`);
      errorLogs.forEach((log) => {
        lines.push(`    - ${log.message}`);
      });
    }
    lines.push('');

    // Operator evaluations summary
    const opEvals = diagnostics.operatorEvaluations || [];
    lines.push(`Operator Evaluations: ${opEvals.length}`);
    if (opEvals.length > 0) {
      opEvals.forEach((op) => {
        lines.push(`  - ${op.operator}: ${op.success ? '✅' : '❌'}`);
      });
    }
    lines.push('');

    // Scope evaluations summary
    const scopeEvals = diagnostics.scopeEvaluations || [];
    lines.push(`Scope Evaluations: ${scopeEvals.length}`);
    if (scopeEvals.length > 0) {
      scopeEvals.forEach((scope) => {
        const resolved = scope.resolvedEntities?.length || 0;
        const candidates = scope.candidateEntities?.length || 0;
        const filtered = candidates - resolved;

        lines.push(`  - ${scope.scopeId}:`);
        lines.push(`      Candidates: ${candidates}`);
        lines.push(`      Resolved: ${resolved}`);
        if (filtered > 0) {
          lines.push(`      Filtered: ${filtered}`);
        }
      });
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Create a complete actor-target scenario for testing.
   *
   * @param {object} options - Scenario configuration
   * @param {string} [options.actorId] - Actor entity ID
   * @param {string} [options.targetId] - Target entity ID
   * @param {string} [options.location] - Location ID for both entities
   * @param {boolean} [options.closeProximity] - Whether to establish closeness
   * @param {object} [options.actorComponents] - Custom components for actor
   * @param {object} [options.targetComponents] - Custom components for target
   * @returns {object} Actor and target entities
   */
  createActorTargetScenario({
    actorId = 'actor1',
    targetId = 'target1',
    location = 'test-location',
    closeProximity = true,
    actorComponents = {},
    targetComponents = {},
  } = {}) {
    const actor = this.createActorWithValidation(actorId, {
      components: actorComponents,
      location,
    });

    const target = this.createActorWithValidation(targetId, {
      components: targetComponents,
      location,
    });

    if (closeProximity) {
      this.establishClosenessWithValidation(actor, target);

      // Re-fetch entities after closeness establishment to get updated components
      const getEntityFn =
        this.mocks.entityManager.getEntityInstance ||
        this.mocks.entityManager.getEntity;
      return {
        actor: getEntityFn.call(this.mocks.entityManager, actorId),
        target: getEntityFn.call(this.mocks.entityManager, targetId),
      };
    }

    return { actor, target };
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
