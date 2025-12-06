/**
 * @file llm-request-service-sanitization.integration.test.js
 * @description Integration coverage for LlmRequestService focusing on header forwarding
 * and error response preview handling that previously lacked instrumentation hits.
 */

import { describe, test, expect, jest } from '@jest/globals';
import express from 'express';
import http from 'http';

import {
  PAYLOAD_SANITIZATION_MAX_LENGTH,
  PAYLOAD_SANITIZATION_ELLIPSIS,
} from '../../src/config/constants.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';

const envSnapshot = new Map();

/**
 * Records the original environment variable value (if not already recorded)
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

describe('LlmRequestService sanitization and preview integration', () => {
  afterEach(() => {
    restoreEnv();
  });

  test('forwards prompt-based requests while filtering headers and truncating payload previews', async () => {
    const { service, logger, cleanup } = await createService({
      httpAgentEnabled: false,
    });

    const received = {};
    const server = await createTestServer((app) => {
      app.post('/prompt', (req, res) => {
        received.headers = req.headers;
        received.body = req.body;
        res.json({ ok: true, echoed: req.body });
      });
    });

    try {
      const inheritedHeaders = { 'X-Inherited': 'skip-me' };
      const clientHeaders = Object.create(inheritedHeaders);
      clientHeaders['X-Trace-Id'] = 'client-value';
      clientHeaders['Content-Type'] = 'text/plain';
      clientHeaders.Authorization = 'client-token';

      const llmConfig = {
        displayName: 'Prompt Only LLM',
        apiType: 'custom',
        endpointUrl: `http://127.0.0.1:${server.port}/prompt`,
        providerSpecificHeaders: {
          'X-Provider-Hint': 'alpha',
          Authorization: 'provider-token',
          'Content-Type': 'provider/type',
        },
      };

      const prompt = 'Z'.repeat(PAYLOAD_SANITIZATION_MAX_LENGTH + 42);
      const response = await service.forwardRequest(
        'prompt-llm',
        llmConfig,
        { prompt },
        clientHeaders,
        'secret-api-key'
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(received.headers).toBeDefined();
      expect(received.body).toEqual({ prompt });

      expect(received.headers['x-trace-id']).toBe('client-value');
      expect(received.headers['x-provider-hint']).toBe('alpha');
      expect(received.headers['authorization']).toBe('Bearer secret-api-key');
      expect(received.headers['content-type']).toBe('application/json');
      expect(received.headers).not.toHaveProperty('x-inherited');
      expect(received.headers['content-length']).toBeDefined();

      const sanitizedPreviewCall = logger.debug.mock.calls.find(([message]) =>
        message.includes('Sanitized Target Payload Preview')
      );
      expect(sanitizedPreviewCall).toBeDefined();
      const sanitizedPayload = sanitizedPreviewCall[1].payload;
      expect(
        sanitizedPayload.prompt.endsWith(PAYLOAD_SANITIZATION_ELLIPSIS)
      ).toBe(true);
      expect(sanitizedPayload.prompt.length).toBe(
        PAYLOAD_SANITIZATION_MAX_LENGTH + PAYLOAD_SANITIZATION_ELLIPSIS.length
      );
    } finally {
      await server.close();
      await cleanup();
    }
  });

  test('captures unexpected provider status codes with trimmed error previews', async () => {
    const { service, logger, cleanup } = await createService({
      nodeEnv: 'production',
      httpAgentEnabled: false,
    });

    const longError = 'X'.repeat(240);
    const server = await createTestServer((app) => {
      app.post('/mystery', (_req, res) => {
        res.status(399).json({ error: longError });
      });
    });

    try {
      const result = await service.forwardRequest(
        'mystery-llm',
        {
          displayName: 'Mystery LLM',
          apiType: 'custom',
          endpointUrl: `http://127.0.0.1:${server.port}/mystery`,
          defaultParameters: {
            maxRetries: 1,
            baseDelayMs: 1,
            maxDelayMs: 2,
          },
        },
        { prompt: 'trigger' }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.errorStage).toBe('llm_forwarding_unexpected_llm_status');
      expect(result.errorDetailsForClient.llmApiStatusCode).toBe(399);
      expect(
        result.errorDetailsForClient.llmApiResponseBodyPreview.endsWith('...')
      ).toBe(true);
      expect(
        result.errorDetailsForClient.llmApiResponseBodyPreview.length
      ).toBeLessThanOrEqual(203);

      const warnCall = logger.warn.mock.calls.find(([message]) =>
        message.includes('llm_forwarding_unexpected_llm_status')
      );
      expect(warnCall).toBeDefined();
    } finally {
      await server.close();
      await cleanup();
    }
  });
});
