import { emitGoapEvent } from '../../../src/goap/events/goapEventFactory.js';

export function dispatchGoapEventForTest(eventBus, eventType, payload = {}, context = {}) {
  return emitGoapEvent(eventBus, eventType, payload, context);
}
