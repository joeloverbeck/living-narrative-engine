import { describe, it, beforeEach, afterEach, beforeAll, afterAll, expect } from '@jest/globals';
import { createGoapTestSetup } from '../testFixtures/goapTestSetup.js';
import GOAPDebugger from '../../../../src/goap/debug/goapDebugger.js';
import { createPlanningStateView } from '../../../../src/goap/planner/planningStateView.js';

function createStubPlanInspector() {
  return {
    inspect: jest.fn().mockReturnValue(''),
    inspectJSON: jest.fn().mockReturnValue(null),
  };
}

function createStubStateDiffViewer() {
  return {
    diff: jest.fn(() => ({})),
    visualize: jest.fn(() => ''),
    diffJSON: jest.fn(() => ({})),
  };
}

function createStubRefinementTracer() {
  return {
    startCapture: jest.fn(),
    stopCapture: jest.fn().mockReturnValue(null),
    getTrace: jest.fn().mockReturnValue(null),
    format: jest.fn(() => ''),
  };
}

describe('GOAPDebugger diagnostics integration', () => {
  let setup;
  let goapDebugger;
  let logger;
  let previousAssertionFlag;

  beforeAll(() => {
    previousAssertionFlag = process.env.GOAP_STATE_ASSERT;
    process.env.GOAP_STATE_ASSERT = '1';
  });

  afterAll(() => {
    if (typeof previousAssertionFlag === 'undefined') {
      delete process.env.GOAP_STATE_ASSERT;
    } else {
      process.env.GOAP_STATE_ASSERT = previousAssertionFlag;
    }
  });

  beforeEach(async () => {
    setup = await createGoapTestSetup({ mockRefinement: true });
    logger = setup.testBed.createMockLogger();

    goapDebugger = new GOAPDebugger({
      goapController: setup.controller,
      planInspector: createStubPlanInspector(),
      stateDiffViewer: createStubStateDiffViewer(),
      refinementTracer: createStubRefinementTracer(),
      logger,
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('surfaces missing task-library diagnostics and records planning-state misses', () => {
    const actor = {
      id: 'diagnostics_actor',
      components: {
        'core:needs': { hunger: 10 },
      },
    };
    setup.registerPlanningActor(actor);

    const initialReport = goapDebugger.generateReportJSON(actor.id);
    expect(initialReport.taskLibraryDiagnostics).toBeNull();
    expect(initialReport.diagnosticsMeta.taskLibrary.available).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'GOAP_DEBUGGER_DIAGNOSTICS_MISSING',
      expect.objectContaining({
        actorId: actor.id,
        sectionId: 'taskLibrary',
      })
    );
    logger.warn.mockClear();

    const planningState = setup.buildPlanningState(actor);
    expect(() => {
      const view = createPlanningStateView(planningState, {
        metadata: { actorId: actor.id, origin: 'integration-test' },
      });
      view.assertPath('state.actor.components.nonexistent_component.value');
    }).toThrow(/GOAP_STATE_MISS/);

    const diagnosticsSnapshot = goapDebugger.generateReportJSON(actor.id);
    expect(diagnosticsSnapshot.planningStateDiagnostics).toEqual(
      expect.objectContaining({
        totalMisses: expect.any(Number),
        lastMisses: expect.arrayContaining([
          expect.objectContaining({
            reason: expect.any(String),
            timestamp: expect.any(Number),
          }),
        ]),
      })
    );
    expect(diagnosticsSnapshot.diagnosticsMeta.planningState.available).toBe(true);
    expect(diagnosticsSnapshot.diagnosticsMeta.planningState.stale).toBe(false);

    // Warning stays throttled even though diagnostics are still missing for task library
    goapDebugger.generateReportJSON(actor.id);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
