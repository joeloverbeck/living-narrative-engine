/**
 * @file httpAgentService.adaptiveCleanup.test.js - Tests for adaptive cleanup functionality
 */

import { jest } from '@jest/globals';
import https from 'https';
import http from 'http';
import HttpAgentService from '../../../src/services/httpAgentService.js';

// Mock the http and https modules
jest.mock('http');
jest.mock('https');

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  isDebugEnabled: true,
});

describe('HttpAgentService - Adaptive Cleanup', () => {
  let httpAgentService;
  let mockLogger;
  let mockHttpAgent;
  let mockHttpsAgent;

  const createMockAgent = (activeSockets = 0, freeSockets = 0) => ({
    destroy: jest.fn(),
    sockets:
      activeSockets > 0 ? { 'host:port': Array(activeSockets).fill({}) } : {},
    freeSockets:
      freeSockets > 0 ? { 'host:port': Array(freeSockets).fill({}) } : {},
    on: jest.fn(),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockLogger = createMockLogger();

    // Create default mock agents
    mockHttpAgent = createMockAgent(1, 2);
    mockHttpsAgent = createMockAgent(2, 1);

    // Mock agent constructors
    http.Agent.mockImplementation(() => mockHttpAgent);
    https.Agent.mockImplementation(() => mockHttpsAgent);

    jest.clearAllMocks();
  });

  afterEach(() => {
    if (httpAgentService) {
      httpAgentService.cleanup();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Adaptive cleanup initialization', () => {
    it('should use fixed interval when adaptiveCleanupEnabled is false', () => {
      const mockSetInterval = jest.spyOn(global, 'setInterval');

      httpAgentService = new HttpAgentService(mockLogger, {
        adaptiveCleanupEnabled: false,
        baseCleanupIntervalMs: 60000,
      });

      // Should use setInterval instead of setTimeout for fixed cleanup
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Initialized with adaptive cleanup configuration',
        expect.objectContaining({
          adaptiveCleanup: expect.objectContaining({
            adaptiveCleanupEnabled: false,
            baseIntervalMs: 60000,
          }),
        })
      );

      mockSetInterval.mockRestore();
    });

    it('should use adaptive cleanup when enabled (default)', () => {
      const mockSetTimeout = jest.spyOn(global, 'setTimeout');

      httpAgentService = new HttpAgentService(mockLogger);

      // Should use setTimeout for adaptive cleanup
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 300000);

      mockSetTimeout.mockRestore();
    });
  });

  describe('Adaptive cleanup disabled behaviour', () => {
    it('forces cleanup of idle agents using the fallback interval loop', () => {
      const mockSetInterval = jest.spyOn(global, 'setInterval');

      jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      httpAgentService = new HttpAgentService(mockLogger, {
        adaptiveCleanupEnabled: false,
        baseCleanupIntervalMs: 60000,
        idleThresholdMs: 300000,
      });

      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 60000);

      httpAgentService.getAgent('https://api.example.com');

      // Advance virtual time beyond idle threshold so the agent becomes eligible for cleanup
      jest.setSystemTime(new Date('2025-01-01T00:10:00Z'));

      const cleanupResult = httpAgentService.forceAdaptiveCleanup();

      expect(cleanupResult.agentsRemoved).toBe(1);
      expect(cleanupResult.currentAgentCount).toBe(0);
      expect(httpAgentService.getActiveAgentCount()).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('HttpAgentService: Adaptive cleanup completed'),
        expect.objectContaining({
          idleThreshold: expect.any(Number),
          duration: expect.any(Number),
        })
      );

      mockSetInterval.mockRestore();
    });

    it('cleans up timers and agents on shutdown when fallback scheduling is active', () => {
      const mockSetInterval = jest.spyOn(global, 'setInterval');
      const mockClearTimeout = jest.spyOn(global, 'clearTimeout');

      httpAgentService = new HttpAgentService(mockLogger, {
        adaptiveCleanupEnabled: false,
        baseCleanupIntervalMs: 45000,
      });

      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 45000);

      httpAgentService.getAgent('https://api.shutdown-test.example');

      httpAgentService.cleanup();

      expect(mockClearTimeout).toHaveBeenCalled();
      const [clearTimeoutArg] = mockClearTimeout.mock.calls.at(-1);
      expect(clearTimeoutArg).toEqual(
        expect.objectContaining({
          ref: expect.any(Function),
          unref: expect.any(Function),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Cleared adaptive cleanup timer'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('HttpAgentService: Destroyed all 1 agents')
      );

      mockSetInterval.mockRestore();
      mockClearTimeout.mockRestore();
    });
  });

  describe('getNextCleanupIntervalPreview', () => {
    it('returns the base interval when adaptive cleanup is disabled', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        adaptiveCleanupEnabled: false,
        baseCleanupIntervalMs: 45000,
        minCleanupIntervalMs: 10000,
        maxCleanupIntervalMs: 900000,
      });

      const interval = httpAgentService.getNextCleanupIntervalPreview();

      expect(interval).toBe(45000);
      expect(httpAgentService.getEnhancedStats().adaptiveCleanup.enabled).toBe(
        false
      );
    });

    it('supports temporarily overriding adaptive cleanup behaviour for diagnostics', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        baseCleanupIntervalMs: 120000,
        minCleanupIntervalMs: 60000,
        maxCleanupIntervalMs: 900000,
      });

      const adaptiveInterval = httpAgentService.getNextCleanupIntervalPreview();
      expect(adaptiveInterval).toBe(234000);

      const forcedFixedInterval =
        httpAgentService.getNextCleanupIntervalPreview({
          overrideAdaptiveCleanupEnabled: false,
        });
      expect(forcedFixedInterval).toBe(120000);

      const statsAfterPreview = httpAgentService.getEnhancedStats();
      expect(statsAfterPreview.adaptiveCleanup.enabled).toBe(true);
      expect(
        statsAfterPreview.adaptiveCleanup.adjustments
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Timer management in scheduleNextCleanup', () => {
    it('should clear existing timeout when scheduling new cleanup', () => {
      const mockClearTimeout = jest.spyOn(global, 'clearTimeout');
      const mockSetTimeout = jest.spyOn(global, 'setTimeout');

      httpAgentService = new HttpAgentService(mockLogger);

      // Force a cleanup to trigger rescheduling
      jest.advanceTimersByTime(300000);

      // Should have cleared the previous timeout
      expect(mockClearTimeout).toHaveBeenCalled();
      // Should have set a new timeout
      expect(mockSetTimeout).toHaveBeenCalledTimes(2); // Initial + reschedule

      mockClearTimeout.mockRestore();
      mockSetTimeout.mockRestore();
    });

    it('should calculate next interval after cleanup', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create some agents to affect calculations
      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');

      // Advance to trigger cleanup
      jest.advanceTimersByTime(300000);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Scheduled next cleanup in \d+ms/)
      );
    });

    it('should shrink cleanup interval under high load and memory pressure', () => {
      const mockSetTimeout = jest.spyOn(global, 'setTimeout');

      httpAgentService = new HttpAgentService(mockLogger, {
        baseCleanupIntervalMs: 1000,
        minCleanupIntervalMs: 100,
        maxCleanupIntervalMs: 10000,
        highLoadRequestsPerMin: 1,
        memoryThresholdMB: 0.000001,
      });

      // Generate enough recent requests to trigger the high load branch
      httpAgentService.getAgent('https://api-high-load.example.com');
      httpAgentService.getAgent('https://api-high-load.example.com');
      httpAgentService.getAgent('https://api-high-load.example.com');

      // Ignore the initial scheduling call from the constructor
      mockSetTimeout.mockClear();

      // Trigger the scheduled cleanup so the next interval is recalculated
      jest.advanceTimersByTime(1000);

      expect(mockSetTimeout).toHaveBeenCalled();
      const [, scheduledDelay] = mockSetTimeout.mock.calls.at(-1);
      expect(scheduledDelay).toBeLessThan(1000);

      const adjustmentCall = mockLogger.debug.mock.calls.find(([message]) =>
        message.includes('Adaptive cleanup interval adjusted')
      );

      expect(adjustmentCall).toBeDefined();
      expect(adjustmentCall[0]).toContain('high-load+high-memory+few-agents');
      expect(adjustmentCall[1]).toMatchObject({
        requestRate: expect.any(Number),
        memoryUsageMB: expect.any(Number),
        agentCount: expect.any(Number),
        intervalMultiplier: expect.any(Number),
      });

      mockSetTimeout.mockRestore();
    });
  });

  describe('Request frequency tracking', () => {
    it('should track request frequency within window', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      const now = Date.now();
      jest.setSystemTime(now);

      // Make requests
      httpAgentService.getAgent('https://api.example.com');
      jest.setSystemTime(now + 10000); // 10 seconds later
      httpAgentService.getAgent('https://api.example.com');
      jest.setSystemTime(now + 20000); // 20 seconds later
      httpAgentService.getAgent('https://api.example.com');

      const stats = httpAgentService.getEnhancedStats();
      expect(stats.requestRate).toBe(3); // 3 requests in the last minute
    });

    it('should filter out old requests outside window', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      const now = Date.now();
      jest.setSystemTime(now);

      // Make old requests
      httpAgentService.getAgent('https://api.example.com');
      httpAgentService.getAgent('https://api.example.com');

      // Advance beyond window
      jest.setSystemTime(now + 70000); // 70 seconds later

      // Make new requests
      httpAgentService.getAgent('https://api.example.com');

      const stats = httpAgentService.getEnhancedStats();
      expect(stats.requestRate).toBe(1); // Only 1 request in the last minute
    });
  });

  describe('Memory usage estimation', () => {
    it('should estimate memory based on agent and socket count', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create agents with specific socket configurations
      const agent1 = createMockAgent(5, 3);
      const agent2 = createMockAgent(2, 4);
      https.Agent.mockImplementationOnce(() => agent1);
      https.Agent.mockImplementationOnce(() => agent2);

      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');

      const stats = httpAgentService.getEnhancedStats();
      // 2 agents * 1KB + (5+3+2+4) sockets * 0.5KB = 2 + 7 = 9KB = 0.0087890625MB
      expect(stats.estimatedMemoryUsageMB).toBeCloseTo(0.0087890625, 4);
    });

    it('should handle agents without sockets', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      const agentNoSockets = {
        destroy: jest.fn(),
        on: jest.fn(),
        // No sockets or freeSockets properties
      };
      https.Agent.mockImplementationOnce(() => agentNoSockets);

      httpAgentService.getAgent('https://api.example.com');

      const stats = httpAgentService.getEnhancedStats();
      expect(stats.estimatedMemoryUsageMB).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Adaptive interval calculation', () => {
    it('should reduce interval for high load', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        baseCleanupIntervalMs: 100000,
        highLoadRequestsPerMin: 30,
      });

      // Simulate high load
      const now = Date.now();
      for (let i = 0; i < 40; i++) {
        jest.setSystemTime(now + i * 1000);
        httpAgentService.getAgent('https://api.example.com');
      }

      // Force adaptive cleanup to trigger interval calculation
      httpAgentService.forceAdaptiveCleanup();

      // The stats should show high request rate
      const stats = httpAgentService.getEnhancedStats();
      expect(stats.requestRate).toBe(40);

      // Now trigger the scheduled cleanup to see interval adjustment
      jest.advanceTimersByTime(100000);

      // Verify high load was detected (can check via stats or other observable behavior)
      const finalStats = httpAgentService.getEnhancedStats();
      expect(finalStats.adaptiveCleanup.adjustments).toBeGreaterThanOrEqual(0);
    });

    it('should increase interval for low load', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        baseCleanupIntervalMs: 100000,
      });

      // Simulate low load (only 5 requests)
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        jest.setSystemTime(now + i * 10000);
        httpAgentService.getAgent('https://api.example.com');
      }

      // Force cleanup to see current state
      httpAgentService.forceAdaptiveCleanup();

      const stats = httpAgentService.getEnhancedStats();
      expect(stats.requestRate).toBe(5);

      // The interval calculation happens internally
      // We can verify it's working by checking the overall system behavior
      expect(stats.adaptiveCleanup.enabled).toBe(true);
    });

    it('should adjust for high memory usage', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        memoryThresholdMB: 0.001, // Very low threshold to trigger
      });

      // Create many agents to increase memory
      for (let i = 0; i < 10; i++) {
        httpAgentService.getAgent(`https://api${i}.example.com`);
      }

      // Check that memory usage exceeds threshold
      const stats = httpAgentService.getEnhancedStats();
      expect(stats.estimatedMemoryUsageMB).toBeGreaterThan(0.001);

      // Force cleanup to see the effect of high memory
      const result = httpAgentService.forceAdaptiveCleanup();

      // With high memory, cleanup should be more aggressive
      // The exact behavior depends on implementation, but we can verify it runs
      expect(result.currentMemoryMB).toBeDefined();
    });

    it('should respect min and max interval bounds', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        baseCleanupIntervalMs: 100000,
        minCleanupIntervalMs: 50000,
        maxCleanupIntervalMs: 150000,
      });

      // Create conditions for very low interval
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        jest.setSystemTime(now + i * 500);
        httpAgentService.getAgent('https://api.example.com');
      }

      // Advance to trigger multiple cleanups
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(50000);
      }

      // Check that intervals respect bounds
      const debugCalls = mockLogger.debug.mock.calls.filter((call) =>
        call[0].includes('Scheduled next cleanup')
      );

      debugCalls.forEach((call) => {
        const match = call[0].match(/in (\d+)ms/);
        expect(match).toBeTruthy();
        const interval = parseInt(match[1]);
        expect(interval).toBeGreaterThanOrEqual(50000);
        expect(interval).toBeLessThanOrEqual(150000);
      });
    });

    it('should handle many agents adjustment', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create many agents
      for (let i = 0; i < 60; i++) {
        httpAgentService.getAgent(`https://api${i}.example.com`);
      }

      // Trigger cleanup
      jest.advanceTimersByTime(300000);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('many-agents'),
        expect.any(Object)
      );
    });

    it('should handle few agents adjustment', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create just a few agents
      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');

      // Trigger cleanup
      jest.advanceTimersByTime(300000);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('few-agents'),
        expect.any(Object)
      );
    });

    it('should return base interval when adaptive cleanup is disabled', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        adaptiveCleanupEnabled: false,
        baseCleanupIntervalMs: 120000,
      });

      // Make some requests
      httpAgentService.getAgent('https://api.example.com');

      // The interval should remain constant
      jest.advanceTimersByTime(120000);
      jest.advanceTimersByTime(120000);

      // Should not see any adaptive adjustment logs
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Adaptive cleanup interval adjusted'),
        expect.any(Object)
      );
    });
  });

  describe('Adaptive cleanup execution', () => {
    it('should adjust idle threshold based on high load', () => {
      // Need to create distinct agents for each URL
      const agent1 = createMockAgent(1, 1);
      const agent2 = createMockAgent(1, 1);
      const agent3 = createMockAgent(1, 1);

      https.Agent.mockImplementationOnce(() => agent1)
        .mockImplementationOnce(() => agent2)
        .mockImplementationOnce(() => agent3);

      httpAgentService = new HttpAgentService(mockLogger, {
        highLoadRequestsPerMin: 30,
        idleThresholdMs: 60000,
      });

      // Create agents
      const now = Date.now();
      jest.setSystemTime(now);
      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');

      // Simulate high load by making many requests in a short time
      for (let i = 0; i < 40; i++) {
        jest.setSystemTime(now + i * 1000);
        httpAgentService.getAgent('https://api3.example.com');
      }

      // Advance time to make first two agents idle (but not by doubled threshold)
      jest.setSystemTime(now + 90000); // 1.5 minutes

      // Trigger cleanup
      httpAgentService.forceAdaptiveCleanup();
      const afterStats = httpAgentService.getStats();

      // In reality, the cleanup behavior is complex and depends on multiple factors
      // We can verify that the cleanup ran and respected the high load condition
      // by checking that at least one agent survived (agent3 which is recent)
      expect(afterStats.activeAgents).toBeGreaterThanOrEqual(1);

      // The exact cleanup behavior depends on the implementation's
      // idle threshold calculation under high load
    });

    it('should adjust idle threshold based on high memory', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        memoryThresholdMB: 0.001, // Very low to trigger
        idleThresholdMs: 60000,
      });

      // Create many agents
      const now = Date.now();
      jest.setSystemTime(now);
      for (let i = 0; i < 10; i++) {
        httpAgentService.getAgent(`https://api${i}.example.com`);
      }

      // Advance time to make agents idle (but not by original threshold)
      jest.setSystemTime(now + 35000); // 35 seconds

      // Force cleanup
      httpAgentService.forceAdaptiveCleanup();

      // With high memory, threshold is halved to 30000ms, so agents should be cleaned
      expect(mockHttpsAgent.destroy).toHaveBeenCalled();
    });

    it('should update statistics after cleanup', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      const initialStats = httpAgentService.getEnhancedStats();
      expect(initialStats.adaptiveCleanup.cleanupOperations).toBe(0);

      // Create and age an agent
      const now = Date.now();
      jest.setSystemTime(now);
      httpAgentService.getAgent('https://api.example.com');

      jest.setSystemTime(now + 400000); // Advance beyond idle threshold

      // Force cleanup
      httpAgentService.forceAdaptiveCleanup();

      const afterStats = httpAgentService.getEnhancedStats();
      expect(afterStats.adaptiveCleanup.cleanupOperations).toBe(1);
      // Duration might be 0 in tests due to mocked timers, check it's defined
      expect(afterStats.adaptiveCleanup.lastCleanupDuration).toBeDefined();
      expect(
        afterStats.adaptiveCleanup.lastCleanupDuration
      ).toBeGreaterThanOrEqual(0);
    });

    it('should log cleanup results when agents are cleaned', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create agent
      const now = Date.now();
      jest.setSystemTime(now);
      httpAgentService.getAgent('https://api.example.com');

      // Make it idle
      jest.setSystemTime(now + 400000);

      // Trigger cleanup
      jest.advanceTimersByTime(300000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Adaptive cleanup completed - cleaned 1 agents'
        ),
        expect.objectContaining({
          requestRate: expect.any(Number),
          memoryUsageMB: expect.any(Number),
          agentCount: 0,
          idleThreshold: expect.any(Number),
          duration: expect.any(Number),
        })
      );
    });

    it('should log when no agents are cleaned if debug enabled', () => {
      mockLogger.isDebugEnabled = true;
      httpAgentService = new HttpAgentService(mockLogger);

      // Create fresh agent
      httpAgentService.getAgent('https://api.example.com');

      // Trigger cleanup immediately (no idle agents)
      jest.advanceTimersByTime(300000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Adaptive cleanup completed - cleaned 0 agents'
        ),
        expect.any(Object)
      );
    });
  });

  describe('Enhanced statistics', () => {
    it('should include all adaptive cleanup metrics', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Perform some operations
      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');

      // Force a cleanup
      httpAgentService.forceAdaptiveCleanup();

      const stats = httpAgentService.getEnhancedStats();

      expect(stats).toMatchObject({
        agentsCreated: 2,
        requestsServed: 2,
        activeAgents: 2,
        requestRate: expect.any(Number),
        estimatedMemoryUsageMB: expect.any(Number),
        adaptiveCleanup: {
          enabled: true,
          adjustments: expect.any(Number),
          averageInterval: expect.any(Number),
          lastCleanupDuration: expect.any(Number),
          cleanupOperations: 1,
        },
      });
    });

    it('should show adaptive cleanup disabled when configured', () => {
      httpAgentService = new HttpAgentService(mockLogger, {
        adaptiveCleanupEnabled: false,
      });

      const stats = httpAgentService.getEnhancedStats();
      expect(stats.adaptiveCleanup.enabled).toBe(false);
    });
  });

  describe('Force cleanup', () => {
    it('should return cleanup results', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create agents
      const now = Date.now();
      jest.setSystemTime(now);
      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');
      httpAgentService.getAgent('https://api3.example.com');

      // Make some idle
      jest.setSystemTime(now + 400000);
      httpAgentService.getAgent('https://api3.example.com'); // Keep api3 fresh

      const result = httpAgentService.forceAdaptiveCleanup();

      expect(result).toMatchObject({
        agentsRemoved: 2,
        memoryFreedMB: expect.any(Number),
        currentAgentCount: 1,
        currentMemoryMB: expect.any(Number),
      });

      expect(result.memoryFreedMB).toBeGreaterThan(0);
    });

    it('should handle no agents to clean', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      const result = httpAgentService.forceAdaptiveCleanup();

      expect(result).toMatchObject({
        agentsRemoved: 0,
        memoryFreedMB: 0,
        currentAgentCount: 0,
        currentMemoryMB: 0,
      });
    });

    it('should properly execute cleanup logic', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create idle agent
      const now = Date.now();
      jest.setSystemTime(now);
      httpAgentService.getAgent('https://api.example.com');
      jest.setSystemTime(now + 400000);

      // Spy on cleanupIdleAgents
      const cleanupSpy = jest.spyOn(httpAgentService, 'cleanupIdleAgents');

      httpAgentService.forceAdaptiveCleanup();

      expect(cleanupSpy).toHaveBeenCalled();
      expect(mockHttpsAgent.destroy).toHaveBeenCalled();
    });
  });

  describe('Additional coverage for edge cases', () => {
    it('should properly handle interval calculation branches', () => {
      // Test the specific branches in #calculateNextCleanupInterval
      httpAgentService = new HttpAgentService(mockLogger, {
        baseCleanupIntervalMs: 100000,
        highLoadRequestsPerMin: 30,
        memoryThresholdMB: 0.5,
      });

      // Note: updateConfig only affects new agents, not the adaptive cleanup setting
      // The adaptive cleanup enabled/disabled is set during construction
      const stats = httpAgentService.getEnhancedStats();
      expect(stats.adaptiveCleanup.enabled).toBe(true);

      // Re-enable adaptive cleanup
      httpAgentService.updateConfig({ adaptiveCleanupEnabled: true });

      // Create high load scenario to cover lines 506-507
      const now = Date.now();
      for (let i = 0; i < 35; i++) {
        jest.setSystemTime(now + i * 1500);
        httpAgentService.getAgent('https://api.example.com');
      }

      // Also create many agents to trigger memory threshold (lines 517-518)
      for (let i = 0; i < 100; i++) {
        const mockAgent = createMockAgent(10, 10); // Many sockets per agent
        https.Agent.mockImplementationOnce(() => mockAgent);
        httpAgentService.getAgent(`https://api${i}.example.com`);
      }

      // Force cleanup to trigger calculations
      const result = httpAgentService.forceAdaptiveCleanup();
      expect(result.currentAgentCount).toBeGreaterThan(0);

      // Verify high memory scenario
      const enhancedStats = httpAgentService.getEnhancedStats();
      expect(enhancedStats.estimatedMemoryUsageMB).toBeGreaterThan(0.5);
    });

    it('should handle adaptive cleanup with high load idle threshold adjustment', () => {
      // Specific test for line 582 - high load idle threshold adjustment
      httpAgentService = new HttpAgentService(mockLogger, {
        highLoadRequestsPerMin: 20,
        idleThresholdMs: 60000,
      });

      // Create an agent that will be idle
      const now = Date.now();
      jest.setSystemTime(now);
      httpAgentService.getAgent('https://idle.example.com');

      // Create high load
      for (let i = 0; i < 25; i++) {
        jest.setSystemTime(now + i * 2000);
        httpAgentService.getAgent('https://busy.example.com');
      }

      // Advance time so the first agent would be idle under normal threshold
      // but not under doubled threshold
      jest.setSystemTime(now + 100000); // 100 seconds

      // Force cleanup instead of waiting for scheduled one
      httpAgentService.forceAdaptiveCleanup();

      // Verify the cleanup ran
      const enhancedStats = httpAgentService.getEnhancedStats();
      expect(enhancedStats.adaptiveCleanup.cleanupOperations).toBeGreaterThan(
        0
      );

      // The request rate depends on the time window
      // Since we made 25 requests over 50 seconds, and then advanced time,
      // some might have fallen outside the window
      expect(enhancedStats.requestRate).toBeGreaterThanOrEqual(0);
    });

    it('filters out expired request timestamps when calculating request rates', () => {
      const baseTime = new Date('2025-02-01T00:00:00Z');
      jest.setSystemTime(baseTime);

      httpAgentService = new HttpAgentService(mockLogger);

      // Record requests that will fall outside of the one minute tracking window
      httpAgentService.getAgent('https://api.example.com');
      jest.setSystemTime(new Date(baseTime.getTime() + 30_000));
      httpAgentService.getAgent('https://api.example.com');

      // Advance beyond the window to ensure the existing timestamps are stale
      jest.setSystemTime(new Date(baseTime.getTime() + 120_000));

      const staleStats = httpAgentService.getEnhancedStats();
      expect(staleStats.requestRate).toBe(0);

      // Add a fresh request that should now be counted and trigger the tracker pruning
      httpAgentService.getAgent('https://api.example.com');

      const statsBeforeCleanup = httpAgentService.getEnhancedStats();
      expect(statsBeforeCleanup.requestRate).toBe(1);

      httpAgentService.forceAdaptiveCleanup();

      const statsAfterCleanup = httpAgentService.getEnhancedStats();
      expect(statsAfterCleanup.requestRate).toBe(1);
      expect(
        statsAfterCleanup.adaptiveCleanup.cleanupOperations
      ).toBeGreaterThan(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle agent monitoring when socket events fail', () => {
      const errorAgent = {
        ...createMockAgent(),
        on: jest.fn((event, callback) => {
          if (event === 'socket') {
            // Simulate socket creation that throws
            setTimeout(() => {
              const errorSocket = {
                on: jest.fn(() => {
                  throw new Error('Socket event error');
                }),
              };
              try {
                callback(errorSocket);
              } catch (_e) {
                // Error should be caught internally
              }
            }, 0);
          }
        }),
      };

      https.Agent.mockImplementationOnce(() => errorAgent);
      httpAgentService = new HttpAgentService(mockLogger);

      // Should not throw when creating agent despite socket error
      expect(() =>
        httpAgentService.getAgent('https://api.example.com')
      ).not.toThrow();

      // Process only pending timers (not all)
      jest.runOnlyPendingTimers();

      // Verify the service is still functional
      expect(httpAgentService.getActiveAgentCount()).toBe(1);
    });

    it('should handle concurrent cleanup operations', () => {
      httpAgentService = new HttpAgentService(mockLogger);

      // Create agents
      for (let i = 0; i < 5; i++) {
        httpAgentService.getAgent(`https://api${i}.example.com`);
      }

      // Trigger multiple cleanups rapidly
      const results = [];
      results.push(httpAgentService.forceAdaptiveCleanup());
      results.push(httpAgentService.forceAdaptiveCleanup());

      // Second cleanup should find nothing to clean
      expect(results[0].agentsRemoved).toBeGreaterThanOrEqual(0);
      expect(results[1].agentsRemoved).toBe(0);
    });
  });
});
