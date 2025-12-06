import { afterEach, describe, expect, jest, test } from '@jest/globals';
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

const ORIGINAL_ENV = new Map();

function setEnv(key, value) {
  if (!ORIGINAL_ENV.has(key)) {
    ORIGINAL_ENV.set(key, process.env[key]);
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function restoreEnv() {
  for (const [key, value] of ORIGINAL_ENV.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  ORIGINAL_ENV.clear();
}

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

async function createTestServer(configure) {
  const app = express();
  app.use(express.json());
  configure(app);

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

async function createService({
  logger = createLogger(),
  nodeEnv = 'test',
  httpAgentEnabled = false,
} = {}) {
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
    logger,
    cleanup: async () => {
      httpAgentService.cleanup();
      resetAppConfigServiceInstance();
    },
  };
}

describe('LlmRequestService header fallback integration coverage', () => {
  afterEach(() => {
    restoreEnv();
  });

  test('handles absent client headers and short prompts without unnecessary mutations', async () => {
    const { service, logger, cleanup } = await createService({
      httpAgentEnabled: false,
    });

    const received = {};
    const server = await createTestServer((app) => {
      app.post('/minimal', (req, res) => {
        received.headers = req.headers;
        received.body = req.body;
        res.json({ acknowledged: true });
      });
    });

    const prompt = 'Short prompt ready for dispatch';

    try {
      const response = await service.forwardRequest(
        'llm-minimal',
        {
          displayName: 'Minimal header LLM',
          apiType: 'custom',
          endpointUrl: `http://127.0.0.1:${server.port}/minimal`,
          providerSpecificHeaders: null,
        },
        { prompt },
        null,
        'inline-secret'
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(received.body).toEqual({ prompt });

      expect(received.headers['x-trace-id']).toBeUndefined();
      expect(received.headers['x-provider-hint']).toBeUndefined();
      expect(received.headers['authorization']).toBe('Bearer inline-secret');
      expect(received.headers['content-type']).toBe('application/json');

      const previewCall = logger.debug.mock.calls.find(([message]) =>
        message.includes('Sanitized Target Payload Preview')
      );
      expect(previewCall).toBeDefined();
      const sanitizedPayload = previewCall?.[1]?.payload;
      expect(sanitizedPayload?.prompt).toBe(prompt);
      expect(sanitizedPayload?.prompt.length).toBeLessThanOrEqual(
        PAYLOAD_SANITIZATION_MAX_LENGTH
      );
      expect(
        sanitizedPayload?.prompt.endsWith(PAYLOAD_SANITIZATION_ELLIPSIS)
      ).toBe(false);
    } finally {
      await server.close();
      await cleanup();
    }
  });
});
