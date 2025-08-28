/**
 * @file Integration test to reproduce the RemoteLogger connection issue
 * @description Tests the connection between RemoteLogger and the llm-proxy-server debug endpoint
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import { createTestBed } from '../../common/testBed.js';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock window object for browser environment simulation
global.window = {
  location: {
    origin: 'http://127.0.0.1:8080',
    hostname: '127.0.0.1'
  }
};

// Mock URL constructor for endpoint adjustment
global.URL = class MockURL {
  constructor(url) {
    const parts = url.split('://');
    this.protocol = parts[0] + ':';
    const hostAndPath = parts[1].split('/');
    const hostAndPort = hostAndPath[0].split(':');
    this.hostname = hostAndPort[0];
    this.port = hostAndPort[1] || '';
    this.pathname = '/' + hostAndPath.slice(1).join('/');
  }
  
  toString() {
    return `${this.protocol}//${this.hostname}:${this.port}${this.pathname}`;
  }
};

describe('RemoteLogger Connection Issue Reproduction', () => {
  let testBed;
  let mockLogger;
  let remoteLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    
    // Reset fetch mock
    jest.clearAllMocks();
    
    // Create RemoteLogger with test configuration
    remoteLogger = new RemoteLogger({
      endpoint: 'http://localhost:3001/api/debug-log',
      batchSize: 10,
      flushInterval: 1000,
      retryAttempts: 3,
      retryBaseDelay: 100,
      retryMaxDelay: 1000,
      fallbackLogger: mockLogger
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Connection Refused Error Simulation', () => {
    it('should reproduce the net::ERR_CONNECTION_REFUSED error', async () => {
      // Mock fetch to simulate connection refused error
      fetch.mockRejectedValue(new Error('Failed to fetch'));

      // Try to log a debug message
      remoteLogger.debug('Test debug message during startup');

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that fetch was called with the adjusted endpoint (127.0.0.1 instead of localhost)
      expect(fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/debug-log', // Should be adjusted from localhost to 127.0.0.1
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('Test debug message during startup')
        })
      );

      // Verify fallback logging was used
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RemoteLogger] Failed to send batch to server'),
        expect.objectContaining({
          error: 'Failed to fetch'
        })
      );
    });

    it('should handle multiple rapid connection attempts during startup', async () => {
      let callCount = 0;
      fetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          // First 3 calls fail with connection error
          return Promise.reject(new Error('Failed to fetch'));
        }
        // 4th call succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, processed: 1, timestamp: new Date().toISOString() })
        });
      });

      // Simulate rapid logging during bootstrap
      for (let i = 0; i < 5; i++) {
        remoteLogger.debug(`Bootstrap log ${i}`);
      }

      // Wait for processing and retries
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify multiple retry attempts were made
      expect(fetch).toHaveBeenCalledTimes(4);
      
      // Verify eventual success
      const lastCall = fetch.mock.calls[3];
      expect(lastCall[0]).toBe('http://127.0.0.1:3001/api/debug-log');
    });
  });

  describe('Endpoint URL Adjustment', () => {
    it('should adjust localhost to 127.0.0.1 to match page origin', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, processed: 1, timestamp: new Date().toISOString() })
      });

      remoteLogger.debug('Test message');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the endpoint was adjusted from localhost to 127.0.0.1
      expect(fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/debug-log',
        expect.any(Object)
      );
    });

    it('should log the endpoint adjustment', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, processed: 1, timestamp: new Date().toISOString() })
      });

      remoteLogger.debug('Test message');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify debug log about endpoint adjustment
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Adjusted endpoint from http://localhost:3001/api/debug-log to http://127.0.0.1:3001/api/debug-log')
      );
    });
  });

  describe('Server Response Validation', () => {
    it('should handle successful responses correctly', async () => {
      const mockResponse = {
        success: true,
        processed: 1,
        timestamp: '2025-08-28T18:30:00.000Z'
      };

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      remoteLogger.debug('Test successful message');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Should not have fallback logging for successful requests
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should validate response format and reject invalid responses', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      remoteLogger.debug('Test message with invalid response');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should fall back to console logging due to invalid response format
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RemoteLogger] Failed to send batch to server'),
        expect.objectContaining({
          error: 'Invalid response format from debug log endpoint'
        })
      );
    });
  });

  describe('Error Recovery', () => {
    it('should recover gracefully after connection is restored', async () => {
      let isServerReady = false;
      
      fetch.mockImplementation(() => {
        if (!isServerReady) {
          return Promise.reject(new Error('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, processed: 1, timestamp: new Date().toISOString() })
        });
      });

      // Log message while server is "down"
      remoteLogger.debug('Message while server down');
      await new Promise(resolve => setTimeout(resolve, 100));

      // "Start" the server
      isServerReady = true;

      // Log message after server is "up"
      remoteLogger.debug('Message after server up');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify first call failed, second succeeded
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});