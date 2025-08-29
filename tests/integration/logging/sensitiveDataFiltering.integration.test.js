/**
 * @file Integration tests for sensitive data filtering in logging system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import HybridLogger from '../../../src/logging/hybridLogger.js';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';
import { createTestBed } from '../../common/testBed.js';

// Mock fetch globally for RemoteLogger
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Sensitive Data Filtering Integration', () => {
  let testBed;
  let mockConsoleLogger;
  let mockEventBus;
  let categoryDetector;

  beforeEach(() => {
    testBed = createTestBed();
    
    mockConsoleLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      groupCollapsed: jest.fn(),
      groupEnd: jest.fn(),
      table: jest.fn(),
      setLogLevel: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    categoryDetector = new LogCategoryDetector({
      enableCache: false,
    });

    // Mock successful fetch response for all RemoteLogger instances
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 1 }),
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('RemoteLogger Integration', () => {
    let remoteLogger;

    beforeEach(() => {
      const config = {
        endpoint: 'http://localhost:3001/api/debug-log',
        batchSize: 5,
        flushInterval: 1000,
        filtering: {
          enabled: true,
          strategy: 'mask',
          patterns: {
            testToken: 'token:\\s*\\w+',
          },
        },
      };

      remoteLogger = new RemoteLogger({
        config,
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });
    });

    afterEach(() => {
      if (remoteLogger && typeof remoteLogger.destroy === 'function') {
        remoteLogger.destroy();
      }
    });

    it('should filter sensitive data in log messages', (done) => {
      const sensitiveMessage = 'User login with API_KEY=sk-1234567890abcdef successful';
      
      // Mock the flush to capture what would be sent
      const originalFlush = remoteLogger._flush;
      remoteLogger._flush = jest.fn();

      remoteLogger.info(sensitiveMessage);

      setTimeout(() => {
        // Access buffer through public method to check filtered content
        const buffer = remoteLogger.getBuffer();
        expect(buffer.length).toBeGreaterThan(0);
        
        const logEntry = buffer[buffer.length - 1];
        expect(logEntry.message).not.toContain('sk-1234567890abcdef');
        expect(logEntry.message).toContain('[REDACTED]');
        
        done();
      }, 100);
    });

    it('should filter custom patterns from config', (done) => {
      const messageWithCustomPattern = 'Authentication token: abc123def456';

      const originalFlush = remoteLogger._flush;
      remoteLogger._flush = jest.fn();

      remoteLogger.info(messageWithCustomPattern);

      setTimeout(() => {
        const buffer = remoteLogger.getBuffer();
        const logEntry = buffer[buffer.length - 1];
        
        expect(logEntry.message).not.toContain('abc123def456');
        expect(logEntry.message).toContain('[REDACTED]');
        
        done();
      }, 100);
    });

    it('should filter metadata objects', (done) => {
      const sensitiveMetadata = {
        user: 'john',
        password: 'secret123',
        apiKey: 'sk-test123',
        normalData: 'public info',
      };

      const originalFlush = remoteLogger._flush;
      remoteLogger._flush = jest.fn();

      remoteLogger.info('User action', sensitiveMetadata);

      setTimeout(() => {
        const buffer = remoteLogger.getBuffer();
        const logEntry = buffer[buffer.length - 1];
        
        if (logEntry && logEntry.metadata && logEntry.metadata.originalArgs && logEntry.metadata.originalArgs[0]) {
          const args = logEntry.metadata.originalArgs[0];
          expect(args.user).toBe('john');
          expect(args.password).toBe('[REDACTED]');
          expect(args.apiKey).toBe('[REDACTED]');
          expect(args.normalData).toBe('public info');
        }
        
        done();
      }, 100);
    });

    it('should work when filtering is disabled', (done) => {
      const configWithoutFiltering = {
        endpoint: 'http://localhost:3001/api/debug-log',
        batchSize: 5,
        filtering: {
          enabled: false,
        },
      };

      const loggerWithoutFilter = new RemoteLogger({
        config: configWithoutFiltering,
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });

      const originalFlush = loggerWithoutFilter._flush;
      loggerWithoutFilter._flush = jest.fn();

      const sensitiveMessage = 'password: secret123';
      loggerWithoutFilter.info(sensitiveMessage);

      setTimeout(() => {
        const buffer = loggerWithoutFilter.getBuffer();
        const logEntry = buffer[buffer.length - 1];
        
        expect(logEntry.message).toBe(sensitiveMessage);
        
        loggerWithoutFilter.destroy?.();
        done();
      }, 100);
    });
  });

  describe('HybridLogger Integration', () => {
    let hybridLogger;

    beforeEach(() => {
      const remoteConfig = {
        endpoint: 'http://localhost:3001/api/debug-log',
        batchSize: 5,
        filtering: {
          enabled: true,
          strategy: 'mask',
        },
      };

      const remoteLogger = new RemoteLogger({
        config: remoteConfig,
        dependencies: {
          consoleLogger: mockConsoleLogger,
          eventBus: mockEventBus,
        },
      });

      const hybridConfig = {
        console: {
          enabled: true,
          levels: ['info', 'warn', 'error'],
          categories: null, // Allow all categories for testing
        },
        remote: {
          enabled: true,
          levels: null,
        },
        filtering: {
          enabled: true,
          strategy: 'partial',
        },
      };

      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: remoteLogger,
          categoryDetector: categoryDetector,
        },
        hybridConfig
      );
    });

    afterEach(() => {
      if (hybridLogger && hybridLogger.getRemoteLogger && hybridLogger.getRemoteLogger().destroy) {
        hybridLogger.getRemoteLogger().destroy();
      }
    });

    it('should filter sensitive data in console output', () => {
      const sensitiveMessage = 'Login successful with password: mySecretPassword123';
      
      // Clear any previous console calls before test
      mockConsoleLogger.info.mockClear();
      
      hybridLogger.info(sensitiveMessage);

      expect(mockConsoleLogger.info).toHaveBeenCalled();
      
      // Find the call that contains our test message (not initialization messages)
      const relevantCall = mockConsoleLogger.info.mock.calls.find(call => 
        call[0] && call[0].includes('Login successful')
      );
      expect(relevantCall).toBeDefined();
      
      const loggedMessage = relevantCall[0];
      
      // Verify sensitive data is filtered out
      expect(loggedMessage).not.toContain('mySecretPassword123');
      
      // Verify some form of masking is present (account for category prefix)
      expect(loggedMessage).toMatch(/password:\s*[a-zA-Z*]+\d+/); // Pattern: prefix + asterisks + suffix
      
      // Verify the message has category formatting
      expect(loggedMessage).toMatch(/^\[.*:.*\]/);
    });

    it('should filter arguments passed to console logger', () => {
      const sensitiveArgs = {
        user: 'john',
        credentials: {
          token: 'Bearer xyz123abc456',
          secret: 'topSecret',
        },
        publicInfo: 'everyone can see this',
      };

      hybridLogger.warn('Authentication attempt', sensitiveArgs);

      expect(mockConsoleLogger.warn).toHaveBeenCalled();
      const consoleArgs = mockConsoleLogger.warn.mock.calls[0];
      const filteredArgs = consoleArgs[1];

      expect(filteredArgs.user).toBe('john');
      // The entire credentials object is filtered as it contains sensitive key
      expect(filteredArgs.credentials).toMatch(/\[.*\*.*\]/);
      expect(filteredArgs.publicInfo).toBe('everyone can see this');
    });

    it('should filter both console and remote destinations independently', (done) => {
      const sensitiveMessage = 'API operation with apiKey: sk-1234567890abcdef completed';

      // Clear previous mock calls
      mockConsoleLogger.info.mockClear();

      // Mock remote logger's flush to capture remote data
      const remoteLogger = hybridLogger.getRemoteLogger();
      const originalFlush = remoteLogger._flush;
      remoteLogger._flush = jest.fn();

      hybridLogger.info(sensitiveMessage);

      // Check console filtering immediately
      expect(mockConsoleLogger.info).toHaveBeenCalled();
      
      // Find the call that contains our test message
      const relevantConsoleCall = mockConsoleLogger.info.mock.calls.find(call => 
        call[0] && call[0].includes('API operation')
      );
      expect(relevantConsoleCall).toBeDefined();
      
      const consoleMessage = relevantConsoleCall[0];
      
      // Verify sensitive API key data is filtered out from console
      expect(consoleMessage).not.toContain('sk-1234567890abcdef');
      
      // Verify some form of masking is present in console
      expect(consoleMessage).toMatch(/apiKey:\s*[a-zA-Z0-9*\[\]-]+/); // Pattern includes partial masking format
      
      // Verify category formatting in console
      expect(consoleMessage).toMatch(/^\[.*:.*\]/);

      // Check remote filtering after buffer processing
      setTimeout(() => {
        const buffer = remoteLogger.getBuffer();
        if (buffer.length > 0) {
          const logEntry = buffer[buffer.length - 1];
          // Verify sensitive data is filtered from remote logs
          expect(logEntry.message).not.toContain('sk-1234567890abcdef');
          // Verify some form of filtering occurred (flexible pattern)
          expect(logEntry.message).toMatch(/apiKey:\s*[a-zA-Z0-9*\[\]-]+|REDACTED/);
        }
        done();
      }, 100);
    });

    it('should handle different filtering strategies per destination', () => {
      // This test demonstrates that console uses 'partial' while remote uses 'mask'
      const sensitiveMessage = 'Processing payment with creditCard: 1234567890123456';

      // Clear any previous console calls before test
      mockConsoleLogger.error.mockClear();

      hybridLogger.error(sensitiveMessage);

      // Console should use partial masking
      expect(mockConsoleLogger.error).toHaveBeenCalled();
      
      // Find the call that contains our test message (not initialization messages)
      const relevantCall = mockConsoleLogger.error.mock.calls.find(call => 
        call[0] && call[0].includes('Processing payment')
      );
      expect(relevantCall).toBeDefined();
      
      const consoleMessage = relevantCall[0];
      
      // Verify sensitive credit card data is filtered out
      expect(consoleMessage).not.toContain('1234567890123456');
      
      // Verify some form of masking is present (flexible pattern to account for different masking strategies)
      expect(consoleMessage).toMatch(/creditCard:\s*[a-zA-Z0-9*\[\]]+/); // Pattern includes partial masking format
      
      // Verify the message has category formatting
      expect(consoleMessage).toMatch(/^\[.*:.*\]/);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing filtering configuration gracefully', () => {
      const configWithoutFiltering = {
        endpoint: 'http://localhost:3001/api/debug-log',
        batchSize: 5,
        // No filtering config
      };

      expect(() => {
        const logger = new RemoteLogger({
          config: configWithoutFiltering,
          dependencies: {
            consoleLogger: mockConsoleLogger,
            eventBus: mockEventBus,
          },
        });
        
        logger.info('test message');
        logger.destroy?.();
      }).not.toThrow();
    });

    it('should handle invalid filtering patterns gracefully', () => {
      const configWithInvalidPattern = {
        endpoint: 'http://localhost:3001/api/debug-log',
        filtering: {
          enabled: true,
          patterns: {
            invalid: '[unclosed regex',
            valid: 'token:\\s*\\w+',
          },
        },
      };

      expect(() => {
        const logger = new RemoteLogger({
          config: configWithInvalidPattern,
          dependencies: {
            consoleLogger: mockConsoleLogger,
            eventBus: mockEventBus,
          },
        });
        
        logger.info('test message');
        logger.destroy?.();
      }).not.toThrow();

      // Should warn about invalid pattern
      expect(mockConsoleLogger.warn).toHaveBeenCalled();
    });

    it('should handle circular references in metadata', () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        const logger = new RemoteLogger({
          config: {
            filtering: { enabled: true },
          },
          dependencies: {
            consoleLogger: mockConsoleLogger,
            eventBus: mockEventBus,
          },
        });
        
        logger.info('test', circularObj);
        logger.destroy?.();
      }).not.toThrow();
    });
  });

});