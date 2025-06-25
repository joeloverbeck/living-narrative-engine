/**
 * @file Tests the tracing behavior inside ActionDiscoveryService.
 * @see tests/unit/actions/actionDiscoveryService.tracing.test.js
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { mock, mockDeep } from 'jest-mock-extended';

// Mock TraceContext and its constructor
jest.mock('../../../src/actions/tracing/traceContext.js', () => {
  return {
    TraceContext: jest.fn().mockImplementation(() => ({
      addLog: jest.fn(),
      logs: [],
    })),
  };
});

describe('ActionDiscoveryService Tracing', () => {
  let service;
  let deps;
  let actorEntity;
  let context;

  const actionDefPrereq = { id: 'action1', name: 'With Prereqs', prerequisites: [{ op: 'test' }], scope: 'someScope' };
  const actionDefScope = { id: 'action2', name: 'With Scope', scope: 'someScope' };
  const actionDefSimple = { id: 'action3', name: 'Simple', scope: 'none' };

  beforeEach(() => {
    jest.clearAllMocks();

    deps = {
      gameDataRepository: mockDeep(),
      entityManager: mockDeep(),
      prerequisiteEvaluationService: mock(),
      actionIndex: mock(),
      logger: mock(),
      formatActionCommandFn: jest.fn(),
      safeEventDispatcher: mockDeep(),
      targetResolutionService: {
        resolveTargets: jest.fn(),
      },
      traceContextFactory: jest.fn(() => new TraceContext()),
      getActorLocationFn: jest.fn(),
      getEntityDisplayNameFn: jest.fn(),
    };

    actorEntity = { id: 'player' };
    context = { a: 1 };

    // Default mock behaviors
    deps.getActorLocationFn.mockReturnValue('location1');
    deps.actionIndex.getCandidateActions.mockReturnValue([]);
    deps.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
    deps.targetResolutionService.resolveTargets.mockImplementation(async (scopeName) => {
      if (scopeName === 'someScope') return [
        { type: 'entity', entityId: 'target1' },
        { type: 'entity', entityId: 'target2' }
      ];
      if (scopeName === 'none') return [{ type: 'none', entityId: null }];
      if (scopeName === 'self') return [{ type: 'entity', entityId: actorEntity.id }];
      return [];
    });
    deps.formatActionCommandFn.mockReturnValue({ ok: true, value: 'do action' });

    service = new ActionDiscoveryService(deps);
  });

  // New test structure for getValidActions with tracing
  describe('getValidActions({ trace: true })', () => {

    it('should create a new TraceContext and log the start of the trace', async () => {
      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });

      expect(TraceContext).toHaveBeenCalledTimes(1);
      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        `Starting action discovery for actor '${actorEntity.id}'.`,
        'getValidActions',
        { withTrace: true }
      );
    });

    it('should call getCandidateActions with the actor and the trace object', async () => {
      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });

      expect(deps.actionIndex.getCandidateActions).toHaveBeenCalledWith(actorEntity, trace);
    });

    it('should log each candidate action being processed', async () => {
      deps.actionIndex.getCandidateActions.mockReturnValue([actionDefSimple, actionDefScope]);

      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });

      expect(trace.addLog).toHaveBeenCalledWith(
        'step',
        `Processing candidate action: '${actionDefSimple.id}'`,
        'ActionDiscoveryService.#processCandidateAction'
      );
      expect(trace.addLog).toHaveBeenCalledWith(
        'step',
        `Processing candidate action: '${actionDefScope.id}'`,
        'ActionDiscoveryService.#processCandidateAction'
      );
    });

    it('should pass the trace object to the prerequisite check', async () => {
      deps.actionIndex.getCandidateActions.mockReturnValue([actionDefPrereq]);
      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });

      expect(deps.prerequisiteEvaluationService.evaluate).toHaveBeenCalledWith(
        actionDefPrereq.prerequisites,
        actionDefPrereq,
        actorEntity,
        trace // The trace object
      );
    });

    it('should log when prerequisites pass', async () => {
      deps.actionIndex.getCandidateActions.mockReturnValue([actionDefPrereq]);
      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });

      expect(trace.addLog).toHaveBeenCalledWith(
        'success',
        `Action '${actionDefPrereq.id}' passed actor prerequisite check.`,
        'ActionDiscoveryService.#processCandidateAction'
      );
    });

    it('should log and discard action when prerequisites fail', async () => {
      deps.actionIndex.getCandidateActions.mockReturnValue([actionDefPrereq]);
      deps.prerequisiteEvaluationService.evaluate.mockReturnValue(false);

      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });

      expect(trace.addLog).toHaveBeenCalledWith(
        'failure',
        `Action '${actionDefPrereq.id}' discarded due to failed actor prerequisites.`,
        'ActionDiscoveryService.#processCandidateAction'
      );
      // The rest of the processing for this action should be skipped
      expect(deps.targetResolutionService.resolveTargets).not.toHaveBeenCalled();
    });

    it('should pass the trace object to the scope resolution', async () => {
      deps.actionIndex.getCandidateActions.mockReturnValue([actionDefScope]);
      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });

      expect(deps.targetResolutionService.resolveTargets).toHaveBeenCalledWith(
        actionDefScope.scope,
        actorEntity,
        expect.anything(), // The runtime context
        trace // The trace object
      );
    });

    it('should orchestrate a full trace, logging multiple steps in order', async () => {
      deps.actionIndex.getCandidateActions.mockReturnValue([actionDefPrereq, actionDefScope]);
      deps.prerequisiteEvaluationService.evaluate.mockImplementation((prereqs, actionDef) => {
        // Fail prereqs only for the first action
        return actionDef.id !== actionDefPrereq.id;
      });

      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });
      const calls = trace.addLog.mock.calls;

      expect(calls[0][1]).toContain('Starting action discovery');
      expect(calls[1][1]).toContain(`Processing candidate action: '${actionDefPrereq.id}'`);
      expect(calls[2][1]).toContain(`discarded due to failed actor prerequisites`);
      expect(calls[3][1]).toContain(`Processing candidate action: '${actionDefScope.id}'`);
      expect(calls[4][1]).toContain('passed actor prerequisite check');

      // The trace logging has changed since we now delegate to the TargetResolutionService
      // Find the final log message in the calls array
      const finalLogCall = calls.find(call => call[1].includes("Finished discovery"));
      expect(finalLogCall).toBeDefined();
      expect(finalLogCall[1]).toContain("Finished discovery. Found 2 valid actions");
    });

    it('should return the populated trace object in the result', async () => {
      const { trace } = await service.getValidActions(actorEntity, context, { trace: true });
      expect(trace).not.toBeNull();
      expect(trace).toBeInstanceOf(Object);
      expect(trace.addLog).toBeDefined();
    });

    it('should return a null trace when tracing is disabled', async () => {
      const { trace } = await service.getValidActions(actorEntity, context, { trace: false });
      expect(trace).toBeNull();
      expect(TraceContext).not.toHaveBeenCalled();
    });
  });
});
