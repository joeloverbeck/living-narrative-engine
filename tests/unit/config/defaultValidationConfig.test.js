/**
 * @file Unit tests for default validation configuration
 * Tests that the default validation-config.json is valid and properly configured
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';

describe('Default Validation Configuration', () => {
  let config;
  let schema;
  let ajv;

  beforeEach(async () => {
    // Load configuration
    const configPath = path.join(process.cwd(), 'config/validation-config.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configContent);

    // Load schema
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/validation-config.schema.json'
    );
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);

    ajv = new Ajv({ strict: false });
  });

  describe('Schema Validation', () => {
    it('should be valid according to schema', () => {
      const validate = ajv.compile(schema);
      const valid = validate(config);

      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validate.errors, null, 2));
      }

      expect(valid).toBe(true);
    });
  });

  describe('Validators Configuration', () => {
    it('should contain all 11 validators', () => {
      expect(config.validators).toHaveLength(11);
    });

    it('should have all validators enabled by default', () => {
      const allEnabled = config.validators.every((v) => v.enabled === true);
      expect(allEnabled).toBe(true);
    });

    it('should order validators by priority (0-10)', () => {
      const priorities = config.validators.map((v) => v.priority);
      const sortedPriorities = [...priorities].sort((a, b) => a - b);

      expect(priorities).toEqual(sortedPriorities);
      expect(priorities).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should have correct validator names in order', () => {
      const expectedNames = [
        'component_existence',
        'property_schemas',
        'body_descriptors',
        'blueprint_existence',
        'socket_slot_compatibility',
        'pattern_matching',
        'descriptor_coverage',
        'part_availability',
        'generated_slot_parts',
        'load_failures',
        'recipe_usage',
      ];

      const actualNames = config.validators.map((v) => v.name);
      expect(actualNames).toEqual(expectedNames);
    });
  });

  describe('Fail-Fast Configuration', () => {
    it('should configure fail-fast for critical validators (priorities 0-3)', () => {
      const failFastValidators = config.validators.filter((v) => v.failFast);
      const failFastNames = failFastValidators.map((v) => v.name);

      expect(failFastValidators).toHaveLength(4);
      expect(failFastNames).toEqual([
        'component_existence',
        'property_schemas',
        'body_descriptors',
        'blueprint_existence',
      ]);
    });

    it('should not fail-fast for lower priority validators (priorities 4-10)', () => {
      const nonFailFastValidators = config.validators.filter((v) => !v.failFast);
      const nonFailFastPriorities = nonFailFastValidators.map((v) => v.priority);

      expect(nonFailFastValidators).toHaveLength(7);
      expect(nonFailFastPriorities).toEqual([4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe('Pattern Matching Configuration', () => {
    it('should have skipIfDisabled config for pattern_matching validator', () => {
      const patternValidator = config.validators.find((v) => v.name === 'pattern_matching');

      expect(patternValidator).toBeDefined();
      expect(patternValidator.config).toBeDefined();
      expect(patternValidator.config.skipIfDisabled).toBe(true);
    });

    it('should be the only validator with config option', () => {
      const validatorsWithConfig = config.validators.filter((v) => v.config !== undefined);

      expect(validatorsWithConfig).toHaveLength(1);
      expect(validatorsWithConfig[0].name).toBe('pattern_matching');
    });
  });

  describe('Mods Configuration', () => {
    it('should have essential mods configured', () => {
      expect(config.mods.essential).toEqual(['core', 'descriptors', 'anatomy']);
    });

    it('should have empty optional mods array', () => {
      expect(config.mods.optional).toEqual([]);
    });

    it('should enable autoDetect for mod loading', () => {
      expect(config.mods.autoDetect).toBe(true);
    });

    it('should reference existing mods in filesystem', async () => {
      const modsDir = path.join(process.cwd(), 'data/mods');

      for (const modId of config.mods.essential) {
        const modPath = path.join(modsDir, modId);
        const exists = await fs
          .access(modPath)
          .then(() => true)
          .catch(() => false);

        expect(exists).toBe(true);
      }
    });
  });

  describe('Error Handling Configuration', () => {
    it('should set default severity to error', () => {
      expect(config.errorHandling.defaultSeverity).toBe('error');
    });

    it('should set severity overrides for specific validators', () => {
      expect(config.errorHandling.severityOverrides).toEqual({
        socket_slot_compatibility: 'warning',
        descriptor_coverage: 'info',
        recipe_usage: 'info',
      });
    });

    it('should enable continueOnError', () => {
      expect(config.errorHandling.continueOnError).toBe(true);
    });

    it('should have severity overrides for exactly 3 validators', () => {
      const overrides = Object.keys(config.errorHandling.severityOverrides);
      expect(overrides).toHaveLength(3);
    });

    it('should only override severity for non-fail-fast validators', () => {
      const overriddenNames = Object.keys(config.errorHandling.severityOverrides);

      for (const name of overriddenNames) {
        const validator = config.validators.find((v) => v.name === name);
        expect(validator.failFast).toBe(false);
      }
    });
  });

  describe('Output Configuration', () => {
    it('should set output format to text', () => {
      expect(config.output.format).toBe('text');
    });

    it('should disable verbose output by default', () => {
      expect(config.output.verbose).toBe(false);
    });

    it('should enable colorization', () => {
      expect(config.output.colorize).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain current validation behavior priorities', () => {
      // Critical validators that fail fast (current behavior: stop on first error)
      const criticalValidators = [
        'component_existence',
        'property_schemas',
        'body_descriptors',
        'blueprint_existence',
      ];

      for (const name of criticalValidators) {
        const validator = config.validators.find((v) => v.name === name);
        expect(validator.failFast).toBe(true);
      }
    });

    it('should maintain current severity levels', () => {
      // Validators that currently report as warnings or info
      const severityMap = {
        socket_slot_compatibility: 'warning',
        descriptor_coverage: 'info',
        recipe_usage: 'info',
      };

      for (const [name, severity] of Object.entries(severityMap)) {
        expect(config.errorHandling.severityOverrides[name]).toBe(severity);
      }
    });
  });
});
