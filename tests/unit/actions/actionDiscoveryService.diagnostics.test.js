import { describe, it, expect, jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

/**
 * Creates a mock logger with all required methods.
 *
 * @returns {object} Mock logger
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
 * Creates a service instance with optional overrides.
 *
 * @param {object} overrides - Configuration overrides
 * @returns {object} Service and dependencies
 */
function createService(overrides = {}) {
  const logger = overrides.logger ?? createLogger();
  const entityManager = overrides.entityManager ?? {
    getEntityInstance: jest.fn(),
  };
  const actionPipelineOrchestrator = overrides.actionPipelineOrchestrator ?? {
    discoverActions: jest.fn().mockResolvedValue({
      actions: [],
      errors: [],
    }),
  };
  const traceContextFactory =
    overrides.traceContextFactory ??
    jest.fn(() => ({
      info: jest.fn(),
      getTracedActions: jest.fn(() => new Map()),
      getTracingSummary: jest.fn(() => ({})),
    }));
  const getActorLocationFn =
    overrides.getActorLocationFn ?? jest.fn(() => 'default-location');
  const serviceSetup = overrides.serviceSetup ?? {
    setupService: jest.fn(() => logger),
  };

  const service = new ActionDiscoveryService({
    entityManager,
    logger,
    actionPipelineOrchestrator,
    traceContextFactory,
    getActorLocationFn,
    serviceSetup,
    ...overrides,
  });

  return {
    service,
    logger,
    entityManager,
    actionPipelineOrchestrator,
    traceContextFactory,
    getActorLocationFn,
    serviceSetup,
  };
}

/**
 * Creates a mock action-aware trace with getTracedActions method.
 *
 * @param {Map} tracedActionsData - Map of traced action data
 * @returns {object} Mock trace object
 */
function createMockActionAwareTrace(tracedActionsData = new Map()) {
  return {
    captureActionData: jest.fn(),
    info: jest.fn(),
    getTracedActions: jest.fn(() => tracedActionsData),
    getTracingSummary: jest.fn(() => ({
      totalStagesTracked: 1,
      sessionDuration: 100,
    })),
  };
}

describe('ActionDiscoveryService Diagnostics Mode (ACTDISDIAFAIFAS-008)', () => {
  describe('getValidActions accepts diagnostics option', () => {
    it('accepts { diagnostics: true } option without error', async () => {
      const actor = { id: 'test-actor' };
      const trace = createMockActionAwareTrace();
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    it('creates trace when diagnostics is true even without trace option', async () => {
      const actor = { id: 'test-actor' };
      const trace = createMockActionAwareTrace();
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
      });

      await service.getValidActions(actor, {}, { diagnostics: true });

      // Should create trace even though trace option is not explicitly true
      expect(actionAwareTraceFactory).toHaveBeenCalled();
    });
  });

  describe('diagnostics property in result', () => {
    it('includes .diagnostics property when diagnostics option is enabled', async () => {
      const actor = { id: 'test-actor' };
      const trace = createMockActionAwareTrace();
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.componentFiltering).toBeDefined();
      expect(result.diagnostics.targetValidation).toBeDefined();
      expect(result.diagnostics.scopeResolution).toBeDefined();
    });

    it('does not include .diagnostics property when diagnostics option is false', async () => {
      const actor = { id: 'test-actor' };
      const { service } = createService();

      const result = await service.getValidActions(actor, {}, { diagnostics: false });

      expect(result.diagnostics).toBeUndefined();
    });

    it('does not include .diagnostics property when diagnostics option is omitted', async () => {
      const actor = { id: 'test-actor' };
      const { service } = createService();

      const result = await service.getValidActions(actor, {});

      expect(result.diagnostics).toBeUndefined();
    });
  });

  describe('zero overhead when diagnostics disabled', () => {
    it('does not create trace when neither trace nor diagnostics is requested', async () => {
      const actor = { id: 'test-actor' };
      const traceContextFactory = jest.fn(() => ({
        info: jest.fn(),
        getTracedActions: jest.fn(() => new Map()),
      }));
      const actionAwareTraceFactory = jest.fn();

      const { service, actionPipelineOrchestrator } = createService({
        traceContextFactory,
        actionAwareTraceFactory,
      });

      await service.getValidActions(actor, {});

      // Neither trace factory should be called
      expect(traceContextFactory).not.toHaveBeenCalled();
      expect(actionAwareTraceFactory).not.toHaveBeenCalled();

      // Pipeline should receive null trace
      expect(actionPipelineOrchestrator.discoverActions).toHaveBeenCalledWith(
        actor,
        expect.any(Object),
        { trace: null }
      );
    });
  });

  describe('diagnostics aggregation from stages', () => {
    it('aggregates component filtering rejections', async () => {
      const actor = { id: 'test-actor' };
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

      const trace = createMockActionAwareTrace(tracedActionsData);
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics.componentFiltering.rejectedActions).toHaveLength(1);
      expect(result.diagnostics.componentFiltering.rejectedActions[0]).toEqual({
        actionId: 'personal-space:get_close',
        reason: 'FORBIDDEN_COMPONENT',
        forbiddenComponents: ['personal-space-states:closeness'],
        actorHasComponents: ['personal-space-states:closeness'],
      });
    });

    it('aggregates target validation failures', async () => {
      const actor = { id: 'test-actor' };
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

      const trace = createMockActionAwareTrace(tracedActionsData);
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics.targetValidation.validationFailures).toHaveLength(1);
      expect(result.diagnostics.targetValidation.validationFailures[0]).toEqual({
        actionId: 'positioning:kneel_before',
        targetRole: 'primary',
        validationType: 'forbidden_components',
        rejectedEntities: [
          {
            entityId: 'target-123',
            forbiddenComponentsPresent: ['positioning:kneeling'],
          },
        ],
      });
    });

    it('aggregates scope resolution errors', async () => {
      const actor = { id: 'test-actor' };
      const tracedActionsData = new Map([
        [
          'some-action:invalid',
          {
            scope_evaluation: {
              error: {
                message: 'Scope resolution failed',
                scopeId: 'invalid-scope',
              },
            },
          },
        ],
      ]);

      const trace = createMockActionAwareTrace(tracedActionsData);
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.diagnostics.scopeResolution.errors).toHaveLength(1);
      expect(result.diagnostics.scopeResolution.errors[0]).toEqual({
        actionId: 'some-action:invalid',
        message: 'Scope resolution failed',
        scopeId: 'invalid-scope',
      });
    });
  });

  describe('.actions[] always present', () => {
    it('includes .actions property when diagnostics is enabled', async () => {
      const actor = { id: 'test-actor' };
      const trace = createMockActionAwareTrace();
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };
      const actionPipelineOrchestrator = {
        discoverActions: jest.fn().mockResolvedValue({
          actions: [{ id: 'core:speak' }],
          errors: [],
        }),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
        actionPipelineOrchestrator,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      expect(result.actions).toEqual([{ id: 'core:speak' }]);
    });

    it('includes .actions property when diagnostics is disabled', async () => {
      const actor = { id: 'test-actor' };
      const actionPipelineOrchestrator = {
        discoverActions: jest.fn().mockResolvedValue({
          actions: [{ id: 'core:speak' }],
          errors: [],
        }),
      };

      const { service } = createService({ actionPipelineOrchestrator });

      const result = await service.getValidActions(actor, {});

      expect(result.actions).toEqual([{ id: 'core:speak' }]);
    });
  });

  describe('empty diagnostics when all actions pass', () => {
    it('returns empty diagnostics arrays when no rejections occurred', async () => {
      const actor = { id: 'test-actor' };
      // Empty traced actions - no rejections or failures
      const trace = createMockActionAwareTrace(new Map());
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };
      const actionPipelineOrchestrator = {
        discoverActions: jest.fn().mockResolvedValue({
          actions: [{ id: 'core:speak' }, { id: 'core:wait' }],
          errors: [],
        }),
      };

      const { service } = createService({
        actionAwareTraceFactory,
        actionTraceFilter,
        actionPipelineOrchestrator,
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

  describe('error handling in diagnostics aggregation', () => {
    it('returns empty diagnostics when getTracedActions throws', async () => {
      const logger = createLogger();
      const actor = { id: 'test-actor' };
      const trace = {
        captureActionData: jest.fn(),
        info: jest.fn(),
        getTracedActions: jest.fn(() => {
          throw new Error('Trace data corrupted');
        }),
        getTracingSummary: jest.fn(() => ({})),
      };
      const actionAwareTraceFactory = jest.fn(() => trace);
      const actionTraceFilter = {
        isEnabled: jest.fn(() => true),
        shouldTrace: jest.fn(() => true),
      };

      const { service } = createService({
        logger,
        actionAwareTraceFactory,
        actionTraceFilter,
      });

      const result = await service.getValidActions(actor, {}, { diagnostics: true });

      // Should return empty diagnostics structure (error caught in both telemetry and aggregation)
      expect(result.diagnostics).toEqual({
        componentFiltering: { rejectedActions: [] },
        targetValidation: { validationFailures: [] },
        scopeResolution: { errors: [] },
      });
      // Telemetry section catches error first
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to process trace telemetry',
        expect.objectContaining({ error: 'Trace data corrupted' })
      );
      // Aggregation also catches error
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to aggregate diagnostics from trace',
        { error: 'Trace data corrupted' }
      );
    });

    it('returns empty diagnostics when trace lacks getTracedActions method', async () => {
      const actor = { id: 'test-actor' };
      // Trace without getTracedActions method (falls back to standard trace)
      const trace = {
        info: jest.fn(),
        step: jest.fn(),
      };
      const traceContextFactory = jest.fn(() => trace);

      const { service } = createService({
        traceContextFactory,
      });

      // Force trace creation but without action-aware capabilities
      const result = await service.getValidActions(actor, {}, { trace: true, diagnostics: true });

      // diagnostics should be undefined since trace lacks getTracedActions
      expect(result.diagnostics).toBeUndefined();
    });
  });
});
