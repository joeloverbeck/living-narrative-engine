import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
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

describe('LlmRequestService provider headers and prompt sanitisation integration', () => {
  beforeEach(() => {
    resetAppConfigServiceInstance();
  });

  afterEach(() => {
    restoreEnv();
    resetAppConfigServiceInstance();
  });

  test('merges provider headers while sanitising long prompt previews without altering payload', async () => {
    const { service, logger, cleanup } = await createService({
      httpAgentEnabled: false,
    });

    const received = {};
    const server = await createTestServer((app) => {
      app.post('/provider-headers', (req, res) => {
        received.headers = req.headers;
        received.body = req.body;
        res.json({ ok: true });
      });
    });

    const longPromptCore = 'Extended prompt body for sanitisation checks: ';
    const longPrompt =
      longPromptCore + 'X'.repeat(PAYLOAD_SANITIZATION_MAX_LENGTH + 20);

    const providerSpecificHeaders = {
      'X-Custom-Provider': 'alpha-tier',
      Authorization: 'should-not-be-forwarded',
      'Content-Type': 'text/plain',
      'X-Provider-Tier': 'gold',
    };

    const clientTargetHeaders = {
      'X-Client-Trace': 'trace-789',
      Authorization: 'client-value-ignored',
      'Content-Type': 'ignored/client',
    };

    try {
      const response = await service.forwardRequest(
        'llm-provider-headers',
        {
          displayName: 'Headers + prompt sanitisation LLM',
          apiType: 'custom',
          endpointUrl: `http://127.0.0.1:${server.port}/provider-headers`,
          providerSpecificHeaders,
        },
        { prompt: longPrompt },
        clientTargetHeaders,
        'inline-secret-key'
      );

      expect(response.success).toBe(true);
      expect(response.statusCode).toBe(200);
      expect(received.body?.prompt).toBe(longPrompt);

      expect(received.headers['x-custom-provider']).toBe('alpha-tier');
      expect(received.headers['x-provider-tier']).toBe('gold');
      expect(received.headers['x-client-trace']).toBe('trace-789');

      expect(received.headers['authorization']).toBe(
        'Bearer inline-secret-key'
      );
      expect(received.headers['content-type']).toBe('application/json');

      const previewCall = logger.debug.mock.calls.find(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Sanitized Target Payload Preview for')
      );

      expect(previewCall).toBeDefined();
      const sanitizedPayload = previewCall?.[1]?.payload;
      expect(sanitizedPayload).toBeDefined();
      expect(sanitizedPayload?.prompt).toBeDefined();

      const expectedTruncated =
        longPrompt.substring(0, PAYLOAD_SANITIZATION_MAX_LENGTH) +
        PAYLOAD_SANITIZATION_ELLIPSIS;

      expect(sanitizedPayload?.prompt).toBe(expectedTruncated);
      expect(sanitizedPayload?.prompt.length).toBe(
        PAYLOAD_SANITIZATION_MAX_LENGTH + PAYLOAD_SANITIZATION_ELLIPSIS.length
      );
      expect(received.body?.prompt.length).toBe(longPrompt.length);
    } finally {
      await server.close();
      await cleanup();
    }
  });
});
