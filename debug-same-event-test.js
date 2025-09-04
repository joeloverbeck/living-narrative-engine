// Test with same event name

class EventBus {
  #recursionDepth = new Map();

  async dispatch(eventName, payload) {
    const currentDepth = this.#recursionDepth.get(eventName) || 0;
    console.log(`[${payload}] Starting dispatch of '${eventName}', current depth: ${currentDepth}`);
    
    // Bug: incrementing immediately makes concurrent calls look like recursion
    this.#recursionDepth.set(eventName, currentDepth + 1);
    
    const newDepth = this.#recursionDepth.get(eventName);
    const isCritical = eventName.includes('error') && newDepth > 1;
    
    if (isCritical) {
      console.log(`[${payload}] BLOCKED - depth ${newDepth} > 1 for error event`);
      this.#recursionDepth.set(eventName, currentDepth); // Restore
      return false;
    }
    
    // Check max depth
    if (newDepth > 3) {
      console.log(`[${payload}] BLOCKED - max depth exceeded`);
      this.#recursionDepth.set(eventName, currentDepth);
      return false;
    }
    
    console.log(`[${payload}] Processing at depth ${newDepth}`);
    
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Restore depth
    if (currentDepth <= 0) {
      this.#recursionDepth.delete(eventName);
    } else {
      this.#recursionDepth.set(eventName, currentDepth);
    }
    
    console.log(`[${payload}] Completed, restored depth to ${currentDepth}`);
    return true;
  }
}

async function test() {
  const bus = new EventBus();
  
  console.log('\n=== Concurrent dispatches of SAME event ===');
  const results = await Promise.all([
    bus.dispatch('core:error', 'Error1'),
    bus.dispatch('core:error', 'Error2'),
    bus.dispatch('core:error', 'Error3')
  ]);
  console.log('Results:', results);
}

test().catch(console.error);
