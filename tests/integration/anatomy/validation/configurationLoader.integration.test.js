/**
 * @file Integration tests for ConfigurationLoader with real schema validator
 * Ensures that schema validation occurs correctly before normalization
 * and that normalized configs don't fail validation.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import ConfigurationLoader from '../../../../src/anatomy/validation/core/ConfigurationLoader.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';

describe('ConfigurationLoader Integration - Real Schema Validator', () => {
  let schemaValidator;
  let logger;

  beforeEach(async () => {
    logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Create real schema validator (not mocked)
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load the validation-config schema
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/validation-config.schema.json'
    );
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Add schema with its $id
    await schemaValidator.addSchema(schema, schema.$id);
  });

  it('should successfully load and validate default configuration with real schema', async () => {
    const loader = new ConfigurationLoader({ schemaValidator, logger });

    // This should not throw - if it does, it means the validation bug exists
    const result = await loader.load();

    // Verify the config loaded successfully
    expect(result.rawConfig).toBeDefined();
    expect(result.pipelineConfig).toBeDefined();

    // Verify essential mods are present
    expect(result.rawConfig.mods.essential).toContain('core');
    expect(result.rawConfig.mods.essential).toContain('anatomy');

    // Verify validators are loaded (should be 11 validators)
    expect(result.rawConfig.validators).toBeDefined();
    expect(result.rawConfig.validators.length).toBeGreaterThan(0);

    // Verify normalized names in pipeline config (hyphenated format)
    expect(result.pipelineConfig.validators).toBeDefined();
    expect(result.pipelineConfig.validators['component-existence']).toBeDefined();
    expect(result.pipelineConfig.validators['pattern-matching']).toBeDefined();
    expect(result.pipelineConfig.validators['body-descriptors']).toBeDefined();
    expect(result.pipelineConfig.guards.enabled).toBe(true);
  });

  it('should validate individual config files before normalization', async () => {
    const loader = new ConfigurationLoader({ schemaValidator, logger });

    // Load default config
    const result = await loader.load();

    // The raw config contains normalized (hyphenated) names after merge
    const validators = result.rawConfig.validators;
    expect(validators).toBeDefined();

    // Each validator should be defined with normalized names
    validators.forEach((validator) => {
      expect(validator.name).toBeDefined();
      // Names in raw config are normalized (hyphenated format)
      expect(validator.name).toMatch(/^[a-z-]+$/);
    });
  });

  it('should handle config merging without post-merge validation errors', async () => {
    const loader = new ConfigurationLoader({ schemaValidator, logger });

    // Provide override config (will be normalized during merge)
    const overrides = {
      validators: [
        {
          name: 'pattern_matching',
          enabled: false,
        },
      ],
    };

    // This should not throw even with overrides
    // Call with undefined configPath to use default, and provide overrides
    const result = await loader.load(undefined, overrides);

    expect(result.rawConfig).toBeDefined();
    expect(result.pipelineConfig).toBeDefined();

    // Verify the override was applied (normalized to hyphenated)
    expect(result.pipelineConfig.validators['pattern-matching']).toBeDefined();
    expect(result.pipelineConfig.validators['pattern-matching'].enabled).toBe(false);
  });

  it('should have consistent normalized names in both rawConfig and pipelineConfig', async () => {
    const loader = new ConfigurationLoader({ schemaValidator, logger });
    const result = await loader.load();

    // Both rawConfig and pipelineConfig should use normalized (hyphenated) names
    const rawValidatorNames = result.rawConfig.validators.map((v) => v.name);
    const pipelineNames = Object.keys(result.pipelineConfig.validators);

    // All names should be in hyphenated format (normalized)
    rawValidatorNames.forEach((name) => {
      expect(name).toMatch(/^[a-z-]+$/);
    });

    pipelineNames.forEach((name) => {
      expect(name).toMatch(/^[a-z-]+$/);
    });

    // Verify both contain the same validators (names match)
    const rawNamesSet = new Set(rawValidatorNames);
    pipelineNames.forEach((name) => {
      expect(rawNamesSet.has(name)).toBe(true);
    });
  });
});
