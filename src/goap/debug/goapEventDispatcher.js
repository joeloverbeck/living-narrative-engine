import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { GOAP_EVENTS } from '../events/goapEvents.js';

const GLOBAL_ACTOR_ID = 'global';
export const GOAP_EVENT_COMPLIANCE_CODES = {
  MISSING_PAYLOAD: 'GOAP_EVENT_PAYLOAD_MISSING',
  INVALID_SIGNATURE: 'GOAP_EVENT_INVALID_SIGNATURE',
};

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
 * @returns {{
 *   dispatch(eventType: string, payload?: object, options?: { allowEmptyPayload?: boolean, actorIdOverride?: string }): Promise<void> | void,
 *   getComplianceSnapshot(): { global: object|null, actors: object[] },
 *   getComplianceForActor(actorId: string): object|null
 * }}
 */
export function createGoapEventDispatcher(eventBus, logger) {
  if (!eventBus || typeof eventBus.dispatch !== 'function') {
    throw new Error('createGoapEventDispatcher requires an eventBus with a dispatch method.');
  }

  const safeLogger = ensureValidLogger(logger, 'GoapEventDispatcher');
  const complianceByActor = new Map();
  complianceByActor.set(GLOBAL_ACTOR_ID, createComplianceEntry(GLOBAL_ACTOR_ID));

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
    const globalEntry = complianceByActor.get(GLOBAL_ACTOR_ID);
    globalEntry.totalEvents += 1;

    const actorEntry = getOrCreateEntry(actorId);
    if (actorEntry) {
      actorEntry.totalEvents += 1;
    }
  };

  const recordViolation = ({ actorId, eventType, reason, code }) => {
    const violation = {
      actorId: actorId || 'unknown',
      eventType,
      code,
      reason,
      stack: new Error(reason).stack,
      timestamp: Date.now(),
    };

    const globalEntry = complianceByActor.get(GLOBAL_ACTOR_ID);
    globalEntry.missingPayloads += 1;
    globalEntry.lastViolation = violation;

    const actorEntry = getOrCreateEntry(actorId);
    if (actorEntry) {
      actorEntry.missingPayloads += 1;
      actorEntry.lastViolation = violation;
    }

    try {
      safeLogger.warn('GOAP event dispatch violation detected', violation);
      eventBus.dispatch(GOAP_EVENTS.EVENT_CONTRACT_VIOLATION, violation);
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
      recordEventDispatch(actorId);
      return eventBus.dispatch(validatedType, normalizedPayload);
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
  };

  return dispatcher;
}
