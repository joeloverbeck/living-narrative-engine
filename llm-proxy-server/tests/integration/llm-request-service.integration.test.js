/**
 * @file llm-request-service.integration.test.js
 * @description Integration tests exercising LlmRequestService with real dependencies
 */

import { describe, test, expect } from '@jest/globals';
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
 * Helper to start an Express test server and return its port and shutdown function.
 * @param {(app: import('express').Express) => void} routeInitializer
 * @returns {Promise<{ port: number, close: () => Promise<void> }>} server helpers
 */
async function createTestServer(routeInitializer) {
  const app = express();
  app.use(express.json());
  routeInitializer(app);

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
 * Creates a fully wired LlmRequestService instance with real collaborators.
 * @param {{ nodeEnv?: string, httpAgentEnabled?: boolean }} [options]
 * @returns {Promise<{ service: LlmRequestService, httpAgentService: HttpAgentService, cleanup: () => Promise<void> }>}
 */
async function createService(options = {}) {
  const { nodeEnv = 'test', httpAgentEnabled = true } = options;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousHttpAgentEnabled = process.env.HTTP_AGENT_ENABLED;

  process.env.NODE_ENV = nodeEnv;
  process.env.HTTP_AGENT_ENABLED = httpAgentEnabled ? 'true' : 'false';

  resetAppConfigServiceInstance();
  const logger = new ConsoleLogger();
  const appConfigService = getAppConfigService(logger);
  const httpAgentService = new HttpAgentService(
    logger,
    appConfigService.getHttpAgentConfig()
  );
  const service = new LlmRequestService(
    logger,
    httpAgentService,
    appConfigService,
    RetryManager
  );

  return {
    service,
    httpAgentService,
    cleanup: async () => {
      httpAgentService.cleanup();
      resetAppConfigServiceInstance();

      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }

      if (previousHttpAgentEnabled === undefined) {
        delete process.env.HTTP_AGENT_ENABLED;
      } else {
        process.env.HTTP_AGENT_ENABLED = previousHttpAgentEnabled;
      }
    },
  };
}

describe('LlmRequestService integration', () => {
  test('successfully forwards request to provider with sanitized headers', async () => {
    const { service, httpAgentService, cleanup } = await createService({
      nodeEnv: 'test',
      httpAgentEnabled: true,
    });

    const server = await createTestServer((app) => {
      app.post('/llm', (req, res) => {
        res.json({ provider: 'ok', echo: req.body });
      });
    });

    try {
      const llmModelConfig = {
        displayName: 'Local Test LLM',
        apiType: 'openai',
        endpointUrl: `http://127.0.0.1:${server.port}/llm`,
        providerSpecificHeaders: {
          'X-Provider': 'alpha',
          Authorization: 'ignored-provider-token',
          'Content-Type': 'ignored/type',
        },
        defaultParameters: {
          maxRetries: 1,
          baseDelayMs: 5,
          maxDelayMs: 10,
        },
      };

      const clientHeaders = {
        'X-Custom-Header': 'client-value',
        Authorization: 'should-not-pass',
        'Content-Type': 'client/type',
      };

      const payload = {
        messages: [
          {
            role: 'user',
            content: 'A'.repeat(120),
          },
        ],
      };

      const response = await service.forwardRequest(
        'local-llm',
        llmModelConfig,
        payload,
        clientHeaders,
        'secret-key'
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(response.contentTypeIfSuccess).toBe('application/json');
      expect(response.data).toEqual({ provider: 'ok', echo: payload });

      const agentStats = httpAgentService.getStats();
      expect(agentStats.activeAgents).toBeGreaterThanOrEqual(1);
      expect(
        agentStats.agentDetails.some((stat) => stat.requestCount >= 1)
      ).toBe(true);
    } finally {
      await server.close();
      await cleanup();
    }
  });

  test('returns configuration error when endpoint is missing', async () => {
    const { service, cleanup } = await createService({
      nodeEnv: 'test',
      httpAgentEnabled: false,
    });

    try {
      const result = await service.forwardRequest(
        'broken-llm',
        {
          displayName: 'Broken LLM',
          apiType: 'openai',
          endpointUrl: '   ',
        },
        { prompt: 'Hello world' }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.errorStage).toBe('llm_config_invalid_endpoint_url');
      expect(result.errorDetailsForClient.llmId).toBe('broken-llm');
    } finally {
      await cleanup();
    }
  });

  test('relays provider client error details with production sanitization', async () => {
    const { service, cleanup } = await createService({
      nodeEnv: 'production',
      httpAgentEnabled: false,
    });

    const server = await createTestServer((app) => {
      app.post('/fail', (_req, res) => {
        res
          .status(429)
          .json({ error: 'Too many requests, please retry later.' });
      });
    });

    try {
      const llmModelConfig = {
        displayName: 'Strict LLM',
        apiType: 'openai',
        endpointUrl: `http://127.0.0.1:${server.port}/fail`,
        defaultParameters: {
          maxRetries: 1,
          baseDelayMs: 1,
          maxDelayMs: 1,
        },
      };

      const result = await service.forwardRequest(
        'strict-llm',
        llmModelConfig,
        { prompt: 'trigger error' },
        {},
        null
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.errorStage).toBe('llm_forwarding_client_error_relayed');
      expect(result.errorMessage).toContain('client-side error');
      expect(result.errorDetailsForClient.llmApiStatusCode).toBe(429);
      expect(result.errorDetailsForClient.llmApiResponseBodyPreview).toContain(
        'Too many requests'
      );
      expect(result.errorDetailsForClient.originalErrorMessage).toBe(
        'Internal error occurred'
      );
    } finally {
      await server.close();
      await cleanup();
    }
  });

  test('reports network exhaustion when provider is unreachable', async () => {
    const { service, cleanup } = await createService({
      nodeEnv: 'test',
      httpAgentEnabled: false,
    });

    try {
      const result = await service.forwardRequest(
        'offline-llm',
        {
          displayName: 'Offline LLM',
          apiType: 'openai',
          endpointUrl: 'http://127.0.0.1:59999/unreachable',
          defaultParameters: {
            maxRetries: 2,
            baseDelayMs: 5,
            maxDelayMs: 10,
          },
        },
        { messages: [{ role: 'user', content: 'Hello' }] }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(504);
      expect(result.errorStage).toBe(
        'llm_forwarding_network_or_retry_exhausted'
      );
      expect(result.errorMessage).toContain('network issue');
      expect(
        result.errorDetailsForClient.originalProxiedErrorMessage
      ).toBeDefined();
    } finally {
      await cleanup();
    }
  });
});
