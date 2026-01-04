/**
 * @file Integration tests for ActionDiscoveryService diagnostics mode
 * @description Validates end-to-end diagnostic flow with the action pipeline,
 * verifying that diagnostics output accurately reflects rejection reasons.
 *
 * Part of ACTDISDIAFAIFAS-010 - Integration Tests
 * @see specs/action-discovery-diagnostics-fail-fast.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

/**
 * Creates a minimal logger mock.
 *
 * @returns {object} Logger mock
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Creates an action-aware trace mock that captures diagnostics data.
 *
 * @param {Map} tracedActionsData - Initial trace data
 * @returns {object} Trace mock with getTracedActions
 */
function createActionAwareTrace(tracedActionsData = new Map()) {
  return {
    captureActionData: jest.fn(),
    info: jest.fn(),
    step: jest.fn(),
    getTracedActions: jest.fn(() => tracedActionsData),
    getTracingSummary: jest.fn(() => ({
      totalStagesTracked: tracedActionsData.size,
      sessionDuration: 100,
    })),
  };
}

/**
 * Creates a fully configured ActionDiscoveryService for testing.
 *
 * @param {object} overrides - Configuration overrides
 * @returns {object} Service and its dependencies
 */
function createServiceWithDiagnostics(overrides = {}) {
  const logger = overrides.logger ?? createLogger();

  const actor = overrides.actor ?? {
    id: 'test-actor',
    components: {
      'core:actor': {},
      'core:position': { locationId: 'test-location' },
    },
  };

  const entityManager = overrides.entityManager ?? {
    getEntityInstance: jest.fn((id) => (id === actor.id ? actor : null)),
  };

  const tracedActionsData = overrides.tracedActionsData ?? new Map();
  const trace = createActionAwareTrace(tracedActionsData);

  const actionAwareTraceFactory = jest.fn(() => trace);
  const actionTraceFilter = {
    isEnabled: jest.fn(() => true),
    shouldTrace: jest.fn(() => true),
  };

  const pipelineActions = overrides.pipelineActions ?? [];
  const pipelineErrors = overrides.pipelineErrors ?? [];

  const actionPipelineOrchestrator = {
    discoverActions: jest.fn().mockResolvedValue({
      actions: pipelineActions,
      errors: pipelineErrors,
    }),
  };

  const service = new ActionDiscoveryService({
    entityManager,
    logger,
    actionPipelineOrchestrator,
    traceContextFactory: jest.fn(),
    getActorLocationFn: jest.fn(() => 'test-location'),
    actionAwareTraceFactory,
    actionTraceFilter,
    ...overrides,
  });

  return {
    service,
    actor,
    logger,
    entityManager,
    actionPipelineOrchestrator,
    actionAwareTraceFactory,
    actionTraceFilter,
    trace,
    tracedActionsData,
  };
}

describe('ActionDiscoveryService Diagnostics Integration (ACTDISDIAFAIFAS-010)', () => {
  describe('End-to-end diagnostic flow with real mod definitions', () => {
    it('should return diagnostics structure when diagnostics option is enabled', async () => {
      const { service, actor } = createServiceWithDiagnostics();

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.componentFiltering).toBeDefined();
      expect(result.diagnostics.targetValidation).toBeDefined();
      expect(result.diagnostics.scopeResolution).toBeDefined();
    });

    it('should create trace when diagnostics is enabled', async () => {
      const { service, actor, actionAwareTraceFactory } = createServiceWithDiagnostics();

      await service.getValidActions(actor, {}, { diagnostics: true });

      expect(actionAwareTraceFactory).toHaveBeenCalled();
    });
  });

  describe('ComponentFilteringStage rejections captured', () => {
    it('should aggregate component filtering rejections in diagnostics', async () => {
      // Set up trace data with forbidden component rejection
      const tracedActionsData = new Map([
        [
          'stage',
          {
            component_filtering_rejections: {
              stageName: 'ComponentFilteringStage',
              diagnostics: {
                rejectedActions: [
                  {
                    actionId: 'personal-space:get_close',
                    reason: 'FORBIDDEN_COMPONENT',
                    forbiddenComponents: ['personal-space-states:closeness'],
                    actorHasComponents: ['personal-space-states:closeness'],
                  },
                ],
              },
            },
          },
        ],
      ]);

      const { service, actor } = createServiceWithDiagnostics({ tracedActionsData });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics.componentFiltering.rejectedActions).toHaveLength(1);
      expect(result.diagnostics.componentFiltering.rejectedActions[0]).toMatchObject({
        actionId: 'personal-space:get_close',
        reason: 'FORBIDDEN_COMPONENT',
        forbiddenComponents: ['personal-space-states:closeness'],
      });
    });

    it('should capture multiple forbidden component rejections', async () => {
      const tracedActionsData = new Map([
        [
          'stage',
          {
            component_filtering_rejections: {
              stageName: 'ComponentFilteringStage',
              diagnostics: {
                rejectedActions: [
                  {
                    actionId: 'personal-space:get_close',
                    reason: 'FORBIDDEN_COMPONENT',
                    forbiddenComponents: ['personal-space-states:closeness'],
                    actorHasComponents: ['personal-space-states:closeness'],
                  },
                  {
                    actionId: 'positioning:sit_down',
                    reason: 'FORBIDDEN_COMPONENT',
                    forbiddenComponents: ['positioning:sitting'],
                    actorHasComponents: ['positioning:sitting'],
                  },
                ],
              },
            },
          },
        ],
      ]);

      const { service, actor } = createServiceWithDiagnostics({ tracedActionsData });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics.componentFiltering.rejectedActions).toHaveLength(2);
    });
  });

  describe('TargetValidationStage rejections captured', () => {
    it('should aggregate target validation failures in diagnostics', async () => {
      const tracedActionsData = new Map([
        [
          'positioning:kneel_before',
          {
            target_validation_failure: {
              stageName: 'TargetComponentValidationStage',
              diagnostics: {
                validationFailures: [
                  {
                    actionId: 'positioning:kneel_before',
                    targetRole: 'primary',
                    validationType: 'forbidden_components',
                    rejectedEntities: [
                      {
                        entityId: 'target-123',
                        forbiddenComponentsPresent: ['positioning:kneeling'],
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      ]);

      const { service, actor } = createServiceWithDiagnostics({ tracedActionsData });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics.targetValidation.validationFailures).toHaveLength(1);
      expect(result.diagnostics.targetValidation.validationFailures[0]).toMatchObject({
        actionId: 'positioning:kneel_before',
        targetRole: 'primary',
        validationType: 'forbidden_components',
      });
    });
  });

  describe('Scope resolution errors include context', () => {
    it('should aggregate scope resolution errors with context', async () => {
      const tracedActionsData = new Map([
        [
          'invalid-action:test',
          {
            scope_evaluation: {
              error: {
                message: "Condition 'core:missing-condition' not found",
                scopeId: 'invalid-scope',
                conditionId: 'core:missing-condition',
              },
            },
          },
        ],
      ]);

      const { service, actor } = createServiceWithDiagnostics({ tracedActionsData });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics.scopeResolution.errors).toHaveLength(1);
      expect(result.diagnostics.scopeResolution.errors[0]).toMatchObject({
        actionId: 'invalid-action:test',
        message: "Condition 'core:missing-condition' not found",
        scopeId: 'invalid-scope',
      });
    });
  });

  describe('Diagnostics match actual rejection reasons', () => {
    it('should accurately reflect forbidden component rejection', async () => {
      const rejectionData = {
        actionId: 'personal-space:get_close',
        reason: 'FORBIDDEN_COMPONENT',
        forbiddenComponents: ['personal-space-states:closeness'],
        actorHasComponents: ['personal-space-states:closeness'],
      };

      const tracedActionsData = new Map([
        [
          'stage',
          {
            component_filtering_rejections: {
              stageName: 'ComponentFilteringStage',
              diagnostics: {
                rejectedActions: [rejectionData],
              },
            },
          },
        ],
      ]);

      const { service, actor } = createServiceWithDiagnostics({ tracedActionsData });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      // The diagnostics should match exactly what was captured
      const rejection = result.diagnostics.componentFiltering.rejectedActions[0];
      expect(rejection.actionId).toBe('personal-space:get_close');
      expect(rejection.reason).toBe('FORBIDDEN_COMPONENT');
      expect(rejection.forbiddenComponents).toContain('personal-space-states:closeness');
      expect(rejection.actorHasComponents).toContain('personal-space-states:closeness');
    });
  });

  describe('Empty diagnostics when all actions available', () => {
    it('should return empty diagnostics arrays when no rejections occurred', async () => {
      // Empty trace data - no rejections
      const tracedActionsData = new Map();

      const { service, actor } = createServiceWithDiagnostics({
        tracedActionsData,
        pipelineActions: [{ id: 'core:speak' }, { id: 'core:wait' }],
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics).toEqual({
        componentFiltering: { rejectedActions: [] },
        targetValidation: { validationFailures: [] },
        scopeResolution: { errors: [] },
      });
      expect(result.actions).toHaveLength(2);
    });
  });

  describe("Diagnostics don't affect action results", () => {
    it('should return same actions with or without diagnostics', async () => {
      const pipelineActions = [
        { id: 'core:speak', name: 'Speak' },
        { id: 'core:wait', name: 'Wait' },
      ];

      const setup1 = createServiceWithDiagnostics({ pipelineActions });
      const setup2 = createServiceWithDiagnostics({ pipelineActions });

      const resultWithDiagnostics = await setup1.service.getValidActions(
        setup1.actor,
        {},
        { diagnostics: true }
      );

      const resultWithoutDiagnostics = await setup2.service.getValidActions(
        setup2.actor,
        {},
        { diagnostics: false }
      );

      // Actions should be identical
      expect(resultWithDiagnostics.actions).toEqual(resultWithoutDiagnostics.actions);

      // Only the diagnostics property differs
      expect(resultWithDiagnostics.diagnostics).toBeDefined();
      expect(resultWithoutDiagnostics.diagnostics).toBeUndefined();
    });
  });

  describe('Zero overhead when diagnostics disabled', () => {
    it('should not create trace when diagnostics is disabled', async () => {
      const { service, actor, actionAwareTraceFactory } = createServiceWithDiagnostics();

      await service.getValidActions(actor, {}, { diagnostics: false });

      // Trace factory should not be called when diagnostics is disabled
      expect(actionAwareTraceFactory).not.toHaveBeenCalled();
    });

    it('should not create trace when diagnostics option is omitted', async () => {
      const { service, actor, actionAwareTraceFactory } = createServiceWithDiagnostics();

      await service.getValidActions(actor, {});

      expect(actionAwareTraceFactory).not.toHaveBeenCalled();
    });
  });

  describe('Error handling in diagnostics aggregation', () => {
    it('should return empty diagnostics when trace data retrieval fails', async () => {
      const faultyTrace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
        getTracedActions: jest.fn(() => {
          throw new Error('Trace data corrupted');
        }),
        getTracingSummary: jest.fn(() => ({})),
      };

      const logger = createLogger();
      const actionAwareTraceFactory = jest.fn(() => faultyTrace);

      const { service, actor } = createServiceWithDiagnostics({
        logger,
        actionAwareTraceFactory,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      // Should gracefully handle the error and return empty diagnostics
      expect(result.diagnostics).toEqual({
        componentFiltering: { rejectedActions: [] },
        targetValidation: { validationFailures: [] },
        scopeResolution: { errors: [] },
      });

      // Should log warning about the failure (includes service prefix)
      expect(logger.warn).toHaveBeenCalledWith(
        'ActionDiscoveryService: Failed to process trace telemetry',
        expect.objectContaining({ error: 'Trace data corrupted' })
      );
    });
  });
});
