/**
 * @file Unit tests for TargetValidationReporter
 * @see src/actions/pipeline/stages/TargetValidationReporter.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import TargetValidationReporter from '../../../../../src/actions/pipeline/stages/TargetValidationReporter.js';
import {
  ACTOR_ROLE,
  ALL_MULTI_TARGET_ROLES,
  LEGACY_TARGET_ROLE,
} from '../../../../../src/actions/pipeline/TargetRoleRegistry.js';

describe('TargetValidationReporter', () => {
  let reporter;
  let logger;
  let trace;
  let nowSpy;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      debug: jest.fn(),
    };
    reporter = new TargetValidationReporter({ logger });
    trace = {
      step: jest.fn(),
      success: jest.fn(),
      captureActionData: jest.fn().mockResolvedValue(undefined),
    };
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('reports stage lifecycle events when trace supports them', () => {
    reporter.reportStageSkipped({
      trace,
      source: 'TargetComponentValidationStage.execute',
      reason: 'Skipped for config',
    });
    reporter.reportStageStart({
      trace,
      source: 'TargetComponentValidationStage.execute',
      candidateCount: 3,
      strictness: 'strict',
    });
    reporter.reportStageCompletion({
      trace,
      source: 'TargetComponentValidationStage.execute',
      candidateCount: 3,
      filteredCount: 2,
      duration: 4.5,
    });

    expect(trace.step).toHaveBeenCalledTimes(2);
    expect(trace.success).toHaveBeenCalledWith(
      'Target component validation completed: 2 of 3 actions passed',
      'TargetComponentValidationStage.execute',
      expect.objectContaining({ inputCount: 3, outputCount: 2, duration: 4.5 })
    );
  });

  it('emits validation analysis payload with target identifiers', async () => {
    const actionDef = {
      id: 'test:action',
      forbidden_components: { [LEGACY_TARGET_ROLE]: ['blocker'] },
      required_components: { [ALL_MULTI_TARGET_ROLES[0]]: ['needed'] },
    };
    const targetEntities = {
      [LEGACY_TARGET_ROLE]: [{ id: 'legacy-id' }],
      [ALL_MULTI_TARGET_ROLES[0]]: { id: 'multi-target-id' },
      [ACTOR_ROLE]: { id: 'actor-id' },
    };

    await reporter.reportValidationAnalysis({
      trace,
      actionDef,
      targetEntities,
      validation: { valid: false, reason: 'Test failure' },
      validationTime: 3,
    });

    expect(trace.captureActionData).toHaveBeenCalledWith(
      'target_component_validation',
      'test:action',
      expect.objectContaining({
        validationPassed: false,
        validationReason: 'Test failure',
        targetEntityIds: expect.objectContaining({
          [LEGACY_TARGET_ROLE]: 'legacy-id',
          [ALL_MULTI_TARGET_ROLES[0]]: 'multi-target-id',
          [ACTOR_ROLE]: 'actor-id',
        }),
        validationTime: 3,
        timestamp: 1700000000000,
      })
    );
  });

  it('reports performance data and logs debug on failure', async () => {
    const error = new Error('capture failed');
    trace.captureActionData.mockResolvedValueOnce(undefined);
    trace.captureActionData.mockRejectedValueOnce(error);

    await reporter.reportPerformanceData({
      trace,
      actionDef: { id: 'test:action' },
      startTime: 1,
      endTime: 6,
      totalCandidates: 4,
    });

    expect(trace.captureActionData).toHaveBeenNthCalledWith(
      1,
      'stage_performance',
      'test:action',
      expect.objectContaining({
        duration: 5,
        itemsProcessed: 4,
        timestamp: 1700000000000,
      })
    );

    await reporter.reportPerformanceData({
      trace,
      actionDef: { id: 'test:action' },
      startTime: 2,
      endTime: 4,
      totalCandidates: 2,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to capture performance data for action 'test:action': capture failed"
      )
    );
  });

  it('does not attempt action capture when trace lacks support', async () => {
    const minimalTrace = { step: jest.fn(), success: jest.fn() };

    await reporter.reportValidationAnalysis({
      trace: minimalTrace,
      actionDef: { id: 'noop' },
      targetEntities: null,
      validation: { valid: true },
      validationTime: 1,
    });

    await reporter.reportPerformanceData({
      trace: minimalTrace,
      actionDef: { id: 'noop' },
      startTime: 0,
      endTime: 1,
      totalCandidates: 1,
    });

    expect(minimalTrace.step).not.toHaveBeenCalled();
  });
});
