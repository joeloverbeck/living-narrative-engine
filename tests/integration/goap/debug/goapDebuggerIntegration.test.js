/**
 * @file Integration tests for GOAPDebugger with real services
 * Tests GOAPDebugger coordinating all debug tools
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import GOAPDebugger from '../../../../src/goap/debug/goapDebugger.js';
import PlanInspector from '../../../../src/goap/debug/planInspector.js';
import StateDiffViewer from '../../../../src/goap/debug/stateDiffViewer.js';
import RefinementTracer from '../../../../src/goap/debug/refinementTracer.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT } from '../../../../src/goap/debug/goapDebuggerDiagnosticsContract.js';
import { createGoapEventTraceProbe } from '../../../../src/goap/debug/goapEventTraceProbe.js';
import { createGoapEventDispatcher } from '../../../../src/goap/debug/goapEventDispatcher.js';
import { createEventBusMock } from '../../../common/mocks/createEventBusMock.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';
import { emitGoapEvent } from '../../../../src/goap/events/goapEventFactory.js';

describe('GOAPDebugger Integration', () => {
  let testBed;
  let goapDebugger;
  let mockController;
  let mockDataRegistry;
  let entityManager;
  let logger;
  let eventTraceProbe;
  let planInspector;
  let stateDiffViewer;
  let refinementTracer;
  let mockGoapEventDispatcher;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
    entityManager = new SimpleEntityManager();

    // Mock GOAP controller with nested failure structure
    mockController = {
      getActivePlan: jest.fn().mockReturnValue(null),
      getCurrentGoal: jest.fn().mockReturnValue(null),
      getFailedGoals: jest.fn().mockReturnValue([]),
      getFailedTasks: jest.fn().mockReturnValue([]),
      getDependencyDiagnostics: jest.fn().mockReturnValue([]),
      getNumericConstraintDiagnostics: jest.fn().mockReturnValue({
        actorId: 'test-actor',
        totalFallbacks: 0,
        recent: [],
      }),
      getTaskLibraryDiagnostics: jest.fn().mockReturnValue(null),
      getPlanningStateDiagnostics: jest.fn().mockReturnValue(null),
      getEventComplianceDiagnostics: jest.fn().mockReturnValue({
        actor: { actorId: 'test-actor', totalEvents: 0, missingPayloads: 0 },
        global: { actorId: 'global', totalEvents: 0, missingPayloads: 0 },
      }),
      getGoalPathDiagnostics: jest.fn().mockReturnValue(null),
      getEffectFailureTelemetry: jest.fn().mockReturnValue(null),
      getDiagnosticsContractVersion: jest
        .fn()
        .mockReturnValue(GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.version),
    };

    // Mock data registry for action/task names
    mockDataRegistry = {
      get: jest.fn((key) => {
        if (key === 'tasks') return new Map();
        if (key === 'actions') return new Map();
        return null;
      }),
      getActionById: jest.fn().mockReturnValue(null),
      getTaskById: jest.fn().mockReturnValue(null),
    };

    // Mock entity display data provider
    const mockEntityDisplayProvider = {
      getEntityDisplayData: jest.fn((id) => ({ name: `Entity-${id}` })),
    };

    // Create real debug tool instances
    planInspector = new PlanInspector({
      goapController: mockController,
      dataRegistry: mockDataRegistry,
      entityManager,
      entityDisplayDataProvider: mockEntityDisplayProvider,
      logger,
    });

    stateDiffViewer = new StateDiffViewer({ logger });

    // Mock event bus for RefinementTracer
    const mockEventBus = testBed.createMock('eventBus', [
      'dispatch',
      'subscribe',
      'unsubscribe',
      'on',
      'off',
    ]);

    // Mock game data repository for RefinementTracer
    const mockGameDataRepository = {
      get: jest.fn().mockReturnValue(new Map()),
    };

    refinementTracer = new RefinementTracer({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      logger,
    });

    mockGoapEventDispatcher = {
      getProbeDiagnostics: jest.fn().mockReturnValue({
        totalRegistered: 1,
        totalAttachedEver: 1,
        totalDetached: 0,
        lastAttachedAt: Date.now(),
        lastDetachedAt: null,
        hasProbes: true,
      }),
    };

    eventTraceProbe = {
      record: jest.fn(),
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      getSnapshot: jest.fn().mockReturnValue({
        actorId: 'test-actor',
        capturing: false,
        totalCaptured: 0,
        totalViolations: 0,
        events: [],
      }),
      clear: jest.fn(),
    };

    // Create GOAPDebugger with real tools
    goapDebugger = new GOAPDebugger({
      goapController: mockController,
      planInspector,
      stateDiffViewer,
      refinementTracer,
      eventTraceProbe,
      goapEventDispatcher: mockGoapEventDispatcher,
      logger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Plan Inspection', () => {
    it('should inspect active plan for actor', () => {
      const actorId = 'test-actor';

      const planText = goapDebugger.inspectPlan(actorId);

      expect(planText).toBeDefined();
      expect(typeof planText).toBe('string');
      expect(mockController.getActivePlan).toHaveBeenCalledWith(actorId);
    });

    it('should return JSON plan data', () => {
      const actorId = 'test-actor';

      const planData = goapDebugger.inspectPlanJSON(actorId);

      // Will be null if no active plan
      expect(planData === null || typeof planData === 'object').toBe(true);
    });

    it('should get current goal for actor', () => {
      const actorId = 'test-actor';

      const goal = goapDebugger.inspectCurrentGoal(actorId);

      // Will be null if no active goal
      expect(goal === null || typeof goal === 'object').toBe(true);
    });
  });

  describe('Failure History', () => {
    it('should return empty failure history for new actor', () => {
      const actorId = 'test-actor';

      const failures = goapDebugger.getFailureHistory(actorId);

      expect(failures).toEqual({
        failedGoals: [],
        failedTasks: [],
      });
    });

    it('should handle nested failure structure', () => {
      const actorId = 'test-actor';

      // Set up nested failure structure
      mockController.getFailedGoals.mockReturnValue([
        {
          goalId: 'goal-1',
          failures: [
            { reason: 'precondition failed', timestamp: 1000 },
            { reason: 'no valid tasks', timestamp: 2000 },
          ],
        },
      ]);

      mockController.getFailedTasks.mockReturnValue([
        {
          taskId: 'task-1',
          failures: [{ reason: 'refinement failed', timestamp: 3000 }],
        },
      ]);

      const failures = goapDebugger.getFailureHistory(actorId);

      // Verify structure matches expected nested format
      expect(Array.isArray(failures.failedGoals)).toBe(true);
      expect(Array.isArray(failures.failedTasks)).toBe(true);
      expect(failures.failedGoals).toHaveLength(1);
      expect(failures.failedGoals[0].failures).toHaveLength(2);
      expect(failures.failedTasks).toHaveLength(1);
      expect(failures.failedTasks[0].failures).toHaveLength(1);
    });
  });

  it('captures GOAP events in the event stream probe', () => {
    const traceProbe = createGoapEventTraceProbe({ logger });
    const eventBusMock = createEventBusMock();
    const goapDispatcher = createGoapEventDispatcher(eventBusMock, logger, {
      probes: [traceProbe],
    });

    const debuggerWithRealProbe = new GOAPDebugger({
      goapController: mockController,
      planInspector,
      stateDiffViewer,
      refinementTracer,
      eventTraceProbe: traceProbe,
      goapEventDispatcher: goapDispatcher,
      logger,
    });

    debuggerWithRealProbe.startTrace('test-actor');
    const context = { actorId: 'test-actor', taskId: 'test-task' };

    emitGoapEvent(
      goapDispatcher,
      GOAP_EVENTS.REFINEMENT_STARTED,
      {
        actorId: 'test-actor',
        taskId: 'test-task',
      },
      context
    );
    emitGoapEvent(
      goapDispatcher,
      GOAP_EVENTS.METHOD_SELECTED,
      {
        actorId: 'test-actor',
        taskId: 'test-task',
        methodId: 'method-1',
      },
      context
    );
    emitGoapEvent(
      goapDispatcher,
      GOAP_EVENTS.REFINEMENT_STEP_STARTED,
      {
        actorId: 'test-actor',
        taskId: 'test-task',
        stepIndex: 0,
        step: { stepType: 'primitive_action' },
      },
      context
    );
    emitGoapEvent(
      goapDispatcher,
      GOAP_EVENTS.REFINEMENT_STATE_UPDATED,
      {
        actorId: 'test-actor',
        taskId: 'test-task',
        key: 'step0',
        newValue: 'ok',
      },
      context
    );
    emitGoapEvent(
      goapDispatcher,
      GOAP_EVENTS.REFINEMENT_STEP_COMPLETED,
      {
        actorId: 'test-actor',
        taskId: 'test-task',
        stepIndex: 0,
        result: { success: true },
      },
      context
    );
    emitGoapEvent(
      goapDispatcher,
      GOAP_EVENTS.REFINEMENT_COMPLETED,
      {
        actorId: 'test-actor',
        taskId: 'test-task',
        methodId: 'method-1',
        stepsExecuted: 1,
        success: true,
      },
      context
    );

    const eventStream = debuggerWithRealProbe.getEventStream('test-actor');
    expect(eventStream.events.length).toBeGreaterThanOrEqual(5);
    eventStream.events.forEach((event) => {
      expect(event.payload.actorId).toBe('test-actor');
    });
  });

  describe('State Diff', () => {
    it('should show diff between planning states', () => {
      const beforeState = { hunger: 10, health: 100 };
      const afterState = { hunger: 5, health: 100 };

      const diffText = goapDebugger.showStateDiff(beforeState, afterState);

      expect(diffText).toBeDefined();
      expect(typeof diffText).toBe('string');
    });

    it('should return diff as JSON', () => {
      const beforeState = { hunger: 10 };
      const afterState = { hunger: 5 };

      const diffData = goapDebugger.showStateDiffJSON(beforeState, afterState);

      expect(diffData).toBeDefined();
      expect(typeof diffData).toBe('object');
    });
  });

  describe('Refinement Tracing', () => {
    it('should start and stop trace for actor', () => {
      const actorId = 'test-actor';

      // Start trace
      goapDebugger.startTrace(actorId);

      // Get current trace
      const trace = goapDebugger.getTrace(actorId);
      expect(trace).toBeDefined();

      // Stop trace
      const stoppedTrace = goapDebugger.stopTrace(actorId);
      expect(stoppedTrace).toBeDefined();
    });

    it('should format trace as text', () => {
      const actorId = 'test-actor';

      goapDebugger.startTrace(actorId);
      const trace = goapDebugger.stopTrace(actorId);

      // Trace may be null if no refinement occurred
      expect(trace === null || typeof trace === 'object').toBe(true);

      // Only test formatting if trace exists
      const formatted = goapDebugger.formatTrace(trace);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Combined Reporting', () => {
    it('should generate comprehensive text report', () => {
      const actorId = 'test-actor';

      const report = goapDebugger.generateReport(actorId);

      expect(report).toContain('GOAP Debug Report');
      expect(report).toContain('Active Plan');
      expect(report).toContain('Failure History');
      expect(report).toContain('Dependency Contracts');
      expect(report).toContain('Task Library Diagnostics');
      expect(report).toContain('Planning State Diagnostics');
      expect(report).toContain('End Report');
      expect(report).toContain('No task library diagnostics captured.');
      expect(report).toContain('No planning-state diagnostics captured');
    });

    it('should generate JSON report with all data', () => {
      const actorId = 'test-actor';

      const report = goapDebugger.generateReportJSON(actorId);

      expect(report).toHaveProperty('actorId', actorId);
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('plan');
      expect(report).toHaveProperty('failures');
      expect(report).toHaveProperty('dependencies');
      expect(report).toHaveProperty('trace');
      expect(report).toHaveProperty('taskLibraryDiagnostics', null);
      expect(report).toHaveProperty('planningStateDiagnostics', null);
    });

    it('should include trace in report when active', () => {
      const actorId = 'test-actor';

      // Start trace before generating report
      goapDebugger.startTrace(actorId);

      const report = goapDebugger.generateReport(actorId);

      // Should include active trace section
      expect(report).toContain('Active Trace');
    });

    it('should render diagnostics data when available', () => {
      const actorId = 'test-actor';

      mockController.getTaskLibraryDiagnostics.mockReturnValue({
        timestamp: 1731638400000,
        totalTasks: 7,
        namespaces: {
          core: { taskCount: 4 },
          crafting: { taskCount: 3 },
        },
        missingActors: ['actor-missing'],
        warnings: ['Deprecated namespace detected'],
      });

      mockController.getPlanningStateDiagnostics.mockReturnValue({
        actorId,
        totalMisses: 2,
        lastMisses: [
          {
            timestamp: 1731638400001,
            path: 'actor.components.core_needs.hunger',
            origin: 'hasComponent',
            reason: 'planning-state-miss',
          },
        ],
      });

      const report = goapDebugger.generateReport(actorId);

      expect(report).toContain('Total Tasks: 7');
      expect(report).toContain('core: 4 tasks');
      expect(report).toContain('Missing Actors: actor-missing');
      expect(report).toContain('Warnings:');
      expect(report).toContain('Total Misses: 2');
      expect(report).toContain('path=actor.components.core_needs.hunger');
    });
  });

  describe('Failure History Formatting', () => {
    it('should format nested failure structure in text report', () => {
      const actorId = 'test-actor';

      // Set up nested failures
      mockController.getFailedGoals.mockReturnValue([
        {
          goalId: 'goal-1',
          failures: [
            { reason: 'precondition failed', timestamp: 1000 },
            { reason: 'no valid tasks', timestamp: 2000 },
          ],
        },
      ]);

      mockController.getFailedTasks.mockReturnValue([
        {
          taskId: 'task-1',
          failures: [{ reason: 'refinement failed', timestamp: 3000 }],
        },
      ]);

      const report = goapDebugger.generateReport(actorId);

      // Should show nested structure
      expect(report).toContain('Failed Goals: 1');
      expect(report).toContain('Goal: goal-1');
      expect(report).toContain('precondition failed');
      expect(report).toContain('no valid tasks');
      expect(report).toContain('Failed Tasks: 1');
      expect(report).toContain('Task: task-1');
      expect(report).toContain('refinement failed');
    });
  });
});
