/**
 * @file Additional integration coverage for MultiTargetResolutionStage focusing on
 * action-aware tracing interactions and failure handling across legacy and multi-target workflows.
 */

import {
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';
import {
  createMultiTargetResolutionStage,
  createTestContextFromAction,
  createTestLegacyAction,
} from '../../../../common/actions/multiTargetStageTestUtilities.js';
import { EntityManagerTestBed } from '../../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../../src/entities/entityDefinition.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';

/**
 * @class TestLogger
 * @description In-memory logger for capturing diagnostic output in integration tests.
 */
class TestLogger {
  /**
   * @description Creates a new TestLogger instance.
   * @param {object} [options] - Logger configuration options.
   * @param {boolean} [options.throwOnSummary=false] - Whether to throw when the summary log is emitted.
   */
  constructor({ throwOnSummary = false } = {}) {
    this.throwOnSummary = throwOnSummary;
    this.logs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  /**
   * @description Records debug messages for later assertions.
   * @param {string} message - Message passed to the logger.
   * @param {object} [payload] - Optional structured payload.
   * @returns {void}
   */
  debug(message, payload) {
    if (this.throwOnSummary && typeof message === 'string') {
      if (message.includes('post-resolution summary')) {
        throw new Error('summary logging unavailable');
      }
    }
    this.logs.debug.push({ message, payload });
  }

  /**
   * @description Records info level log entries.
   * @param {string} message - Log message.
   * @param {object} [payload] - Optional payload associated with the log entry.
   * @returns {void}
   */
  info(message, payload) {
    this.logs.info.push({ message, payload });
  }

  /**
   * @description Records warnings emitted by the stage under test.
   * @param {string} message - Warning message.
   * @param {Error|object} [details] - Additional warning context.
   * @returns {void}
   */
  warn(message, details) {
    this.logs.warn.push({ message, details });
  }

  /**
   * @description Records error level log entries.
   * @param {string} message - Error message.
   * @param {Error|object} [details] - Additional error payload.
   * @returns {void}
   */
  error(message, details) {
    this.logs.error.push({ message, details });
  }
}

/**
 * @class RecordingTrace
 * @description Structured trace stub that captures rich instrumentation while optionally
 * simulating downstream failures for coverage of defensive code paths.
 */
class RecordingTrace {
  /**
   * @description Creates a new RecordingTrace instance.
   * @param {object} [options] - Trace configuration.
   * @param {boolean} [options.failMultiTargetCapture=false] - Whether to throw during multi-target capture.
   * @param {boolean} [options.failPerformanceCapture=false] - Whether to reject during performance capture.
   * @param {boolean} [options.failErrorCapture=false] - Whether to throw during error capture.
   */
  constructor({
    failMultiTargetCapture = false,
    failPerformanceCapture = false,
    failErrorCapture = false,
  } = {}) {
    this.failMultiTargetCapture = failMultiTargetCapture;
    this.failPerformanceCapture = failPerformanceCapture;
    this.failErrorCapture = failErrorCapture;
    this.steps = [];
    this.infos = [];
    this.failures = [];
    this.legacyDetections = [];
    this.legacyConversions = [];
    this.actionData = [];
    this.scopeEvaluations = [];
    this.multiTargetResolutions = [];
  }

  /**
   * @description Records pipeline step messages.
   * @param {string} message - Step message.
   * @returns {void}
   */
  step(message) {
    this.steps.push(message);
  }

  /**
   * @description Records informational trace messages.
   * @param {string} message - Info message.
   * @returns {void}
   */
  info(message) {
    this.infos.push(message);
  }

  /**
   * @description Records success trace messages for completed steps.
   * @param {string} message - Success message.
   * @returns {void}
   */
  success(message) {
    this.infos.push(message);
  }

  /**
   * @description Records failure trace messages.
   * @param {string} message - Failure message.
   * @returns {void}
   */
  failure(message) {
    this.failures.push(message);
  }

  /**
   * @description Captures legacy detection diagnostics.
   * @param {string} actionId - Action identifier being traced.
   * @param {object} detection - Detection payload.
   * @returns {void}
   */
  captureLegacyDetection(actionId, detection) {
    this.legacyDetections.push({ actionId, detection });
  }

  /**
   * @description Captures legacy conversion analytics.
   * @param {string} actionId - Action identifier being traced.
   * @param {object} conversion - Conversion payload.
   * @returns {void}
   */
  captureLegacyConversion(actionId, conversion) {
    this.legacyConversions.push({ actionId, conversion });
  }

  /**
   * @description Captures scope evaluation statistics for individual targets.
   * @param {string} actionId - Action identifier.
   * @param {string} targetKey - Target key being evaluated.
   * @param {object} payload - Evaluation payload.
   * @returns {void}
   */
  captureScopeEvaluation(actionId, targetKey, payload) {
    this.scopeEvaluations.push({ actionId, targetKey, payload });
  }

  /**
   * @description Captures aggregated multi-target resolution analytics.
   * @param {string} actionId - Action identifier.
   * @param {object} payload - Resolution payload.
   * @returns {void}
   */
  captureMultiTargetResolution(actionId, payload) {
    this.multiTargetResolutions.push({ actionId, payload });
  }

  /**
   * @description Captures per-stage action data while optionally simulating downstream failures.
   * @param {string} stage - Stage identifier.
   * @param {string} actionId - Action identifier.
   * @param {object} data - Captured stage data.
   * @returns {Promise<void>|void}
   */
  captureActionData(stage, actionId, data) {
    this.actionData.push({ stage, actionId, data });

    if (
      stage === 'target_resolution' &&
      !data.isLegacy &&
      !data.resolutionFailed &&
      this.failMultiTargetCapture
    ) {
      this.failMultiTargetCapture = false;
      throw new Error('target resolution capture failed');
    }

    if (
      stage === 'target_resolution' &&
      data.resolutionFailed &&
      this.failErrorCapture
    ) {
      this.failErrorCapture = false;
      throw new Error('target resolution error capture failed');
    }

    if (stage === 'stage_performance') {
      if (this.failPerformanceCapture) {
        this.failPerformanceCapture = false;
        return Promise.reject(new Error('performance capture failed'));
      }
      return Promise.resolve();
    }

    return undefined;
  }
}

describe('MultiTargetResolutionStage tracing coverage integration', () => {
  it('captures action-aware analytics across legacy and multi-target flows', async () => {
    const logger = new TestLogger({ throwOnSummary: true });
    const entityTestBed = new EntityManagerTestBed();
    const entityManager = entityTestBed.entityManager;
    const unifiedScopeResolver = { resolve: jest.fn() };
    const targetResolver = { resolveTargets: jest.fn() };
    const stage = createMultiTargetResolutionStage({
      entityManager,
      logger,
      unifiedScopeResolver,
      targetResolver,
    });

    try {
      const locationDef = new EntityDefinition('test:location', {
        description: 'Command center',
        components: {
          'core:name': { text: 'Command Center' },
          'core:location': { name: 'Command Center' },
        },
      });
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Squad leader',
        components: {
          'core:name': { text: 'Leader' },
          'core:actor': { name: 'Leader', rank: 'Captain' },
          'core:position': { locationId: 'location-001' },
        },
      });
      const allyDef = new EntityDefinition('test:ally', {
        description: 'Trusted ally',
        components: {
          'core:name': { text: 'Ally' },
          'core:actor': { name: 'Ally', rank: 'Sergeant' },
        },
      });
      const companionDef = new EntityDefinition('test:companion', {
        description: 'Support drone',
        components: {
          'core:name': { text: 'Support Drone' },
          'core:item': { type: 'drone' },
        },
      });

      entityTestBed.setupDefinitions(
        locationDef,
        actorDef,
        allyDef,
        companionDef
      );

      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-001',
      });
      await entityManager.createEntityInstance('test:ally', {
        instanceId: 'ally-001',
      });
      await entityManager.createEntityInstance('test:companion', {
        instanceId: 'companion-001',
      });

      targetResolver.resolveTargets.mockImplementation(async (scope) => {
        if (scope === 'self') {
          return {
            success: true,
            value: [{ entityId: 'actor-001', displayName: 'Leader' }],
          };
        }
        return {
          success: true,
          value: [{ entityId: 'ally-001', displayName: 'Ally' }],
        };
      });

      unifiedScopeResolver.resolve.mockImplementation((scope) => {
        if (scope === 'test:primary_scope') {
          return Promise.resolve(
            ActionResult.success(new Set(['ally-001']))
          );
        }
        if (scope === 'test:secondary_scope') {
          return Promise.resolve(
            ActionResult.success(new Set(['companion-001']))
          );
        }
        if (scope === 'test:legacy_scope') {
          return Promise.resolve(ActionResult.success(new Set(['actor-001'])));
        }
        return Promise.resolve(ActionResult.failure({ error: 'unknown scope' }));
      });

      const legacyAction = createTestLegacyAction({
        id: 'legacy:salute',
        name: 'Salute Superior',
        template: 'salute {target}',
        targets: 'self',
      });

      const multiTargetAction = createTestContextFromAction({
        id: 'mission:coordinate',
        name: 'Coordinate Strike',
      });

      const trace = new RecordingTrace({
        failMultiTargetCapture: true,
        failPerformanceCapture: true,
      });

      const result = await stage.executeInternal({
        candidateActions: [legacyAction, multiTargetAction],
        actor,
        actionContext: {
          actor,
          currentLocation: { id: 'location-001' },
          location: { id: 'location-001' },
        },
        data: { stage: 'integration-test' },
        trace,
      });

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(2);

      expect(trace.legacyDetections.length).toBeGreaterThanOrEqual(1);
      expect(
        trace.legacyDetections.some((entry) => entry.actionId === 'legacy:salute')
      ).toBe(true);
      expect(trace.legacyConversions).toHaveLength(1);
      expect(trace.multiTargetResolutions).toHaveLength(1);
      expect(trace.scopeEvaluations).toHaveLength(2);
      expect(
        trace.actionData.filter((entry) => entry.stage === 'stage_performance')
      ).toHaveLength(2);

      const warnMessages = logger.logs.warn.map((entry) => entry.message);
      expect(
        warnMessages.some((message) =>
          message.includes('Failed to capture target resolution data for action')
        )
      ).toBe(true);
      expect(
        warnMessages.some((message) =>
          message.includes('Failed to capture post-resolution summary')
        )
      ).toBe(true);

      expect(
        logger.logs.warn.some((entry) =>
          typeof entry.message === 'string' &&
          entry.message.includes('Failed to capture performance data for action')
        )
      ).toBe(true);

      expect(trace.multiTargetResolutions[0].payload.targetKeys).toEqual([
        'primary',
        'secondary',
      ]);
      expect(trace.steps).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Resolving targets for action 'legacy:salute'"),
          expect.stringContaining(
            "Resolving targets for action 'mission:coordinate'"
          ),
        ])
      );
    } finally {
      entityTestBed.cleanup();
    }
  });

  it('handles legacy and multi-target failure scenarios with defensive tracing', async () => {
    const logger = new TestLogger();
    const entityTestBed = new EntityManagerTestBed();
    const entityManager = entityTestBed.entityManager;

    const legacyLayer = {
      isLegacyAction: jest.fn((action) => action.id.startsWith('legacy:')),
      convertLegacyFormat: jest.fn((action) => {
        if (action.id === 'legacy:conversion-error') {
          return { isLegacy: true, error: 'conversion failed' };
        }
        if (action.id === 'legacy:throws') {
          throw new Error('legacy explosion');
        }
        const scopeMap = {
          'legacy:empty': 'actor.empty',
          'legacy:missing-targets': 'actor.fail',
        };
        const scope = scopeMap[action.id] || 'actor.none';
        return {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope, placeholder: 'target' },
          },
        };
      }),
      getMigrationSuggestion: jest.fn(() => 'migrate'),
    };

    const targetResolver = {
      resolveTargets: jest.fn(async (scope) => {
        if (scope === 'actor.empty') {
          return { success: true, value: [] };
        }
        if (scope === 'actor.fail') {
          return {
            success: false,
            errors: [{ message: 'no entities resolved' }],
          };
        }
        return { success: true, value: [{ entityId: 'actor-001' }] };
      }),
    };

    const targetDependencyResolver = {
      getResolutionOrder: jest.fn((targetDefs) => {
        if (
          Object.values(targetDefs).some(
            (definition) => definition.scope === 'trigger:error'
          )
        ) {
          throw new Error('dependency resolution failure');
        }
        return Object.keys(targetDefs);
      }),
    };

    const targetDisplayNameResolver = {
      getEntityDisplayName: jest.fn((entityId) => `Entity ${entityId}`),
    };

    const unifiedScopeResolver = {
      resolve: jest.fn((scope) => {
        if (scope === 'primary.scope') {
          return Promise.resolve(
            ActionResult.success(new Set(['ally-001']))
          );
        }
    if (scope === 'secondary.scope') {
      return Promise.resolve(ActionResult.success(new Set()));
    }
    if (scope === 'invalid.scope') {
      return Promise.resolve(
        ActionResult.failure([{ message: 'invalid scope' }])
      );
    }
    if (scope === 'ghost.scope') {
      return Promise.resolve(ActionResult.success(new Set(['ghost-001'])));
    }
    return Promise.resolve(ActionResult.success(new Set(['ally-001'])));
  }),
    };

    const stage = createMultiTargetResolutionStage({
      entityManager,
      logger,
      unifiedScopeResolver,
      targetResolver,
      overrides: {
        legacyTargetCompatibilityLayer: legacyLayer,
        targetDependencyResolver,
        targetDisplayNameResolver,
      },
    });

    try {
      const locationDef = new EntityDefinition('test:location', {
        description: 'Fallback zone',
        components: {
          'core:name': { text: 'Fallback Zone' },
          'core:location': { name: 'Fallback Zone' },
        },
      });

      const actorDef = new EntityDefinition('test:actor', {
        description: 'Fallback actor',
        components: {
          'core:name': { text: 'Fallback' },
          'core:actor': { name: 'Fallback' },
          'core:position': { locationId: 'location-001' },
        },
      });
      const allyDef = new EntityDefinition('test:ally', {
        description: 'Ally entity',
        components: {
          'core:name': { text: 'Backup Ally' },
        },
      });
      entityTestBed.setupDefinitions(locationDef, actorDef, allyDef);
      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-001',
      });
      await entityManager.createEntityInstance('test:ally', {
        instanceId: 'ally-001',
      });

      const executeStage = (traceInstance) =>
        stage.executeInternal({
          candidateActions,
          actor,
          actionContext: {
            actor,
            currentLocation: { id: 'location-001' },
            location: { id: 'location-001' },
          },
          data: {},
          trace: traceInstance,
        });

      const candidateActions = [
        { id: 'legacy:empty', name: 'Legacy Empty', targets: 'self' },
        { id: 'legacy:missing-targets', name: 'Legacy Missing', targets: 'self' },
        { id: 'legacy:conversion-error', name: 'Legacy Conversion Error', targets: 'self' },
        { id: 'legacy:throws', name: 'Legacy Throws', targets: 'self' },
        { id: 'multi:invalid-config', name: 'Invalid Multi', targets: null },
        {
          id: 'multi:dependency-error',
          name: 'Dependency Error',
          targets: {
            trouble: { scope: 'trigger:error', placeholder: 'trouble' },
          },
        },
        {
          id: 'multi:empty-secondary',
          name: 'Empty Secondary',
          targets: {
            primary: {
              scope: 'primary.scope',
              placeholder: 'primary',
            },
            secondary: {
              scope: 'secondary.scope',
              placeholder: 'secondary',
              contextFrom: 'primary',
            },
          },
        },
        {
          id: 'multi:scope-failure',
          name: 'Scope Failure',
          targets: {
            solo: {
              scope: 'invalid.scope',
              placeholder: 'solo',
            },
          },
        },
        {
          id: 'multi:missing-entity',
          name: 'Missing Entity',
          targets: {
            phantom: {
              scope: 'ghost.scope',
              placeholder: 'phantom',
            },
          },
        },
      ];

      const failingTrace = new RecordingTrace({ failErrorCapture: true });

      const failureResult = await executeStage(failingTrace);

      expect(failureResult.success).toBe(true);
      expect(failureResult.data.actionsWithTargets).toHaveLength(0);
      const failureEntries = failingTrace.actionData.filter(
        (entry) => entry.data?.resolutionFailed
      );
      expect(failureEntries.length).toBeGreaterThan(0);

      expect(
        logger.logs.warn.some((entry) =>
          entry.message.includes('Failed to capture target resolution error')
        )
      ).toBe(true);

      expect(
        logger.logs.error.some((entry) =>
          entry.message.includes("Failed to resolve scope 'invalid.scope'")
        )
      ).toBe(true);

      const debugLogsBeforeSuccessRun = logger.logs.debug.length;

      targetResolver.resolveTargets.mockClear();
      targetDependencyResolver.getResolutionOrder.mockClear();

      const successTrace = new RecordingTrace();
      const successResult = await executeStage(successTrace);

      expect(successResult.success).toBe(true);
      expect(successResult.data.actionsWithTargets).toHaveLength(0);
      const successFailureEntries = successTrace.actionData.filter(
        (entry) => entry.data?.resolutionFailed
      );
      expect(successFailureEntries.length).toBeGreaterThan(0);
      expect(
        successFailureEntries.some(
          (entry) => entry.actionId === 'legacy:throws'
        )
      ).toBe(true);

      expect(
        logger.logs.debug.slice(debugLogsBeforeSuccessRun).some(
          (entry) =>
            typeof entry.message === 'string' &&
            entry.message.includes(
              "Captured target resolution error for action 'legacy:throws'"
            )
        )
      ).toBe(true);

      expect(targetResolver.resolveTargets).toHaveBeenCalledWith(
        'actor.empty',
        actor,
        expect.objectContaining({ actor }),
        successTrace,
        'legacy:empty'
      );
      expect(targetDependencyResolver.getResolutionOrder).toHaveBeenCalled();

    } finally {
      entityTestBed.cleanup();
    }
  });
});
