import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import ConfigurationLoader from '../../../../../src/anatomy/validation/core/ConfigurationLoader.js';

const SCHEMA_SUCCESS = { isValid: true, errors: [] };

function createLoggerMock() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('ConfigurationLoader', () => {
  let schemaValidator;
  let logger;
  let tempDir;

  beforeEach(async () => {
    schemaValidator = { validate: jest.fn().mockResolvedValue(SCHEMA_SUCCESS) };
    logger = createLoggerMock();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-loader-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('loads default configuration and exposes pipeline metadata', async () => {
    const loader = new ConfigurationLoader({ schemaValidator, logger });
    const result = await loader.load();

    expect(result.rawConfig.mods.essential).toEqual([
      'core',
      'descriptors',
      'anatomy',
    ]);
    expect(result.rawConfig.validators).toHaveLength(11);
    expect(result.pipelineConfig.validators['pattern-matching']).toBeDefined();
    expect(
      result.pipelineConfig.validators['descriptor-coverage'].severityOverrides[
        'descriptor-coverage'
      ]
    ).toBe('info');
    expect(schemaValidator.validate).toHaveBeenCalled();
  });

  it('merges user configuration file and overrides with normalized names', async () => {
    const userConfigPath = path.join(tempDir, 'user-config.json');
    const userConfig = {
      mods: { essential: ['core', 'dlc'], autoDetect: false },
      validators: [
        {
          name: 'pattern_matching',
          enabled: false,
          priority: 5,
          failFast: true,
          config: { skipIfDisabled: false },
        },
      ],
      errorHandling: {
        defaultSeverity: 'warning',
        severityOverrides: { pattern_matching: 'warning' },
        continueOnError: true,
      },
      output: { format: 'json', verbose: true, colorize: false },
    };
    await fs.writeFile(userConfigPath, JSON.stringify(userConfig, null, 2));

    const loader = new ConfigurationLoader({ schemaValidator, logger });
    const result = await loader.load(userConfigPath, {
      validators: [
        {
          name: 'pattern_matching',
          enabled: true,
          priority: 5,
        },
      ],
    });

    const patternValidator = result.rawConfig.validators.find(
      (validator) => validator.name === 'pattern-matching'
    );
    expect(patternValidator.enabled).toBe(true);
    expect(patternValidator.failFast).toBe(true);
    expect(result.pipelineConfig.validators['pattern-matching'].severityOverrides[
      'pattern-matching'
    ]).toBe('warning');
    expect(result.rawConfig.mods.essential).toEqual(['core', 'dlc']);
    expect(result.pipelineConfig.output.format).toBe('json');
  });

  it('deduplicates validators when merge is called directly', () => {
    const loader = new ConfigurationLoader({ schemaValidator, logger });
    const merged = loader.merge(
      {
        validators: [
          { name: 'component_existence', enabled: true, priority: 1 },
          { name: 'pattern_matching', enabled: true, priority: 2 },
        ],
      },
      {
        validators: [
          { name: 'component-existence', enabled: false, priority: 10 },
        ],
      }
    );

    expect(merged.validators).toHaveLength(2);
    expect(merged.validators.find((v) => v.name === 'component-existence').enabled).toBe(
      false
    );
  });

  it('throws when schema validation fails for user file', async () => {
    schemaValidator.validate = jest
      .fn()
      .mockResolvedValueOnce(SCHEMA_SUCCESS)
      .mockResolvedValueOnce({ isValid: false, errors: [{ message: 'boom' }] });

    const invalidPath = path.join(tempDir, 'invalid-config.json');
    await fs.writeFile(
      invalidPath,
      JSON.stringify({ mods: { essential: ['core'], autoDetect: false } })
    );

    const loader = new ConfigurationLoader({ schemaValidator, logger });
    await expect(loader.load(invalidPath)).rejects.toThrow(
      'ConfigurationLoader: Schema validation failed'
    );
  });

  it('throws when JSON cannot be parsed', async () => {
    const invalidPath = path.join(tempDir, 'broken.json');
    await fs.writeFile(invalidPath, '{ invalid json');

    const loader = new ConfigurationLoader({ schemaValidator, logger });
    await expect(loader.load(invalidPath)).rejects.toThrow(
      'ConfigurationLoader: Invalid JSON'
    );
  });
});
