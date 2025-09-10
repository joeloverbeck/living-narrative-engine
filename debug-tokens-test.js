// Simple test to verify the recursion detection issue

class SafeEventDispatcher {
  #isHandlingError = false;

  async dispatch(eventName, payload, options = {}) {
    const description = `dispatching event '${eventName}'`;

    // Key check - this is what's preventing multiple error events
    const isErrorEvent =
      description.includes('system_error_occurred') ||
      description.includes('error');
    const hasErrorKeywords = description.match(/(error|exception|fail)/i);

    if (isErrorEvent || hasErrorKeywords || this.#isHandlingError) {
      console.log(
        `BLOCKED: Event ${eventName} - isErrorEvent: ${isErrorEvent}, hasErrorKeywords: ${hasErrorKeywords}, isHandlingError: ${this.#isHandlingError}`
      );
      return false;
    }

    // Only set the flag when we're about to log an error
    this.#isHandlingError = true;

    console.log(`DISPATCHED: Event ${eventName}`);

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 0));

    this.#isHandlingError = false;
    return true;
  }
}

async function test() {
  const dispatcher = new SafeEventDispatcher();

  // Test case: Multiple error events in parallel (like Promise.all)
  console.log('\n=== Testing parallel dispatch (Promise.all) ===');
  const results = await Promise.all([
    dispatcher.dispatch('core:system_error_occurred', { message: 'Error 1' }),
    dispatcher.dispatch('core:system_error_occurred', { message: 'Error 2' }),
    dispatcher.dispatch('core:system_error_occurred', { message: 'Error 3' }),
  ]);
  console.log('Results:', results);

  // Test case: Sequential dispatch
  console.log('\n=== Testing sequential dispatch ===');
  for (let i = 1; i <= 3; i++) {
    await dispatcher.dispatch('core:system_error_occurred', {
      message: `Error ${i}`,
    });
  }
}

test().catch(console.error);
