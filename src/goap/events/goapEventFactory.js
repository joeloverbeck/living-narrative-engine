import { isPlainObject } from '../../utils/objectUtils.js';

/**
 *
 * @param value
 * @param label
 */
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

/**
 *
 * @param target
 * @param key
 * @param value
 */
function normalizeContextField(target, key, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return;
  }
  if (target[key]) {
    return;
  }
  target[key] = value;
}

/**
 *
 * @param eventType
 * @param payload
 * @param context
 */
export function createGoapEventPayload(eventType, payload = {}, context = {}) {
  assertNonEmptyString(eventType, 'GOAP event type');

  const normalizedPayload = typeof payload === 'undefined' ? {} : payload;

  if (!isPlainObject(normalizedPayload)) {
    throw new Error('GOAP event payload must be a plain object.');
  }

  const enriched = { ...normalizedPayload };

  if (!enriched.timestamp) {
    enriched.timestamp = Date.now();
  }

  if (context && typeof context === 'object') {
    normalizeContextField(enriched, 'actorId', context.actorId);
    normalizeContextField(enriched, 'taskId', context.taskId);
    normalizeContextField(enriched, 'goalId', context.goalId);
  }

  return enriched;
}

/**
 *
 * @param dispatcher
 * @param eventType
 * @param payload
 * @param context
 */
export function emitGoapEvent(dispatcher, eventType, payload, context) {
  if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
    throw new Error(
      'emitGoapEvent requires a dispatcher with a dispatch method.'
    );
  }

  const normalizedPayload = createGoapEventPayload(eventType, payload, context);
  return dispatcher.dispatch(eventType, normalizedPayload);
}
