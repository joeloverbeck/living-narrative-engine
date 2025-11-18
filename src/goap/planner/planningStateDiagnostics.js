import { GOAP_EVENTS } from '../events/goapEvents.js';
import { emitGoapEvent } from '../events/goapEventFactory.js';

const diagnosticsByActor = new Map();
let eventBus = null;

function resolveActorId(rawId) {
  if (rawId === undefined || rawId === null || rawId === '') {
    return 'unknown';
  }
  return String(rawId);
}

function createTelemetry(actorId) {
  return {
    actorId,
    totalLookups: 0,
    unknownStatuses: 0,
    fallbacks: 0,
    cacheHits: 0,
    lastUpdated: null,
  };
}

function touchTelemetry(telemetry) {
  telemetry.lastUpdated = Date.now();
}

/**
 * Register the GOAP event bus so diagnostics can emit structured events.
 * @param {import('../../interfaces/IEventBus.js').IEventBus|null} bus
 */
export function registerPlanningStateDiagnosticsEventBus(bus) {
  if (bus && typeof bus.dispatch === 'function') {
    eventBus = bus;
  }
}

function clone(entry) {
  return JSON.parse(JSON.stringify(entry));
}

function recordTelemetry(actorId, updater) {
  const normalizedActorId = resolveActorId(actorId);
  const entry = getOrCreateEntry(normalizedActorId);
  const telemetry = entry.telemetry;
  updater(telemetry);
  touchTelemetry(telemetry);
  return entry;
}

/**
 * Record a planning-state lookup attempt for telemetry.
 * @param {object} payload
 */
export function recordPlanningStateLookup(payload = {}) {
  recordTelemetry(payload.actorId, (telemetry) => {
    telemetry.totalLookups += 1;
  });
}

/**
 * Record that the runtime fell back to the EntityManager due to planning-state miss.
 * @param {object} payload
 */
export function recordPlanningStateFallback(payload = {}) {
  recordTelemetry(payload.actorId, (telemetry) => {
    telemetry.fallbacks += 1;
  });
}

/**
 * Record that a cached fallback answer was used.
 * @param {object} payload
 */
export function recordPlanningStateCacheHit(payload = {}) {
  recordTelemetry(payload.actorId, (telemetry) => {
    telemetry.cacheHits += 1;
  });
}

function getOrCreateEntry(actorId) {
  if (!diagnosticsByActor.has(actorId)) {
    diagnosticsByActor.set(actorId, {
      actorId,
      totalMisses: 0,
      lastMisses: [],
      telemetry: createTelemetry(actorId),
    });
  }
  const entry = diagnosticsByActor.get(actorId);
  if (!entry.telemetry) {
    entry.telemetry = createTelemetry(actorId);
  }
  return entry;
}

/**
 * Record a planning-state miss and emit GOAP telemetry.
 * @param {object} payload
 */
export function recordPlanningStateMiss(payload) {
  const actorId = resolveActorId(payload?.actorId);
  const entry = getOrCreateEntry(actorId);
  entry.totalMisses += 1;
  if (entry.telemetry) {
    entry.telemetry.unknownStatuses += 1;
    touchTelemetry(entry.telemetry);
  }
  const miss = {
    timestamp: Date.now(),
    path: payload?.path || null,
    entityId: payload?.entityId || null,
    componentId: payload?.componentId || null,
    origin: payload?.origin || null,
    goalId: payload?.goalId || null,
    taskId: payload?.taskId || null,
    reason: payload?.reason || 'planning-state-miss',
    metadata: payload?.metadata || null,
  };
  entry.lastMisses.push(miss);
  if (entry.lastMisses.length > 5) {
    entry.lastMisses.shift();
  }

  if (eventBus) {
    emitGoapEvent(
      eventBus,
      GOAP_EVENTS.STATE_MISS,
      {
        actorId,
        path: miss.path,
        entityId: miss.entityId,
        componentId: miss.componentId,
        origin: miss.origin,
        goalId: miss.goalId,
        taskId: miss.taskId,
        reason: miss.reason,
      },
      {
        actorId,
        goalId: miss.goalId,
        taskId: miss.taskId,
      }
    );
  }

  return miss;
}

/**
 * Get diagnostics for a single actor.
 * @param {string} actorId
 * @returns {object|null}
 */
export function getPlanningStateDiagnostics(actorId) {
  if (!actorId) {
    return null;
  }
  const entry = diagnosticsByActor.get(actorId);
  return entry ? clone(entry) : null;
}

/**
 * Get diagnostics for every actor.
 * @returns {Array<object>}
 */
export function getAllPlanningStateDiagnostics() {
  return Array.from(diagnosticsByActor.values()).map((entry) => clone(entry));
}

/**
 * Clear diagnostics for a single actor or for everyone when actorId omitted.
 * @param {string} [actorId]
 */
export function clearPlanningStateDiagnostics(actorId) {
  if (actorId) {
    diagnosticsByActor.delete(actorId);
  } else {
    diagnosticsByActor.clear();
  }
}
