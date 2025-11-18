import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

const TERMINAL_EVENT_SET = new Set([
  GOAP_EVENTS.PLANNING_COMPLETED,
  GOAP_EVENTS.PLANNING_FAILED,
]);

/**
 *
 * @param actors
 */
function normalizeActorSet(actors) {
  if (!actors) {
    return null;
  }
  if (actors instanceof Set) {
    return new Set(actors);
  }
  if (Array.isArray(actors)) {
    return new Set(actors);
  }
  return new Set([actors]);
}

/**
 * Creates a tracker that records GOAP terminal planning events (completed/failed)
 * per actor and per simulated turn. Tests can assert each actor generates exactly
 * one terminal event per turn, detect silent misses, and inspect event payloads.
 *
 * @param {object} eventBus - Event bus mock returned from createGoapTestSetup
 * @param {object} [options]
 * @param {string[]} [options.terminalEvents] - Custom terminal event types
 */
export function createMultiActorCompletionTracker(eventBus, options = {}) {
  if (!eventBus) {
    throw new Error('createMultiActorCompletionTracker requires an event bus instance');
  }

  const terminalEvents = new Set(options.terminalEvents || TERMINAL_EVENT_SET);
  const actorTotals = new Map();
  const actorBuffers = new Map();
  const turnHistory = [];
  let currentTurn = null;
  let turnIndex = 0;
  let disposed = false;

  const recordTerminalEvent = (event) => {
    if (!terminalEvents.has(event.type)) {
      return;
    }

    const actorId = event.payload?.actorId || 'unknown_actor';
    if (!actorTotals.has(actorId)) {
      actorTotals.set(actorId, { completed: 0, failed: 0 });
    }
    const totals = actorTotals.get(actorId);
    if (event.type === GOAP_EVENTS.PLANNING_COMPLETED) {
      totals.completed += 1;
    } else if (event.type === GOAP_EVENTS.PLANNING_FAILED) {
      totals.failed += 1;
    }

    if (!actorBuffers.has(actorId)) {
      actorBuffers.set(actorId, []);
    }
    actorBuffers.get(actorId).push(event);

    if (currentTurn) {
      currentTurn.events.push({ actorId, event });
    }
  };

  const detach =
    typeof eventBus.onDispatch === 'function'
      ? eventBus.onDispatch(recordTerminalEvent)
      : typeof eventBus.subscribe === 'function'
        ? eventBus.subscribe('*', recordTerminalEvent)
        : null;

  if (!detach) {
    throw new Error(
      'createMultiActorCompletionTracker requires an event bus with onDispatch() or subscribe() support'
    );
  }

  const startTurn = ({ label, actors } = {}) => {
    if (disposed) {
      throw new Error('Cannot start a turn after tracker teardown');
    }
    if (currentTurn) {
      throw new Error('Cannot start a new turn before ending the active turn');
    }
    currentTurn = {
      label: label || `turn-${turnIndex + 1}`,
      expectedActors: actors ? [...actors] : null,
      events: [],
      turnIndex,
    };
    turnIndex += 1;
  };

  const endTurn = ({ actors, allowFailuresFor } = {}) => {
    if (!currentTurn) {
      throw new Error('endTurn() called without matching startTurn()');
    }

    const expectedActors =
      actors || currentTurn.expectedActors || currentTurn.events.map((entry) => entry.actorId);

    if (!expectedActors || expectedActors.length === 0) {
      throw new Error('endTurn() requires at least one expected actor');
    }

    const expectedSet = new Set(expectedActors);
    const actorEventMap = new Map();
    const allowFailuresSet = normalizeActorSet(allowFailuresFor) || new Set();

    for (const { actorId, event } of currentTurn.events) {
      if (!actorEventMap.has(actorId)) {
        actorEventMap.set(actorId, []);
      }
      actorEventMap.get(actorId).push(event);
    }

    for (const actorId of expectedSet) {
      const actorEvents = actorEventMap.get(actorId) || [];
      if (actorEvents.length !== 1) {
        throw new Error(
          `Expected exactly one terminal planning event for actor "${actorId}" in turn "${currentTurn.label}" but found ${actorEvents.length}`
        );
      }
      const [event] = actorEvents;
      if (!allowFailuresSet.has(actorId) && event.type === GOAP_EVENTS.PLANNING_FAILED) {
        throw new Error(
          `Actor "${actorId}" unexpectedly failed planning in turn "${currentTurn.label}"`
        );
      }
      if (!terminalEvents.has(event.type)) {
        throw new Error(
          `Actor "${actorId}" emitted non-terminal event "${event.type}" in turn "${currentTurn.label}"`
        );
      }
    }

    for (const actorId of actorEventMap.keys()) {
      if (!expectedSet.has(actorId)) {
        throw new Error(
          `Actor "${actorId}" emitted a terminal event during turn "${currentTurn.label}" but was not expected`
        );
      }
    }

    const summary = {
      label: currentTurn.label,
      turnIndex: currentTurn.turnIndex,
      events: currentTurn.events.map(({ actorId, event }) => ({
        actorId,
        event,
      })),
      byActor: new Map(
        Array.from(actorEventMap.entries()).map(([actorId, events]) => [actorId, events[0]])
      ),
    };

    turnHistory.push(summary);
    currentTurn = null;
    return summary;
  };

  const getActorTotals = (actorId) => {
    const totals = actorTotals.get(actorId);
    if (!totals) {
      return { completed: 0, failed: 0 };
    }
    return { ...totals };
  };

  const flushActorEvents = (actorId) => {
    const events = actorBuffers.get(actorId) || [];
    actorBuffers.set(actorId, []);
    return events.slice();
  };

  const teardown = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    detach();
    actorTotals.clear();
    actorBuffers.clear();
    currentTurn = null;
  };

  return {
    startTurn,
    endTurn,
    getActorTotals,
    flushActorEvents,
    getTurnHistory: () => [...turnHistory],
    teardown,
  };
}
