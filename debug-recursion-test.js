// Test to understand the recursion tracking issue

class EventBus {
  #recursionDepth = new Map();

  async dispatch(eventName) {
    const currentDepth = this.#recursionDepth.get(eventName) || 0;
    console.log(
      `[${eventName}] Starting dispatch, current depth: ${currentDepth}`
    );

    // This is the bug - incrementing before we know if it's actual recursion
    this.#recursionDepth.set(eventName, currentDepth + 1);

    const newDepth = this.#recursionDepth.get(eventName);
    const isCritical = eventName.includes('error') && newDepth > 1;

    if (isCritical) {
      console.log(
        `[${eventName}] BLOCKED - marked as critical at depth ${newDepth}`
      );
      this.#recursionDepth.set(eventName, currentDepth); // Restore
      return false;
    }

    console.log(`[${eventName}] Processing at depth ${newDepth}`);

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Restore depth
    if (currentDepth <= 0) {
      this.#recursionDepth.delete(eventName);
    } else {
      this.#recursionDepth.set(eventName, currentDepth);
    }

    console.log(`[${eventName}] Completed, restored depth to ${currentDepth}`);
    return true;
  }
}

async function test() {
  const bus = new EventBus();

  console.log('\n=== Concurrent dispatches (Promise.all) ===');
  const results = await Promise.all([
    bus.dispatch('error1'),
    bus.dispatch('error2'),
    bus.dispatch('error3'),
  ]);
  console.log('Results:', results);
}

test().catch(console.error);
