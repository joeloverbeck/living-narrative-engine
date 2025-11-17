import { GOAP_EVENTS } from '../events/goapEvents.js';

const diagnosticsByActor = new Map();
let eventBus = null;

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

function getOrCreateEntry(actorId) {
  if (!diagnosticsByActor.has(actorId)) {
    diagnosticsByActor.set(actorId, {
      actorId,
      totalMisses: 0,
      lastMisses: [],
    });
  }
  return diagnosticsByActor.get(actorId);
}

/**
 * Record a planning-state miss and emit GOAP telemetry.
 * @param {object} payload
 */
export function recordPlanningStateMiss(payload) {
  const actorId = (payload?.actorId && String(payload.actorId)) || 'unknown';
  const entry = getOrCreateEntry(actorId);
  entry.totalMisses += 1;
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
    eventBus.dispatch({
      type: GOAP_EVENTS.STATE_MISS,
      payload: {
        actorId,
        path: miss.path,
        entityId: miss.entityId,
        componentId: miss.componentId,
        origin: miss.origin,
        goalId: miss.goalId,
        taskId: miss.taskId,
        reason: miss.reason,
      },
    });
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
