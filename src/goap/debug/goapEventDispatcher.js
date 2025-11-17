import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { GOAP_EVENTS } from '../events/goapEvents.js';

const GLOBAL_ACTOR_ID = 'global';
const EVENT_BUS_CONTRACT_REFERENCE = 'See specs/goap-system-specs.md and docs/goap/debugging-tools.md#Planner Contract Checklist for the GOAP event bus contract.';
export const GOAP_EVENT_COMPLIANCE_CODES = {
  MISSING_PAYLOAD: 'GOAP_EVENT_PAYLOAD_MISSING',
  INVALID_SIGNATURE: 'GOAP_EVENT_INVALID_SIGNATURE',
};

const warnedEventBuses = new WeakSet();

function clonePayloadForProbe(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(payload);
    } catch (_) {
      // Fall through to JSON serialization when structuredClone fails
    }
  }

  try {
    return JSON.parse(JSON.stringify(payload));
  } catch (_) {
    return { ...payload };
  }
}

function normalizeActorId(actorId) {
  if (typeof actorId === 'string') {
    const trimmed = actorId.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return GLOBAL_ACTOR_ID;
}

/**
 * @typedef {object} IGoapEventProbe
 * @property {(event: { type: string, payload: object, actorId?: string, violation?: boolean, timestamp: number }) => void} record
 */

export function validateEventBusContract(eventBus, logger, options = {}) {
  const safeLogger = ensureValidLogger(logger, 'GoapEventDispatcher');
  const context = options.context || 'GoapEventDispatcher';

  if (!eventBus || typeof eventBus.dispatch !== 'function') {
    const message =
      'GOAP event dispatcher requires an eventBus with a dispatch(eventType, payload) method. ' +
      EVENT_BUS_CONTRACT_REFERENCE;
    safeLogger.warn('GOAP event bus missing dispatch method', { context });
    throw new Error(message);
  }

  const arity = eventBus.dispatch.length;
  if (arity > 0 && arity < 2) {
    const message =
      `GOAP event bus dispatch must accept (eventType, payload). Received function arity=${arity}. ` +
      EVENT_BUS_CONTRACT_REFERENCE;
    if (!warnedEventBuses.has(eventBus)) {
      safeLogger.warn('GOAP event bus dispatch signature mismatch', {
        context,
        arity,
      });
      warnedEventBuses.add(eventBus);
    }
    throw new Error(message);
  }

  return eventBus;
}

function createComplianceEntry(actorId) {
  return {
    actorId,
    totalEvents: 0,
    missingPayloads: 0,
    lastViolation: null,
  };
}

function cloneComplianceEntry(entry) {
  if (!entry) {
    return null;
  }
  return {
    actorId: entry.actorId,
    totalEvents: entry.totalEvents,
    missingPayloads: entry.missingPayloads,
    lastViolation: entry.lastViolation ? { ...entry.lastViolation } : null,
  };
}

/**
 * Create a GOAP-specific event dispatcher that enforces payload contracts and
 * tracks compliance metrics.
 *
 * @param {import('../../interfaces/IEventBus.js').IEventBus} eventBus
 * @param {import('../../interfaces/coreServices.js').ILogger} logger
 * @param {object} [options]
 * @param {Array<IGoapEventProbe>} [options.probes]
 * @param {string} [options.context]
 * @returns {{
 *   dispatch(eventType: string, payload?: object, options?: { allowEmptyPayload?: boolean, actorIdOverride?: string }): Promise<void> | void,
 *   getComplianceSnapshot(): { global: object|null, actors: object[] },
 *   getComplianceForActor(actorId: string): object|null
 * }}
 */
export function createGoapEventDispatcher(eventBus, logger, options = {}) {
  const safeLogger = ensureValidLogger(logger, 'GoapEventDispatcher');
  const { probes = [], context } = options ?? {};
  const validatedEventBus = validateEventBusContract(eventBus, safeLogger, {
    context: context || 'GoapEventDispatcher',
  });
  const activeProbes = Array.isArray(probes)
    ? probes.filter((probe) => probe && typeof probe.record === 'function')
    : [];
  const complianceByActor = new Map();
  complianceByActor.set(GLOBAL_ACTOR_ID, createComplianceEntry(GLOBAL_ACTOR_ID));

  const emitToProbes = (eventType, payload, metadata = {}) => {
    if (activeProbes.length === 0) {
      return;
    }

    const snapshot = {
      type: eventType,
      payload: clonePayloadForProbe(payload),
      actorId: metadata.actorId ? normalizeActorId(metadata.actorId) : undefined,
      violation: Boolean(metadata.violation),
      timestamp: metadata.timestamp || Date.now(),
    };

    for (const probe of activeProbes) {
      try {
        probe.record(snapshot);
      } catch (error) {
        safeLogger.warn('GOAP event probe failed to record event', {
          eventType,
          error,
        });
      }
    }
  };

  const registerProbe = (probe) => {
    if (!probe || typeof probe.record !== 'function') {
      safeLogger.warn('GOAP event probe missing record() method', {
        context: context || 'GoapEventDispatcher',
      });
      return () => {};
    }

    activeProbes.push(probe);
    return () => {
      const index = activeProbes.indexOf(probe);
      if (index >= 0) {
        activeProbes.splice(index, 1);
      }
    };
  };

  const getOrCreateEntry = (actorId) => {
    if (!actorId || typeof actorId !== 'string') {
      return null;
    }
    const normalizedId = actorId.trim();
    if (!normalizedId) {
      return null;
    }
    if (!complianceByActor.has(normalizedId)) {
      complianceByActor.set(normalizedId, createComplianceEntry(normalizedId));
    }
    return complianceByActor.get(normalizedId);
  };

  const recordEventDispatch = (actorId) => {
    const normalizedActor = normalizeActorId(actorId);
    const globalEntry = complianceByActor.get(GLOBAL_ACTOR_ID);
    globalEntry.totalEvents += 1;

    const actorEntry =
      normalizedActor === GLOBAL_ACTOR_ID
        ? null
        : getOrCreateEntry(normalizedActor);
    if (actorEntry) {
      actorEntry.totalEvents += 1;
    }
  };

  const recordViolation = ({ actorId, eventType, reason, code }) => {
    const violation = {
      actorId: normalizeActorId(actorId),
      eventType,
      code,
      reason,
      stack: new Error(reason).stack,
      timestamp: Date.now(),
    };

    const globalEntry = complianceByActor.get(GLOBAL_ACTOR_ID);
    globalEntry.missingPayloads += 1;
    globalEntry.lastViolation = violation;

    const actorEntry =
      violation.actorId === GLOBAL_ACTOR_ID
        ? globalEntry
        : getOrCreateEntry(violation.actorId);
    if (actorEntry && actorEntry !== globalEntry) {
      actorEntry.missingPayloads += 1;
      actorEntry.lastViolation = violation;
    }

    emitToProbes(GOAP_EVENTS.EVENT_CONTRACT_VIOLATION, violation, {
      actorId: violation.actorId,
      violation: true,
      timestamp: violation.timestamp,
    });

    try {
      safeLogger.warn('GOAP event dispatch violation detected', violation);
      validatedEventBus.dispatch(GOAP_EVENTS.EVENT_CONTRACT_VIOLATION, violation);
    } catch (error) {
      safeLogger.error('Failed to dispatch GOAP event contract violation', {
        violation,
        error,
      });
    }
  };

  const validateEventType = (eventType) => {
    if (typeof eventType === 'object' && eventType !== null) {
      const legacyType = typeof eventType.type === 'string' ? eventType.type : 'unknown';
      recordViolation({
        actorId: eventType?.payload?.actorId,
        eventType: legacyType,
        reason:
          'GOAP events must call dispatch(eventType, payload). Received legacy object signature.',
        code: GOAP_EVENT_COMPLIANCE_CODES.INVALID_SIGNATURE,
      });
      throw new Error(
        'GOAP event dispatch requires (eventType, payload). Received legacy single-object signature.'
      );
    }

    if (typeof eventType !== 'string' || eventType.trim().length === 0) {
      recordViolation({
        actorId: undefined,
        eventType: 'unknown',
        reason: 'GOAP event dispatch requires a non-empty string eventType.',
        code: GOAP_EVENT_COMPLIANCE_CODES.INVALID_SIGNATURE,
      });
      throw new Error('GOAP event dispatch requires a non-empty string eventType.');
    }

    return eventType;
  };

  const normalizePayload = (eventType, payload, allowEmptyPayload, actorIdOverride) => {
    if (!allowEmptyPayload) {
      if (!payload || typeof payload !== 'object') {
        recordViolation({
          actorId: actorIdOverride,
          eventType,
          reason: 'GOAP event payload must be a non-null object.',
          code: GOAP_EVENT_COMPLIANCE_CODES.MISSING_PAYLOAD,
        });
        throw new Error(
          `GOAP event "${eventType}" requires a structured payload object. See specs/goap-system-specs.md#Planner Interface Contract.`
        );
      }
    } else if (payload != null && typeof payload !== 'object') {
      recordViolation({
        actorId: actorIdOverride,
        eventType,
        reason: 'GOAP event payload must be an object when provided.',
        code: GOAP_EVENT_COMPLIANCE_CODES.MISSING_PAYLOAD,
      });
      throw new Error(
        `GOAP event "${eventType}" must use an object payload when provided. See specs/goap-system-specs.md.`
      );
    }

    return payload ?? {};
  };

  const dispatcher = {
    dispatch(eventType, payload, options = {}) {
      const { allowEmptyPayload = false, actorIdOverride } = options;
      const validatedType = validateEventType(eventType);
      const normalizedPayload = normalizePayload(
        validatedType,
        payload,
        allowEmptyPayload,
        actorIdOverride
      );

      const actorId = actorIdOverride || normalizedPayload?.actorId;
      const normalizedActorId = normalizeActorId(actorId);
      recordEventDispatch(normalizedActorId);
      emitToProbes(validatedType, normalizedPayload, {
        actorId: normalizedActorId,
        timestamp: normalizedPayload?.timestamp,
      });

      const dispatchResult = validatedEventBus.dispatch(
        validatedType,
        normalizedPayload
      );

      if (
        typeof dispatchResult !== 'undefined' &&
        (typeof dispatchResult !== 'object' || typeof dispatchResult.then !== 'function')
      ) {
        const message =
          'GOAP event bus dispatch must return a Promise or void. ' +
          EVENT_BUS_CONTRACT_REFERENCE;
        safeLogger.warn('GOAP event bus returned invalid dispatch result', {
          eventType: validatedType,
          resultType: typeof dispatchResult,
        });
        throw new Error(message);
      }

      return dispatchResult;
    },

    getComplianceSnapshot() {
      return {
        global: cloneComplianceEntry(complianceByActor.get(GLOBAL_ACTOR_ID)),
        actors: Array.from(complianceByActor.values())
          .filter((entry) => entry.actorId !== GLOBAL_ACTOR_ID)
          .map((entry) => cloneComplianceEntry(entry)),
      };
    },

    getComplianceForActor(actorId) {
      const targetId = actorId || GLOBAL_ACTOR_ID;
      const entry =
        targetId === GLOBAL_ACTOR_ID
          ? complianceByActor.get(GLOBAL_ACTOR_ID)
          : complianceByActor.get(targetId);
      return cloneComplianceEntry(entry);
    },

    registerProbe,
  };

  return dispatcher;
}
