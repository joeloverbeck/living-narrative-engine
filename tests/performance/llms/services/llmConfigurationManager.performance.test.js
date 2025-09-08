/**
 * @file Performance tests for LLMConfigurationManager service
 * @description Tests concurrency, load handling, and performance characteristics
 * @see src/llms/services/llmConfigurationManager.js
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { LLMConfigurationManager } from '../../../../src/llms/services/llmConfigurationManager.js';

describe('LLMConfigurationManager Performance Tests', () => {
  let mockLogger;
  let mockConfigLoader;

  const mockConfig = {
    defaultConfigId: 'gpt-4',
    configs: {
      'gpt-4': {
        configId: 'gpt-4',
        displayName: 'GPT-4',
        modelIdentifier: 'gpt-4',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
        jsonOutputStrategy: { method: 'native_json' },
        promptElements: [],
        promptAssemblyOrder: [],
        contextTokenLimit: 8192,
      },
      claude: {
        configId: 'claude',
        displayName: 'Claude 3',
        modelIdentifier: 'claude-3-opus',
        endpointUrl: 'https://api.anthropic.com/v1/messages',
        apiType: 'anthropic',
        jsonOutputStrategy: { method: 'native_json' },
        promptElements: [],
        promptAssemblyOrder: [],
        contextTokenLimit: 200000,
      },
    },
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfigLoader = {
      loadConfigs: jest.fn(),
    };
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent init calls', async () => {
      const configManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);

      const init1 = configManager.init({ llmConfigLoader: mockConfigLoader });
      const init2 = configManager.init({ llmConfigLoader: mockConfigLoader });

      await Promise.all([init1, init2]);

      // Should only load configs once despite concurrent calls
      expect(mockConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Initialization already in progress')
      );
    });

    it('should handle rapid sequential init calls', async () => {
      const configManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);

      // Simulate rapid sequential calls
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          configManager.init({ llmConfigLoader: mockConfigLoader })
        );
      }

      await Promise.all(promises);

      // Should only load configs once
      expect(mockConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
      expect(configManager.isInitialized()).toBe(true);
      expect(configManager.isOperational()).toBe(true);
    });

    it('should handle concurrent configuration changes', async () => {
      const configManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      // Simulate concurrent configuration changes
      const promises = [];
      const configIds = ['gpt-4', 'claude', 'gpt-4', 'claude'];

      for (const configId of configIds) {
        promises.push(configManager.setActiveConfiguration(configId));
      }

      const results = await Promise.all(promises);

      // All operations should succeed
      expect(results.every((result) => result === true)).toBe(true);

      // Final active config should be one of the valid ones
      const activeId = await configManager.getActiveConfigId();
      expect(['gpt-4', 'claude']).toContain(activeId);
    });

    it('should handle concurrent reads during initialization', async () => {
      const configManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // Simulate slow config loading
      mockConfigLoader.loadConfigs.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockConfig), 100);
          })
      );

      const initPromise = configManager.init({
        llmConfigLoader: mockConfigLoader,
      });

      // Try to read configurations while initialization is in progress
      const readPromises = [
        configManager.getActiveConfigId(),
        configManager.getAvailableOptions(),
        configManager.getAllConfigurations().catch(() => null),
      ];

      await initPromise;
      const results = await Promise.all(readPromises);

      // Verify that concurrent reads don't crash and return expected values
      // The reads during initialization should return safe defaults
      expect([null, 'gpt-4', 'claude']).toContain(results[0]); // Could be null or any valid config
      expect(Array.isArray(results[1])).toBe(true); // Should return an array (empty or with options)
      
      // After initialization completes, verify the manager is operational
      expect(configManager.isOperational()).toBe(true);
      
      // Now that it's initialized, subsequent reads should work correctly
      const postInitActiveId = await configManager.getActiveConfigId();
      expect(['gpt-4', 'claude']).toContain(postInitActiveId);
    });
  });

  describe('Load Testing', () => {
    it('should handle high-frequency configuration switching', async () => {
      const configManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const startTime = Date.now();
      const iterations = 100;
      const promises = [];

      for (let i = 0; i < iterations; i++) {
        const configId = i % 2 === 0 ? 'gpt-4' : 'claude';
        promises.push(configManager.setActiveConfiguration(configId));
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertion: should complete 100 switches in under 1 second
      expect(duration).toBeLessThan(1000);

      // Verify last configuration is set correctly
      const activeId = await configManager.getActiveConfigId();
      expect(['gpt-4', 'claude']).toContain(activeId);
    });

    it('should maintain performance with many configuration lookups', async () => {
      const configManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const startTime = Date.now();
      const iterations = 1000;
      const promises = [];

      for (let i = 0; i < iterations; i++) {
        if (i % 3 === 0) {
          promises.push(configManager.getActiveConfiguration());
        } else if (i % 3 === 1) {
          promises.push(configManager.loadConfiguration('gpt-4'));
        } else {
          promises.push(configManager.loadConfiguration('claude'));
        }
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertion: 1000 lookups should complete quickly
      expect(duration).toBeLessThan(500);

      // Verify all lookups returned valid results
      expect(results.every((result) => result !== null)).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during repeated initialization attempts', async () => {
      const iterations = 50;
      const managers = [];

      for (let i = 0; i < iterations; i++) {
        const manager = new LLMConfigurationManager({
          logger: mockLogger,
          initialLlmId: `config-${i}`,
        });

        mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
        await manager.init({ llmConfigLoader: mockConfigLoader });
        managers.push(manager);
      }

      // Verify all managers are operational
      expect(managers.every((m) => m.isOperational())).toBe(true);

      // No specific memory assertions here, but this test helps identify
      // memory leaks when run with memory profiling tools
    });

    it('should handle initialization failures gracefully under load', async () => {
      const promises = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const manager = new LLMConfigurationManager({
          logger: mockLogger,
          initialLlmId: null,
        });

        // Create a separate mock for each manager to avoid shared state issues
        const localMockConfigLoader = {
          loadConfigs: jest.fn(),
        };

        // Alternate between success and failure
        if (i % 2 === 0) {
          localMockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
          promises.push(
            manager
              .init({ llmConfigLoader: localMockConfigLoader })
              .then(() => ({ success: true, manager, operational: true }))
          );
        } else {
          localMockConfigLoader.loadConfigs.mockResolvedValue({
            error: true,
            message: 'Load failed',
          });
          promises.push(
            manager
              .init({ llmConfigLoader: localMockConfigLoader })
              .then(() => ({ 
                success: true, 
                manager, 
                operational: manager.isOperational() 
              }))
          );
        }
      }

      const results = await Promise.all(promises);

      // All should complete without throwing
      expect(results.length).toBe(iterations);

      // Verify operational status based on config loading result
      const operational = results.filter((r) => r.operational);
      const nonOperational = results.filter((r) => !r.operational);

      expect(operational.length).toBe(10); // Half should be operational
      expect(nonOperational.length).toBe(10); // Half should not be operational

      // Verify managers have correct operational status
      operational.forEach(({ manager }) => {
        expect(manager.isOperational()).toBe(true);
      });

      nonOperational.forEach(({ manager }) => {
        expect(manager.isOperational()).toBe(false);
      });
    });
  });
});