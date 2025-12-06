import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_ERROR,
  TRACE_DATA,
} from '../../../../src/actions/tracing/traceContext.js';

const FIXED_TIMESTAMP = 1700000000000;

describe('TraceContext', () => {
  let traceContext;
  let dateNowSpy;
  let currentTimestamp;

  beforeEach(() => {
    traceContext = new TraceContext();
    currentTimestamp = FIXED_TIMESTAMP;
    dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => currentTimestamp++);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe('addLog', () => {
    it('stores log entries with timestamps and optional data', () => {
      const payload = { detail: 'important' };

      traceContext.addLog(TRACE_INFO, 'message', 'TestSource', payload);

      expect(traceContext.logs).toHaveLength(1);
      expect(traceContext.logs[0]).toEqual({
        type: TRACE_INFO,
        message: 'message',
        source: 'TestSource',
        timestamp: FIXED_TIMESTAMP,
        data: payload,
      });
    });

    it('omits data property when value is null or undefined', () => {
      traceContext.addLog(TRACE_SUCCESS, 'null data', 'NullSource', null);
      traceContext.addLog(
        TRACE_SUCCESS,
        'undefined data',
        'UndefinedSource',
        undefined
      );

      expect(traceContext.logs).toHaveLength(2);
      expect(traceContext.logs[0]).toEqual({
        type: TRACE_SUCCESS,
        message: 'null data',
        source: 'NullSource',
        timestamp: FIXED_TIMESTAMP,
      });
      expect(traceContext.logs[1]).toEqual({
        type: TRACE_SUCCESS,
        message: 'undefined data',
        source: 'UndefinedSource',
        timestamp: FIXED_TIMESTAMP + 1,
      });
    });
  });

  describe('convenience wrappers', () => {
    it('records log types without payload when omitted', () => {
      traceContext.info('info message', 'InfoSource');
      traceContext.success('success message', 'SuccessSource');
      traceContext.failure('failure message', 'FailureSource');
      traceContext.step('step message', 'StepSource');
      traceContext.error('error message', 'ErrorSource');
      traceContext.data('data message', 'DataSource');

      const types = traceContext.logs.map((entry) => entry.type);
      expect(types).toEqual([
        TRACE_INFO,
        TRACE_SUCCESS,
        TRACE_FAILURE,
        TRACE_STEP,
        TRACE_ERROR,
        TRACE_DATA,
      ]);
      expect(traceContext.logs.every((entry) => entry.data === undefined)).toBe(
        true
      );
    });

    it('records payload when provided explicitly', () => {
      const payload = { context: 'useful' };

      traceContext.info('info', 'InfoSource', payload);
      traceContext.success('success', 'SuccessSource', payload);
      traceContext.failure('failure', 'FailureSource', payload);
      traceContext.step('step', 'StepSource', payload);
      traceContext.error('error', 'ErrorSource', payload);
      traceContext.data('data', 'DataSource', payload);

      traceContext.logs.forEach((entry) => {
        expect(entry.data).toBe(payload);
      });
    });
  });

  describe('operator evaluations', () => {
    it('captures operator evaluation data as trace entries', () => {
      const operatorData = {
        operator: 'isSocketCovered',
        entityId: 'socket-1',
        result: true,
        reason: 'Socket already used',
      };

      traceContext.captureOperatorEvaluation(operatorData);

      expect(traceContext.logs).toHaveLength(1);
      const [entry] = traceContext.logs;
      expect(entry.type).toBe(TRACE_DATA);
      expect(entry.message).toBe('Operator evaluation: isSocketCovered');
      expect(entry.source).toBe('OperatorEvaluation');
      expect(entry.data).toMatchObject({
        type: 'operator_evaluation',
        ...operatorData,
      });
      expect(entry.data.capturedAt).toBeGreaterThanOrEqual(FIXED_TIMESTAMP);
      expect(traceContext.getOperatorEvaluations()).toEqual([entry.data]);
    });

    it('filters out non operator entries in getOperatorEvaluations', () => {
      traceContext.addLog(TRACE_INFO, 'regular info', 'Info');
      traceContext.captureOperatorEvaluation({
        operator: 'test',
        entityId: '1',
        result: false,
      });
      traceContext.addLog(TRACE_DATA, 'Other data', 'Misc', { type: 'other' });

      const evaluations = traceContext.getOperatorEvaluations();
      expect(evaluations).toHaveLength(1);
      expect(evaluations[0].operator).toBe('test');
    });
  });

  describe('scope evaluations', () => {
    it('captures scope evaluation data as trace entries', () => {
      const scopeData = {
        scopeId: 'scope-1',
        actorId: 'actor-42',
        candidateEntities: ['a', 'b'],
        resolvedEntities: ['b'],
        filterResults: [{ filter: 'type', passed: true }],
      };

      traceContext.captureScopeEvaluation(scopeData);

      expect(traceContext.logs).toHaveLength(1);
      const [entry] = traceContext.logs;
      expect(entry.type).toBe(TRACE_DATA);
      expect(entry.message).toBe('Scope evaluation: scope-1');
      expect(entry.source).toBe('ScopeEvaluation');
      expect(entry.data).toMatchObject({
        type: 'scope_evaluation',
        ...scopeData,
      });
      expect(entry.data.capturedAt).toBe(FIXED_TIMESTAMP);
      expect(traceContext.getScopeEvaluations()).toEqual([entry.data]);
    });

    it('filters out non scope entries in getScopeEvaluations', () => {
      traceContext.addLog(TRACE_STEP, 'progress', 'Stage');
      traceContext.captureScopeEvaluation({
        scopeId: 'scope-2',
        actorId: 'actor',
        candidateEntities: [],
        resolvedEntities: [],
      });
      traceContext.captureOperatorEvaluation({
        operator: 'other',
        entityId: 'x',
        result: true,
      });

      const scopeEvaluations = traceContext.getScopeEvaluations();
      expect(scopeEvaluations).toHaveLength(1);
      expect(scopeEvaluations[0].scopeId).toBe('scope-2');
    });
  });
});
