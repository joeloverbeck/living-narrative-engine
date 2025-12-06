// @jest-environment node
import { describe, it, expect, afterAll, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { LlmConfigLoader } from '../../../src/llms/services/llmConfigLoader.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import NodeDataFetcher from '../../../cli/data/nodeDataFetcher.js';

const projectRoot = process.cwd();

/**
 *
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param logger
 */
async function createSchemaValidator(logger) {
  const schemaValidator = new AjvSchemaValidator({ logger });
  const schemaPath = path.resolve(
    projectRoot,
    'data',
    'schemas',
    'llm-configs.schema.json'
  );
  const schemaSource = await fs.readFile(schemaPath, 'utf8');
  const schemaJson = JSON.parse(schemaSource);
  await schemaValidator.addSchema(schemaJson, schemaJson.$id);
  return schemaValidator;
}

/**
 *
 */
function createSafeEventDispatcher() {
  return {
    dispatch: jest.fn().mockResolvedValue(true),
  };
}

/**
 *
 * @param overrides
 */
async function createLoader(overrides = {}) {
  const logger = overrides.logger ?? createTestLogger();
  const schemaValidator =
    overrides.schemaValidator ?? (await createSchemaValidator(logger));
  const loader = new LlmConfigLoader({
    logger,
    schemaValidator,
    configuration: overrides.configuration ?? new StaticConfiguration(),
    safeEventDispatcher:
      overrides.safeEventDispatcher ?? createSafeEventDispatcher(),
    dataFetcher: overrides.dataFetcher ?? new NodeDataFetcher(),
    defaultConfigPath: overrides.defaultConfigPath,
  });
  return { loader, logger, schemaValidator };
}

/**
 *
 * @param contents
 */
async function createTempFile(contents) {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'llm-config-loader-integration-')
  );
  const tempFilePath = path.join(tempDir, 'llm-config.json');
  await fs.writeFile(tempFilePath, contents, 'utf8');
  return { tempDir, tempFilePath };
}

describe('LlmConfigLoader with real schema validator and Node data fetcher', () => {
  const tempDirectories = new Set();

  afterAll(async () => {
    await Promise.all(
      Array.from(tempDirectories).map((dirPath) =>
        fs.rm(dirPath, { recursive: true, force: true })
      )
    );
  });

  it('loads the production llm-configs.json using Ajv schema validation', async () => {
    const { loader, logger } = await createLoader();

    const result = await loader.loadConfigs();

    expect(result).toEqual(
      expect.objectContaining({
        defaultConfigId: expect.any(String),
        configs: expect.any(Object),
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns a structured error when the schema ID is missing from configuration', async () => {
    class MissingSchemaConfiguration extends StaticConfiguration {
      getContentTypeSchemaId() {
        return undefined;
      }
    }

    const { loader, logger } = await createLoader({
      configuration: new MissingSchemaConfiguration(),
    });

    const result = await loader.loadConfigs('config/llm-configs.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation_setup',
        message:
          "LlmConfigLoader: Schema ID for 'llm-configs' is undefined. Cannot validate.",
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      "LlmConfigLoader: Could not retrieve schema ID for 'llm-configs' from IConfiguration."
    );
  });

  it('surfaces Ajv validation problems for malformed configuration files', async () => {
    const { loader } = await createLoader();

    const malformedConfig = {
      defaultConfigId: 'missingConfigs',
    };
    const { tempDir, tempFilePath } = await createTempFile(
      JSON.stringify(malformedConfig, null, 2)
    );
    tempDirectories.add(tempDir);

    const result = await loader.loadConfigs(tempFilePath);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
      })
    );
    const hasMissingConfigsError = (result.validationErrors || []).some(
      (validationError) =>
        validationError.errorType === 'SCHEMA_VALIDATION' &&
        typeof validationError.message === 'string' &&
        validationError.message.includes("'configs'")
    );
    expect(hasMissingConfigsError).toBe(true);
  });

  it('classifies missing files as fetch_not_found errors', async () => {
    const innerFetcher = new NodeDataFetcher();
    class NotFoundWrappingFetcher {
      async fetch(identifier) {
        try {
          return await innerFetcher.fetch(identifier);
        } catch (error) {
          const notFoundError = new Error(
            `HTTP error! status 404 (Not Found) fetching ${identifier}`
          );
          notFoundError.originalError = new Error(
            'HTTP error! status 404 (Not Found)'
          );
          notFoundError.cause = error;
          throw notFoundError;
        }
      }
    }

    const { loader } = await createLoader({
      dataFetcher: new NotFoundWrappingFetcher(),
    });

    const result = await loader.loadConfigs('config/non-existent-file.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch_not_found',
      })
    );
    expect(result.message).toContain('Failed to load, parse, or validate');
  });

  it('marks invalid JSON responses as parse errors', async () => {
    const { loader } = await createLoader();
    const { tempDir, tempFilePath } = await createTempFile('this is not json');
    tempDirectories.add(tempDir);

    const result = await loader.loadConfigs(tempFilePath);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'parse',
      })
    );
    expect(result.message).toContain('Failed to load, parse, or validate');
  });

  it('detects validation setup failures thrown by the configuration provider', async () => {
    class ThrowingConfiguration extends StaticConfiguration {
      getContentTypeSchemaId() {
        throw new Error("Schema ID for 'llm-configs' is undefined at runtime");
      }
    }

    const { loader } = await createLoader({
      configuration: new ThrowingConfiguration(),
    });

    const result = await loader.loadConfigs('config/llm-configs.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation_setup',
      })
    );
    expect(result.message).toContain('Failed to load, parse, or validate');
  });

  it('reports retry exhaustion as fetch_max_retries_exceeded', async () => {
    const innerFetcher = new NodeDataFetcher();
    class RetryingDataFetcher {
      async fetch(identifier) {
        let attempts = 0;
        let lastError;
        while (attempts < 3) {
          attempts += 1;
          try {
            return await innerFetcher.fetch(identifier);
          } catch (error) {
            lastError = error;
          }
        }
        const retryError = new Error(
          `Failed after ${attempts} attempt(s) while fetching ${identifier}`
        );
        retryError.originalError = new Error(
          'Retry exhaustion underlying cause'
        );
        retryError.lastError = lastError;
        throw retryError;
      }
    }

    const { loader } = await createLoader({
      dataFetcher: new RetryingDataFetcher(),
    });

    const result = await loader.loadConfigs('config/non-existent-file.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch_max_retries_exceeded',
      })
    );
    expect(result.message).toContain('Failed to load, parse, or validate');
  });
});
