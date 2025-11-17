import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createGoapEventDispatcher, GOAP_EVENT_COMPLIANCE_CODES } from '../../../../src/goap/debug/goapEventDispatcher.js';
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
});
