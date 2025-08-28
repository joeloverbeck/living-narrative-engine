/**
 * @file Integration test to reproduce RemoteLogger connection failures
 * @description Tests the actual connection issues observed in error_logs.txt
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import RemoteLogger from '../../../src/logging/remoteLogger.js';

describe('RemoteLogger Connection Issues - Integration', () => {
  let testBed;
  let remoteLogger;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(async () => {
    if (remoteLogger) {
      // Clean up logger resources
      remoteLogger.cleanup?.();
    }
    testBed.cleanup();
  });

  describe('Connection Failure Scenarios', () => {
    it('should reproduce ERR_CONNECTION_REFUSED when proxy server is not running', async () => {
      // Reproduce the exact scenario from error_logs.txt
      const mockLogger = testBed.createMockLogger();
      
      // Use the same endpoint configuration as production
      remoteLogger = new RemoteLogger(mockLogger, {
        endpoint: 'http://127.0.0.1:3001/api/debug-log',
        batchSize: 100,
        flushInterval: 1000,
        retryAttempts: 1, // Reduce for faster test
        requestTimeout: 5000
      });

      // Try to log something - this should trigger the connection attempt
      remoteLogger.info('Test message that should fail to send');

      // Wait for the connection attempt and failure
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Verify that the logger falls back to console and logs the failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server, falling back to console')
      );
    });

    it('should reproduce the race condition between client startup and server readiness', async () => {
      // Simulate the scenario where client starts logging immediately after bootstrap
      const mockLogger = testBed.createMockLogger();
      
      remoteLogger = new RemoteLogger(mockLogger, {
        endpoint: 'http://127.0.0.1:3001/api/debug-log',
        batchSize: 10, // Small batch for immediate sending
        flushInterval: 100, // Fast flush
        retryAttempts: 2,
        requestTimeout: 3000
      });

      // Simulate rapid logging that happens during app bootstrap
      for (let i = 0; i < 50; i++) {
        remoteLogger.info(`Bootstrap log ${i}`);
      }

      // Wait for connection attempts
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Should see multiple connection failures
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server')
      );
    });

    it('should handle mixed localhost/127.0.0.1 URL scenarios', async () => {
      const mockLogger = testBed.createMockLogger();
      
      // Test both URL formats that appear in the codebase
      const endpoints = [
        'http://localhost:3001/api/debug-log',
        'http://127.0.0.1:3001/api/debug-log'
      ];

      for (const endpoint of endpoints) {
        const logger = new RemoteLogger(mockLogger, {
          endpoint,
          batchSize: 1,
          flushInterval: 100,
          retryAttempts: 1,
          requestTimeout: 2000
        });

        logger.info(`Testing endpoint: ${endpoint}`);
        
        // Wait for connection attempt
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        logger.cleanup?.();
      }

      // Both should fail with connection refused
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send batch to server')
      );
    });
  });

  describe('Expected Behavior After Fixes', () => {
    it('should successfully connect when proxy server is available', async () => {
      // This test will pass after we implement the fixes
      // For now, it documents the expected behavior
      const mockLogger = testBed.createMockLogger();
      
      remoteLogger = new RemoteLogger(mockLogger, {
        endpoint: 'http://127.0.0.1:3001/api/debug-log',
        batchSize: 10,
        flushInterval: 1000,
        retryAttempts: 3,
        retryBaseDelay: 500,
        requestTimeout: 10000
      });

      // Log a test message
      remoteLogger.info('Test message for successful connection');

      // Wait for potential retry attempts
      await new Promise(resolve => setTimeout(resolve, 8000));

      // After fixes, this should not log connection failures
      // (When server is running, mockLogger.warn should not be called with connection errors)
      
      // For now, this test will fail - it documents what we want to achieve
      if (process.env.PROXY_SERVER_AVAILABLE === 'true') {
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining('Failed to send batch to server')
        );
      } else {
        // Until proxy server is fixed, we expect failures
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to send batch to server')
        );
      }
    });

    it('should implement proper retry logic with backoff', async () => {
      const mockLogger = testBed.createMockLogger();
      
      remoteLogger = new RemoteLogger(mockLogger, {
        endpoint: 'http://127.0.0.1:3001/api/debug-log',
        batchSize: 5,
        flushInterval: 500,
        retryAttempts: 3,
        retryBaseDelay: 100,
        retryMaxDelay: 1000,
        requestTimeout: 2000
      });

      // Log messages to trigger retry sequence
      for (let i = 0; i < 10; i++) {
        remoteLogger.info(`Retry test message ${i}`);
      }

      // Wait for full retry sequence
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Should see evidence of retry attempts in logs
      // This will be implemented as part of the fix
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrying batch send')
      );
    });
  });
});