import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createGoapEventDispatcher,
  GOAP_EVENT_COMPLIANCE_CODES,
  GOAP_EVENT_TRACE_LOG_CODES,
  validateEventBusContract,
} from '../../../../src/goap/debug/goapEventDispatcher.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

describe('createGoapEventDispatcher', () => {
  let eventBus;
  let logger;

  beforeEach(() => {
    eventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('dispatches events via the underlying event bus and tracks compliance', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    await dispatcher.dispatch('goap:test_event', { actorId: 'actor-123' });

    expect(eventBus.dispatch).toHaveBeenCalledWith('goap:test_event', {
      actorId: 'actor-123',
    });

    const actorStats = dispatcher.getComplianceForActor('actor-123');
    expect(actorStats).toMatchObject({
      actorId: 'actor-123',
      totalEvents: 1,
      missingPayloads: 0,
    });

    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.totalEvents).toBe(1);
  });

  it('emits violation telemetry when using the legacy single-object signature', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    expect(() =>
      dispatcher.dispatch({
        type: 'goap:test_event',
        payload: { actorId: 'bad-actor' },
      })
    ).toThrow(/legacy single-object signature/);

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      GOAP_EVENTS.EVENT_CONTRACT_VIOLATION,
      expect.objectContaining({
        code: GOAP_EVENT_COMPLIANCE_CODES.INVALID_SIGNATURE,
        eventType: 'goap:test_event',
      })
    );

    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.missingPayloads).toBe(1);
  });

  it('guards against missing payloads while still recording compliance metadata', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    expect(() => dispatcher.dispatch('goap:test_event')).toThrow(/requires a structured payload object/);

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      GOAP_EVENTS.EVENT_CONTRACT_VIOLATION,
      expect.objectContaining({
        code: GOAP_EVENT_COMPLIANCE_CODES.MISSING_PAYLOAD,
        eventType: 'goap:test_event',
      })
    );

    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.totalEvents).toBe(0);
    expect(snapshot.global.missingPayloads).toBe(1);
  });

  it('allows explicit empty payloads when allowEmptyPayload is true', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    await dispatcher.dispatch('goap:dependency_validated', undefined, {
      allowEmptyPayload: true,
    });

    expect(eventBus.dispatch).toHaveBeenCalledWith('goap:dependency_validated', {});
    expect(dispatcher.getComplianceForActor('global').totalEvents).toBe(1);
  });

  it('fan-outs events to probes without breaking dispatch flow', async () => {
    const probeEvents = [];
    const flakyProbe = {
      record: () => {
        throw new Error('probe failure');
      },
    };
    const dispatcher = createGoapEventDispatcher(eventBus, logger, {
      probes: [
        {
          record: (entry) => probeEvents.push(entry),
        },
        flakyProbe,
      ],
    });

    await dispatcher.dispatch('goap:test_event', { actorId: 'actor-123', taskId: 'task-1' });

    expect(probeEvents).toHaveLength(1);
    expect(probeEvents[0]).toMatchObject({
      type: 'goap:test_event',
      actorId: 'actor-123',
      payload: expect.objectContaining({ taskId: 'task-1' }),
    });
    expect(eventBus.dispatch).toHaveBeenCalledWith('goap:test_event', {
      actorId: 'actor-123',
      taskId: 'task-1',
    });
  });

  it('registers probes after construction and detaches them via the returned handle', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);
    const dynamicProbe = { record: jest.fn() };
    const detach = dispatcher.registerProbe(dynamicProbe);

    await dispatcher.dispatch('goap:test_event', { actorId: 'actor-999' });
    expect(dynamicProbe.record).toHaveBeenCalledTimes(1);

    detach();
    await dispatcher.dispatch('goap:test_event', { actorId: 'actor-999' });
    expect(dynamicProbe.record).toHaveBeenCalledTimes(1);
  });

  it('handles invalid probes when registering dynamically', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);
    const detach = dispatcher.registerProbe(null);

    expect(typeof detach).toBe('function');
    // Calling detach on invalid probes should be a no-op
    expect(() => detach()).not.toThrow();
  });

  it('logs trace state transitions and exposes probe diagnostics', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('probes unavailable'),
      expect.objectContaining({ code: GOAP_EVENT_TRACE_LOG_CODES.DISABLED })
    );

    logger.info.mockClear();
    const probe = { record: jest.fn() };
    const detach = dispatcher.registerProbe(probe);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('tracing enabled'),
      expect.objectContaining({ code: GOAP_EVENT_TRACE_LOG_CODES.ENABLED })
    );
    let diagnostics = dispatcher.getProbeDiagnostics();
    expect(diagnostics).toMatchObject({ hasProbes: true, totalRegistered: 1, totalAttachedEver: 1 });

    logger.info.mockClear();
    detach();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('tracing disabled'),
      expect.objectContaining({ code: GOAP_EVENT_TRACE_LOG_CODES.DISABLED })
    );
    diagnostics = dispatcher.getProbeDiagnostics();
    expect(diagnostics.hasProbes).toBe(false);
    expect(diagnostics.totalDetached).toBe(1);
  });

  it('throws when event bus dispatch returns a non-promise value', () => {
    eventBus.dispatch.mockReturnValue('invalid');
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    expect(() =>
      dispatcher.dispatch('goap:test_event', { actorId: 'actor-1' })
    ).toThrow(/must return a Promise or void/);
  });

  it('tracks planning completion/failure counters per actor without mutation', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    await dispatcher.dispatch(GOAP_EVENTS.PLANNING_COMPLETED, { actorId: 'actor-A' });
    await dispatcher.dispatch(GOAP_EVENTS.PLANNING_FAILED, { actorId: 'actor-B' });
    await dispatcher.dispatch(GOAP_EVENTS.PLANNING_FAILED, { actorId: 'actor-A' });

    const planningSnapshot = dispatcher.getPlanningComplianceSnapshot();
    expect(planningSnapshot.global).toMatchObject({
      planningCompleted: 1,
      planningFailed: 2,
      totalPlanningEvents: 3,
    });

    const actorA = planningSnapshot.actors.find((entry) => entry.actorId === 'actor-A');
    const actorB = planningSnapshot.actors.find((entry) => entry.actorId === 'actor-B');
    expect(actorA).toMatchObject({ planningCompleted: 1, planningFailed: 1, totalPlanningEvents: 2 });
    expect(actorB).toMatchObject({ planningCompleted: 0, planningFailed: 1, totalPlanningEvents: 1 });

    actorA.planningCompleted = 999;
    const freshSnapshot = dispatcher.getPlanningComplianceSnapshot();
    const freshActorA = freshSnapshot.actors.find((entry) => entry.actorId === 'actor-A');
    expect(freshActorA.planningCompleted).toBe(1);
  });

  it('warns and only increments global planning stats when actorId is missing', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    await dispatcher.dispatch(GOAP_EVENTS.PLANNING_COMPLETED, {});

    const planningSnapshot = dispatcher.getPlanningComplianceSnapshot();
    expect(planningSnapshot.global).toMatchObject({ planningCompleted: 1, planningFailed: 0 });
    expect(planningSnapshot.actors).toHaveLength(0);

    expect(logger.warn).toHaveBeenCalledWith(
      'GOAP planning telemetry missing actorId',
      expect.objectContaining({ eventType: GOAP_EVENTS.PLANNING_COMPLETED })
    );
  });
});

describe('validateEventBusContract', () => {
  let logger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('throws when event bus lacks a dispatch method', () => {
    expect(() => validateEventBusContract(null, logger)).toThrow(/dispatch/);
  });

  it('rejects legacy single-argument dispatch functions', () => {
    const legacyBus = {
      dispatch(event) {
        return event;
      },
    };
    expect(() => validateEventBusContract(legacyBus, logger)).toThrow(/event bus dispatch must accept \(eventType, payload\)/);
  });

  it('passes modern dispatch implementations', () => {
    const modernBus = {
      dispatch(eventType, payload) {
        return Promise.resolve({ eventType, payload });
      },
    };
    expect(validateEventBusContract(modernBus, logger)).toBe(modernBus);
  });
});
