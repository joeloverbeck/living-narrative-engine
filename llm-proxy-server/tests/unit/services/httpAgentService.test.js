/**
 * @file httpAgentService.test.js - Unit tests for HttpAgentService
 */

import { jest } from '@jest/globals';
import https from 'https';
import http from 'http';
import HttpAgentService from '../../../src/services/httpAgentService.js';
import { HTTP_AGENT_TIMEOUT } from '../../../src/config/constants.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Mock the http and https modules
jest.mock('http');
jest.mock('https');

describe('HttpAgentService', () => {
  let httpAgentService;
  let mockLogger;
  let mockHttpAgent;
  let mockHttpsAgent;

  beforeEach(() => {
    // Use fake timers for all tests to prevent real intervals
    jest.useFakeTimers();

    mockLogger = createMockLogger();

    // Create mock agents
    mockHttpAgent = {
      destroy: jest.fn(),
      sockets: { 'host:80': [{}] },
      freeSockets: { 'host:80': [{}, {}] },
      on: jest.fn(),
    };

    mockHttpsAgent = {
      destroy: jest.fn(),
      sockets: { 'host:443': [{}, {}] },
      freeSockets: { 'host:443': [{}] },
      on: jest.fn(),
    };

    // Mock agent constructors
    http.Agent.mockImplementation(() => mockHttpAgent);
    https.Agent.mockImplementation(() => mockHttpsAgent);

    httpAgentService = new HttpAgentService(mockLogger, {
      keepAlive: true,
      maxSockets: 25,
      maxFreeSockets: 5,
      timeout: 30000,
      freeSocketTimeout: 15000,
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up the service to clear any intervals
    if (httpAgentService && httpAgentService.cleanup) {
      httpAgentService.cleanup();
    }

    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration when not provided', () => {
      new HttpAgentService(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Initialized with adaptive cleanup configuration',
        expect.objectContaining({
          keepAlive: true,
          maxSockets: 50,
          maxFreeSockets: 10,
          timeout: HTTP_AGENT_TIMEOUT,
          freeSocketTimeout: 30000,
          maxTotalSockets: 500,
          adaptiveCleanup: expect.objectContaining({
            baseIntervalMs: 300000,
            minIntervalMs: 60000,
            maxIntervalMs: 900000,
            idleThresholdMs: 300000,
            memoryThresholdMB: 100,
            highLoadRequestsPerMin: 60,
            adaptiveCleanupEnabled: true,
          }),
        })
      );
    });

    it('should initialize with provided configuration', () => {
      new HttpAgentService(mockLogger, {
        keepAlive: true,
        maxSockets: 25,
        maxFreeSockets: 5,
        timeout: 30000,
        freeSocketTimeout: 15000,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Initialized with adaptive cleanup configuration',
        expect.objectContaining({
          keepAlive: true,
          maxSockets: 25,
          maxFreeSockets: 5,
          timeout: 30000,
          freeSocketTimeout: 15000,
          maxTotalSockets: 500,
          adaptiveCleanup: expect.objectContaining({
            baseIntervalMs: 300000,
            minIntervalMs: 60000,
            maxIntervalMs: 900000,
            idleThresholdMs: 300000,
            memoryThresholdMB: 100,
            highLoadRequestsPerMin: 60,
            adaptiveCleanupEnabled: true,
          }),
        })
      );
    });

    it('should throw error when logger is not provided', () => {
      expect(() => new HttpAgentService()).toThrow();
    });

    it('should set up adaptive cleanup', () => {
      const mockSetTimeout = jest.spyOn(global, 'setTimeout');

      const service = new HttpAgentService(mockLogger);

      // Verify setTimeout was called for adaptive cleanup
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 300000);

      // Clean up the service
      service.cleanup();

      mockSetTimeout.mockRestore();
    });
  });

  describe('getAgent', () => {
    it('should create new HTTPS agent for HTTPS URL', () => {
      const agent = httpAgentService.getAgent(
        'https://api.example.com/endpoint'
      );

      expect(https.Agent).toHaveBeenCalledWith({
        keepAlive: true,
        maxSockets: 25,
        maxFreeSockets: 5,
        timeout: 30000,
        freeSocketTimeout: 15000,
        scheduling: 'fifo',
      });

      expect(agent).toBe(mockHttpsAgent);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Created new agent for https://api.example.com:443'
      );
    });

    it('should create new HTTP agent for HTTP URL', () => {
      const agent = httpAgentService.getAgent(
        'http://api.example.com/endpoint'
      );

      expect(http.Agent).toHaveBeenCalledWith({
        keepAlive: true,
        maxSockets: 25,
        maxFreeSockets: 5,
        timeout: 30000,
        freeSocketTimeout: 15000,
        scheduling: 'fifo',
      });

      expect(agent).toBe(mockHttpAgent);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Created new agent for http://api.example.com:80'
      );
    });

    it('should reuse existing agent for same host', () => {
      const agent1 = httpAgentService.getAgent(
        'https://api.example.com/endpoint1'
      );
      const agent2 = httpAgentService.getAgent(
        'https://api.example.com/endpoint2'
      );

      expect(agent1).toBe(agent2);
      expect(https.Agent).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'HttpAgentService: Reusing agent for https://api.example.com:443 (2 requests)'
      );
    });

    it('should create separate agents for different hosts', () => {
      const agent1 = httpAgentService.getAgent('https://api1.example.com');
      const agent2 = httpAgentService.getAgent('https://api2.example.com');

      expect(agent1).toBe(mockHttpsAgent);
      expect(agent2).toBe(mockHttpsAgent);
      expect(https.Agent).toHaveBeenCalledTimes(2);
    });

    it('should create separate agents for different ports', () => {
      httpAgentService.getAgent('https://api.example.com:443');
      httpAgentService.getAgent('https://api.example.com:8443');

      expect(https.Agent).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid URLs', () => {
      expect(() => httpAgentService.getAgent('not-a-url')).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HttpAgentService: Error getting agent for URL',
        expect.objectContaining({
          url: 'not-a-url',
          error: expect.any(String),
        })
      );
    });

    it('should monitor agent socket events', () => {
      httpAgentService.getAgent('https://api.example.com');

      expect(mockHttpsAgent.on).toHaveBeenCalledWith(
        'socket',
        expect.any(Function)
      );

      // Simulate socket creation
      const socketCallback = mockHttpsAgent.on.mock.calls[0][1];
      const mockSocket = { on: jest.fn() };
      socketCallback(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith(
        'agentRemove',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'HttpAgentService: Socket created for https://api.example.com:443'
      );
    });

    it('should track statistics correctly', () => {
      httpAgentService.getAgent('https://api.example.com');
      httpAgentService.getAgent('https://api.example.com');
      httpAgentService.getAgent('http://api.example.com');

      const stats = httpAgentService.getStats();
      expect(stats.agentsCreated).toBe(2);
      expect(stats.requestsServed).toBe(3);
    });
  });

  describe('getFetchOptions', () => {
    it('should return fetch options with agent', () => {
      const options = httpAgentService.getFetchOptions(
        'https://api.example.com'
      );

      expect(options).toEqual({ agent: mockHttpsAgent });
      expect(https.Agent).toHaveBeenCalled();
    });
  });

  describe('destroyAgent', () => {
    it('should destroy existing agent', () => {
      httpAgentService.getAgent('https://api.example.com');
      const result = httpAgentService.destroyAgent('https://api.example.com');

      expect(result).toBe(true);
      expect(mockHttpsAgent.destroy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Destroyed agent for https://api.example.com:443'
      );
    });

    it('should destroy http agents using the default port', () => {
      httpAgentService.getAgent('http://public.example.com/path');

      const result = httpAgentService.destroyAgent(
        'http://public.example.com/path'
      );

      expect(result).toBe(true);
      expect(mockHttpAgent.destroy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Destroyed agent for http://public.example.com:80'
      );
    });

    it('should return false for non-existent agent', () => {
      const result = httpAgentService.destroyAgent('https://nonexistent.com');

      expect(result).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      const result = httpAgentService.destroyAgent('not-a-url');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HttpAgentService: Error destroying agent',
        expect.objectContaining({
          url: 'not-a-url',
          error: expect.any(String),
        })
      );
    });
  });

  describe('destroyAll', () => {
    it('should destroy all agents', () => {
      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');
      httpAgentService.getAgent('http://api3.example.com');

      httpAgentService.destroyAll();

      expect(mockHttpsAgent.destroy).toHaveBeenCalledTimes(2);
      expect(mockHttpAgent.destroy).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Destroyed all 3 agents'
      );

      // Verify agents are cleared
      expect(httpAgentService.getActiveAgentCount()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', () => {
      httpAgentService.getAgent('https://api.example.com');
      httpAgentService.getAgent('https://api.example.com');
      httpAgentService.getAgent('http://api.example.com');

      const stats = httpAgentService.getStats();

      expect(stats).toEqual({
        agentsCreated: 2,
        requestsServed: 3,
        socketsCreated: 0,
        socketsReused: 0,
        activeAgents: 2,
        cleanupOperations: 0,
        adaptiveCleanupAdjustments: 0,
        lastCleanupDuration: 0,
        averageCleanupInterval: 300000,
        agentDetails: expect.arrayContaining([
          expect.objectContaining({
            key: 'https://api.example.com:443',
            protocol: 'https:',
            hostname: 'api.example.com',
            port: 443,
            requestCount: 2,
            activeSockets: 2,
            freeSockets: 1,
          }),
          expect.objectContaining({
            key: 'http://api.example.com:80',
            protocol: 'http:',
            hostname: 'api.example.com',
            port: 80,
            requestCount: 1,
            activeSockets: 1,
            freeSockets: 2,
          }),
        ]),
      });
    });
  });

  describe('cleanupIdleAgents', () => {
    it('should cleanup agents idle longer than threshold', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');

      // Advance time by 6 minutes
      jest.setSystemTime(now + 360000);

      // Use the recent agent
      httpAgentService.getAgent('https://api2.example.com');

      // Cleanup with 5 minute threshold
      const cleaned = httpAgentService.cleanupIdleAgents(300000);

      expect(cleaned).toBe(1);
      expect(mockHttpsAgent.destroy).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Cleaned up idle agent https://api1.example.com:443'
      );

      jest.useRealTimers();
    });

    it('should return 0 when no agents are idle', () => {
      httpAgentService.getAgent('https://api.example.com');

      const cleaned = httpAgentService.cleanupIdleAgents(300000);
      expect(cleaned).toBe(0);
    });

    it('should use the default idle threshold when not provided', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      httpAgentService.getAgent('https://default-threshold.example.com');

      // Advance just beyond the default 5 minute window
      jest.setSystemTime(now + 301000);

      const cleaned = httpAgentService.cleanupIdleAgents();

      expect(cleaned).toBe(1);
      expect(mockHttpsAgent.destroy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Cleaned up idle agent https://default-threshold.example.com:443'
      );
    });
  });

  describe('hasAgent', () => {
    it('should return true for existing agent', () => {
      httpAgentService.getAgent('https://api.example.com');

      expect(httpAgentService.hasAgent('https://api.example.com')).toBe(true);
    });

    it('should detect http agents with implicit default ports', () => {
      httpAgentService.getAgent('http://api.example.com/resource');

      expect(httpAgentService.hasAgent('http://api.example.com/resource')).toBe(
        true
      );
    });

    it('should return false for non-existent agent', () => {
      expect(httpAgentService.hasAgent('https://api.example.com')).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(httpAgentService.hasAgent('not-a-url')).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      httpAgentService.updateConfig({ maxSockets: 100, timeout: 120000 });

      const config = httpAgentService.getConfig();
      expect(config.maxSockets).toBe(100);
      expect(config.timeout).toBe(120000);
      expect(config.keepAlive).toBe(true); // Original value preserved

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Updated configuration',
        expect.objectContaining({
          maxSockets: 100,
          timeout: 120000,
        })
      );
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = httpAgentService.getConfig();

      expect(config).toEqual({
        keepAlive: true,
        maxSockets: 25,
        maxFreeSockets: 5,
        timeout: 30000,
        freeSocketTimeout: 15000,
        maxTotalSockets: 500,
      });
    });

    it('should return a copy of configuration', () => {
      const config1 = httpAgentService.getConfig();
      const config2 = httpAgentService.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with custom ports', () => {
      httpAgentService.getAgent('https://api.example.com:8443/endpoint');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Created new agent for https://api.example.com:8443'
      );
    });

    it('should handle URLs without paths', () => {
      const agent = httpAgentService.getAgent('https://api.example.com');
      expect(agent).toBe(mockHttpsAgent);
    });

    it('should track socket reuse statistics', () => {
      httpAgentService.getAgent('https://api.example.com');

      // Get the socket event handler
      const socketCallback = mockHttpsAgent.on.mock.calls[0][1];
      const mockSocket = { on: jest.fn() };
      socketCallback(mockSocket);

      // Get the agentRemove handler and trigger it
      const agentRemoveCallback = mockSocket.on.mock.calls[0][1];
      agentRemoveCallback();

      const stats = httpAgentService.getStats();
      expect(stats.socketsCreated).toBe(1);
      expect(stats.socketsReused).toBe(1);
    });
  });

  describe('adaptive cleanup interval calculations', () => {
    const baseInterval = 300000;

    it('should extend the cleanup interval during sustained low load', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      try {
        httpAgentService.cleanup();
        setTimeoutSpy.mockClear();
        jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

        httpAgentService = new HttpAgentService(mockLogger, {
          keepAlive: true,
          maxSockets: 25,
          maxFreeSockets: 5,
          timeout: 30000,
          freeSocketTimeout: 15000,
        });

        mockLogger.debug.mockClear();

        expect(setTimeoutSpy).toHaveBeenCalledWith(
          expect.any(Function),
          baseInterval
        );

        jest.advanceTimersByTime(baseInterval);

        expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(1);
        const [, nextInterval] = setTimeoutSpy.mock.calls[1];

        expect(nextInterval).toBeGreaterThan(baseInterval);
        const adjustmentLog = mockLogger.debug.mock.calls.find(([message]) =>
          typeof message === 'string' &&
          message.includes('Adaptive cleanup interval adjusted')
        );
        expect(adjustmentLog).toBeDefined();
      } finally {
        setTimeoutSpy.mockRestore();
      }
    });

    it('should keep the base interval when load stays within normal range', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      try {
        httpAgentService.cleanup();
        setTimeoutSpy.mockClear();
        const baseTime = new Date('2024-01-01T00:00:00.000Z');
        jest.setSystemTime(baseTime);

        httpAgentService = new HttpAgentService(mockLogger, {
          keepAlive: true,
          maxSockets: 25,
          maxFreeSockets: 5,
          timeout: 30000,
          freeSocketTimeout: 15000,
        });

        mockLogger.debug.mockClear();

        jest.advanceTimersByTime(baseInterval - 45000);

        for (let index = 0; index < 12; index += 1) {
          httpAgentService.getAgent(`https://balanced-${index}.example.com`);
          jest.advanceTimersByTime(3000);
        }

        jest.advanceTimersByTime(9000);

        expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(1);
        const [, nextInterval] = setTimeoutSpy.mock.calls[1];

        expect(nextInterval).toBe(baseInterval);
        const adjustmentLog = mockLogger.debug.mock.calls.find(([message]) =>
          typeof message === 'string' &&
          message.includes('Adaptive cleanup interval adjusted')
        );
        expect(adjustmentLog).toBeUndefined();
      } finally {
        setTimeoutSpy.mockRestore();
      }
    });
  });

  describe('cleanup', () => {
    it('should clear timeout and destroy all agents', () => {
      const mockClearTimeout = jest.spyOn(global, 'clearTimeout');

      // Create some agents
      httpAgentService.getAgent('https://api1.example.com');
      httpAgentService.getAgent('https://api2.example.com');

      // Call cleanup
      httpAgentService.cleanup();

      // Verify timeout was cleared
      expect(mockClearTimeout).toHaveBeenCalled();

      // Verify all agents were destroyed
      expect(mockHttpsAgent.destroy).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Cleared adaptive cleanup timer'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Destroyed all 2 agents'
      );

      // Verify no agents remain
      expect(httpAgentService.getActiveAgentCount()).toBe(0);

      mockClearTimeout.mockRestore();
    });

    it('should handle cleanup when no timeout exists', () => {
      const mockClearTimeout = jest.spyOn(global, 'clearTimeout');

      // Create a new service and immediately clean it up
      const service = new HttpAgentService(mockLogger);
      service.cleanup();

      // Should still work without errors
      expect(mockClearTimeout).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HttpAgentService: Cleared adaptive cleanup timer'
      );

      mockClearTimeout.mockRestore();
    });
  });
});
