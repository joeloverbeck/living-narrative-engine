import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { GOAP_EVENTS } from '../events/goapEvents.js';

const GLOBAL_ACTOR_ID = 'global';
const EVENT_BUS_CONTRACT_REFERENCE = 'See specs/goap-system-specs.md and docs/goap/debugging-tools.md#Planner Contract Checklist for the GOAP event bus contract.';
export const GOAP_EVENT_COMPLIANCE_CODES = {
  MISSING_PAYLOAD: 'GOAP_EVENT_PAYLOAD_MISSING',
  INVALID_SIGNATURE: 'GOAP_EVENT_INVALID_SIGNATURE',
};
export const GOAP_EVENT_TRACE_LOG_CODES = {
  DISABLED: 'GOAP_EVENT_TRACE_DISABLED',
  ENABLED: 'GOAP_EVENT_TRACE_ENABLED',
};

const warnedEventBuses = new WeakSet();

/**
 *
 * @param payload
 */
function clonePayloadForProbe(payload) {
  // payload is always an object (normalized by normalizePayload)
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

/**
 *
 * @param actorId
 */
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

/**
 *
 * @param eventBus
 * @param logger
 * @param options
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

/**
 *
 * @param actorId
 */
function createComplianceEntry(actorId) {
  return {
    actorId,
    totalEvents: 0,
    missingPayloads: 0,
    planningCompleted: 0,
    planningFailed: 0,
    lastViolation: null,
  };
}

/**
 *
 * @param entry
 */
function cloneComplianceEntry(entry) {
  if (!entry) {
    return null;
  }
  return {
    actorId: entry.actorId,
    totalEvents: entry.totalEvents,
    missingPayloads: entry.missingPayloads,
    planningCompleted: entry.planningCompleted,
    planningFailed: entry.planningFailed,
    lastViolation: entry.lastViolation ? { ...entry.lastViolation } : null,
  };
}

/**
 *
 * @param entry
 */
function clonePlanningEntry(entry) {
  // entry is always valid (comes from complianceByActor Map)
  const planningCompleted = entry.planningCompleted || 0;
  const planningFailed = entry.planningFailed || 0;
  return {
    actorId: entry.actorId,
    planningCompleted,
    planningFailed,
    totalPlanningEvents: planningCompleted + planningFailed,
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
 *   getPlanningComplianceSnapshot(): { global: object|null, actors: object[] },
 *   getComplianceForActor(actorId: string): object|null,
 *   registerProbe(probe: IGoapEventProbe): () => void,
 *   getProbeDiagnostics(): { totalRegistered: number, totalAttachedEver: number, totalDetached: number, lastAttachedAt: number|null, lastDetachedAt: number|null, hasProbes: boolean }
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
  const probeStats = {
    totalRegistered: activeProbes.length,
    totalAttachedEver: activeProbes.length,
    totalDetached: 0,
    lastAttachedAt: activeProbes.length > 0 ? Date.now() : null,
    lastDetachedAt: null,
    hasProbes: activeProbes.length > 0,
  };
  const complianceByActor = new Map();
  complianceByActor.set(GLOBAL_ACTOR_ID, createComplianceEntry(GLOBAL_ACTOR_ID));
  let lastProbeLogState = probeStats.hasProbes ? 'enabled' : 'disabled';

  if (!probeStats.hasProbes) {
    safeLogger.info('GOAP event trace probes unavailable; dispatcher constructed without probes.', {
      code: GOAP_EVENT_TRACE_LOG_CODES.DISABLED,
      context: context || 'GoapEventDispatcher',
    });
  }

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

  const logProbeStateChange = (state) => {
    // Note: State change is guaranteed by guards in registerProbe/detach functions
    // (wasEmpty check and activeProbes.length === 0 check ensure only transitions are logged)
    lastProbeLogState = state;
    if (state === 'enabled') {
      safeLogger.info('GOAP event trace probe attached; tracing enabled.', {
        code: GOAP_EVENT_TRACE_LOG_CODES.ENABLED,
        context: context || 'GoapEventDispatcher',
      });
    } else {
      safeLogger.info('GOAP event trace probes unavailable; tracing disabled.', {
        code: GOAP_EVENT_TRACE_LOG_CODES.DISABLED,
        context: context || 'GoapEventDispatcher',
      });
    }
  };

  const registerProbe = (probe) => {
    if (!probe || typeof probe.record !== 'function') {
      safeLogger.warn('GOAP event probe missing record() method', {
        context: context || 'GoapEventDispatcher',
      });
      return () => {};
    }

    const wasEmpty = activeProbes.length === 0;
    activeProbes.push(probe);
    probeStats.totalRegistered = activeProbes.length;
    probeStats.totalAttachedEver += 1;
    probeStats.hasProbes = activeProbes.length > 0;
    probeStats.lastAttachedAt = Date.now();
    if (wasEmpty) {
      logProbeStateChange('enabled');
    }
    return () => {
      const index = activeProbes.indexOf(probe);
      if (index >= 0) {
        activeProbes.splice(index, 1);
        probeStats.totalRegistered = activeProbes.length;
        probeStats.totalDetached += 1;
        probeStats.hasProbes = activeProbes.length > 0;
        probeStats.lastDetachedAt = Date.now();
        if (activeProbes.length === 0) {
          logProbeStateChange('disabled');
        }
      }
    };
  };

  const getOrCreateEntry = (actorId) => {
    // actorId is always a valid non-empty string (normalized by normalizeActorId before calling)
    if (!complianceByActor.has(actorId)) {
      complianceByActor.set(actorId, createComplianceEntry(actorId));
    }
    return complianceByActor.get(actorId);
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

  const isPlanningEventType = (eventType) => {
    return (
      eventType === GOAP_EVENTS.PLANNING_COMPLETED ||
      eventType === GOAP_EVENTS.PLANNING_FAILED
    );
  };

  const recordPlanningOutcome = (eventType, actorId, hasActorId) => {
    const globalEntry = complianceByActor.get(GLOBAL_ACTOR_ID);
    const field = eventType === GOAP_EVENTS.PLANNING_COMPLETED ? 'planningCompleted' : 'planningFailed';
    globalEntry[field] += 1;

    if (!hasActorId) {
      safeLogger.warn('GOAP planning telemetry missing actorId', {
        eventType,
        context: context || 'GoapEventDispatcher',
      });
      return;
    }

    const actorEntry =
      actorId === GLOBAL_ACTOR_ID ? complianceByActor.get(GLOBAL_ACTOR_ID) : getOrCreateEntry(actorId);
    if (!actorEntry || actorEntry === globalEntry) {
      return;
    }
    actorEntry[field] += 1;
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
    } else if (payload !== null && payload !== undefined && typeof payload !== 'object') {
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

      const actorId = actorIdOverride ?? normalizedPayload?.actorId;
      const hasExplicitActorId = typeof actorId === 'string' && actorId.trim().length > 0;
      const normalizedActorId = normalizeActorId(actorId);
      recordEventDispatch(normalizedActorId);
      if (isPlanningEventType(validatedType)) {
        recordPlanningOutcome(validatedType, normalizedActorId, hasExplicitActorId);
      }
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

    getPlanningComplianceSnapshot() {
      return {
        global: clonePlanningEntry(complianceByActor.get(GLOBAL_ACTOR_ID)),
        actors: Array.from(complianceByActor.values())
          .filter((entry) => entry.actorId !== GLOBAL_ACTOR_ID)
          .map((entry) => clonePlanningEntry(entry)),
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

    getProbeDiagnostics() {
      return {
        totalRegistered: probeStats.totalRegistered,
        totalAttachedEver: probeStats.totalAttachedEver,
        totalDetached: probeStats.totalDetached,
        lastAttachedAt: probeStats.lastAttachedAt,
        lastDetachedAt: probeStats.lastDetachedAt,
        hasProbes: probeStats.hasProbes,
      };
    },
  };

  return dispatcher;
}
