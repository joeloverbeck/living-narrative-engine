import { describe, it, expect, jest } from '@jest/globals';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_ERROR,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_DATA,
} from '../../../src/actions/tracing/traceContext.js';

describe('TraceContext', () => {
  it('initializes with empty logs', () => {
    const trace = new TraceContext();
    expect(trace.logs).toEqual([]);
  });

  it('adds a log entry without data', () => {
    const trace = new TraceContext();
    const before = Date.now();
    trace.addLog(TRACE_INFO, 'hello', 'tester');
    expect(trace.logs).toHaveLength(1);
    const entry = trace.logs[0];
    expect(entry.type).toBe(TRACE_INFO);
    expect(entry.message).toBe('hello');
    expect(entry.source).toBe('tester');
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry).not.toHaveProperty('data');
  });

  it('adds a log entry with data when provided', () => {
    const trace = new TraceContext();
    const data = { foo: 'bar' };
    trace.addLog(TRACE_ERROR, 'oops', 'tester', data);
    expect(trace.logs).toHaveLength(1);
    expect(trace.logs[0]).toMatchObject({
      type: TRACE_ERROR,
      message: 'oops',
      source: 'tester',
      data,
    });
  });

  it('preserves log order when multiple entries are added', () => {
    const trace = new TraceContext();
    trace.addLog(TRACE_INFO, 'first', 'src1');
    trace.addLog(TRACE_SUCCESS, 'second', 'src2', { value: 42 });
    expect(trace.logs.map((l) => l.message)).toEqual(['first', 'second']);
  });

  it('exposes helper methods for each log type', () => {
    const trace = new TraceContext();
    trace.info('i', 'src');
    trace.success('s', 'src');
    trace.failure('f', 'src');
    trace.step('p', 'src');
    trace.error('e', 'src');
    trace.data('d', 'src');

    expect(trace.logs.map((l) => l.type)).toEqual([
      TRACE_INFO,
      TRACE_SUCCESS,
      TRACE_FAILURE,
      TRACE_STEP,
      TRACE_ERROR,
      TRACE_DATA,
    ]);
  });

  it('records payloads supplied to helper methods', () => {
    const trace = new TraceContext();
    const payload = { answer: 42 };

    trace.data('with payload', 'helper', payload);

    expect(trace.logs).toHaveLength(1);
    expect(trace.logs[0]).toMatchObject({
      type: TRACE_DATA,
      message: 'with payload',
      source: 'helper',
      data: payload,
    });
  });

  it('includes payloads across helper wrappers when provided', () => {
    const cases = [
      ['info', TRACE_INFO],
      ['success', TRACE_SUCCESS],
      ['failure', TRACE_FAILURE],
      ['step', TRACE_STEP],
      ['error', TRACE_ERROR],
      ['data', TRACE_DATA],
    ];

    for (const [method, expectedType] of cases) {
      const trace = new TraceContext();
      const payload = { marker: method };
      const message = `message-${method}`;
      const source = `source-${method}`;

      trace[method](message, source, payload);

      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0]).toMatchObject({
        type: expectedType,
        message,
        source,
        data: payload,
      });
    }
  });

  describe('operator evaluation capture', () => {
    it('captures operator evaluation metadata with timestamps', () => {
      const trace = new TraceContext();
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(2020) // capturedAt
        .mockReturnValueOnce(3030); // log timestamp

      trace.captureOperatorEvaluation({
        operator: 'isSocketCovered',
        entityId: 'entity-1',
        result: true,
        reason: 'All sockets occupied',
        details: { sockets: 3 },
      });

      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0]).toMatchObject({
        type: TRACE_DATA,
        message: 'Operator evaluation: isSocketCovered',
        source: 'OperatorEvaluation',
        timestamp: 3030,
        data: {
          type: 'operator_evaluation',
          operator: 'isSocketCovered',
          entityId: 'entity-1',
          result: true,
          reason: 'All sockets occupied',
          details: { sockets: 3 },
          capturedAt: 2020,
        },
      });
      expect(trace.getOperatorEvaluations()).toEqual([
        {
          type: 'operator_evaluation',
          operator: 'isSocketCovered',
          entityId: 'entity-1',
          result: true,
          reason: 'All sockets occupied',
          details: { sockets: 3 },
          capturedAt: 2020,
        },
      ]);

      nowSpy.mockRestore();
    });

    it('filters operator evaluation entries from other log types', () => {
      const trace = new TraceContext();
      const sequence = [0, 1, 100, 101, 200, 201];
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => sequence.shift());

      trace.info('ignored info', 'source');
      trace.data('other data', 'source', { type: 'other' });

      trace.captureOperatorEvaluation({
        operator: 'first',
        entityId: 'a',
        result: false,
      });
      trace.captureOperatorEvaluation({
        operator: 'second',
        entityId: 'b',
        result: true,
      });

      const evaluations = trace.getOperatorEvaluations();

      expect(evaluations).toHaveLength(2);
      expect(evaluations.map((entry) => entry.operator)).toEqual([
        'first',
        'second',
      ]);
      expect(evaluations.map((entry) => entry.capturedAt)).toEqual([100, 200]);

      nowSpy.mockRestore();
    });
  });

  describe('scope evaluation capture', () => {
    it('captures scope evaluation metadata with timestamps', () => {
      const trace = new TraceContext();
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(2020) // capturedAt
        .mockReturnValueOnce(3030); // log timestamp

      trace.captureScopeEvaluation({
        scopeId: 'affection:close_actors_facing_each_other',
        actorId: 'actor1',
        candidateEntities: ['target1', 'target2', 'target3'],
        resolvedEntities: ['target1'],
        success: true,
        context: {
          actorId: 'actor1',
          hasFilters: true,
        },
        filterResults: [
          {
            filter: { '==': [{ var: 'facing' }, 'toward'] },
            passed: ['target1'],
            failed: ['target2', 'target3'],
          },
        ],
      });

      expect(trace.logs).toHaveLength(1);
      expect(trace.logs[0]).toMatchObject({
        type: TRACE_DATA,
        message: 'Scope evaluation: affection:close_actors_facing_each_other',
        source: 'ScopeEvaluation',
        timestamp: 3030,
        data: {
          type: 'scope_evaluation',
          scopeId: 'affection:close_actors_facing_each_other',
          actorId: 'actor1',
          candidateEntities: ['target1', 'target2', 'target3'],
          resolvedEntities: ['target1'],
          success: true,
          context: {
            actorId: 'actor1',
            hasFilters: true,
          },
          filterResults: [
            {
              filter: { '==': [{ var: 'facing' }, 'toward'] },
              passed: ['target1'],
              failed: ['target2', 'target3'],
            },
          ],
          capturedAt: 2020,
        },
      });
      expect(trace.getScopeEvaluations()).toEqual([
        {
          type: 'scope_evaluation',
          scopeId: 'affection:close_actors_facing_each_other',
          actorId: 'actor1',
          candidateEntities: ['target1', 'target2', 'target3'],
          resolvedEntities: ['target1'],
          success: true,
          context: {
            actorId: 'actor1',
            hasFilters: true,
          },
          filterResults: [
            {
              filter: { '==': [{ var: 'facing' }, 'toward'] },
              passed: ['target1'],
              failed: ['target2', 'target3'],
            },
          ],
          capturedAt: 2020,
        },
      ]);

      nowSpy.mockRestore();
    });

    it('filters scope evaluation entries from other log types', () => {
      const trace = new TraceContext();
      const sequence = [0, 1, 100, 101, 200, 201];
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => sequence.shift());

      trace.info('ignored info', 'source');
      trace.data('other data', 'source', { type: 'other' });

      trace.captureScopeEvaluation({
        scopeId: 'affection:first_scope',
        actorId: 'actor-a',
        candidateEntities: ['entity1', 'entity2'],
        resolvedEntities: ['entity1'],
      });
      trace.captureScopeEvaluation({
        scopeId: 'positioning:second_scope',
        actorId: 'actor-b',
        candidateEntities: ['entity3'],
        resolvedEntities: [],
      });

      const evaluations = trace.getScopeEvaluations();

      expect(evaluations).toHaveLength(2);
      expect(evaluations.map((entry) => entry.scopeId)).toEqual([
        'affection:first_scope',
        'positioning:second_scope',
      ]);
      expect(evaluations.map((entry) => entry.capturedAt)).toEqual([100, 200]);

      nowSpy.mockRestore();
    });

    it('returns empty array when no scope evaluations captured', () => {
      const trace = new TraceContext();
      trace.info('just an info log', 'source');
      trace.data('other data', 'source', { type: 'other' });

      const evaluations = trace.getScopeEvaluations();

      expect(evaluations).toEqual([]);
    });

    it('does not affect existing operator evaluation methods', () => {
      const trace = new TraceContext();
      const sequence = [100, 101, 200, 201];
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => sequence.shift());

      // Add both operator and scope evaluations
      trace.captureOperatorEvaluation({
        operator: 'testOperator',
        entityId: 'entity1',
        result: true,
      });

      trace.captureScopeEvaluation({
        scopeId: 'test:scope',
        actorId: 'actor1',
        candidateEntities: [],
        resolvedEntities: [],
      });

      // Verify they are properly separated
      const operatorEvals = trace.getOperatorEvaluations();
      const scopeEvals = trace.getScopeEvaluations();

      expect(operatorEvals).toHaveLength(1);
      expect(operatorEvals[0].operator).toBe('testOperator');

      expect(scopeEvals).toHaveLength(1);
      expect(scopeEvals[0].scopeId).toBe('test:scope');

      nowSpy.mockRestore();
    });
  });
});
