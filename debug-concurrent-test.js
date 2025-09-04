// Test to debug concurrent dispatch issue
import EventBus from './src/events/eventBus.js';
import ConsoleLogger from './src/logging/consoleLogger.js';

async function test() {
  const logger = new ConsoleLogger('DEBUG');
  const eventBus = new EventBus({ logger });
  
  const capturedEvents = [];
  eventBus.subscribe('core:system_error_occurred', (event) => {
    console.log(`✓ Captured: ${event.payload.message}`);
    capturedEvents.push(event);
  });
  
  console.log('\n=== Starting 3 concurrent dispatches ===');
  
  const promises = [
    eventBus.dispatch('core:system_error_occurred', { message: 'Error 1' }),
    eventBus.dispatch('core:system_error_occurred', { message: 'Error 2' }),
    eventBus.dispatch('core:system_error_occurred', { message: 'Error 3' })
  ];
  
  console.log('Promises created, awaiting...');
  await Promise.all(promises);
  
  console.log(`\nTotal captured: ${capturedEvents.length}`);
  console.log('Messages:', capturedEvents.map(e => e.payload.message));
}

test().catch(console.error);
