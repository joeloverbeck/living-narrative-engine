import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
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

const ORIGINAL_ENV = { ...process.env };

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

async function createService({
  nodeEnv = 'test',
  httpAgentEnabled = false,
} = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: nodeEnv,
    HTTP_AGENT_ENABLED: httpAgentEnabled ? 'true' : 'false',
  };

  resetAppConfigServiceInstance();
  const logger = createLogger();
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

describe('LlmRequestService prototype header handling integration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('skips inherited provider headers and truncates prompt previews for prompt-only payloads', async () => {
    const { service, logger, cleanup } = await createService({
      nodeEnv: 'test',
      httpAgentEnabled: false,
    });

    const captured = {};
    const server = await createTestServer((app) => {
      app.post('/prototype-headers', (req, res) => {
        captured.headers = req.headers;
        captured.body = req.body;
        res.json({ ok: true });
      });
    });

    const providerHeaderPrototype = {
      'X-Prototype-Header': 'ignore-me',
      Authorization: 'prototype-authorization',
      'Content-Type': 'prototype/type',
    };

    const providerSpecificHeaders = Object.create(providerHeaderPrototype);
    providerSpecificHeaders['X-Provider-Only'] = 'allowed';
    providerSpecificHeaders['X-Additional'] = 'secondary';
    providerSpecificHeaders.Authorization = 'own-authorization';
    providerSpecificHeaders['Content-Type'] = 'own/type';

    const promptPayload = {
      prompt: 'P'.repeat(PAYLOAD_SANITIZATION_MAX_LENGTH + 16),
    };

    try {
      const response = await service.forwardRequest(
        'prototype-llm',
        {
          displayName: 'Prototype Sensitive LLM',
          apiType: 'custom',
          endpointUrl: `http://127.0.0.1:${server.port}/prototype-headers`,
          providerSpecificHeaders,
        },
        promptPayload,
        undefined,
        'integration-api-key'
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(captured.body).toEqual(promptPayload);

      expect(captured.headers['x-provider-only']).toBe('allowed');
      expect(captured.headers['x-additional']).toBe('secondary');
      expect(captured.headers['x-prototype-header']).toBeUndefined();
      expect(captured.headers['authorization']).toBe(
        'Bearer integration-api-key'
      );
      expect(captured.headers['content-type']).toBe('application/json');

      const sanitizedCall = logger.debug.mock.calls.find(([message]) =>
        message.includes('Sanitized Target Payload Preview')
      );
      expect(sanitizedCall).toBeDefined();
      const sanitizedPayload = sanitizedCall[1].payload;
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
});
