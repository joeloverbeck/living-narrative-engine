/**
 * @file llm-request-service-dependency-guards.integration.test.js
 * @description Integration tests verifying dependency guard behavior of LlmRequestService using real collaborators.
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Helper that builds real service collaborators for the constructor guard checks.
 * @returns {{ logger: ConsoleLogger, appConfigService: ReturnType<typeof getAppConfigService>, httpAgentService: HttpAgentService }}
 */
function createRealCollaborators() {
  const logger = new ConsoleLogger();
  const appConfigService = getAppConfigService(logger);
  const httpAgentService = new HttpAgentService(
    logger,
    appConfigService.getHttpAgentConfig()
  );

  return { logger, appConfigService, httpAgentService };
}

describe('LlmRequestService dependency guard integration', () => {
  /** @type {ConsoleLogger} */
  let logger;
  /** @type {ReturnType<typeof getAppConfigService>} */
  let appConfigService;
  /** @type {HttpAgentService} */
  let httpAgentService;
  let previousNodeEnv;
  let previousHttpAgentEnabled;

  beforeEach(() => {
    previousNodeEnv = process.env.NODE_ENV;
    previousHttpAgentEnabled = process.env.HTTP_AGENT_ENABLED;

    process.env.NODE_ENV = 'test';
    process.env.HTTP_AGENT_ENABLED = 'true';

    resetAppConfigServiceInstance();

    const collaborators = createRealCollaborators();
    logger = collaborators.logger;
    appConfigService = collaborators.appConfigService;
    httpAgentService = collaborators.httpAgentService;
  });

  afterEach(() => {
    if (httpAgentService) {
      httpAgentService.cleanup();
    }

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
  });

  test('throws when logger dependency is missing', () => {
    expect(
      () =>
        new LlmRequestService(
          /** @type {any} */ (undefined),
          httpAgentService,
          appConfigService,
          RetryManager
        )
    ).toThrow('LlmRequestService: logger is required.');
  });

  test('throws when HttpAgentService dependency is missing', () => {
    expect(
      () =>
        new LlmRequestService(
          logger,
          /** @type {any} */ (undefined),
          appConfigService,
          RetryManager
        )
    ).toThrow('LlmRequestService: httpAgentService is required.');
  });

  test('throws when AppConfigService dependency is missing', () => {
    expect(
      () =>
        new LlmRequestService(
          logger,
          httpAgentService,
          /** @type {any} */ (undefined),
          RetryManager
        )
    ).toThrow('LlmRequestService: appConfigService is required.');
  });

  test('throws when RetryManager dependency is missing', () => {
    expect(
      () =>
        new LlmRequestService(
          logger,
          httpAgentService,
          appConfigService,
          /** @type {any} */ (undefined)
        )
    ).toThrow('LlmRequestService: RetryManagerClass is required.');
  });

  test('constructs successfully when all dependencies are provided', () => {
    const service = new LlmRequestService(
      logger,
      httpAgentService,
      appConfigService,
      RetryManager
    );

    expect(service).toBeInstanceOf(LlmRequestService);
  });
});
