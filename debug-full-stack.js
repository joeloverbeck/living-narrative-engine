// Test with the full stack
import EventBus from './src/events/eventBus.js';
import ValidatedEventDispatcher from './src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from './src/events/safeEventDispatcher.js';
import ConsoleLogger from './src/logging/consoleLogger.js';

async function test() {
  const logger = new ConsoleLogger('ERROR');
  
  const mockGameDataRepository = {
    getEventDefinition: (id) => {
      if (id === 'core:system_error_occurred') {
        return {
          id: 'core:system_error_occurred',
          name: 'System Error Occurred',
          payloadSchema: { type: 'object' }
        };
      }
      return null;
    }
  };
  
  const mockSchemaValidator = {
    isValid: () => true,
    validate: () => ({ isValid: true })
  };

  const eventBus = new EventBus({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: mockGameDataRepository,
    schemaValidator: mockSchemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  const capturedEvents = [];
  eventBus.subscribe('core:system_error_occurred', (event) => {
    capturedEvents.push(event);
    console.log(`Captured: ${event.payload.message}`);
  });

  console.log('\n=== Dispatching 3 error events concurrently ===');
  
  const results = await Promise.all([
    safeEventDispatcher.dispatch('core:system_error_occurred', { message: 'Error 1' }),
    safeEventDispatcher.dispatch('core:system_error_occurred', { message: 'Error 2' }),
    safeEventDispatcher.dispatch('core:system_error_occurred', { message: 'Error 3' })
  ]);
  
  console.log('Dispatch results:', results);
  console.log(`Total captured: ${capturedEvents.length}`);
  console.log('Messages:', capturedEvents.map(e => e.payload.message));
}

test().catch(console.error);
