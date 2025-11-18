import { describe, it, expect, jest } from '@jest/globals';
import GOAPDebugger from '../../../../src/goap/debug/goapDebugger.js';
import { GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT } from '../../../../src/goap/debug/goapDebuggerDiagnosticsContract.js';
import { createPlannerHarness } from '../planner/helpers/createPlannerHarness.js';

const ACTOR_ID = 'debugger-telemetry-actor';

/**
 *
 */
function createEffectFailureTelemetry() {
  const { planner, mocks } = createPlannerHarness({ actorId: ACTOR_ID });

  const task = {
    id: 'core:invalid_effect',
    planningEffects: [{ operation: 'MODIFY_COMPONENT', component: 'core:hunger', modifier: { decrement: 10 } }],
    boundParams: {},
  };

  const goal = {
    id: 'effect-telemetry-goal',
    goalState: { '<=': [{ var: `${ACTOR_ID}.core.hunger` }, 30] },
  };

  const currentState = { [`${ACTOR_ID}:core:hunger`]: 60 };

  const simulationError = new Error('Parameter resolution failed');
  mocks.effectsSimulator.simulateEffects.mockImplementation(() => {
    throw simulationError;
  });

  try {
    planner.testTaskReducesDistance(task, currentState, goal, ACTOR_ID);
  } catch {
    // Expected: #failForInvalidEffect throws
  }

  return planner.getEffectFailureTelemetry(ACTOR_ID);
}

/**
 *
 * @param controllerOverrides
 */
function createDebugger(controllerOverrides = {}) {
  const telemetry = controllerOverrides.effectFailureTelemetry ?? createEffectFailureTelemetry();

  const controller = {
    getActivePlan: jest.fn().mockReturnValue(null),
    getFailedGoals: jest.fn().mockReturnValue([]),
    getFailedTasks: jest.fn().mockReturnValue([]),
    getDependencyDiagnostics: jest.fn().mockReturnValue([]),
    getNumericConstraintDiagnostics: jest.fn().mockReturnValue({
      actorId: ACTOR_ID,
      totalFallbacks: 0,
      recent: [],
    }),
    getTaskLibraryDiagnostics: jest.fn().mockReturnValue(null),
    getPlanningStateDiagnostics: jest.fn().mockReturnValue(null),
    getEventComplianceDiagnostics: jest.fn().mockReturnValue({
      actor: { actorId: ACTOR_ID, totalEvents: 0, missingPayloads: 0 },
      global: { actorId: 'global', totalEvents: 0, missingPayloads: 0 },
    }),
    getGoalPathDiagnostics: jest.fn().mockReturnValue(null),
    getEffectFailureTelemetry: jest.fn().mockImplementation((actorId) =>
      actorId === ACTOR_ID ? telemetry : null
    ),
    getDiagnosticsContractVersion: jest
      .fn()
      .mockReturnValue(GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.version),
    ...controllerOverrides.controller,
  };

  const planInspector = {
    inspect: jest.fn().mockReturnValue('No plan'),
    inspectJSON: jest.fn().mockReturnValue(null),
  };

  const stateDiffViewer = {
    diff: jest.fn().mockReturnValue('diff'),
    visualize: jest.fn().mockReturnValue('visualizer'),
    diffJSON: jest.fn().mockReturnValue({}),
  };

  const refinementTracer = {
    startCapture: jest.fn(),
    stopCapture: jest.fn(),
    getTrace: jest.fn().mockReturnValue(null),
    format: jest.fn().mockReturnValue('trace'),
  };

  const eventTraceProbe = {
    record: jest.fn(),
    startCapture: jest.fn(),
    stopCapture: jest.fn(),
    getSnapshot: jest.fn().mockReturnValue({
      actorId: ACTOR_ID,
      capturing: false,
      totalCaptured: 0,
      totalViolations: 0,
      events: [],
    }),
    clear: jest.fn(),
  };

  const goapEventDispatcher = {
    getProbeDiagnostics: jest.fn().mockReturnValue({ hasProbes: true }),
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return new GOAPDebugger({
    goapController: controller,
    planInspector,
    stateDiffViewer,
    refinementTracer,
    eventTraceProbe,
    goapEventDispatcher,
    logger,
  });
}

describe('GOAPDebugger effect failure telemetry', () => {
  it('surfaces testTaskReducesDistance failures in the report payload', () => {
    const debuggerInstance = createDebugger();

    const report = debuggerInstance.generateReportJSON(ACTOR_ID);

    expect(report.effectFailureTelemetry).toEqual(
      expect.objectContaining({
        actorId: ACTOR_ID,
        totalFailures: 1,
        failures: [
          expect.objectContaining({
            taskId: 'core:invalid_effect',
            phase: 'distance-check',
            message: 'Parameter resolution failed',
          }),
        ],
      })
    );
    expect(report.diagnosticsMeta.effectFailureTelemetry).toEqual(
      expect.objectContaining({
        sectionId: GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT.sections.effectFailureTelemetry.id,
        available: true,
        stale: false,
      })
    );
  });
});
