/**
 * @file Tests for E2E Test Container Builder
 * Verifies the e2eTestContainer utility properly creates production
 * containers with real services while stubbing external dependencies.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createE2ETestEnvironment } from './e2eTestContainer.js';

describe('E2E Test Container', () => {
  let env;

  afterEach(async () => {
    if (env) {
      await env.cleanup();
      env = null;
    }
  });

  describe('Container Creation', () => {
    it('should create container with production registrations', async () => {
      env = await createE2ETestEnvironment();
      expect(env.container).toBeDefined();
      expect(typeof env.container.resolve).toBe('function');
      expect(typeof env.container.isRegistered).toBe('function');
    });

    it('should resolve services without explicit options', async () => {
      env = await createE2ETestEnvironment();
      expect(env.services.entityManager).toBeDefined();
    });
  });

  describe('LLM Stubbing', () => {
    it('should stub LLM adapter by default', async () => {
      env = await createE2ETestEnvironment();
      // LLM is stubbed - verify by checking the stub function exists
      expect(env.stubLLM).toBeInstanceOf(Function);
    });

    it('should allow configuring LLM stub responses', async () => {
      env = await createE2ETestEnvironment({
        defaultLLMResponse: { actionId: 'core:look' },
      });
      // Change the stub response - should not throw
      env.stubLLM({ actionId: 'core:wait' });

      // Verify the new response is used
      const llmAdapter = env.container.resolve('LLMAdapter');
      const result = await llmAdapter.getAIDecision({});
      expect(JSON.parse(result).actionId).toBe('core:wait');
    });

    it('should return JSON string from LLM stub when object is provided', async () => {
      const testResponse = { actionId: 'test:action', thought: 'test thought' };
      env = await createE2ETestEnvironment({
        defaultLLMResponse: testResponse,
      });

      // Get the LLM adapter stub directly from the container to test it
      const llmAdapter = env.container.resolve('LLMAdapter');
      const result = await llmAdapter.getAIDecision({});

      expect(typeof result).toBe('string');
      expect(JSON.parse(result)).toEqual(testResponse);
    });

    it('should return string directly from LLM stub when string is provided', async () => {
      const testResponse = '{"actionId": "test:action"}';
      env = await createE2ETestEnvironment({
        stubLLM: true,
      });
      env.stubLLM(testResponse);

      const llmAdapter = env.container.resolve('LLMAdapter');
      const result = await llmAdapter.getAIDecision({});

      expect(result).toBe(testResponse);
    });

    it('should allow disabling LLM stubbing', async () => {
      // When stubLLM is false, the real LLM adapter should be registered
      // We just verify the environment still creates successfully
      env = await createE2ETestEnvironment({
        stubLLM: false,
      });

      expect(env.services.entityManager).toBeDefined();
      // stubLLM function still exists but calling it would override
      expect(env.stubLLM).toBeInstanceOf(Function);
    });
  });

  describe('Service Resolution', () => {
    beforeEach(async () => {
      env = await createE2ETestEnvironment();
    });

    it('should resolve entityManager from container', () => {
      expect(env.services.entityManager).toBeDefined();
      expect(typeof env.services.entityManager.createEntityInstance).toBe('function');
    });

    it('should resolve actionDiscoveryService from container', () => {
      expect(env.services.actionDiscoveryService).toBeDefined();
    });

    it('should resolve actionExecutor from container', () => {
      expect(env.services.actionExecutor).toBeDefined();
    });

    it('should resolve eventBus from container', () => {
      expect(env.services.eventBus).toBeDefined();
      expect(typeof env.services.eventBus.dispatch).toBe('function');
    });

    it('should resolve logger from container', () => {
      expect(env.services.logger).toBeDefined();
      expect(typeof env.services.logger.info).toBe('function');
      expect(typeof env.services.logger.error).toBe('function');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on dispose', async () => {
      env = await createE2ETestEnvironment();
      await env.cleanup();
      // Container should be cleaned up (no error thrown)
      // Verify container is still accessible but cleanup was called
      expect(env.container).toBeDefined();
      env = null; // Prevent double cleanup in afterEach
    });

    it('should not affect production services', async () => {
      env = await createE2ETestEnvironment();
      await env.cleanup();

      // Create a fresh environment - should work independently
      const env2 = await createE2ETestEnvironment();
      expect(env2.services.entityManager).toBeDefined();
      await env2.cleanup();
      env = null; // Prevent afterEach cleanup
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple environment creations', async () => {
      // Create first environment
      env = await createE2ETestEnvironment();
      const firstEntityManager = env.services.entityManager;

      // Cleanup first
      await env.cleanup();

      // Create second environment
      env = await createE2ETestEnvironment();
      const secondEntityManager = env.services.entityManager;

      // They should be different instances
      expect(firstEntityManager).not.toBe(secondEntityManager);
    });

    it('should provide LLM stub with getCurrentActiveLlmId method', async () => {
      env = await createE2ETestEnvironment();

      const llmAdapter = env.container.resolve('LLMAdapter');
      expect(typeof llmAdapter.getCurrentActiveLlmId).toBe('function');
      expect(llmAdapter.getCurrentActiveLlmId()).toBe('stub-llm');
    });

    it('should allow updating LLM stub response after creation', async () => {
      env = await createE2ETestEnvironment({
        defaultLLMResponse: { actionId: 'core:wait' },
      });

      // Update response
      env.stubLLM({ actionId: 'core:look', thought: 'looking around' });

      // Verify new response is used
      const llmAdapter = env.container.resolve('LLMAdapter');
      const result = await llmAdapter.getAIDecision({});
      const parsed = JSON.parse(result);

      expect(parsed.actionId).toBe('core:look');
      expect(parsed.thought).toBe('looking around');
    });
  });
});
