import { jest } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from './tests/common/clichesGeneratorControllerTestBed.js';

/**
 *
 */
async function runDebugTest() {
  const testBed = new ClichesGeneratorControllerTestBed();

  // Setup basic direction load
  testBed.setupSuccessfulDirectionLoad();

  // Track if event listener is called
  let changeEventFired = false;

  console.log('Setting up test bed...');
  await testBed.setup();

  console.log('Controller initialized:', !!testBed.controller);
  console.log(
    'Controller.initialize exists:',
    typeof testBed.controller?.initialize
  );

  // Check DOM elements
  const directionSelector = document.getElementById('direction-selector');
  console.log('Direction selector exists:', !!directionSelector);
  console.log('Direction selector options:', directionSelector?.options.length);

  // Try to add our own change listener
  if (directionSelector) {
    directionSelector.addEventListener('change', () => {
      console.log('Change event fired!');
      changeEventFired = true;
    });
  }

  // Simulate change
  if (directionSelector) {
    console.log('Setting selector value to dir-1');
    directionSelector.value = 'dir-1';
    const event = new Event('change', { bubbles: true });
    directionSelector.dispatchEvent(event);
  }

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log('Change event was fired:', changeEventFired);

  // Check if mockEventBus dispatch was called
  console.log(
    'EventBus dispatch calls:',
    testBed.mockEventBus.dispatch.mock.calls.length
  );
  if (testBed.mockEventBus.dispatch.mock.calls.length > 0) {
    console.log(
      'First dispatch call:',
      testBed.mockEventBus.dispatch.mock.calls[0]
    );
  }

  testBed.cleanup();
}

runDebugTest().catch(console.error);
