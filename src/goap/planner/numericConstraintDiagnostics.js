const MAX_RECENT_FALLBACKS = 5;
const diagnosticsByActor = new Map();

/**
 *
 * @param entry
 */
function clone(entry) {
  if (!entry) {
    return null;
  }
  return {
    actorId: entry.actorId,
    totalFallbacks: entry.totalFallbacks,
    recent: entry.recent.map((item) => ({ ...item })),
  };
}

/**
 *
 * @param actorId
 */
function getOrCreateEntry(actorId) {
  const key = actorId || 'unknown';
  if (!diagnosticsByActor.has(key)) {
    diagnosticsByActor.set(key, {
      actorId: key,
      totalFallbacks: 0,
      recent: [],
    });
  }
  return diagnosticsByActor.get(key);
}

/**
 *
 * @param payload
 */
export function recordNumericConstraintFallback(payload = {}) {
  const actorId = payload.actorId || 'unknown';
  const entry = getOrCreateEntry(actorId);
  entry.totalFallbacks += 1;
  const event = {
    goalId: payload.goalId || null,
    origin: payload.origin || 'NumericConstraintEvaluator',
    varPath: payload.varPath || null,
    operator: payload.operator || null,
    reason: payload.reason || null,
    timestamp: payload.timestamp || Date.now(),
  };
  entry.recent.push(event);
  if (entry.recent.length > MAX_RECENT_FALLBACKS) {
    entry.recent.shift();
  }

  return clone(entry);
}

/**
 *
 * @param actorId
 */
export function getNumericConstraintDiagnostics(actorId) {
  if (!actorId) {
    return null;
  }
  return clone(diagnosticsByActor.get(actorId) || diagnosticsByActor.get('unknown'));
}

/**
 *
 */
export function getAllNumericConstraintDiagnostics() {
  return Array.from(diagnosticsByActor.values()).map((entry) => clone(entry));
}

/**
 *
 * @param actorId
 */
export function clearNumericConstraintDiagnostics(actorId) {
  if (actorId) {
    diagnosticsByActor.delete(actorId);
  } else {
    diagnosticsByActor.clear();
  }
}
