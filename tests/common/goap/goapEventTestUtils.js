import { emitGoapEvent } from '../../../src/goap/events/goapEventFactory.js';

/**
 *
 * @param eventBus
 * @param eventType
 * @param payload
 * @param context
 */
export function dispatchGoapEventForTest(eventBus, eventType, payload = {}, context = {}) {
  return emitGoapEvent(eventBus, eventType, payload, context);
}
