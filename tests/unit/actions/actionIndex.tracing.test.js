/**
 * @file Tests the tracing behavior inside ActionIndex.
 * @see tests/unit/actionIndex.tracing.test.js
 */

// tests/actions/actionIndex.test.js

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import {
  TraceContext,
  TRACE_DATA,
  TRACE_INFO,
  TRACE_SUCCESS,
} from '../../../src/actions/tracing/traceContext.js';
import { mock } from 'jest-mock-extended';

// Mock the TraceContext to spy on its methods
jest.mock('../../../src/actions/tracing/traceContext.js', () => {
  const actual = jest.requireActual(
    '../../../src/actions/tracing/traceContext.js'
  );
  return {
    ...actual,
    TraceContext: jest.fn().mockImplementation(() => ({
      addLog: jest.fn(),
      info(msg, src, data) {
        data === undefined
          ? this.addLog(actual.TRACE_INFO, msg, src)
          : this.addLog(actual.TRACE_INFO, msg, src, data);
      },
      success(msg, src, data) {
        data === undefined
          ? this.addLog(actual.TRACE_SUCCESS, msg, src)
          : this.addLog(actual.TRACE_SUCCESS, msg, src, data);
      },
      failure(msg, src, data) {
        data === undefined
          ? this.addLog(actual.TRACE_FAILURE, msg, src)
          : this.addLog(actual.TRACE_FAILURE, msg, src, data);
      },
      step(msg, src, data) {
        data === undefined
          ? this.addLog(actual.TRACE_STEP, msg, src)
          : this.addLog(actual.TRACE_STEP, msg, src, data);
      },
      error(msg, src, data) {
        data === undefined
          ? this.addLog(actual.TRACE_ERROR, msg, src)
          : this.addLog(actual.TRACE_ERROR, msg, src, data);
      },
      data(msg, src, data) {
        data === undefined
          ? this.addLog(actual.TRACE_DATA, msg, src)
          : this.addLog(actual.TRACE_DATA, msg, src, data);
      },
      logs: [],
      result: null,
    })),
  };
});

describe('ActionIndex', () => {
  let logger;
  let entityManager;
  let actionIndex;

  // Action definitions for testing
  const actionDef1 = { id: 'action1', name: 'Action One' };
  const actionDef2 = {
    id: 'action2',
    name: 'Action Two',
    required_components: { actor: ['componentA'] },
  };
  const actionDef3 = {
    id: 'action3',
    name: 'Action Three',
    required_components: { actor: ['componentB'] },
  };
  const actionDef4 = {
    id: 'action4',
    name: 'Action Four',
    required_components: { actor: ['componentA', 'componentC'] },
  };
  const allActions = [actionDef1, actionDef2, actionDef3, actionDef4];

  beforeEach(() => {
    logger = mock();
    entityManager = mock();
    actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex(allActions);
    // Clear mock history before each test
    jest.clearAllMocks();
  });

  describe('getCandidateActions', () => {
    it('should return an empty array if actorEntity is null or has no id', () => {
      expect(actionIndex.getCandidateActions(null)).toEqual([]);
      expect(actionIndex.getCandidateActions({})).toEqual([]);
    });

    it('should return actions with no requirements if actor has no matching components', () => {
      const actorEntity = { id: 'actor1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'componentD',
      ]);
      const candidates = actionIndex.getCandidateActions(actorEntity);
      expect(candidates).toHaveLength(1);
      expect(candidates).toContain(actionDef1);
    });

    it('should return a unique set of actions based on actor components', () => {
      const actorEntity = { id: 'actor1' };
      entityManager.getAllComponentTypesForEntity.mockReturnValue([
        'componentA',
        'componentC',
      ]);
      const candidates = actionIndex.getCandidateActions(actorEntity);
      // Expect action1 (no req), action2 (req A), action4 (req A, C)
      expect(candidates).toHaveLength(3);
      expect(candidates).toContain(actionDef1);
      expect(candidates).toContain(actionDef2);
      expect(candidates).toContain(actionDef4);
      expect(candidates).not.toContain(actionDef3);
    });

    describe('with Tracing', () => {
      let trace;
      let actorEntity;
      const source = 'ActionIndex.getCandidateActions';

      beforeEach(() => {
        trace = new TraceContext();
        actorEntity = { id: 'player' };
      });

      it('should not call trace.addLog if trace parameter is null', () => {
        entityManager.getAllComponentTypesForEntity.mockReturnValue([
          'componentA',
        ]);
        actionIndex.getCandidateActions(actorEntity, null);
        expect(trace.addLog).not.toHaveBeenCalled();
      });

      it('should log actor components when tracing', () => {
        const components = ['componentA', 'componentB'];
        entityManager.getAllComponentTypesForEntity.mockReturnValue(components);

        actionIndex.getCandidateActions(actorEntity, trace);

        expect(trace.addLog).toHaveBeenCalledWith(
          TRACE_DATA,
          `Actor '${actorEntity.id}' has components.`,
          source,
          { components: components }
        );
      });

      it('should log the addition of actions with no actor requirements', () => {
        entityManager.getAllComponentTypesForEntity.mockReturnValue([]);

        actionIndex.getCandidateActions(actorEntity, trace);

        expect(trace.addLog).toHaveBeenCalledWith(
          TRACE_INFO,
          'Added 1 actions with no actor component requirements.',
          source
        );
      });

      it('should log when actions are found for a specific component', () => {
        entityManager.getAllComponentTypesForEntity.mockReturnValue([
          'componentA',
        ]);

        actionIndex.getCandidateActions(actorEntity, trace);

        // action2 and action4 require componentA
        expect(trace.addLog).toHaveBeenCalledWith(
          TRACE_INFO,
          `Found 2 actions requiring component 'componentA'.`,
          source
        );
      });

      it('should not log if no actions are found for a component', () => {
        entityManager.getAllComponentTypesForEntity.mockReturnValue([
          'componentD',
        ]);

        actionIndex.getCandidateActions(actorEntity, trace);

        // Ensure the 'Found X actions' log is not called for componentD
        const calls = trace.addLog.mock.calls;
        const foundActionLogs = calls.filter((call) =>
          call[1].startsWith('Found')
        );
        expect(foundActionLogs).toHaveLength(0);
      });

      it('should log the final list of candidate actions and their IDs', () => {
        const components = ['componentA'];
        entityManager.getAllComponentTypesForEntity.mockReturnValue(components);

        const candidates = actionIndex.getCandidateActions(actorEntity, trace);
        const candidateIds = candidates.map((a) => a.id);

        expect(trace.addLog).toHaveBeenCalledWith(
          TRACE_SUCCESS,
          `Final candidate list contains ${candidates.length} unique actions.`,
          source,
          { actionIds: candidateIds }
        );
        // Should contain action1, action2, action4
        expect(candidateIds).toEqual(
          expect.arrayContaining(['action1', 'action2', 'action4'])
        );
        expect(candidates.length).toBe(3);
      });

      it('should perform all logging steps in the correct order', () => {
        const components = ['componentB'];
        entityManager.getAllComponentTypesForEntity.mockReturnValue(components);

        actionIndex.getCandidateActions(actorEntity, trace);

        const calls = trace.addLog.mock.calls;
        expect(calls).toHaveLength(4);
        expect(calls[0][0]).toBe(TRACE_DATA); // components
        expect(calls[0][1]).toContain('has components');

        expect(calls[1][0]).toBe(TRACE_INFO); // no requirement
        expect(calls[1][1]).toContain('no actor component requirements');

        expect(calls[2][0]).toBe(TRACE_INFO); // componentB actions
        expect(calls[2][1]).toContain("requiring component 'componentB'");

        expect(calls[3][0]).toBe(TRACE_SUCCESS); // final list
        expect(calls[3][1]).toContain('Final candidate list');
      });
    });
  });
});
