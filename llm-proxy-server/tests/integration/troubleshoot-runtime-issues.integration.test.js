/**
 * @file Comprehensive integration tests for runtime troubleshooting issues
 * Tests all fixes implemented during the runtime troubleshooting session
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getAppConfigService } from '../../src/config/appConfig.js';
import { ConsoleLogger } from '../../src/consoleLogger.js';

describe('Runtime Troubleshooting Issues - Integration Tests', () => {
  let appConfigService;
  let logger;

  beforeEach(() => {
    logger = new ConsoleLogger();
    appConfigService = getAppConfigService(logger);
  });

  describe('LLM Configuration Count Reporting', () => {
    it('should correctly report LLM configuration count in server startup', async () => {
      // This test verifies the fix for server.js:456
      // The issue was accessing llmConfigs.llms instead of llmConfigs.configs

      // Import the LlmConfigService to test directly
      const { LlmConfigService } = await import(
        '../../src/config/llmConfigService.js'
      );
      const { NodeFileSystemReader } = await import(
        '../../src/nodeFileSystemReader.js'
      );
      const { loadProxyLlmConfigs } = await import(
        '../../src/proxyLlmConfigLoader.js'
      );

      const fileSystemReader = new NodeFileSystemReader();
      const llmConfigService = new LlmConfigService(
        fileSystemReader,
        logger,
        appConfigService,
        loadProxyLlmConfigs
      );

      await llmConfigService.initialize();
      expect(llmConfigService.isOperational()).toBe(true);

      const llmConfigs = llmConfigService.getLlmConfigs();

      // Verify the structure is correct (this was the bug - accessing .llms instead of .configs)
      expect(llmConfigs).toHaveProperty('configs');
      expect(llmConfigs).not.toHaveProperty('llms');

      // Verify count is correct (should be 4 based on config file)
      const configCount = Object.keys(llmConfigs.configs).length;
      expect(configCount).toBe(4);
      expect(configCount).toBeGreaterThan(0);
    });
  });

  describe('Cache Service Method Compatibility', () => {
    it('should verify cache service has correct method names', async () => {
      // This test verifies the fix for cache service method compatibility
      // The issues were:
      // - Health check was calling cacheService.delete() but method is cacheService.invalidate()
      // - Health check was calling cacheService.size() but method is cacheService.getSize()
      // - Health check was calling cacheService.getMemoryUsage() but method is cacheService.getMemoryInfo()

      const CacheService = (
        await import('../../src/services/cacheService.js')
      ).default;

      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const cacheService = new CacheService(mockLogger);

      // Verify the correct methods exist
      expect(typeof cacheService.invalidate).toBe('function'); // Not delete()
      expect(typeof cacheService.getSize).toBe('function'); // Not size()
      expect(typeof cacheService.getMemoryInfo).toBe('function'); // Not getMemoryUsage()

      // Test that the methods work as expected
      cacheService.set('test', 'value', 1000);
      expect(cacheService.getSize()).toBe(1);

      const memoryInfo = cacheService.getMemoryInfo();
      expect(typeof memoryInfo).toBe('object');
      expect(memoryInfo).toHaveProperty('currentBytes');

      cacheService.invalidate('test');
      expect(cacheService.getSize()).toBe(0);
    });
  });

  describe('API Key Path Configuration', () => {
    it('should have correct API key path configuration', () => {
      // Verify the API key path was updated from placeholder
      const apiKeyPath = appConfigService.getProxyProjectRootPathForApiKeyFiles();

      expect(apiKeyPath).toBeDefined();
      expect(apiKeyPath).not.toBe('/path/to/secure/api_key_files_on_server'); // Should not be placeholder
      expect(apiKeyPath).toContain('.private/api-keys'); // Should point to real path
      expect(apiKeyPath).toContain('living-narrative-engine'); // Should be in project
    });
  });

  describe('Health Check Middleware Integration', () => {
    it('should have health check middleware that calls correct LLM config methods', async () => {
      // This test verifies the fix for health check middleware LLM config count bug
      const { createReadinessCheck } = await import(
        '../../src/middleware/healthCheck.js'
      );

      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Create a mock LLM config service that returns the correct structure
      const mockLlmConfigService = {
        isOperational: jest.fn(() => true),
        getLlmConfigs: jest.fn(() => ({
          configs: {
            config1: { id: 'config1' },
            config2: { id: 'config2' },
            config3: { id: 'config3' },
            config4: { id: 'config4' },
          },
          defaultLlmId: 'config1',
        })),
        getResolvedConfigPath: jest.fn(() => '/path/to/config.json'),
      };

      // Create readiness check middleware
      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      // Mock Express request and response
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Execute the middleware
      await readinessCheck(mockReq, mockRes);

      // Verify the middleware called the correct methods
      expect(mockLlmConfigService.isOperational).toHaveBeenCalled();
      expect(mockLlmConfigService.getLlmConfigs).toHaveBeenCalled();

      // Verify the response was successful
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();

      // Verify the response structure includes correct config count
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.status).toBe('UP');
      expect(responseData.details.dependencies).toBeDefined();

      const llmConfigDep = responseData.details.dependencies.find(
        (dep) => dep.name === 'llmConfigService'
      );
      expect(llmConfigDep).toBeDefined();
      expect(llmConfigDep.details.configuredLlms).toBe(4);
    });
  });
});
