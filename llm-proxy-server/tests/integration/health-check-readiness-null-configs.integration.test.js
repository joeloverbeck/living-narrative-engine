import { afterEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { createReadinessCheck } from '../../src/middleware/healthCheck.js';

const ORIGINAL_ENV = { ...process.env };

class NullConfigsLlmConfigService extends LlmConfigService {
  getLlmConfigs() {
    const base = super.getLlmConfigs();
    if (!base) {
      return base;
    }

    return {
      ...base,
      configs: null,
    };
  }
}

describe('readiness check integration when LlmConfigService omits configs map', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAppConfigServiceInstance();
  });

  it('treats missing configs as zero configured models while remaining operational', async () => {
    process.env.NODE_ENV = 'test';
    process.env.METRICS_ENABLED = 'false';
    process.env.CACHE_ENABLED = 'false';
    process.env.HTTP_AGENT_ENABLED = 'false';

    const logger = new ConsoleLogger();
    const fileSystemReader = new NodeFileSystemReader();

    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(logger);

    const customLoader = async (configPath) => {
      logger.debug('Custom loader invoked for readiness coverage', {
        configPath,
      });

      return {
        error: false,
        llmConfigs: {
          defaultConfigId: 'alpha-default',
          configs: {
            alpha: {
              configId: 'alpha',
              displayName: 'Alpha Test Model',
              modelIdentifier: 'alpha-model',
              endpointUrl: 'https://api.example.com',
              apiType: 'openai',
              jsonOutputStrategy: { method: 'tool_calling' },
              promptElements: [],
              promptAssemblyOrder: [],
            },
          },
        },
      };
    };

    const llmConfigService = new NullConfigsLlmConfigService(
      fileSystemReader,
      logger,
      appConfig,
      customLoader
    );

    await llmConfigService.initialize();

    const app = express();
    app.get(
      '/health/ready',
      createReadinessCheck({
        logger,
        llmConfigService,
      })
    );

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');

    const llmDependency = response.body.details.dependencies.find(
      (dependency) => dependency.name === 'llmConfigService'
    );

    expect(llmDependency).toBeDefined();
    expect(llmDependency.status).toBe('UP');
    expect(llmDependency.details.operational).toBe(true);
    expect(llmDependency.details.configuredLlms).toBe(0);
    expect(llmDependency.details.defaultLlm).toBe('alpha-default');
    expect(llmDependency.details.configPath).toEqual(
      llmConfigService.getResolvedConfigPath()
    );
  });
});
