import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import GOAPDebugger from '../../../../src/goap/debug/goapDebugger.js';
import { GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT } from '../../../../src/goap/debug/goapDebuggerDiagnosticsContract.js';

describe('GOAPDebugger', () => {
  let testBed;
  let goapDebugger;
  let mockController;
  let mockInspector;
  let mockDiffViewer;
  let mockTracer;
  let mockEventTraceProbe;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    mockController = testBed.createMock('goapController', [
      'getActivePlan',
      'getFailedGoals',
      'getFailedTasks',
      'getDependencyDiagnostics',
      'getNumericConstraintDiagnostics',
      'getTaskLibraryDiagnostics',
      'getPlanningStateDiagnostics',
      'getEventComplianceDiagnostics',
      'getGoalPathDiagnostics',
      'getEffectFailureTelemetry',
      'getDiagnosticsContractVersion',
    ]);
    mockController.getTaskLibraryDiagnostics.mockReturnValue({
      timestamp: Date.now(),
      totalTasks: 0,
      namespaces: {},
      warnings: [],
    });
    mockController.getDependencyDiagnostics.mockReturnValue([]);
    mockController.getFailedGoals.mockReturnValue([]);
    mockController.getFailedTasks.mockReturnValue([]);
    mockController.getPlanningStateDiagnostics.mockReturnValue({
      totalMisses: 0,
      lastMisses: [
        {
          timestamp: Date.now(),
          path: 'actor:core:needs',
          origin: 'test',
          reason: 'setup',
        },
      ],
    });
    mockController.getEventComplianceDiagnostics.mockReturnValue({
      actor: { actorId: 'actor-1', totalEvents: 0, missingPayloads: 0 },
      global: { actorId: 'global', totalEvents: 0, missingPayloads: 0 },
    });
    mockController.getGoalPathDiagnostics.mockReturnValue({
      actorId: 'actor-1',
      totalViolations: 0,
      entries: [],
      lastViolationAt: Date.now(),
    });
    mockController.getEffectFailureTelemetry.mockReturnValue({
      actorId: 'actor-1',
      totalFailures: 0,
      failures: [],
      lastFailureAt: Date.now(),
    });
    mockController.getDiagnosticsContractVersion.mockReturnValue(
      GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.version
    );
    mockController.getNumericConstraintDiagnostics.mockReturnValue(null);

    mockInspector = testBed.createMock('planInspector', [
      'inspect',
      'inspectJSON',
    ]);

    mockDiffViewer = testBed.createMock('stateDiffViewer', [
      'diff',
      'visualize',
      'diffJSON',
    ]);

    mockTracer = testBed.createMock('refinementTracer', [
      'startCapture',
      'stopCapture',
      'getTrace',
      'format',
    ]);

    mockEventTraceProbe = {
      record: jest.fn(),
      startCapture: jest.fn(),
      stopCapture: jest.fn(),
      getSnapshot: jest.fn().mockReturnValue({
        actorId: 'actor-1',
        capturing: false,
        totalCaptured: 0,
        totalViolations: 0,
        events: [],
      }),
      clear: jest.fn(),
    };
    mockEventDispatcher = {
      getProbeDiagnostics: jest.fn().mockReturnValue({
        totalRegistered: 1,
        totalAttachedEver: 1,
        totalDetached: 0,
        lastAttachedAt: Date.now(),
        lastDetachedAt: null,
        hasProbes: true,
      }),
    };

    goapDebugger = new GOAPDebugger({
      goapController: mockController,
      planInspector: mockInspector,
      stateDiffViewer: mockDiffViewer,
      refinementTracer: mockTracer,
      eventTraceProbe: mockEventTraceProbe,
      goapEventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should validate goapController dependency', () => {
      expect(() => {
        new GOAPDebugger({
          goapController: {},
          planInspector: mockInspector,
          stateDiffViewer: mockDiffViewer,
          refinementTracer: mockTracer,
          eventTraceProbe: mockEventTraceProbe,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate planInspector dependency', () => {
      expect(() => {
        new GOAPDebugger({
          goapController: mockController,
          planInspector: {},
          stateDiffViewer: mockDiffViewer,
          refinementTracer: mockTracer,
          eventTraceProbe: mockEventTraceProbe,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate stateDiffViewer dependency', () => {
      expect(() => {
        new GOAPDebugger({
          goapController: mockController,
          planInspector: mockInspector,
          stateDiffViewer: {},
          refinementTracer: mockTracer,
          eventTraceProbe: mockEventTraceProbe,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate refinementTracer dependency', () => {
      expect(() => {
        new GOAPDebugger({
          goapController: mockController,
          planInspector: mockInspector,
          stateDiffViewer: mockDiffViewer,
          refinementTracer: {},
          eventTraceProbe: mockEventTraceProbe,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate eventTraceProbe dependency', () => {
      expect(() => {
        new GOAPDebugger({
          goapController: mockController,
          planInspector: mockInspector,
          stateDiffViewer: mockDiffViewer,
          refinementTracer: mockTracer,
          eventTraceProbe: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('fails fast when diagnostics contract versions diverge', () => {
      mockController.getDiagnosticsContractVersion.mockReturnValue('0.0.1');

      expect(() => {
        new GOAPDebugger({
          goapController: mockController,
          planInspector: mockInspector,
          stateDiffViewer: mockDiffViewer,
          refinementTracer: mockTracer,
          eventTraceProbe: mockEventTraceProbe,
          logger: mockLogger,
        });
      }).toThrow(/diagnostics contract mismatch/);
    });
  });

  describe('inspectPlan', () => {
    it('should delegate to plan inspector', () => {
      mockInspector.inspect.mockReturnValue('plan output');

      const result = goapDebugger.inspectPlan('actor-1');

      expect(mockInspector.inspect).toHaveBeenCalledWith('actor-1');
      expect(result).toBe('plan output');
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.inspectPlan('')).toThrow();
      expect(() => goapDebugger.inspectPlan(null)).toThrow();
      expect(() => goapDebugger.inspectPlan(undefined)).toThrow();
    });
  });

  describe('inspectPlanJSON', () => {
    it('should delegate to plan inspector for JSON output', () => {
      const planData = { goal: 'test', tasks: [] };
      mockInspector.inspectJSON.mockReturnValue(planData);

      const result = goapDebugger.inspectPlanJSON('actor-1');

      expect(mockInspector.inspectJSON).toHaveBeenCalledWith('actor-1');
      expect(result).toEqual(planData);
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.inspectPlanJSON('')).toThrow();
    });
  });

  describe('inspectCurrentGoal', () => {
    it('should return goal from active plan', () => {
      const goal = { id: 'goal-1', conditions: [] };
      mockController.getActivePlan.mockReturnValue({ goal, tasks: [] });

      const result = goapDebugger.inspectCurrentGoal('actor-1');

      expect(mockController.getActivePlan).toHaveBeenCalledWith('actor-1');
      expect(result).toEqual(goal);
    });

    it('should return null when no active plan', () => {
      mockController.getActivePlan.mockReturnValue(null);

      const result = goapDebugger.inspectCurrentGoal('actor-1');

      expect(result).toBeNull();
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.inspectCurrentGoal('')).toThrow();
    });
  });

  describe('getFailureHistory', () => {
    it('should return nested failure structure from controller', () => {
      const failedGoals = [
        {
          goalId: 'goal-1',
          failures: [
            { reason: 'precondition failed', code: 'NO_APPLICABLE_TASKS', timestamp: 1000 },
            { reason: 'no valid tasks', code: 'NO_VALID_PLAN', timestamp: 2000 },
          ],
        },
      ];
      const failedTasks = [
        {
          taskId: 'task-1',
          failures: [{ reason: 'refinement failed', code: 'TASK_FAILURE', timestamp: 3000 }],
        },
      ];

      mockController.getFailedGoals.mockReturnValue(failedGoals);
      mockController.getFailedTasks.mockReturnValue(failedTasks);

      const result = goapDebugger.getFailureHistory('actor-1');

      expect(result).toEqual({
        failedGoals,
        failedTasks,
      });
      expect(mockController.getFailedGoals).toHaveBeenCalledWith('actor-1');
      expect(mockController.getFailedTasks).toHaveBeenCalledWith('actor-1');
    });

    it('should handle empty failure history', () => {
      mockController.getFailedGoals.mockReturnValue([]);
      mockController.getFailedTasks.mockReturnValue([]);

      const result = goapDebugger.getFailureHistory('actor-1');

      expect(result).toEqual({
        failedGoals: [],
        failedTasks: [],
      });
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.getFailureHistory('')).toThrow();
    });
  });

  describe('showStateDiff', () => {
    it('should delegate to state diff viewer', () => {
      const before = { hunger: 10 };
      const after = { hunger: 5 };
      const diff = { changed: { hunger: { from: 10, to: 5 } } };

      mockDiffViewer.diff.mockReturnValue(diff);
      mockDiffViewer.visualize.mockReturnValue('diff output');

      const result = goapDebugger.showStateDiff(before, after);

      expect(mockDiffViewer.diff).toHaveBeenCalledWith(before, after);
      expect(mockDiffViewer.visualize).toHaveBeenCalledWith(diff, {});
      expect(result).toBe('diff output');
    });

    it('should pass options to visualizer', () => {
      const before = { hunger: 10 };
      const after = { hunger: 5 };
      const options = { showUnchanged: true };

      mockDiffViewer.diff.mockReturnValue({});
      mockDiffViewer.visualize.mockReturnValue('');

      goapDebugger.showStateDiff(before, after, options);

      expect(mockDiffViewer.visualize).toHaveBeenCalledWith({}, options);
    });
  });

  describe('showStateDiffJSON', () => {
    it('should delegate to state diff viewer for JSON output', () => {
      const before = { hunger: 10 };
      const after = { hunger: 5 };
      const diffData = { changed: { hunger: { from: 10, to: 5 } } };

      mockDiffViewer.diffJSON.mockReturnValue(diffData);

      const result = goapDebugger.showStateDiffJSON(before, after);

      expect(mockDiffViewer.diffJSON).toHaveBeenCalledWith(before, after);
      expect(result).toEqual(diffData);
    });
  });

  describe('startTrace', () => {
    it('should delegate to refinement tracer and event trace probe', () => {
      goapDebugger.startTrace('actor-1');

      expect(mockTracer.startCapture).toHaveBeenCalledWith('actor-1');
      expect(mockEventTraceProbe.clear).toHaveBeenCalledWith('actor-1');
      expect(mockEventTraceProbe.startCapture).toHaveBeenCalledWith('actor-1');
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.startTrace('')).toThrow();
    });

    it('warns once per actor when dispatcher reports no probes', () => {
      mockEventDispatcher.getProbeDiagnostics.mockReturnValue({
        totalRegistered: 0,
        totalAttachedEver: 0,
        totalDetached: 0,
        lastAttachedAt: null,
        lastDetachedAt: null,
        hasProbes: false,
      });

      goapDebugger.startTrace('actor-1');
      goapDebugger.startTrace('actor-1');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('GOAPDebugger trace requested'),
        expect.objectContaining({
          actorId: 'actor-1',
          code: 'GOAP_DEBUGGER_TRACE_PROBE_FALLBACK',
        })
      );
      const fallbackWarnings = mockLogger.warn.mock.calls.filter(
        ([, meta]) => meta && meta.code === 'GOAP_DEBUGGER_TRACE_PROBE_FALLBACK'
      );
      expect(fallbackWarnings).toHaveLength(1);

      const snapshot = goapDebugger.getEventStream('actor-1');
      expect(snapshot.captureDisabled).toBe(true);

      mockEventDispatcher.getProbeDiagnostics.mockReturnValue({
        totalRegistered: 1,
        totalAttachedEver: 1,
        totalDetached: 0,
        lastAttachedAt: Date.now(),
        lastDetachedAt: null,
        hasProbes: true,
      });
    });
  });

  describe('stopTrace', () => {
    it('should delegate to refinement tracer and return trace', () => {
      const trace = { events: [], startTime: 1000 };
      mockTracer.stopCapture.mockReturnValue(trace);

      const result = goapDebugger.stopTrace('actor-1');

      expect(mockTracer.stopCapture).toHaveBeenCalledWith('actor-1');
      expect(mockEventTraceProbe.stopCapture).toHaveBeenCalledWith('actor-1');
      expect(result).toEqual(trace);
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.stopTrace('')).toThrow();
    });
  });

  describe('getTrace', () => {
    it('should delegate to refinement tracer without stopping', () => {
      const trace = { events: [], startTime: 1000 };
      mockTracer.getTrace.mockReturnValue(trace);

      const result = goapDebugger.getTrace('actor-1');

      expect(mockTracer.getTrace).toHaveBeenCalledWith('actor-1');
      expect(result).toEqual(trace);
    });

    it('should return null when no active trace', () => {
      mockTracer.getTrace.mockReturnValue(null);

      const result = goapDebugger.getTrace('actor-1');

      expect(result).toBeNull();
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.getTrace('')).toThrow();
    });
  });

  describe('getEventStream', () => {
    it('should return snapshot from the trace probe', () => {
      const snapshot = {
        actorId: 'actor-1',
        capturing: true,
        totalCaptured: 2,
        totalViolations: 1,
        events: [],
      };
      mockEventTraceProbe.getSnapshot.mockReturnValue(snapshot);

      const result = goapDebugger.getEventStream('actor-1');

      expect(mockEventTraceProbe.getSnapshot).toHaveBeenCalledWith('actor-1');
      expect(result).toBe(snapshot);
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.getEventStream('')).toThrow();
    });
  });

  describe('formatTrace', () => {
    it('should delegate to refinement tracer for formatting', () => {
      const trace = { events: [], startTime: 1000 };
      mockTracer.format.mockReturnValue('formatted trace');

      const result = goapDebugger.formatTrace(trace);

      expect(mockTracer.format).toHaveBeenCalledWith(trace);
      expect(result).toBe('formatted trace');
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report with all sections', () => {
      mockInspector.inspect.mockReturnValue('=== Plan ===\n');
      mockController.getFailedGoals.mockReturnValue([]);
      mockController.getFailedTasks.mockReturnValue([]);
      mockTracer.getTrace.mockReturnValue(null);
      mockController.getDependencyDiagnostics.mockReturnValue([]);
      mockController.getTaskLibraryDiagnostics.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('GOAP Debug Report: actor-1');
      expect(report).toContain('Active Plan');
      expect(report).toContain('Failure History');
      expect(report).toContain('Failed Goals: 0');
      expect(report).toContain('Failed Tasks: 0');
      expect(report).toContain('Dependency Contracts');
      expect(report).toContain('Task Library Diagnostics');
      expect(report).toContain('Event Stream');
      expect(report).toContain('End Report');
    });

    it('should include failure details in nested structure', () => {
      mockInspector.inspect.mockReturnValue('');
      mockController.getFailedGoals.mockReturnValue([
        {
          goalId: 'goal-1',
          failures: [
            { reason: 'precondition failed', code: 'NO_APPLICABLE_TASKS', timestamp: 1000 },
            { reason: 'no valid tasks', code: 'NO_VALID_PLAN', timestamp: 2000 },
          ],
        },
      ]);
      mockController.getFailedTasks.mockReturnValue([
        {
          taskId: 'task-1',
          failures: [{ reason: 'refinement failed', code: 'TASK_FAILURE', timestamp: 3000 }],
        },
      ]);
      mockController.getDependencyDiagnostics.mockReturnValue([
        {
          dependency: 'IGoapPlanner',
          requiredMethods: ['plan', 'getLastFailure'],
          providedMethods: ['plan', 'getLastFailure'],
          missingMethods: [],
          timestamp: 1234,
          status: 'ok',
        },
      ]);
      mockController.getTaskLibraryDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        totalTasks: 3,
        namespaces: { test: { taskCount: 3 } },
        warnings: ['deprecated field'],
        missingActors: [],
        timestamp: 1234,
      });
      mockTracer.getTrace.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Failed Goals: 1');
      expect(report).toContain('Goal: goal-1');
      expect(report).toContain('[NO_APPLICABLE_TASKS] precondition failed');
      expect(report).toContain('[NO_VALID_PLAN] no valid tasks');
      expect(report).toContain('Failed Tasks: 1');
      expect(report).toContain('Task: task-1');
      expect(report).toContain('[TASK_FAILURE] refinement failed');
      expect(report).toContain('IGoapPlanner: status=ok');
      expect(report).toContain('required: plan, getLastFailure');
      expect(report).toContain('Task Library Diagnostics');
      expect(report).toContain('Total Tasks: 3');
      expect(report).toContain('Warnings:');
    });

    it('should include active trace when present', () => {
      mockInspector.inspect.mockReturnValue('');
      mockController.getFailedGoals.mockReturnValue([]);
      mockController.getFailedTasks.mockReturnValue([]);
      mockTracer.getTrace.mockReturnValue({ events: [] });
      mockTracer.format.mockReturnValue('=== Trace ===');

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Active Trace');
      expect(report).toContain('=== Trace ===');
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.generateReport('')).toThrow();
    });
  });

  describe('generateReportJSON', () => {
    it('should generate JSON report with all data', () => {
      const planData = { goal: 'test', tasks: [] };
      const failures = {
        failedGoals: [],
        failedTasks: [],
      };
      const trace = { events: [] };
      const diagnostics = {
        actorId: 'actor-1',
        namespaces: {},
        warnings: [],
        timestamp: Date.now(),
      };

      mockInspector.inspectJSON.mockReturnValue(planData);
      mockController.getFailedGoals.mockReturnValue([]);
      mockController.getFailedTasks.mockReturnValue([]);
      mockController.getDependencyDiagnostics.mockReturnValue([]);
      mockController.getTaskLibraryDiagnostics.mockReturnValue(diagnostics);
      mockTracer.getTrace.mockReturnValue(trace);
      mockController.getPlanningStateDiagnostics.mockReturnValue({
        totalMisses: 1,
        lastMisses: [
          {
            timestamp: Date.now(),
            path: 'actor:core:needs',
            origin: 'test',
            reason: 'assert',
          },
        ],
      });

      const report = goapDebugger.generateReportJSON('actor-1');

      expect(report).toEqual(
        expect.objectContaining({
          actorId: 'actor-1',
          timestamp: expect.any(Number),
          plan: planData,
          failures,
          dependencies: [],
          taskLibraryDiagnostics: diagnostics,
          planningStateDiagnostics: {
            totalMisses: 1,
            lastMisses: [
              expect.objectContaining({
                timestamp: expect.any(Number),
                path: 'actor:core:needs',
              }),
            ],
          },
          eventComplianceDiagnostics: {
            actor: expect.objectContaining({
              actorId: 'actor-1',
              missingPayloads: 0,
            }),
            global: expect.objectContaining({
              actorId: 'global',
            }),
          },
          goalPathDiagnostics: expect.objectContaining({ actorId: 'actor-1' }),
          effectFailureTelemetry: expect.objectContaining({ actorId: 'actor-1' }),
          eventStream: expect.objectContaining({
            actorId: 'actor-1',
            events: expect.any(Array),
          }),
          diagnosticsMeta: expect.objectContaining({
            taskLibrary: expect.objectContaining({
              available: true,
              stale: false,
            }),
            planningState: expect.objectContaining({ available: true }),
            eventCompliance: expect.objectContaining({
              available: true,
              stale: true,
            }),
            goalPathViolations: expect.objectContaining({ sectionId: 'goalPathViolations' }),
            effectFailureTelemetry: expect.objectContaining({ sectionId: 'effectFailureTelemetry' }),
          }),
          trace,
        })
      );
    });

    it('should validate actorId parameter', () => {
      expect(() => goapDebugger.generateReportJSON('')).toThrow();
    });
  });

  describe('diagnostics handling', () => {
    it('logs a single warning when diagnostics are missing', () => {
      mockController.getTaskLibraryDiagnostics.mockReturnValue(null);
      mockLogger.warn.mockClear();

      goapDebugger.generateReportJSON('actor-1');
      goapDebugger.generateReportJSON('actor-1');

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.missingWarningCode,
        expect.objectContaining({
          actorId: 'actor-1',
          sectionId: GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.sections.taskLibrary.id,
        })
      );
    });

    it('marks diagnostics stale when timestamp is old', () => {
      const oldTimestamp =
        Date.now() - GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.staleThresholdMs - 5000;
      mockController.getTaskLibraryDiagnostics.mockReturnValue({
        timestamp: oldTimestamp,
        totalTasks: 0,
        namespaces: {},
        warnings: [],
      });

      const report = goapDebugger.generateReport('actor-1');
      expect(report).toContain('⚠️ STALE');

      const json = goapDebugger.generateReportJSON('actor-1');
      expect(json.diagnosticsMeta.taskLibrary.stale).toBe(true);
      expect(json.diagnosticsMeta.taskLibrary.available).toBe(true);
    });

    it('treats planning state diagnostics as available but stale when no misses', () => {
      mockController.getPlanningStateDiagnostics.mockReturnValue({
        totalMisses: 0,
        lastMisses: [],
      });

      const report = goapDebugger.generateReport('actor-1');
      expect(report).toContain('Planning State Diagnostics');
      expect(report).toContain('⚠️ STALE — no recent misses');

      const json = goapDebugger.generateReportJSON('actor-1');
      expect(json.diagnosticsMeta.planningState.available).toBe(true);
      expect(json.diagnosticsMeta.planningState.stale).toBe(true);
    });
  });

  describe('getNumericConstraintDiagnostics', () => {
    it('delegates to GoapController', () => {
      mockController.getNumericConstraintDiagnostics.mockReturnValue({
        totalFallbacks: 3,
        recent: [],
      });
      const diagnostics = goapDebugger.getNumericConstraintDiagnostics('actor-n');
      expect(mockController.getNumericConstraintDiagnostics).toHaveBeenCalledWith(
        'actor-n'
      );
      expect(diagnostics.totalFallbacks).toBe(3);
    });
  });
});
