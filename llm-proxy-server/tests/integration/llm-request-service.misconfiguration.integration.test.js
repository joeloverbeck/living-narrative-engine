/**
 * @file llm-request-service.misconfiguration.integration.test.js
 * @description Integration tests validating LlmRequestService behaviour when
 *              upstream configuration is missing critical fields. These tests
 *              exercise the real HttpAgentService, AppConfigService, RetryManager,
 *              and ConsoleLogger collaborators to ensure the error path remains
 *              wired end-to-end.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

const ORIGINAL_ENV = { ...process.env };

/**
 * Builds a fully wired LlmRequestService instance using the concrete
 * implementations that ship with the proxy server.
 * @returns {Promise<{ service: LlmRequestService, cleanup: () => Promise<void> }>}
 */
async function createService() {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousHttpAgentEnabled = process.env.HTTP_AGENT_ENABLED;

  process.env.NODE_ENV = 'test';
  process.env.HTTP_AGENT_ENABLED = 'true';

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

describe('LlmRequestService configuration resilience integration', () => {
  let consoleSpies = [];

  beforeEach(() => {
    jest.resetModules();
    consoleSpies = [
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
    ];
  });

  afterEach(async () => {
    resetAppConfigServiceInstance();
    for (const spy of consoleSpies) {
      spy.mockRestore();
    }
    consoleSpies = [];

    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      process.env[key] = value;
    }
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }
  });

  it('returns a sanitized configuration error when the LLM endpoint is missing', async () => {
    const { service, cleanup } = await createService();

    try {
      const result = await service.forwardRequest(
        'misconfigured-llm',
        {
          displayName: 'Broken Config LLM',
          apiType: 'openai',
          endpointUrl: '',
          defaultParameters: {
            maxRetries: 2,
            baseDelayMs: 5,
            maxDelayMs: 25,
          },
        },
        {
          messages: [
            { role: 'system', content: 'Validate configuration guards.' },
            { role: 'user', content: 'Trigger endpoint validation failure.' },
          ],
        }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.errorStage).toBe('llm_config_invalid_endpoint_url');
      expect(result.errorMessage).toBe(
        'Proxy server configuration error: LLM endpoint URL is missing or invalid.'
      );
      expect(result.errorDetailsForClient).toEqual(
        expect.objectContaining({
          llmId: 'misconfigured-llm',
          targetUrl: 'Not configured',
        })
      );
      expect(result.errorDetailsForClient.originalErrorMessage).toBe(
        'Endpoint URL in LLM configuration is empty or invalid.'
      );
    } finally {
      await cleanup();
    }
  });
});
