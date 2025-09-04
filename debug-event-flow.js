// Debug test to understand the event flow

import { beforeEach, describe, expect, it } from '@jest/globals';
import EventBus from './src/events/eventBus.js';
import ConsoleLogger from './src/logging/consoleLogger.js';

describe('Debug Event Flow', () => {
  it('should handle multiple error events', async () => {
    const logger = new ConsoleLogger();
    logger.setLogLevel('debug');
    
    const eventBus = new EventBus({ logger });
    const capturedEvents = [];
    
    eventBus.subscribe('core:system_error_occurred', (event) => {
      console.log(`Captured event: ${event.payload.message}`);
      capturedEvents.push(event);
    });
    
    console.log('=== Starting concurrent dispatches ===');
    
    await Promise.all([
      eventBus.dispatch('core:system_error_occurred', { message: 'Error 1' }),
      eventBus.dispatch('core:system_error_occurred', { message: 'Error 2' }),
      eventBus.dispatch('core:system_error_occurred', { message: 'Error 3' })
    ]);
    
    console.log(`Total captured: ${capturedEvents.length}`);
    console.log('Events:', capturedEvents.map(e => e.payload.message));
    
    expect(capturedEvents).toHaveLength(3);
  });
});
