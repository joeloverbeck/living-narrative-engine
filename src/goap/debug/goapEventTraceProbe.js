import { ensureValidLogger } from '../../utils/loggerUtils.js';

const GLOBAL_ACTOR_ID = 'global';
const DEFAULT_MAX_EVENTS_PER_ACTOR = 100;
const DEFAULT_MAX_GLOBAL_EVENTS = 250;

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
 *
 * @param payload
 */
function clonePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(payload);
    } catch (_) {
      // Fall back to JSON serialization when structuredClone fails
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
 * @param event
 */
function cloneEvent(event) {
  return {
    type: event.type,
    actorId: event.actorId,
    violation: Boolean(event.violation),
    timestamp: event.timestamp,
    payload: clonePayload(event.payload),
  };
}

/**
 * Create a GOAP event trace probe that buffers dispatcher events per actor.
 *
 * @param {object} [options]
 * @param {number} [options.maxEventsPerActor]
 * @param {number} [options.maxGlobalEvents]
 * @param {import('../../interfaces/coreServices.js').ILogger} [options.logger]
 * @returns {IGoapEventProbe & {
 *   startCapture(actorId: string): void,
 *   stopCapture(actorId: string): void,
 *   isCapturing(actorId: string): boolean,
 *   getSnapshot(actorId?: string): object,
 *   getEvents(actorId?: string): Array<object>,
 *   flush(actorId?: string): Array<object>,
 *   clear(actorId?: string): void,
 *   getActiveActors(): string[]
 * }}
 */
export function createGoapEventTraceProbe(options = {}) {
  const {
    maxEventsPerActor = DEFAULT_MAX_EVENTS_PER_ACTOR,
    maxGlobalEvents = DEFAULT_MAX_GLOBAL_EVENTS,
    logger,
  } = options;

  const safeLogger = ensureValidLogger(logger, 'GoapEventTraceProbe');
  const activeActors = new Set();
  const eventsByActor = new Map();
  const violationCounts = new Map();
  const globalEvents = [];
  let totalRecorded = 0;
  let totalViolations = 0;
  let attachedAtLeastOnce = false;

  const ensureActorBuffer = (actorId) => {
    if (actorId === GLOBAL_ACTOR_ID) {
      return globalEvents;
    }
    if (!eventsByActor.has(actorId)) {
      eventsByActor.set(actorId, []);
    }
    return eventsByActor.get(actorId);
  };

  const pushEvent = (buffer, event, limit) => {
    buffer.push(event);
    if (buffer.length > limit) {
      buffer.shift();
    }
  };

  const record = (event) => {
    const normalizedActor = normalizeActorId(event.actorId);
    const captureTargets = new Set();

    if (activeActors.has(normalizedActor)) {
      captureTargets.add(normalizedActor);
    }
    if (activeActors.has(GLOBAL_ACTOR_ID)) {
      captureTargets.add(GLOBAL_ACTOR_ID);
    }

    if (captureTargets.size === 0) {
      return;
    }

    const snapshot = {
      type: event.type,
      payload: clonePayload(event.payload),
      actorId: normalizedActor,
      violation: Boolean(event.violation),
      timestamp: event.timestamp || Date.now(),
    };

    totalRecorded += 1;
    if (snapshot.violation) {
      totalViolations += 1;
      violationCounts.set(
        normalizedActor,
        (violationCounts.get(normalizedActor) || 0) + 1
      );
      violationCounts.set(
        GLOBAL_ACTOR_ID,
        (violationCounts.get(GLOBAL_ACTOR_ID) || 0) + 1
      );
    }

    captureTargets.forEach((target) => {
      const buffer = ensureActorBuffer(target);
      const limit = target === GLOBAL_ACTOR_ID ? maxGlobalEvents : maxEventsPerActor;
      pushEvent(buffer, snapshot, limit);
    });
  };

  const startCapture = (actorId) => {
    const normalized = normalizeActorId(actorId);
    activeActors.add(normalized);
    ensureActorBuffer(normalized);
    attachedAtLeastOnce = true;
    safeLogger.debug(`GOAP event trace capture enabled for ${normalized}`);
  };

  const stopCapture = (actorId) => {
    const normalized = normalizeActorId(actorId);
    if (activeActors.delete(normalized)) {
      safeLogger.debug(`GOAP event trace capture disabled for ${normalized}`);
    }
  };

  const getBufferSnapshot = (actorId) => {
    const normalized = normalizeActorId(actorId);
    const buffer =
      normalized === GLOBAL_ACTOR_ID
        ? globalEvents
        : eventsByActor.get(normalized) || [];

    return {
      actorId: normalized,
      capturing: activeActors.has(normalized),
      bufferLimit:
        normalized === GLOBAL_ACTOR_ID ? maxGlobalEvents : maxEventsPerActor,
      totalCaptured: buffer.length,
      totalRecorded,
      totalViolations: violationCounts.get(normalized) || 0,
      globalViolations: violationCounts.get(GLOBAL_ACTOR_ID) || 0,
      lastEventTimestamp:
        buffer.length > 0 ? buffer[buffer.length - 1].timestamp : null,
      events: buffer.map(cloneEvent),
    };
  };

  const flush = (actorId) => {
    const normalized = normalizeActorId(actorId);
    const buffer =
      normalized === GLOBAL_ACTOR_ID
        ? globalEvents
        : eventsByActor.get(normalized) || [];
    const snapshot = buffer.map(cloneEvent);
    buffer.length = 0;
    return snapshot;
  };

  const clear = (actorId) => {
    if (actorId) {
      const normalized = normalizeActorId(actorId);
      if (normalized === GLOBAL_ACTOR_ID) {
        globalEvents.length = 0;
      } else {
        eventsByActor.delete(normalized);
      }
      violationCounts.delete(normalized);
      return;
    }

    activeActors.clear();
    eventsByActor.clear();
    globalEvents.length = 0;
    violationCounts.clear();
    totalRecorded = 0;
    totalViolations = 0;
  };

  return {
    record,
    startCapture,
    stopCapture,
    isCapturing(actorId) {
      return activeActors.has(normalizeActorId(actorId));
    },
    getSnapshot: getBufferSnapshot,
    getEvents(actorId) {
      return getBufferSnapshot(actorId).events;
    },
    flush,
    clear,
    getActiveActors() {
      return Array.from(activeActors);
    },
    getTotals() {
      return {
        totalRecorded,
        totalViolations,
        attachedAtLeastOnce,
      };
    },
  };
}
