import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

describe('ActionDiscoveryService - Action Tracing Enhancement', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Trace Context Creation', () => {
    it('should create standard trace when action tracing is disabled', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: false,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.actions).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(testBed.getCreatedTraceType()).toBe('StructuredTrace');
    });

    it('should create ActionAwareStructuredTrace when action tracing is enabled', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: true,
        tracedActions: ['movement:go'],
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.actions).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(testBed.getCreatedTraceType()).toBe('ActionAwareStructuredTrace');
    });

    it('should fall back to standard trace when ActionAwareTrace creation fails', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: true,
        actionAwareTraceFactoryFailure: true,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.actions).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(testBed.getCreatedTraceType()).toBe('StructuredTrace');

      const errorLogs = testBed.getErrorLogs();
      expect(
        errorLogs.some((log) => log.includes('Failed to create trace context'))
      ).toBe(true);
    });

    it('should handle missing action tracing dependencies gracefully', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: true,
        hasActionAwareTraceFactory: false,
        hasActionTraceFilter: false,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.actions).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(testBed.getCreatedTraceType()).toBe('StructuredTrace');
    });
  });

  describe('Action Tracing Status', () => {
    it('should report correct action tracing availability', () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        hasActionAwareTraceFactory: true,
        hasActionTraceFilter: true,
      });

      expect(discoveryService.isActionTracingAvailable()).toBe(true);

      const status = discoveryService.getActionTracingStatus();
      expect(status.available).toBe(true);
      expect(status.hasFilter).toBe(true);
      expect(status.hasFactory).toBe(true);
    });

    it('should report unavailable when dependencies are missing', () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        hasActionAwareTraceFactory: false,
        hasActionTraceFilter: true,
      });

      expect(discoveryService.isActionTracingAvailable()).toBe(false);

      const status = discoveryService.getActionTracingStatus();
      expect(status.available).toBe(false);
      expect(status.hasFilter).toBe(true);
      expect(status.hasFactory).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work identically to original service when tracing is disabled', async () => {
      const standardService = testBed.createStandardDiscoveryService();
      const enhancedService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: false,
      });

      const actor = testBed.createMockActor('test-actor');
      const baseContext = testBed.createMockContext();

      const standardResult = await standardService.getValidActions(
        actor,
        baseContext
      );
      const enhancedResult = await enhancedService.getValidActions(
        actor,
        baseContext
      );

      expect(enhancedResult.actions).toEqual(standardResult.actions);
      expect(enhancedResult.errors).toEqual(standardResult.errors);
    });

    it('should maintain existing API without breaking changes', () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing();

      // All existing methods should still exist
      expect(typeof discoveryService.getValidActions).toBe('function');

      // New methods should also exist
      expect(typeof discoveryService.isActionTracingAvailable).toBe('function');
      expect(typeof discoveryService.getActionTracingStatus).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle ActionTraceFilter.isEnabled() failures gracefully', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTraceFilterFailure: 'isEnabled',
      });

      const actor = testBed.createMockActor('test-actor');

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

    it('should continue pipeline execution when trace creation fails completely', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        traceContextFactoryFailure: true,
        actionAwareTraceFactoryFailure: true,
      });

      const actor = testBed.createMockActor('test-actor');
      const result = await discoveryService.getValidActions(
        actor,
        {},
        { trace: true }
      );

      expect(result.actions).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('Logging and Debugging', () => {
    it('should log action tracing statistics when tracing is enabled', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: true,
        tracedActions: ['movement:go'],
      });

      const actor = testBed.createMockActor('test-actor');
      await discoveryService.getValidActions(actor, {}, { trace: true });

      const debugLogs = testBed.getDebugLogs();
      expect(
        debugLogs.some(
          (log) =>
            log.includes('Action discovery completed') &&
            log.includes('with action tracing')
        )
      ).toBe(true);
    });

    it('should log trace type for debugging', async () => {
      const discoveryService = testBed.createDiscoveryServiceWithTracing({
        actionTracingEnabled: true,
      });

      const actor = testBed.createMockActor('test-actor');
      await discoveryService.getValidActions(actor, {}, { trace: true });

      const debugLogs = testBed.getDebugLogs();
      expect(
        debugLogs.some(
          (log) =>
            log.includes('Created ActionAwareStructuredTrace') ||
            log.includes('Created StructuredTrace')
        )
      ).toBe(true);
    });
  });
});
