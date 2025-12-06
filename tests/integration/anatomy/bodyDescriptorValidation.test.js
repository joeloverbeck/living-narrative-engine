/**
 * Integration test for body descriptor validation
 * Tests complete validation flow with real data registry and configuration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptorValidator } from '../../../src/anatomy/validators/bodyDescriptorValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

describe('Body Descriptor Validation - Integration', () => {
  let validator;
  let dataRegistry;
  let mockLogger;

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    validator = new BodyDescriptorValidator({ logger: mockLogger });

    // Create real data registry
    dataRegistry = new InMemoryDataRegistry({ logger: mockLogger });

    // Store anatomy formatting configuration with all descriptors
    dataRegistry.store('anatomyFormatting', 'default', {
      descriptionOrder: [
        'height',
        'skin_color',
        'build',
        'body_composition',
        'body_hair',
        'smell',
      ],
    });
  });

  describe('validateRecipeDescriptors with real data', () => {
    it('should validate valid recipe descriptors', () => {
      const validDescriptors = {
        height: 'tall',
        skinColor: 'tan',
        build: 'athletic',
        composition: 'lean',
        hairDensity: 'moderate',
        smell: 'fresh',
      };

      const result = validator.validateRecipeDescriptors(validDescriptors);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should detect invalid descriptor values', () => {
      const invalidDescriptors = {
        height: 'super-ultra-tall', // Invalid value
        build: 'mega-muscular', // Invalid value
      };

      const result = validator.validateRecipeDescriptors(invalidDescriptors);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain('Invalid value');
      expect(result.errors[0]).toContain('super-ultra-tall');
    });

    it('should warn about unknown descriptors', () => {
      const descriptorsWithUnknown = {
        height: 'tall',
        unknownDescriptor: 'some value',
        anotherUnknown: 'another value',
      };

      const result = validator.validateRecipeDescriptors(
        descriptorsWithUnknown
      );

      expect(result.warnings.length).toBe(2);
      expect(result.warnings[0]).toContain('Unknown body descriptor');
      expect(result.warnings[0]).toContain('unknownDescriptor');
    });

    it('should handle free-form descriptors correctly', () => {
      const freeFormDescriptors = {
        skinColor: 'olive with golden undertones',
        smell: 'like fresh rain on summer grass',
      };

      const result = validator.validateRecipeDescriptors(freeFormDescriptors);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('validateFormattingConfig with real configuration', () => {
    it('should validate complete formatting configuration', () => {
      const config = dataRegistry.get('anatomyFormatting', 'default');

      const result = validator.validateFormattingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should detect incomplete formatting configuration', () => {
      const incompleteConfig = {
        descriptionOrder: ['height', 'build'], // Missing most descriptors
      };

      const result = validator.validateFormattingConfig(incompleteConfig);

      expect(result.valid).toBe(true); // Still valid, but with warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('skin_color'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('body_composition'))).toBe(
        true
      );
      expect(result.warnings.some((w) => w.includes('body_hair'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('smell'))).toBe(true);
    });
  });

  describe('validateSystemConsistency with real data', () => {
    it('should validate complete system with formatting config', async () => {
      const result = await validator.validateSystemConsistency({
        dataRegistry,
      });

      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('info');

      // Should have info about registered descriptors
      expect(result.info.length).toBeGreaterThan(0);
      expect(result.info[0]).toContain('Total registered descriptors: 6');
      expect(result.info[1]).toContain('Registered:');
    });

    it('should detect missing formatting config', async () => {
      const emptyRegistry = new InMemoryDataRegistry({ logger: mockLogger });

      const result = await validator.validateSystemConsistency({
        dataRegistry: emptyRegistry,
      });

      expect(result.errors).toContain(
        'Formatting config not found: anatomy:default'
      );
    });

    it('should validate sample recipes if available', async () => {
      // Register sample recipes
      dataRegistry.store('anatomyRecipes', 'anatomy:human_male', {
        bodyDescriptors: {
          height: 'tall',
          skinColor: 'tan',
          build: 'athletic',
        },
      });

      dataRegistry.store('anatomyRecipes', 'anatomy:human_female', {
        bodyDescriptors: {
          height: 'average',
          skinColor: 'fair',
          build: 'shapely',
        },
      });

      const result = await validator.validateSystemConsistency({
        dataRegistry,
      });

      // Should not have warnings about recipe validation since descriptors are valid
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid descriptors in sample recipes', async () => {
      // Register sample recipe with invalid descriptor
      dataRegistry.store('anatomyRecipes', 'anatomy:human_male', {
        bodyDescriptors: {
          height: 'invalid-height-value',
          build: 'invalid-build-value',
        },
      });

      const result = await validator.validateSystemConsistency({
        dataRegistry,
      });

      // Should have warnings about invalid recipe descriptors
      expect(
        result.warnings.some((w) => w.includes('anatomy:human_male'))
      ).toBe(true);
      expect(result.warnings.some((w) => w.includes('Invalid value'))).toBe(
        true
      );
    });

    it('should handle missing sample recipes gracefully', async () => {
      // Don't register any recipes
      const result = await validator.validateSystemConsistency({
        dataRegistry,
      });

      // Should not crash, should complete validation
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('info');
    });

    it('should validate all registered descriptors are reported', async () => {
      const result = await validator.validateSystemConsistency({
        dataRegistry,
      });

      // Check all expected descriptors are mentioned
      const infoText = result.info.join(' ');
      expect(infoText).toContain('height');
      expect(infoText).toContain('skinColor');
      expect(infoText).toContain('build');
      expect(infoText).toContain('composition');
      expect(infoText).toContain('hairDensity');
      expect(infoText).toContain('smell');
    });
  });

  describe('End-to-end validation workflow', () => {
    it('should detect configuration drift', async () => {
      // Create incomplete formatting config to simulate drift
      const incompleteRegistry = new InMemoryDataRegistry({
        logger: mockLogger,
      });
      incompleteRegistry.store('anatomyFormatting', 'default', {
        descriptionOrder: ['height', 'build'], // Missing skin_color, body_composition, body_hair, smell
      });

      const result = await validator.validateSystemConsistency({
        dataRegistry: incompleteRegistry,
      });

      // Should warn about missing descriptors
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) => w.includes('missing from descriptionOrder'))
      ).toBe(true);
    });

    it('should provide actionable error messages', async () => {
      const descriptors = {
        height: 'super-tall', // Invalid
        unknownProp: 'value', // Unknown
      };

      const result = validator.validateRecipeDescriptors(descriptors);

      // Errors should be actionable
      expect(result.errors[0]).toContain('Invalid value');
      expect(result.errors[0]).toContain('Expected one of:');

      // Warnings should be actionable
      expect(result.warnings[0]).toContain('Unknown body descriptor');
      expect(result.warnings[0]).toContain('not in registry');
    });

    it('should validate consistency between schema and config', async () => {
      const result = await validator.validateSystemConsistency({
        dataRegistry,
      });

      // Config should be complete (all descriptors present in beforeEach setup)
      // So there should be no warnings about missing descriptors
      const missingDescriptorWarnings = result.warnings.filter((w) =>
        w.includes('missing from descriptionOrder')
      );
      expect(missingDescriptorWarnings.length).toBe(0);
    });
  });
});
