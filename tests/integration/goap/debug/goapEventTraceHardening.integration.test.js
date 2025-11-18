import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createGoapTestSetup } from '../testFixtures/goapTestSetup.js';
import GOAPDebugger from '../../../../src/goap/debug/goapDebugger.js';
import PlanInspector from '../../../../src/goap/debug/planInspector.js';
import StateDiffViewer from '../../../../src/goap/debug/stateDiffViewer.js';
import RefinementTracer from '../../../../src/goap/debug/refinementTracer.js';
import { createConsumeTask } from '../testFixtures/testTaskFactory.js';
import { createHungerGoal } from '../testFixtures/testGoalFactory.js';
import { createGoapEventTraceProbe } from '../../../../src/goap/debug/goapEventTraceProbe.js';

/**
 *
 * @param setup
 * @param logger
 */
function buildPlanInspector(setup, logger) {
  return new PlanInspector({
    goapController: setup.controller,
    dataRegistry: setup.dataRegistry,
    entityManager: setup.entityManager,
    entityDisplayDataProvider: { getEntityDisplayData: (id) => ({ name: id }) },
    logger,
  });
}

/**
 *
 * @param logger
 */
function buildStateDiffViewer(logger) {
  return new StateDiffViewer({ logger });
}

/**
 *
 * @param setup
 * @param logger
 */
function buildRefinementTracer(setup, logger) {
  return new RefinementTracer({
    eventBus: setup.eventBus,
    gameDataRepository: setup.gameDataRepository,
    logger,
  });
}

describe('GOAP event trace hardening', () => {
  let setup;
  let goapDebugger;
  let eventTraceProbe;
  let detachProbeHandle;
  let logger;

  afterEach(() => {
    if (detachProbeHandle) {
      detachProbeHandle();
      detachProbeHandle = null;
    }
    if (eventTraceProbe) {
      eventTraceProbe.clear();
      eventTraceProbe = null;
    }
    if (setup?.testBed) {
      setup.testBed.cleanup();
      setup = null;
    }
  });

  describe('auto-attached probes', () => {
    beforeEach(async () => {
      const consumeTask = createConsumeTask();
      setup = await createGoapTestSetup({
        tasks: {
          diagnostics: {
            [consumeTask.id]: consumeTask,
          },
        },
        mockRefinement: true,
      });
      ({ probe: eventTraceProbe, detach: detachProbeHandle } =
        setup.bootstrapEventTraceProbe());

      logger = setup.testBed.createMockLogger();
      const planInspector = buildPlanInspector(setup, logger);
      const stateDiffViewer = buildStateDiffViewer(logger);
      const refinementTracer = buildRefinementTracer(setup, logger);

      goapDebugger = new GOAPDebugger({
        goapController: setup.controller,
        planInspector,
        stateDiffViewer,
        refinementTracer,
        eventTraceProbe,
        goapEventDispatcher: setup.goapEventDispatcher,
        logger,
      });
    });

    it('captures dispatcher events after decideTurn without manual wiring', async () => {
      const actorDef = {
        id: 'trace_actor',
        components: {
          'test:hungry': {},
        },
      };
      const { actor, planningState } = setup.registerPlanningActor(actorDef);
      setup.registerPlanningStateSnapshot(planningState);
      setup.registerGoal(createHungerGoal());

      goapDebugger.startTrace(actor.id);
      await setup.controller.decideTurn(actor, setup.world);

      const stream = goapDebugger.getEventStream(actor.id);
      expect(stream.captureDisabled).not.toBe(true);
      expect(stream.totalCaptured).toBeGreaterThan(0);

      const fallbackWarnings = logger.warn.mock.calls.filter(
        ([, meta]) => meta?.code === 'GOAP_DEBUGGER_TRACE_PROBE_FALLBACK'
      );
      expect(fallbackWarnings).toHaveLength(0);

      const disabledLogs = setup.goapEventDispatcherLogger.info.mock.calls.filter(
        ([, meta]) => meta?.code === 'GOAP_EVENT_TRACE_DISABLED'
      );
      expect(disabledLogs).toHaveLength(0);
    });
  });

  describe('probe fallback warnings', () => {
    beforeEach(async () => {
      const consumeTask = createConsumeTask();
      setup = await createGoapTestSetup({
        tasks: {
          diagnostics: {
            [consumeTask.id]: consumeTask,
          },
        },
        mockRefinement: true,
        autoAttachEventTraceProbe: false,
      });

      logger = setup.testBed.createMockLogger();
      const planInspector = buildPlanInspector(setup, logger);
      const stateDiffViewer = buildStateDiffViewer(logger);
      const refinementTracer = buildRefinementTracer(setup, logger);
      eventTraceProbe = createGoapEventTraceProbe({ logger });

      goapDebugger = new GOAPDebugger({
        goapController: setup.controller,
        planInspector,
        stateDiffViewer,
        refinementTracer,
        eventTraceProbe,
        goapEventDispatcher: setup.goapEventDispatcher,
        logger,
      });
    });

    it('emits fallback warning and annotates snapshots when no probes are wired', () => {
      const actorId = 'missing-probe-actor';

      goapDebugger.startTrace(actorId);

      const fallbackWarnings = logger.warn.mock.calls.filter(
        ([, meta]) => meta?.code === 'GOAP_DEBUGGER_TRACE_PROBE_FALLBACK'
      );
      expect(fallbackWarnings).toHaveLength(1);

      const stream = goapDebugger.getEventStream(actorId);
      expect(stream.captureDisabled).toBe(true);

      const disabledLogs = setup.goapEventDispatcherLogger.info.mock.calls.filter(
        ([, meta]) => meta?.code === 'GOAP_EVENT_TRACE_DISABLED'
      );
      expect(disabledLogs.length).toBeGreaterThan(0);
    });
  });
});
