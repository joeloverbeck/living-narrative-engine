/**
 * @file llm-request-service.error-paths.integration.test.js
 * @description Integration tests covering unhandled error branches of LlmRequestService
 *              using real collaborators where possible.
 */

import { afterEach, describe, expect, it } from '@jest/globals';
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
 * Spins up a temporary HTTP server for exercising LLM provider interactions.
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
 * Builds a fully wired LlmRequestService instance with configurable collaborators.
 * @param {{ httpAgentEnabled?: boolean, retryManagerClass?: typeof RetryManager }} [options]
 * @returns {Promise<{
 *   service: LlmRequestService,
 *   httpAgentService: HttpAgentService,
 *   cleanup: () => Promise<void>
 * }>}
 */
async function createService(options = {}) {
  const { httpAgentEnabled = true, retryManagerClass = RetryManager } = options;

  const previousNodeEnv = process.env.NODE_ENV;
  const previousHttpAgentEnabled = process.env.HTTP_AGENT_ENABLED;

  process.env.NODE_ENV = 'test';
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
    retryManagerClass
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

describe('LlmRequestService integration error coverage', () => {
  afterEach(() => {
    resetAppConfigServiceInstance();
  });

  it('maps provider server errors to bad gateway responses while preserving previews', async () => {
    const { service, cleanup } = await createService({
      httpAgentEnabled: true,
    });

    const server = await createTestServer((app) => {
      app.post('/server-error', (_req, res) => {
        res.status(503).json({ error: 'provider down for maintenance' });
      });
    });

    try {
      const payload = {
        messages: [
          { role: 'system', content: 'Testing resilient server handling.' },
          // second message lacks string content to exercise non-string sanitization branch
          { role: 'assistant', content: null },
        ],
      };

      const llmModelConfig = {
        displayName: 'Unstable LLM',
        apiType: 'openai',
        endpointUrl: `http://127.0.0.1:${server.port}/server-error`,
        defaultParameters: {
          maxRetries: 1,
          baseDelayMs: 1,
          maxDelayMs: 5,
        },
      };

      const result = await service.forwardRequest(
        'unstable-llm',
        llmModelConfig,
        payload,
        {
          Authorization: 'client-token-should-be-stripped',
          'Content-Type': 'application/custom',
        },
        'proxy-secret-key'
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(502);
      expect(result.errorStage).toBe('llm_forwarding_server_error_bad_gateway');
      expect(result.errorMessage).toContain('server-side error');
      expect(result.errorDetailsForClient.llmApiStatusCode).toBe(503);
      expect(result.errorDetailsForClient.llmApiResponseBodyPreview).toContain(
        'provider down'
      );
    } finally {
      await server.close();
      await cleanup();
    }
  });

  it('reports unexpected provider statuses when responses are outside the 4xx/5xx range', async () => {
    const { service, cleanup } = await createService({
      httpAgentEnabled: true,
    });

    const server = await createTestServer((app) => {
      app.post('/strange-status', (_req, res) => {
        res.status(399).json({ notice: 'Non standard response from upstream' });
      });
    });

    try {
      const llmModelConfig = {
        displayName: 'Odd Status LLM',
        apiType: 'openai',
        endpointUrl: `http://127.0.0.1:${server.port}/strange-status`,
        defaultParameters: {
          maxRetries: 1,
          baseDelayMs: 1,
          maxDelayMs: 5,
        },
      };

      const result = await service.forwardRequest(
        'odd-status-llm',
        llmModelConfig,
        { prompt: 'trigger unexpected status' }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.errorStage).toBe('llm_forwarding_unexpected_llm_status');
      expect(result.errorMessage).toContain('unexpected status');
      expect(result.errorDetailsForClient.llmApiStatusCode).toBe(399);
      expect(result.errorDetailsForClient.llmApiResponseBodyPreview).toContain(
        'Non standard response'
      );
    } finally {
      await server.close();
      await cleanup();
    }
  });

  it('logs unrecognized retry failures with the generic forwarding error stage', async () => {
    class FailingRetryManager {
      constructor(url, options, maxRetries, baseDelayMs, maxDelayMs, logger) {
        this.url = url;
        this.options = options;
        this.maxRetries = maxRetries;
        this.baseDelayMs = baseDelayMs;
        this.maxDelayMs = maxDelayMs;
        this.logger = logger;
      }

      async executeWithRetry() {
        throw new Error('catastrophic handshake failure in upstream library');
      }
    }

    const { service, cleanup } = await createService({
      httpAgentEnabled: true,
      retryManagerClass: FailingRetryManager,
    });

    try {
      const llmModelConfig = {
        displayName: 'Broken Retry LLM',
        apiType: 'openai',
        endpointUrl: 'http://127.0.0.1:65530/unreachable',
        defaultParameters: {
          maxRetries: 1,
          baseDelayMs: 1,
          maxDelayMs: 5,
        },
      };

      const result = await service.forwardRequest(
        'broken-retry-llm',
        llmModelConfig,
        { messages: [{ role: 'user', content: 'please fail gracefully' }] }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.errorStage).toBe('llm_forwarding_error_unknown');
      expect(result.errorMessage).toContain('Proxy failed to get a response');
      expect(result.errorDetailsForClient.originalErrorMessage).toContain(
        'catastrophic handshake failure'
      );
    } finally {
      await cleanup();
    }
  });
});
