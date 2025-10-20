/**
 * @file llm-request-service-structured-prompt.integration.test.js
 * @description Exercises LlmRequestService's payload sanitization when non-string prompt
 *              structures are provided to ensure logging fallbacks behave without mutation.
 */

import { afterEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import http from 'http';

import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';

const envSnapshot = new Map();

/**
 * Records the original environment variable value (if not already captured)
 * and applies the provided value.
 * @param {string} key
 * @param {string | undefined} value
 */
function setEnv(key, value) {
  if (!envSnapshot.has(key)) {
    envSnapshot.set(key, process.env[key]);
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * Restores environment variables mutated via setEnv during the tests.
 */
function restoreEnv() {
  for (const [key, value] of envSnapshot.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  envSnapshot.clear();
}

/**
 * Creates a structured logger compatible with the services under test.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

/**
 * Spins up an Express server bound to a random local port for testing.
 * @param {(app: import('express').Express) => void} initializeRoutes
 * @returns {Promise<{ port: number, close: () => Promise<void> }>} server helpers
 */
async function createTestServer(initializeRoutes) {
  const app = express();
  app.use(express.json());
  initializeRoutes(app);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

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
 * @param {{ logger?: ReturnType<typeof createLogger>, nodeEnv?: string, httpAgentEnabled?: boolean }} [options]
 * @returns {Promise<{ service: LlmRequestService, httpAgentService: HttpAgentService, logger: ReturnType<typeof createLogger>, cleanup: () => Promise<void> }>}
 */
async function createService(options = {}) {
  const {
    logger = createLogger(),
    nodeEnv = 'test',
    httpAgentEnabled = false,
  } = options;

  setEnv('NODE_ENV', nodeEnv);
  setEnv('HTTP_AGENT_ENABLED', httpAgentEnabled ? 'true' : 'false');

  resetAppConfigServiceInstance();
  const appConfig = getAppConfigService(logger);
  const httpAgentService = new HttpAgentService(
    logger,
    appConfig.getHttpAgentConfig()
  );

  const service = new LlmRequestService(
    logger,
    httpAgentService,
    appConfig,
    RetryManager
  );

  return {
    service,
    httpAgentService,
    logger,
    cleanup: async () => {
      httpAgentService.cleanup();
      resetAppConfigServiceInstance();
    },
  };
}

describe('LlmRequestService structured prompt integration', () => {
  afterEach(() => {
    restoreEnv();
  });

  test('preserves non-string prompt payloads while logging sanitized previews', async () => {
    const { service, logger, cleanup } = await createService({
      httpAgentEnabled: false,
    });

    const received = {};
    const server = await createTestServer((app) => {
      app.post('/structured', (req, res) => {
        received.headers = req.headers;
        received.body = req.body;
        res.json({ ok: true, echoed: req.body });
      });
    });

    try {
      const structuredPrompt = {
        instructions: 'Use available tools when appropriate.',
        metadata: { attempt: 1, origin: 'integration-test' },
      };
      const payload = {
        prompt: structuredPrompt,
        extra: { allowFallback: true },
      };

      const response = await service.forwardRequest(
        'structured-llm',
        {
          displayName: 'Structured Prompt LLM',
          apiType: 'custom',
          endpointUrl: `http://127.0.0.1:${server.port}/structured`,
          defaultParameters: {
            maxRetries: 1,
            baseDelayMs: 5,
            maxDelayMs: 10,
          },
        },
        payload,
        { 'X-Trace-Id': 'structured-flow' },
        'structured-secret'
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(received.body).toEqual(payload);
      expect(received.headers['x-trace-id']).toBe('structured-flow');

      const sanitizedPreviewCall = logger.debug.mock.calls.find(([message]) =>
        message.includes('Sanitized Target Payload Preview')
      );
      expect(sanitizedPreviewCall).toBeDefined();
      const sanitizedPayload = sanitizedPreviewCall[1].payload;

      expect(sanitizedPayload.prompt).toBe(structuredPrompt);
      expect(sanitizedPayload.extra).toEqual({ allowFallback: true });
      expect(typeof sanitizedPayload.prompt).toBe('object');
    } finally {
      await server.close();
      await cleanup();
    }
  });
});
