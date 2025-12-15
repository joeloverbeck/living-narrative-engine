/**
 * @file Unit tests for composition 'dense' value in body descriptor registry
 * @description Tests that 'dense' is a valid composition value, aligning the registry
 * with the anatomy.recipe.schema.json and body_composition.component.json schemas.
 */

import { describe, it, expect } from '@jest/globals';
import {
  BODY_DESCRIPTOR_REGISTRY,
  validateDescriptorValue,
} from '../../../../src/anatomy/registries/bodyDescriptorRegistry.js';

describe('bodyDescriptorRegistry - composition "dense" value', () => {
  describe('Registry alignment with schemas', () => {
    it('should include "dense" in composition validValues', () => {
      // Validates that the registry is aligned with:
      // - data/schemas/anatomy.recipe.schema.json (line 249)
      // - data/mods/descriptors/components/body_composition.component.json (line 14)
      const composition = BODY_DESCRIPTOR_REGISTRY.composition;
      expect(composition.validValues).toContain('dense');
    });

    it('should have "dense" between "lean" and "average" for logical ordering', () => {
      const composition = BODY_DESCRIPTOR_REGISTRY.composition;
      const leanIndex = composition.validValues.indexOf('lean');
      const denseIndex = composition.validValues.indexOf('dense');
      const averageIndex = composition.validValues.indexOf('average');

      expect(denseIndex).toBeGreaterThan(leanIndex);
      expect(denseIndex).toBeLessThan(averageIndex);
    });
  });

  describe('Validation function', () => {
    it('should pass validation for "dense" composition value', () => {
      const result = validateDescriptorValue('composition', 'dense');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Use case: Badger folk male recipe', () => {
    it('should support dense composition for stocky creature builds', () => {
      // The badger_folk_male_standard.recipe.json uses:
      // "composition": "dense"
      // This is appropriate for stocky, muscular creatures like badger-folk
      const result = validateDescriptorValue('composition', 'dense');
      expect(result.valid).toBe(true);
    });
  });

  describe('Formatter function', () => {
    it('should format "dense" value correctly', () => {
      const composition = BODY_DESCRIPTOR_REGISTRY.composition;
      expect(composition.formatter('dense')).toBe('Body composition: dense');
    });
  });
});
