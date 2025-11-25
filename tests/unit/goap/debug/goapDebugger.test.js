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

    it('should handle failures without error codes', () => {
      mockInspector.inspect.mockReturnValue('');
      mockController.getFailedGoals.mockReturnValue([
        {
          goalId: 'test_goal',
          failures: [{ reason: 'unknown failure', timestamp: Date.now() }],
        },
      ]);
      mockController.getFailedTasks.mockReturnValue([
        {
          taskId: 'test_task',
          failures: [{ reason: 'task failed', timestamp: Date.now() }],
        },
      ]);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Goal: test_goal');
      expect(report).toContain('- unknown failure');
      expect(report).not.toContain('[');
      expect(report).toContain('Task: test_task');
      expect(report).toContain('- task failed');
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

  describe('timestamp resolution', () => {
    it('resolves string timestamps correctly in diagnostics meta', () => {
      const isoString = '2024-01-15T10:30:00.000Z';
      mockController.getGoalPathDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        totalViolations: 1,
        entries: [],
        lastViolationAt: isoString,
      });

      const json = goapDebugger.generateReportJSON('actor-1');

      expect(json.diagnosticsMeta.goalPathViolations.lastUpdated).toBe(isoString);
      expect(json.diagnosticsMeta.goalPathViolations.stale).toBe(true);
    });

    it('handles invalid string timestamps gracefully', () => {
      mockController.getGoalPathDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        totalViolations: 1,
        entries: [],
        lastViolationAt: 'not-a-valid-date',
      });

      const json = goapDebugger.generateReportJSON('actor-1');

      expect(json.diagnosticsMeta.goalPathViolations.lastUpdated).toBeNull();
      expect(json.diagnosticsMeta.goalPathViolations.stale).toBe(true);
    });
  });

  describe('task library diagnostics formatting', () => {
    it('includes missing actors when present', () => {
      mockController.getTaskLibraryDiagnostics.mockReturnValue({
        timestamp: Date.now(),
        totalTasks: 5,
        namespaces: { core: { taskCount: 5 } },
        warnings: [],
        missingActors: ['actor-x', 'actor-y'],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Missing Actors: actor-x, actor-y');
    });

    it('returns unavailable message when diagnostics are null', () => {
      mockController.getTaskLibraryDiagnostics.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('No task library diagnostics captured');
      expect(report).toContain('see docs/goap/debugging-tools.md#diagnostics-contract');
    });

    it('shows last updated timestamp and namespace counts when fresh', () => {
      const now = Date.now();
      mockController.getTaskLibraryDiagnostics.mockReturnValue({
        timestamp: now,
        totalTasks: 3,
        namespaces: {
          core: { taskCount: 2 },
          mods: { taskCount: 1 },
        },
        warnings: ['duplicate task id'],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Last updated:');
      expect(report).toContain('Total Tasks: 3');
      expect(report).toContain('core: 2 tasks');
      expect(report).toContain('mods: 1 tasks');
      expect(report).toContain('Warnings:');
      expect(report).toContain('duplicate task id');
    });

    it('falls back to defaults when namespaces are empty and counts are missing', () => {
      mockController.getTaskLibraryDiagnostics.mockReturnValue({
        timestamp: Date.now(),
        namespaces: {},
        warnings: [],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Total Tasks: 0');
      expect(report).toContain('Namespaces: ∅');
    });
  });

  describe('planning state diagnostics formatting', () => {
    it('returns unavailable message when diagnostics are null', () => {
      mockController.getPlanningStateDiagnostics.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('No planning-state diagnostics captured');
      expect(report).toContain('see docs/goap/debugging-tools.md#planning-state-assertions');
    });

    it('shows recent misses and last updated when data is fresh', () => {
      const missTimestamp = Date.now();
      mockController.getPlanningStateDiagnostics.mockReturnValue({
        totalMisses: 2,
        lastMisses: [
          {
            timestamp: missTimestamp,
            path: 'actor.components.health',
            origin: 'validator',
            reason: 'missing component',
          },
          {
            timestamp: missTimestamp - 1000,
            path: 'actor.components.energy',
            origin: 'validator',
            reason: 'missing energy value',
          },
        ],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Last miss recorded:');
      expect(report).toContain('Total Misses: 2');
      expect(report).toContain('Recent Misses (max 5):');
      expect(report).toContain('path=actor.components.health');
      expect(report).toContain('reason=missing component');
      expect(report).toContain('path=actor.components.energy');
      expect(report).toContain('reason=missing energy value');
    });
  });

  describe('event compliance diagnostics formatting', () => {
    it('returns unavailable message when diagnostics are null', () => {
      mockController.getEventComplianceDiagnostics.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Event compliance diagnostics unavailable');
      expect(report).toContain('ensure goapEventDispatcher is wired');
    });

    it('includes last violation timestamp when available', () => {
      const violationTime = Date.now() - 1000;
      mockController.getEventComplianceDiagnostics.mockReturnValue({
        actor: {
          actorId: 'actor-1',
          totalEvents: 10,
          missingPayloads: 0,
        },
        global: {
          totalEvents: 50,
          missingPayloads: 0,
          lastViolation: {
            timestamp: violationTime,
            code: 'MISSING_PAYLOAD',
            eventType: 'TASK_COMPLETED',
            reason: 'missing actorId',
          },
        },
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Last violation recorded:');
      expect(report).toContain('Global Totals:');
      expect(report).toContain('total=50');
      expect(report).toContain('missingPayloads=0');
    });

    it('formats actor entry with violation details', () => {
      mockController.getEventComplianceDiagnostics.mockReturnValue({
        actor: {
          actorId: 'actor-1',
          totalEvents: 10,
          missingPayloads: 2,
          lastViolation: {
            timestamp: Date.now(),
            code: 'MISSING_PAYLOAD',
            eventType: 'GOAL_SELECTED',
            reason: 'missing goalId',
          },
        },
        global: {
          totalEvents: 50,
          missingPayloads: 0,
        },
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Actor (actor-1):');
      expect(report).toContain('total=10');
      expect(report).toContain('missingPayloads=2');
      expect(report).toContain('Last violation (MISSING_PAYLOAD):');
      expect(report).toContain('event=GOAL_SELECTED');
      expect(report).toContain('reason=missing goalId');
    });

    it('shows contract violation warning when violations present', () => {
      mockController.getEventComplianceDiagnostics.mockReturnValue({
        actor: {
          actorId: 'actor-1',
          totalEvents: 10,
          missingPayloads: 3,
        },
        global: {
          totalEvents: 50,
          missingPayloads: 0,
        },
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('⚠️ Event Contract Violations detected');
      expect(report).toContain('docs/goap/debugging-tools.md#Planner Contract Checklist');
    });

    it('shows stale warning when last violation is old', () => {
      const oldTimestamp =
        Date.now() - GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.staleThresholdMs - 1000;
      mockController.getEventComplianceDiagnostics.mockReturnValue({
        actor: {
          actorId: 'actor-1',
          totalEvents: 5,
          missingPayloads: 0,
          lastViolation: {
            timestamp: oldTimestamp,
            code: 'OLD',
            eventType: 'EVENT',
            reason: 'late',
          },
        },
        global: {
          totalEvents: 5,
          missingPayloads: 0,
          lastViolation: {
            timestamp: oldTimestamp,
            code: 'OLD',
            eventType: 'EVENT',
            reason: 'late',
          },
        },
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('⚠️ STALE — last violation recorded');
    });

    it('shows satisfied message when no violations', () => {
      mockController.getEventComplianceDiagnostics.mockReturnValue({
        actor: {
          actorId: 'actor-1',
          totalEvents: 10,
          missingPayloads: 0,
        },
        global: {
          totalEvents: 50,
          missingPayloads: 0,
        },
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Event payload contract satisfied for this actor');
    });
  });

  describe('goal path diagnostics formatting', () => {
    it('returns unavailable message when diagnostics are null', () => {
      mockController.getGoalPathDiagnostics.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('No goal path violations captured');
      expect(report).toContain('Run npm run validate:goals');
      expect(report).toContain('GOAP_GOAL_PATH_LINT=1');
    });

    it('shows stale warning and violation entries when present', () => {
      const oldTimestamp =
        Date.now() - GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.staleThresholdMs - 5000;
      mockController.getGoalPathDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        totalViolations: 2,
        entries: [
          {
            timestamp: oldTimestamp,
            goalId: 'satisfy_hunger',
            violations: [
              { path: 'actor.hunger', expected: 'actor.components.hunger' },
              { path: 'actor.energy', expected: 'actor.components.energy' },
            ],
          },
          {
            timestamp: oldTimestamp,
            goalId: 'rest',
            violations: [{ path: 'actor.fatigue', expected: 'actor.components.fatigue' }],
          },
        ],
        lastViolationAt: oldTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('⚠️ STALE — last violation recorded');
      expect(report).toContain('GOAP_GOAL_PATH_LINT=1 to enforce');
      expect(report).toContain('Total Violations: 2');
      expect(report).toContain('Recent Violations (max 5):');
      expect(report).toContain('goal=satisfy_hunger');
      expect(report).toContain('paths=actor.hunger, actor.energy');
      expect(report).toContain('goal=rest');
      expect(report).toContain('paths=actor.fatigue');
      expect(report).toContain('docs/goap/debugging-tools.md#Planner Contract Checklist');
    });

    it('shows empty violations message when no entries', () => {
      mockController.getGoalPathDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        totalViolations: 0,
        entries: [],
        lastViolationAt: null,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Recent Violations: ∅');
      expect(report).toContain('all goals follow actor.components.* contract');
    });

    it('formats fresh violations without stale warning', () => {
      const recentTimestamp = Date.now();
      mockController.getGoalPathDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        totalViolations: 1,
        entries: [
          {
            timestamp: recentTimestamp,
            goalId: 'explore',
            violations: [{ path: 'actor.location', expected: 'actor.components.location' }],
          },
        ],
        lastViolationAt: recentTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      const goalPathSection = report
        .split('--- Goal Path Violations ---')[1]
        .split('--- Effect Failure Telemetry ---')[0];

      expect(report).toContain('Last violation recorded:');
      expect(report).toContain('Total Violations: 1');
      expect(report).toContain('goal=explore');
      expect(goalPathSection).not.toContain('⚠️ STALE');
    });

    it('uses fallback values when violations payload is incomplete', () => {
      const recentTimestamp = Date.now();
      mockController.getGoalPathDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        entries: 'not-an-array',
        lastViolationAt: recentTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Last violation recorded:');
      expect(report).toContain('Total Violations: 0');
      expect(report).toContain('Recent Violations: ∅');
    });

    it('falls back to unknown goal identifiers when missing', () => {
      const recentTimestamp = Date.now();
      mockController.getGoalPathDiagnostics.mockReturnValue({
        actorId: 'actor-1',
        totalViolations: undefined,
        entries: [
          {
            timestamp: recentTimestamp,
            violations: [{ path: 'actor.missing', expected: 'actor.components.missing' }],
          },
        ],
        lastViolationAt: recentTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Total Violations: 0');
      expect(report).toContain('goal=unknown');
    });
  });

  describe('effect failure telemetry formatting', () => {
    it('returns unavailable message when telemetry is null', () => {
      mockController.getEffectFailureTelemetry.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('No planning-effect telemetry captured');
      expect(report).toContain('Ensure planner emits INVALID_EFFECT_DEFINITION');
    });

    it('shows stale warning and failure entries when present', () => {
      const oldTimestamp =
        Date.now() - GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.staleThresholdMs - 5000;
      mockController.getEffectFailureTelemetry.mockReturnValue({
        actorId: 'actor-1',
        totalFailures: 3,
        failures: [
          {
            timestamp: oldTimestamp,
            taskId: 'eat_food',
            phase: 'simulation',
            goalId: 'satisfy_hunger',
            message: 'Cannot access undefined path actor.inventory',
          },
          {
            timestamp: oldTimestamp,
            taskId: 'drink_water',
            phase: 'planning',
            goalId: 'quench_thirst',
            message: 'Invalid effect path',
          },
          {
            timestamp: oldTimestamp,
            taskId: 'sleep',
            phase: 'execution',
            goalId: 'rest',
            message: 'State mutation failed',
          },
        ],
        lastFailureAt: oldTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('⚠️ STALE — last failure recorded');
      expect(report).toContain('Total Failures: 3');
      expect(report).toContain('Recent Failures (max 10):');
      expect(report).toContain('task=eat_food');
      expect(report).toContain('phase=simulation');
      expect(report).toContain('goal=satisfy_hunger');
      expect(report).toContain('reason=Cannot access undefined path actor.inventory');
      expect(report).toContain('task=drink_water');
      expect(report).toContain('task=sleep');
      expect(report).toContain('INVALID_EFFECT_DEFINITION failures halt planning');
      expect(report).toContain('confirm task.preconditions gate simulator usage');
    });

    it('shows empty failures message when no failures', () => {
      mockController.getEffectFailureTelemetry.mockReturnValue({
        actorId: 'actor-1',
        totalFailures: 0,
        failures: [],
        lastFailureAt: null,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Recent Failures: ∅');
    });

    it('shows last failure when telemetry is fresh', () => {
      const recentTimestamp = Date.now();
      mockController.getEffectFailureTelemetry.mockReturnValue({
        actorId: 'actor-1',
        totalFailures: 1,
        failures: [
          {
            timestamp: recentTimestamp,
            taskId: 'craft',
            phase: 'execution',
            goalId: 'build',
            message: 'craft failed',
          },
        ],
        lastFailureAt: recentTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      const effectTelemetrySection = report
        .split('--- Effect Failure Telemetry ---')[1]
        .split('--- Event Stream ---')[0];

      expect(report).toContain('Last failure recorded:');
      expect(report).toContain('craft');
      expect(effectTelemetrySection).not.toContain('⚠️ STALE');
    });

    it('uses fallback labels when failure details are missing', () => {
      const recentTimestamp = Date.now();
      mockController.getEffectFailureTelemetry.mockReturnValue({
        actorId: 'actor-1',
        failures: [
          {
            timestamp: recentTimestamp,
            taskId: undefined,
            message: 'missing fields',
          },
        ],
        lastFailureAt: recentTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Last failure recorded:');
      expect(report).toContain('Total Failures: 0');
      expect(report).toContain('goal=n/a');
      expect(report).toContain('phase=n/a');
    });

    it('handles non-array telemetry failures gracefully', () => {
      const recentTimestamp = Date.now();
      mockController.getEffectFailureTelemetry.mockReturnValue({
        actorId: 'actor-1',
        failures: 'not-an-array',
        lastFailureAt: recentTimestamp,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Recent Failures: ∅');
      expect(report).toContain('Total Failures: 0');
    });
  });

  describe('event stream formatting', () => {
    it('returns unavailable message when event stream is null', () => {
      mockEventTraceProbe.getSnapshot.mockReturnValue(null);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Event stream capture unavailable');
      expect(report).toContain('Call GOAPDebugger.startTrace(actorId) before running scenarios');
    });

    it('formats detailed event information when events present', () => {
      const eventTime1 = Date.now() - 10000;
      const eventTime2 = Date.now() - 5000;
      mockEventTraceProbe.getSnapshot.mockReturnValue({
        actorId: 'actor-1',
        capturing: true,
        totalCaptured: 2,
        totalViolations: 1,
        events: [
          {
            type: 'GOAL_SELECTED',
            timestamp: eventTime1,
            actorId: 'actor-1',
            payload: {
              actorId: 'actor-1',
              goalId: 'satisfy_hunger',
              priority: 10,
            },
            violation: false,
          },
          {
            type: 'TASK_COMPLETED',
            timestamp: eventTime2,
            payload: {
              actorId: 'actor-1',
              taskId: 'eat_food',
              success: true,
            },
            violation: true,
          },
        ],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Scope: actor-1');
      expect(report).toContain('Capturing: YES');
      expect(report).toContain('Events Captured: 2');
      expect(report).toContain('Violations Recorded: 1');
      expect(report).toContain('Recent Events (max 5):');
      expect(report).toContain('GOAL_SELECTED');
      expect(report).toContain('actor=actor-1');
      expect(report).toContain('TASK_COMPLETED');
      expect(report).toContain('⚠ violation');
      expect(report).toContain('task=eat_food');
      expect(report).toContain('payload=');
    });

    it('shows empty events message when no events captured', () => {
      mockEventTraceProbe.getSnapshot.mockReturnValue({
        actorId: 'actor-1',
        capturing: false,
        totalCaptured: 0,
        totalViolations: 0,
        events: [],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Recent Events: ∅');
      expect(report).toContain('enable tracing via GOAPDebugger.startTrace');
    });

    it('limits event display to most recent 5 events', () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        type: `EVENT_${i}`,
        timestamp: Date.now() - (10 - i) * 1000,
        actorId: 'actor-1',
        payload: {},
        violation: false,
      }));

      mockEventTraceProbe.getSnapshot.mockReturnValue({
        actorId: 'actor-1',
        capturing: true,
        totalCaptured: 10,
        totalViolations: 0,
        events,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('EVENT_5');
      expect(report).toContain('EVENT_9');
      expect(report).not.toContain('EVENT_0');
      expect(report).not.toContain('EVENT_4');
    });

    it('falls back to top-level actorId when payload is missing', () => {
      mockEventTraceProbe.getSnapshot.mockReturnValue({
        actorId: 'actor-1',
        capturing: false,
        totalCaptured: 1,
        totalViolations: 0,
        events: [
          {
            type: 'TASK_STARTED',
            timestamp: Date.now(),
            actorId: 'actor-1',
            violation: false,
          },
        ],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('TASK_STARTED');
      expect(report).toContain('actor=actor-1');
      expect(report).not.toContain('payload=');
    });

    it('uses unknown actor label when both actorId and payload are missing', () => {
      mockEventTraceProbe.getSnapshot.mockReturnValue({
        actorId: 'actor-1',
        capturing: false,
        totalCaptured: 1,
        totalViolations: 0,
        events: [
          {
            type: 'GENERIC_EVENT',
            timestamp: Date.now(),
            violation: false,
          },
        ],
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('GENERIC_EVENT');
      expect(report).toContain('actor=unknown');
    });
  });

  describe('probe diagnostics checking', () => {
    it('does not warn when dispatcher is null', () => {
      const debuggerWithoutDispatcher = new GOAPDebugger({
        goapController: mockController,
        planInspector: mockInspector,
        stateDiffViewer: mockDiffViewer,
        refinementTracer: mockTracer,
        eventTraceProbe: mockEventTraceProbe,
        goapEventDispatcher: null,
        logger: mockLogger,
      });

      mockLogger.warn.mockClear();
      debuggerWithoutDispatcher.startTrace('actor-1');

      const snapshot = debuggerWithoutDispatcher.getEventStream('actor-1');
      expect(snapshot.captureDisabled).toBeUndefined();
    });

    it('logs warning once when getProbeDiagnostics throws error', () => {
      mockEventDispatcher.getProbeDiagnostics.mockImplementation(() => {
        throw new Error('Dispatcher error');
      });

      mockLogger.warn.mockClear();
      goapDebugger.startTrace('actor-1');
      goapDebugger.startTrace('actor-2');

      const diagnosticsErrors = mockLogger.warn.mock.calls.filter(
        ([, meta]) => meta && meta.code === 'GOAP_DEBUGGER_TRACE_PROBE_DIAGNOSTICS_FAILED'
      );
      expect(diagnosticsErrors).toHaveLength(1);
      expect(diagnosticsErrors[0][0]).toContain(
        'GOAPDebugger failed to read GOAP event dispatcher probe diagnostics'
      );
    });

    it('clears capture warning when probes become available', () => {
      mockEventDispatcher.getProbeDiagnostics.mockReturnValue({
        hasProbes: false,
      });

      goapDebugger.startTrace('actor-1');
      expect(goapDebugger.getEventStream('actor-1').captureDisabled).toBe(true);

      mockEventDispatcher.getProbeDiagnostics.mockReturnValue({
        hasProbes: true,
      });

      goapDebugger.startTrace('actor-1');
      expect(goapDebugger.getEventStream('actor-1').captureDisabled).toBeUndefined();
    });
  });

  describe('constructor without goapEventDispatcher', () => {
    it('should allow construction without goapEventDispatcher', () => {
      expect(() => {
        new GOAPDebugger({
          goapController: mockController,
          planInspector: mockInspector,
          stateDiffViewer: mockDiffViewer,
          refinementTracer: mockTracer,
          eventTraceProbe: mockEventTraceProbe,
          goapEventDispatcher: null,
          logger: mockLogger,
        });
      }).not.toThrow();
    });

    it('should allow construction with undefined goapEventDispatcher', () => {
      expect(() => {
        new GOAPDebugger({
          goapController: mockController,
          planInspector: mockInspector,
          stateDiffViewer: mockDiffViewer,
          refinementTracer: mockTracer,
          eventTraceProbe: mockEventTraceProbe,
          goapEventDispatcher: undefined,
          logger: mockLogger,
        });
      }).not.toThrow();
    });
  });

  describe('getDependencyDiagnostics', () => {
    it('delegates to GoapController', () => {
      const diagnostics = [
        {
          dependency: 'IGoapPlanner',
          requiredMethods: ['plan'],
          providedMethods: ['plan'],
          missingMethods: [],
          status: 'ok',
          timestamp: Date.now(),
        },
      ];
      mockController.getDependencyDiagnostics.mockReturnValue(diagnostics);

      const result = goapDebugger.getDependencyDiagnostics();

      expect(mockController.getDependencyDiagnostics).toHaveBeenCalled();
      expect(result).toEqual(diagnostics);
    });

    it('includes missing methods in dependency diagnostics report', () => {
      mockInspector.inspect.mockReturnValue('');
      mockController.getDependencyDiagnostics.mockReturnValue([
        {
          dependency: 'IGoapPlanner',
          requiredMethods: ['plan', 'getLastFailure', 'reset'],
          providedMethods: ['plan', 'getLastFailure'],
          missingMethods: ['reset'],
          status: 'error',
          timestamp: Date.now(),
        },
      ]);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('IGoapPlanner: status=error');
      expect(report).toContain('missing: reset');
    });

    it('handles empty method arrays in dependency diagnostics', () => {
      mockInspector.inspect.mockReturnValue('');
      mockController.getDependencyDiagnostics.mockReturnValue([
        {
          dependency: 'ISimpleDependency',
          requiredMethods: [],
          providedMethods: [],
          missingMethods: [],
          status: 'ok',
          timestamp: Date.now(),
        },
      ]);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('ISimpleDependency: status=ok');
      expect(report).toContain('required: ∅');
      expect(report).toContain('provided: ∅');
      expect(report).not.toContain('missing:');
    });

    it('handles missing dependency name', () => {
      mockInspector.inspect.mockReturnValue('');
      mockController.getDependencyDiagnostics.mockReturnValue([
        {
          dependency: null,
          requiredMethods: ['method1'],
          providedMethods: [],
          missingMethods: ['method1'],
          status: 'error',
          timestamp: Date.now(),
        },
      ]);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('unknown: status=error');
    });

    it('handles dependency diagnostics with undefined method arrays', () => {
      mockInspector.inspect.mockReturnValue('');
      mockController.getDependencyDiagnostics.mockReturnValue([
        {
          dependency: 'IMissingArrays',
          status: 'warn',
          timestamp: Date.now(),
        },
      ]);

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('IMissingArrays: status=warn');
      expect(report).toContain('required: ∅');
      expect(report).toContain('provided: ∅');
    });
  });

  describe('event compliance null actor handling', () => {
    it('formats null actor entry correctly', () => {
      mockController.getEventComplianceDiagnostics.mockReturnValue({
        actor: null,
        global: {
          totalEvents: 50,
          missingPayloads: 0,
        },
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Actor (actor-1): ∅');
    });

    it('formats null global entry correctly', () => {
      mockController.getEventComplianceDiagnostics.mockReturnValue({
        actor: {
          actorId: 'actor-1',
          totalEvents: 10,
          missingPayloads: 0,
        },
        global: null,
      });

      const report = goapDebugger.generateReport('actor-1');

      expect(report).toContain('Global Totals: ∅');
    });
  });
});
