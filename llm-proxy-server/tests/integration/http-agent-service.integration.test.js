/**
 * @file http-agent-service.integration.test.js
 * @description Integration tests for HttpAgentService exercising real interactions with LlmRequestService
 *              and live HTTP servers to validate connection pooling and adaptive cleanup.
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';
import express from 'express';
import http from 'http';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Creates an Express server bound to a random ephemeral port for integration testing.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>} helper methods for the server
 */
async function createEchoServer() {
  const app = express();
  app.use(express.json());

  let requestCounter = 0;
  app.post('/relay', (req, res) => {
    requestCounter += 1;
    res.json({
      counter: requestCounter,
      received: req.body,
      headersEcho: {
        client: req.headers['x-client-tag'],
        provider: req.headers['x-provider'],
      },
    });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    port,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/**
 * Builds an HttpAgentService wired with the real application configuration and logger.
 * @param {ConsoleLogger} logger
 * @returns {{ httpAgentService: HttpAgentService, appConfigService: import('../../src/config/appConfig.js').AppConfigService, cleanup: () => void }}
 */
function buildHttpAgentEnvironment(logger) {
  resetAppConfigServiceInstance();
  const appConfigService = getAppConfigService(logger);

  const httpAgentService = new HttpAgentService(logger, {
    ...appConfigService.getHttpAgentConfig(),
    baseCleanupIntervalMs: 50,
    minCleanupIntervalMs: 25,
    maxCleanupIntervalMs: 120,
    idleThresholdMs: 20,
    highLoadRequestsPerMin: 1,
    memoryThresholdMB: 0.0001,
  });

  return {
    httpAgentService,
    appConfigService,
    cleanup: () => {
      httpAgentService.cleanup();
      resetAppConfigServiceInstance();
    },
  };
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_HTTP_AGENT_ENABLED = process.env.HTTP_AGENT_ENABLED;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.HTTP_AGENT_ENABLED = 'true';
});

afterAll(() => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }

  if (ORIGINAL_HTTP_AGENT_ENABLED === undefined) {
    delete process.env.HTTP_AGENT_ENABLED;
  } else {
    process.env.HTTP_AGENT_ENABLED = ORIGINAL_HTTP_AGENT_ENABLED;
  }
});

describe('HttpAgentService integration behavior', () => {
  test('pools HTTP agents across LLM requests and performs adaptive cleanup', async () => {
    const logger = new ConsoleLogger();
    const { port, close } = await createEchoServer();
    const { httpAgentService, appConfigService, cleanup } =
      buildHttpAgentEnvironment(logger);
    const llmRequestService = new LlmRequestService(
      logger,
      httpAgentService,
      appConfigService,
      RetryManager
    );

    const endpointUrl = `http://127.0.0.1:${port}/relay`;
    const llmModelConfig = {
      displayName: 'Integration Echo',
      apiType: 'openai',
      endpointUrl,
      providerSpecificHeaders: {
        'X-Provider': 'integration-test',
      },
      defaultParameters: {
        maxRetries: 0,
        baseDelayMs: 1,
        maxDelayMs: 2,
      },
    };

    const requestPayloads = [
      { prompt: 'first-pass' },
      { prompt: 'second-pass' },
    ];

    try {
      for (const [index, payload] of requestPayloads.entries()) {
        const response = await llmRequestService.forwardRequest(
          'integration-llm',
          llmModelConfig,
          payload,
          { 'X-Client-Tag': `client-${index + 1}` },
          'api-key-value'
        );

        expect(response.success).toBe(true);
        expect(response.statusCode).toBe(200);
        expect(response.data).toMatchObject({
          counter: index + 1,
          received: payload,
          headersEcho: {
            client: `client-${index + 1}`,
            provider: 'integration-test',
          },
        });
      }

      const statsAfterRequests = httpAgentService.getStats();
      expect(statsAfterRequests.activeAgents).toBe(1);
      expect(statsAfterRequests.requestsServed).toBeGreaterThanOrEqual(2);
      expect(
        statsAfterRequests.agentDetails[0].requestCount
      ).toBeGreaterThanOrEqual(1);

      // Destroy the agent explicitly to verify lifecycle management works with real requests
      expect(httpAgentService.hasAgent(endpointUrl)).toBe(true);
      expect(httpAgentService.destroyAgent(endpointUrl)).toBe(true);
      expect(httpAgentService.hasAgent(endpointUrl)).toBe(false);

      // Re-issue a request to recreate the agent and then force idle cleanup through time travel
      const thirdResponse = await llmRequestService.forwardRequest(
        'integration-llm',
        llmModelConfig,
        { prompt: 'third-pass' },
        { 'X-Client-Tag': 'client-3' },
        'api-key-value'
      );
      expect(thirdResponse.success).toBe(true);

      const futureTime = Date.now() + 10 * 60 * 1000;
      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => futureTime);
      const cleaned = httpAgentService.cleanupIdleAgents(100);
      nowSpy.mockRestore();
      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(httpAgentService.getActiveAgentCount()).toBe(0);

      // Adaptive cleanup and enhanced stats should reflect the cleanup operation
      const enhancedStats = httpAgentService.getEnhancedStats();
      expect(
        enhancedStats.adaptiveCleanup.cleanupOperations
      ).toBeGreaterThanOrEqual(0);
      expect(enhancedStats.agentDetails).toHaveLength(0);

      const forcedCleanupResult = httpAgentService.forceAdaptiveCleanup();
      expect(forcedCleanupResult.currentAgentCount).toBe(0);
      expect(forcedCleanupResult.agentsRemoved).toBeGreaterThanOrEqual(0);

      httpAgentService.updateConfig({ maxSockets: 99 });
      expect(httpAgentService.getConfig().maxSockets).toBe(99);
    } finally {
      await close();
      cleanup();
    }
  });

  test('surfaces invalid URL usage errors and maintains stability', () => {
    const logger = new ConsoleLogger();
    const { httpAgentService, cleanup } = buildHttpAgentEnvironment(logger);

    try {
      expect(() => httpAgentService.getFetchOptions('not-a-valid-url')).toThrow(
        /Invalid URL/
      );
      expect(httpAgentService.destroyAgent('still-not-a-url')).toBe(false);
      expect(httpAgentService.hasAgent('again-not-a-url')).toBe(false);
    } finally {
      cleanup();
    }
  });
});
