import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import TargetResolutionTracingOrchestrator from '../../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import * as dependencyUtils from '../../../../../../src/utils/dependencyUtils.js';

const FIXED_TIMESTAMP = 1_700_000_000_000;

describe('TargetResolutionTracingOrchestrator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('TargetResolutionTracingOrchestrator - Constructor', () => {
    it('should validate logger dependency via validateDependency', () => {
      const logger = createMockLogger();
      const validateSpy = jest.spyOn(dependencyUtils, 'validateDependency');

      new TargetResolutionTracingOrchestrator({ logger });

      expect(validateSpy).toHaveBeenCalledWith(logger, 'ILogger', logger, {
        requiredMethods: ['info', 'warn', 'error', 'debug'],
      });
    });

    it('should throw when logger is missing required methods', () => {
      const incompleteLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      expect(
        () =>
          new TargetResolutionTracingOrchestrator({ logger: incompleteLogger })
      ).toThrow("Invalid or missing method 'debug' on dependency 'ILogger'.");
    });

    it('should retain reference to a valid logger', () => {
      const logger = createMockLogger();
      const orchestrator = new TargetResolutionTracingOrchestrator({ logger });
      const traceWithoutLegacy = createMockTrace({ captureActionData: true });

      orchestrator.captureLegacyDetection(traceWithoutLegacy, 'action-1', {});

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureLegacyDetection implementation'
      );
    });
  });

  describe('isActionAwareTrace', () => {
    let orchestrator;

    beforeEach(() => {
      orchestrator = new TargetResolutionTracingOrchestrator({
        logger: createMockLogger(),
      });
    });

    it('should return true only when captureActionData is a function', () => {
      const trace = createMockTrace({ captureActionData: true });

      expect(orchestrator.isActionAwareTrace(trace)).toBe(true);
      trace.captureActionData = 'not-a-function';
      expect(orchestrator.isActionAwareTrace(trace)).toBe(false);
    });

    it('should return false for plain objects that lack captureActionData', () => {
      expect(orchestrator.isActionAwareTrace({})).toBe(false);
    });

    it('should return false for null/undefined trace values', () => {
      expect(orchestrator.isActionAwareTrace(null)).toBe(false);
      expect(orchestrator.isActionAwareTrace(undefined)).toBe(false);
    });
  });

  describe('captureLegacyDetection', () => {
    let orchestrator;
    let logger;

    beforeEach(() => {
      logger = createMockLogger();
      orchestrator = new TargetResolutionTracingOrchestrator({ logger });
    });

    it('should capture legacy detection when the trace supplies captureLegacyDetection', () => {
      const trace = createMockTrace({
        captureActionData: true,
        captureLegacyDetection: true,
      });
      const detectionData = { foo: 'bar' };

      orchestrator.captureLegacyDetection(trace, 'action-42', detectionData);

      expect(trace.captureLegacyDetection).toHaveBeenCalledWith('action-42', {
        foo: 'bar',
      });
      expect(trace.captureLegacyDetection.mock.calls[0][1]).not.toBe(
        detectionData
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "TargetResolutionTracingOrchestrator: Legacy detection captured for action 'action-42'"
      );
    });

    it('should warn and skip when the trace is action-aware but missing captureLegacyDetection', () => {
      const trace = createMockTrace({ captureActionData: true });

      orchestrator.captureLegacyDetection(trace, 'action-42', {});

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureLegacyDetection implementation'
      );
    });

    it('should warn when trace.captureLegacyDetection throws an error', () => {
      const failingTrace = createMockTrace({
        captureActionData: true,
        captureLegacyDetection: jest.fn(() => {
          throw new Error('fail');
        }),
      });

      orchestrator.captureLegacyDetection(failingTrace, 'action-42', {});

      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to capture legacy detection for action 'action-42'",
        expect.any(Error)
      );
    });
  });

  describe('captureLegacyConversion', () => {
    let orchestrator;
    let logger;

    beforeEach(() => {
      logger = createMockLogger();
      orchestrator = new TargetResolutionTracingOrchestrator({ logger });
    });

    it('should forward conversion data to trace.captureLegacyConversion', () => {
      const trace = createMockTrace({
        captureActionData: true,
        captureLegacyConversion: true,
      });
      const conversionData = { baz: 'qux' };

      orchestrator.captureLegacyConversion(trace, 'act-7', conversionData);

      expect(trace.captureLegacyConversion).toHaveBeenCalledWith('act-7', {
        baz: 'qux',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        "TargetResolutionTracingOrchestrator: Legacy conversion captured for action 'act-7'"
      );
    });

    it('should warn and skip when the method is missing', () => {
      const trace = createMockTrace({ captureActionData: true });

      orchestrator.captureLegacyConversion(trace, 'act-7', {});

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureLegacyConversion implementation'
      );
    });

    it('should warn but not throw when the trace method raises an error', () => {
      const trace = createMockTrace({
        captureActionData: true,
        captureLegacyConversion: jest.fn(() => {
          throw new Error('boom');
        }),
      });

      orchestrator.captureLegacyConversion(trace, 'act-7', {});

      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to capture legacy conversion for action 'act-7'",
        expect.any(Error)
      );
    });
  });

  describe('captureScopeEvaluation', () => {
    let orchestrator;
    let logger;

    beforeEach(() => {
      logger = createMockLogger();
      orchestrator = new TargetResolutionTracingOrchestrator({ logger });
    });

    it('should forward actionId, targetKey, and evaluation data', () => {
      const trace = createMockTrace({
        captureActionData: true,
        captureScopeEvaluation: true,
      });
      const evaluationData = { success: true };

      orchestrator.captureScopeEvaluation(
        trace,
        'action-x',
        'target-y',
        evaluationData
      );

      expect(trace.captureScopeEvaluation).toHaveBeenCalledWith(
        'action-x',
        'target-y',
        {
          success: true,
        }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "TargetResolutionTracingOrchestrator: Scope evaluation captured for action 'action-x' target 'target-y'"
      );
    });

    it('should warn when the trace lacks captureScopeEvaluation', () => {
      const trace = createMockTrace({ captureActionData: true });

      orchestrator.captureScopeEvaluation(trace, 'action-x', 'target-y', {});

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureScopeEvaluation implementation'
      );
    });

    it('should warn if captureScopeEvaluation throws', () => {
      const trace = createMockTrace({
        captureActionData: true,
        captureScopeEvaluation: jest.fn(() => {
          throw new Error('scope fail');
        }),
      });

      orchestrator.captureScopeEvaluation(trace, 'action-x', 'target-y', {});

      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to capture scope evaluation for action 'action-x' target 'target-y'",
        expect.any(Error)
      );
    });
  });

  describe('captureMultiTargetResolution', () => {
    let orchestrator;
    let logger;

    beforeEach(() => {
      logger = createMockLogger();
      orchestrator = new TargetResolutionTracingOrchestrator({ logger });
    });

    it('should send the resolution summary to captureMultiTargetResolution', () => {
      const trace = createMockTrace({
        captureActionData: true,
        captureMultiTargetResolution: true,
      });
      const summary = { resolved: 3 };

      orchestrator.captureMultiTargetResolution(trace, 'action-z', summary);

      expect(trace.captureMultiTargetResolution).toHaveBeenCalledWith(
        'action-z',
        {
          resolved: 3,
        }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        "TargetResolutionTracingOrchestrator: Multi-target summary captured for action 'action-z'"
      );
    });

    it('should warn when the trace lacks the method despite being action-aware', () => {
      const trace = createMockTrace({ captureActionData: true });

      orchestrator.captureMultiTargetResolution(trace, 'action-z', {});

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureMultiTargetResolution implementation'
      );
    });

    it('should warn when captureMultiTargetResolution throws', () => {
      const trace = createMockTrace({
        captureActionData: true,
        captureMultiTargetResolution: jest.fn(() => {
          throw new Error('multi');
        }),
      });

      orchestrator.captureMultiTargetResolution(trace, 'action-z', {});

      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to capture multi-target resolution for action 'action-z'",
        expect.any(Error)
      );
    });
  });

  describe('captureResolutionData', () => {
    let orchestrator;
    let logger;

    beforeEach(() => {
      logger = createMockLogger();
      orchestrator = new TargetResolutionTracingOrchestrator({ logger });
    });

    it('should send payload with stage, actorId, timestamp, and resolution data', () => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
      const trace = createMockTrace({ captureActionData: true });
      const actionDef = { id: 'act-1' };
      const actor = { id: 'actor-1' };
      const resolutionData = { success: true };

      orchestrator.captureResolutionData(
        trace,
        actionDef,
        actor,
        resolutionData
      );

      expect(trace.captureActionData).toHaveBeenCalledWith(
        'target_resolution',
        'act-1',
        expect.objectContaining({
          stage: 'target_resolution',
          actorId: 'actor-1',
          success: true,
          timestamp: FIXED_TIMESTAMP,
        })
      );
    });

    it('should append targetResolutionDetails when detailedResults supplied', () => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
      const trace = createMockTrace({ captureActionData: true });
      const actionDef = { id: 'act-2' };
      const actor = { id: 'actor-99' };
      const resolutionData = { totalTargets: 2 };
      const detailedResults = { foo: 'bar' };

      orchestrator.captureResolutionData(
        trace,
        actionDef,
        actor,
        resolutionData,
        detailedResults
      );

      expect(trace.captureActionData).toHaveBeenCalledWith(
        'target_resolution',
        'act-2',
        expect.objectContaining({
          stage: 'target_resolution',
          actorId: 'actor-99',
          totalTargets: 2,
          targetResolutionDetails: detailedResults,
          timestamp: FIXED_TIMESTAMP,
        })
      );
    });

    it('should warn when trace.captureActionData is missing', () => {
      const trace = {};
      const actionDef = { id: 'act-3' };
      const actor = { id: 'actor-100' };
      const resolutionData = { success: false };
      jest.spyOn(orchestrator, 'isActionAwareTrace').mockReturnValue(true);

      orchestrator.captureResolutionData(
        trace,
        actionDef,
        actor,
        resolutionData
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureActionData implementation'
      );
    });
  });

  describe('captureResolutionError', () => {
    let orchestrator;
    let logger;

    beforeEach(() => {
      logger = createMockLogger();
      orchestrator = new TargetResolutionTracingOrchestrator({ logger });
    });

    it('should send error payload with stage, actorId, and resolutionFailed flag', () => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
      const trace = createMockTrace({ captureActionData: true });
      const actionDef = { id: 'act-err' };
      const actor = { id: 'actor-x' };
      const error = new Error('resolution failed');

      orchestrator.captureResolutionError(trace, actionDef, actor, error);

      expect(trace.captureActionData).toHaveBeenCalledWith(
        'target_resolution',
        'act-err',
        expect.objectContaining({
          stage: 'target_resolution',
          actorId: 'actor-x',
          resolutionFailed: true,
          error: 'resolution failed',
          errorType: 'Error',
          timestamp: FIXED_TIMESTAMP,
        })
      );
    });

    it('should include error message, type, and scopeName when available', () => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
      const trace = createMockTrace({ captureActionData: true });
      const actionDef = { id: 'act-err-2' };
      const actor = { id: 'actor-y' };
      const error = new Error('legacy failure');
      error.scopeName = 'legacy:scope';

      orchestrator.captureResolutionError(trace, actionDef, actor, error);

      expect(trace.captureActionData).toHaveBeenCalledWith(
        'target_resolution',
        'act-err-2',
        expect.objectContaining({
          error: 'legacy failure',
          errorType: 'Error',
          scopeName: 'legacy:scope',
        })
      );
    });

    it('should warn when captureActionData is missing', () => {
      const trace = {};
      const actionDef = { id: 'act-err-3' };
      const actor = { id: 'actor-z' };
      const error = new Error('bad');
      jest.spyOn(orchestrator, 'isActionAwareTrace').mockReturnValue(true);

      orchestrator.captureResolutionError(trace, actionDef, actor, error);

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureActionData implementation'
      );
    });
  });

  describe('capturePostResolutionSummary', () => {
    it('should log a debug summary even though it does not call the trace', () => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
      const logger = createMockLogger();
      const orchestrator = new TargetResolutionTracingOrchestrator({ logger });

      orchestrator.capturePostResolutionSummary(
        null,
        { id: 'actor-1' },
        5,
        4,
        false,
        true,
        30
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'TargetResolutionTracingOrchestrator: Captured post-resolution summary',
        expect.objectContaining({
          actorId: 'actor-1',
          originalActionCount: 5,
          resolvedActionCount: 4,
          resolutionSuccessRate: 0.8,
          stageDurationMs: 30,
          timestamp: FIXED_TIMESTAMP,
        })
      );
    });

    it('should compute resolutionSuccessRate and include actorId/flags in the log payload', () => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
      const logger = createMockLogger();
      const orchestrator = new TargetResolutionTracingOrchestrator({ logger });

      orchestrator.capturePostResolutionSummary(
        null,
        { id: 'actor-hero' },
        0,
        0,
        true,
        false,
        120
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'TargetResolutionTracingOrchestrator: Captured post-resolution summary',
        expect.objectContaining({
          actorId: 'actor-hero',
          hasLegacyActions: true,
          hasMultiTargetActions: false,
          resolutionSuccessRate: 1,
        })
      );
    });

    it('should log a warning instead of throwing if summary logging fails', () => {
      const logger = createMockLogger();
      logger.debug = jest.fn(() => {
        throw new Error('log failure');
      });
      const orchestrator = new TargetResolutionTracingOrchestrator({ logger });

      orchestrator.capturePostResolutionSummary(
        null,
        { id: 'actor' },
        1,
        1,
        false,
        false,
        10
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to capture post-resolution summary for tracing',
        expect.any(Error)
      );
    });
  });

  describe('capturePerformanceData', () => {
    let orchestrator;
    let logger;

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
      logger = createMockLogger();
      orchestrator = new TargetResolutionTracingOrchestrator({ logger });
    });

    it('should await #safeCaptureActionData with event "stage_performance" and payload duration/items info', async () => {
      const trace = createMockTrace({ captureActionData: true });
      const actionDef = { id: 'act-perf' };

      await orchestrator.capturePerformanceData(
        trace,
        actionDef,
        100,
        160,
        10,
        7
      );

      expect(trace.captureActionData).toHaveBeenCalledWith(
        'stage_performance',
        'act-perf',
        expect.objectContaining({
          stage: 'multi_target_resolution',
          duration: 60,
          timestamp: FIXED_TIMESTAMP,
          itemsProcessed: 10,
          itemsResolved: 7,
          stageName: 'MultiTargetResolution',
        })
      );
    });

    it('should skip capture when trace is not action-aware', async () => {
      const trace = createMockTrace();
      const actionDef = { id: 'act-perf-2' };

      await orchestrator.capturePerformanceData(trace, actionDef, 0, 10, 1, 1);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn when captureActionData is missing despite being action-aware', async () => {
      const trace = {};
      const actionDef = { id: 'act-perf-3' };
      jest.spyOn(orchestrator, 'isActionAwareTrace').mockReturnValue(true);

      await orchestrator.capturePerformanceData(trace, actionDef, 0, 10, 1, 1);

      expect(logger.warn).toHaveBeenCalledWith(
        'Action-aware trace missing captureActionData implementation'
      );
    });
  });

  describe('analyzeLegacyFormat', () => {
    let orchestrator;

    beforeEach(() => {
      orchestrator = new TargetResolutionTracingOrchestrator({
        logger: createMockLogger(),
      });
    });

    it('should detect string targets as "string_targets"', () => {
      const action = { targets: 'actor' };

      expect(orchestrator.analyzeLegacyFormat(action)).toBe('string_targets');
    });

    it('should detect scope-only targets as "scope_property"', () => {
      const action = { scope: { foo: 'bar' } };

      expect(orchestrator.analyzeLegacyFormat(action)).toBe('scope_property');
    });

    it('should detect targetType/targetCount as "legacy_target_type"', () => {
      const action = { targetType: 'enemy' };

      expect(orchestrator.analyzeLegacyFormat(action)).toBe(
        'legacy_target_type'
      );
    });

    it('should default to "modern" when no legacy hints are present', () => {
      const action = { id: 'modern-action' };

      expect(orchestrator.analyzeLegacyFormat(action)).toBe('modern');
    });
  });
});

/**
 *
 * @param capabilities
 */
function createMockTrace(capabilities = {}) {
  const trace = {};

  const assignMethod = (name, { async = false } = {}) => {
    const capability = capabilities[name];
    if (!capability) return;
    if (capability === true) {
      trace[name] = async ? jest.fn().mockResolvedValue() : jest.fn();
      return;
    }
    trace[name] = capability;
  };

  assignMethod('step');
  assignMethod('info');
  assignMethod('success');
  assignMethod('failure');
  assignMethod('captureLegacyDetection');
  assignMethod('captureLegacyConversion');
  assignMethod('captureScopeEvaluation');
  assignMethod('captureMultiTargetResolution');
  assignMethod('captureActionData', { async: true });

  return trace;
}

/**
 *
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}
