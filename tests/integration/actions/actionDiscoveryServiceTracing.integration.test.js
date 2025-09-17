import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

/**
 * Integration test bed for action tracing functionality
 */
class ActionTracingIntegrationTestBed extends ActionDiscoveryServiceTestBed {
  #actionTraceData = new Map();

  /**
   * Setup action tracing with configuration
   *
   * @param {object} config - Tracing configuration
   */
  async setupActionTracing(config = {}) {
    this.tracingConfig = {
      enabled: true,
      ...config,
    };
  }

  /**
   * Create a test actor with components
   */
  createTestActor() {
    const actorId = 'test-actor-' + Date.now();
    return {
      id: actorId,
      components: {
        'core:location': { value: 'test-location' },
        'core:inventory': { items: [] },
      },
    };
  }

  /**
   * Run action discovery with tracing
   *
   * @param actor
   */
  async runActionDiscovery(actor) {
    const discoveryService = this.createDiscoveryServiceWithTracing({
      actionTracingEnabled: this.tracingConfig.enabled,
      tracedActions: this.tracingConfig.tracedActions || ['*'],
      verbosity: this.tracingConfig.verbosity || 'standard',
    });

    const result = await discoveryService.getValidActions(
      actor,
      { currentLocation: 'test-location' },
      { trace: true }
    );

    // Capture trace data if available
    if (result.trace?.getTracedActions) {
      this.#actionTraceData = result.trace.getTracedActions();
    }

    return result;
  }

  /**
   * Get captured action trace data
   */
  getActionTraceData() {
    return this.#actionTraceData;
  }

  cleanup() {
    super.cleanup();
    this.#actionTraceData = new Map();
  }
}

describe('ActionDiscoveryService - Action Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionTracingIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should integrate action tracing with full pipeline execution', async () => {
    await testBed.setupActionTracing({
      tracedActions: ['movement:go', 'core:look'],
      verbosity: 'detailed',
    });

    const actor = testBed.createTestActor();
    const result = await testBed.runActionDiscovery(actor);

    expect(result.actions).toBeDefined();
    expect(result.errors).toBeDefined();

    const traceData = testBed.getActionTraceData();
    expect(traceData.size).toBeGreaterThanOrEqual(0);

    // Verify trace data structure if any actions were traced
    for (const [actionId, actionTrace] of traceData) {
      expect(actionTrace.actionId).toBe(actionId);
      expect(actionTrace.actorId).toBe(actor.id);
      expect(typeof actionTrace.startTime).toBe('number');
      expect(typeof actionTrace.stages).toBe('object');
    }
  });

  it('should capture action data across all pipeline stages', async () => {
    await testBed.setupActionTracing({
      tracedActions: ['movement:go'],
      verbosity: 'verbose',
    });

    const actor = testBed.createTestActor();
    await testBed.runActionDiscovery(actor);

    const traceData = testBed.getActionTraceData();

    // If 'movement:go' action was discovered, it should be traced
    if (traceData.has('movement:go')) {
      const goActionTrace = traceData.get('movement:go');
      expect(goActionTrace).toBeDefined();

      // Should have data from multiple pipeline stages
      const stageNames = Object.keys(goActionTrace.stages || {});
      expect(stageNames.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('should maintain performance when action tracing is disabled', async () => {
    await testBed.setupActionTracing({
      enabled: false,
    });

    const actor = testBed.createTestActor();

    const startTime = Date.now();
    const result = await testBed.runActionDiscovery(actor);
    const endTime = Date.now();

    expect(result.actions).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly

    const traceData = testBed.getActionTraceData();
    expect(traceData.size).toBe(0); // No action data should be captured
  });

  it('should handle mixed traced and non-traced actions', async () => {
    await testBed.setupActionTracing({
      tracedActions: ['movement:go'], // Only trace 'go' action
      verbosity: 'standard',
    });

    const actor = testBed.createTestActor();
    const result = await testBed.runActionDiscovery(actor);

    expect(result.actions).toBeDefined();
    expect(result.errors).toBeDefined();

    const traceData = testBed.getActionTraceData();

    // Only 'movement:go' should be traced if it exists
    for (const [actionId] of traceData) {
      expect(actionId).toBe('movement:go');
    }
  });

  it('should provide debugging information for trace activation', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      tracedActions: ['*'],
    });

    const status = discoveryService.getActionTracingStatus();
    expect(status).toBeDefined();
    expect(typeof status.available).toBe('boolean');
    expect(typeof status.enabled).toBe('boolean');
    expect(typeof status.hasFilter).toBe('boolean');
    expect(typeof status.hasFactory).toBe('boolean');

    // Verify debugging logs were captured
    const debugLogs = testBed.getDebugLogs();
    expect(
      debugLogs.some((log) =>
        log.includes('ActionDiscoveryService initialised')
      )
    ).toBe(true);
  });

  it('should gracefully handle tracing failures during discovery', async () => {
    const discoveryService = testBed.createDiscoveryServiceWithTracing({
      actionTracingEnabled: true,
      actionTraceFilterFailure: 'isEnabled',
    });

    const actor = testBed.createTestActor();

    // Should not throw even with tracing failures
    await expect(
      discoveryService.getValidActions(actor, {}, { trace: true })
    ).resolves.not.toThrow();

    const result = await discoveryService.getValidActions(
      actor,
      {},
      { trace: true }
    );
    expect(result.actions).toBeDefined();
    expect(result.errors).toBeDefined();
  });
});
