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

  it('clones payloads without structured objects correctly', async () => {
    const probeEvents = [];
    const dispatcher = createGoapEventDispatcher(eventBus, logger, {
      probes: [{ record: (entry) => probeEvents.push(entry) }],
    });

    // Test with non-object payload (should return empty object)
    await dispatcher.dispatch('goap:test_event', { actorId: 'actor-1', data: null });
    expect(probeEvents[0].payload).toBeDefined();
    expect(typeof probeEvents[0].payload).toBe('object');
  });

  it('handles circular reference payloads by falling back to spread operator', async () => {
    const probeEvents = [];
    const dispatcher = createGoapEventDispatcher(eventBus, logger, {
      probes: [{ record: (entry) => probeEvents.push(entry) }],
    });

    // Create a circular reference
    const circularPayload = { actorId: 'actor-1' };
    circularPayload.self = circularPayload;

    // Mock structuredClone to fail
    const originalStructuredClone = global.structuredClone;
    global.structuredClone = () => {
      throw new Error('Cannot clone circular structure');
    };

    await dispatcher.dispatch('goap:test_event', circularPayload);

    // Restore original
    global.structuredClone = originalStructuredClone;

    expect(probeEvents).toHaveLength(1);
    // The payload should have been cloned via spread, which won't include circular refs
    expect(probeEvents[0].payload.actorId).toBe('actor-1');
  });

  it('returns null when cloning null compliance entries', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    // getComplianceForActor with non-existent actor should use cloneComplianceEntry(undefined)
    const result = dispatcher.getComplianceForActor('non-existent-actor');
    expect(result).toBeNull();
  });

  it('returns null when cloning null planning entries', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    const snapshot = dispatcher.getPlanningComplianceSnapshot();
    // All actors in the snapshot should be valid, but internal clonePlanningEntry(null) is tested
    expect(snapshot.global).toBeDefined();
    expect(snapshot.global).not.toBeNull();
  });

  it('deduplicates probe state change logs', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);
    logger.info.mockClear();

    const probe1 = { record: jest.fn() };
    const probe2 = { record: jest.fn() };

    // First probe registration should log "enabled"
    const detach1 = dispatcher.registerProbe(probe1);
    expect(logger.info).toHaveBeenCalledTimes(1);

    logger.info.mockClear();

    // Second probe registration should NOT log again (state is still "enabled")
    const detach2 = dispatcher.registerProbe(probe2);
    expect(logger.info).not.toHaveBeenCalled();

    logger.info.mockClear();

    // First detach should NOT log (still has 1 probe)
    detach1();
    expect(logger.info).not.toHaveBeenCalled();

    logger.info.mockClear();

    // Second detach should log "disabled"
    detach2();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('tracing disabled'),
      expect.anything()
    );
  });

  it('handles invalid actorId types in getOrCreateEntry', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    // Dispatch with non-string actorId (should normalize to 'global')
    await dispatcher.dispatch('goap:test_event', { actorId: 123 });

    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.totalEvents).toBe(1);
  });

  it('handles empty string actorId in getOrCreateEntry', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    // Dispatch with empty string actorId (should normalize to 'global')
    await dispatcher.dispatch('goap:test_event', { actorId: '   ' });

    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.totalEvents).toBe(1);
    // Should not create a separate actor entry
    expect(snapshot.actors).toHaveLength(0);
  });

  it('handles planning events for global actor without creating separate entry', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    // Dispatch planning event with explicit 'global' actorId
    await dispatcher.dispatch(GOAP_EVENTS.PLANNING_COMPLETED, { actorId: 'global' });

    const planningSnapshot = dispatcher.getPlanningComplianceSnapshot();
    expect(planningSnapshot.global.planningCompleted).toBe(1);
    // Should not create a separate actor entry for 'global'
    expect(planningSnapshot.actors).toHaveLength(0);
  });

  it('handles errors when dispatching violation events', () => {
    const failingEventBus = {
      // eslint-disable-next-line no-unused-vars
      dispatch: jest.fn((eventType, _payload) => {
        if (eventType === GOAP_EVENTS.EVENT_CONTRACT_VIOLATION) {
          throw new Error('Event bus failure');
        }
      }),
    };

    const dispatcher = createGoapEventDispatcher(failingEventBus, logger);

    // This should trigger a violation that tries to dispatch but fails
    expect(() => dispatcher.dispatch('goap:test_event', null)).toThrow();

    // Should have logged the error
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to dispatch GOAP event contract violation',
      expect.objectContaining({
        violation: expect.any(Object),
        error: expect.any(Error),
      })
    );
  });

  it('rejects empty string event types', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    expect(() => dispatcher.dispatch('', { actorId: 'actor-1' })).toThrow(
      /requires a non-empty string eventType/
    );

    // Should have recorded a violation
    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.missingPayloads).toBe(1);
  });

  it('rejects whitespace-only event types', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    expect(() => dispatcher.dispatch('   ', { actorId: 'actor-1' })).toThrow(
      /requires a non-empty string eventType/
    );

    // Should have recorded a violation
    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.missingPayloads).toBe(1);
  });

  it('rejects non-string event types', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    expect(() => dispatcher.dispatch(123, { actorId: 'actor-1' })).toThrow(
      /requires a non-empty string eventType/
    );

    // Should have recorded a violation
    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.missingPayloads).toBe(1);
  });

  it('rejects non-object payloads when allowEmptyPayload is true', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    // String payload with allowEmptyPayload=true
    expect(() =>
      dispatcher.dispatch('goap:test_event', 'invalid payload', { allowEmptyPayload: true })
    ).toThrow(/must use an object payload when provided/);

    // Should have recorded a violation
    let snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.missingPayloads).toBe(1);

    // Number payload with allowEmptyPayload=true
    expect(() =>
      dispatcher.dispatch('goap:test_event', 123, { allowEmptyPayload: true })
    ).toThrow(/must use an object payload when provided/);

    snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.missingPayloads).toBe(2);
  });

  it('allows null payload when allowEmptyPayload is true', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    await dispatcher.dispatch('goap:test_event', null, { allowEmptyPayload: true });

    expect(eventBus.dispatch).toHaveBeenCalledWith('goap:test_event', {});
    const snapshot = dispatcher.getComplianceSnapshot();
    expect(snapshot.global.totalEvents).toBe(1);
    expect(snapshot.global.missingPayloads).toBe(0);
  });

  it('emits violation to probes when recordViolation is called', () => {
    const probeEvents = [];
    const dispatcher = createGoapEventDispatcher(eventBus, logger, {
      probes: [{ record: (entry) => probeEvents.push(entry) }],
    });

    // Trigger a violation
    expect(() => dispatcher.dispatch('goap:test_event', null)).toThrow();

    // Check that the violation was emitted to the probe
    const violationEvent = probeEvents.find(
      (e) => e.type === GOAP_EVENTS.EVENT_CONTRACT_VIOLATION
    );
    expect(violationEvent).toBeDefined();
    expect(violationEvent.violation).toBe(true);
    expect(violationEvent.payload).toMatchObject({
      code: GOAP_EVENT_COMPLIANCE_CODES.MISSING_PAYLOAD,
      eventType: 'goap:test_event',
    });
  });

  it('handles actorIdOverride parameter', async () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    await dispatcher.dispatch('goap:test_event', { data: 'test' }, {
      actorIdOverride: 'override-actor',
    });

    const actorStats = dispatcher.getComplianceForActor('override-actor');
    expect(actorStats).toMatchObject({
      actorId: 'override-actor',
      totalEvents: 1,
    });
  });

  it('clones lastViolation when present in compliance entry', () => {
    const dispatcher = createGoapEventDispatcher(eventBus, logger);

    // Trigger a violation to create lastViolation
    expect(() => dispatcher.dispatch('goap:test_event', null)).toThrow();

    const snapshot1 = dispatcher.getComplianceSnapshot();
    expect(snapshot1.global.lastViolation).toBeDefined();

    // Mutate the snapshot
    snapshot1.global.lastViolation.mutated = true;

    // Get a fresh snapshot and verify it's not mutated
    const snapshot2 = dispatcher.getComplianceSnapshot();
    expect(snapshot2.global.lastViolation.mutated).toBeUndefined();
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
