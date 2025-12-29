/**
 * @file Integration tests for gender descriptor in body descriptions
 * @description Tests the extraction and formatting of gender from core:gender component
 * Gender is extracted from entity's core:gender component, NOT from body.descriptors
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createEntityWithGender,
  createEntityWithoutGender,
} from './fixtures/testEntities.js';
import {
  createFullComposer,
  normalizeDescription,
  extractDescriptorValues,
} from './helpers/anatomyTestHelpers.js';

describe('Gender Descriptor Integration', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Gender Extraction', () => {
    it('should include gender in description when entity has core:gender component', async () => {
      const entity = createEntityWithGender('female', { height: 'tall' });

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Gender: female');
    });

    it('should NOT include gender line when entity lacks core:gender component', async () => {
      const entity = createEntityWithoutGender({ height: 'tall' });

      const result = await composer.composeDescription(entity);

      expect(result).not.toContain('Gender:');
      expect(result).toContain('Height: tall');
    });

    it('should handle male gender value correctly', async () => {
      const entity = createEntityWithGender('male');

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Gender: male');
    });

    it('should handle female gender value correctly', async () => {
      const entity = createEntityWithGender('female');

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Gender: female');
    });

    it('should handle neutral gender value correctly', async () => {
      const entity = createEntityWithGender('neutral');

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Gender: neutral');
    });
  });

  describe('Gender Ordering', () => {
    it('should place gender before height in description', async () => {
      const entity = createEntityWithGender('female', { height: 'tall' });

      const result = await composer.composeDescription(entity);

      const genderIndex = result.indexOf('Gender:');
      const heightIndex = result.indexOf('Height:');

      expect(genderIndex).toBeGreaterThanOrEqual(0);
      expect(heightIndex).toBeGreaterThanOrEqual(0);
      expect(genderIndex).toBeLessThan(heightIndex);
    });

    it('should validate gender is first in descriptor order', async () => {
      const entity = createEntityWithGender('male', {
        height: 'average',
        build: 'athletic',
      });

      const result = await composer.composeDescription(entity);
      const lines = result.split('\n').filter((line) => line.trim());

      // Gender should be the first line with a descriptor
      expect(lines[0]).toContain('Gender: male');
    });

    it('should maintain correct order: gender, height, build', async () => {
      const entity = createEntityWithGender('female', {
        height: 'tall',
        build: 'athletic',
      });

      const result = await composer.composeDescription(entity);

      // Check relative ordering of descriptors
      const genderIndex = result.indexOf('Gender:');
      const heightIndex = result.indexOf('Height:');
      const buildIndex = result.indexOf('Build:');

      expect(genderIndex).toBeGreaterThanOrEqual(0);
      expect(heightIndex).toBeGreaterThanOrEqual(0);
      expect(buildIndex).toBeGreaterThanOrEqual(0);

      // Gender should appear before Height, Height before Build
      expect(genderIndex).toBeLessThan(heightIndex);
      expect(heightIndex).toBeLessThan(buildIndex);
    });
  });

  describe('Gender with Other Descriptors', () => {
    it('should include gender alongside all other body descriptors', async () => {
      const entity = createEntityWithGender('female', {
        height: 'tall',
        skinColor: 'olive',
        build: 'athletic',
        composition: 'lean',
        hairDensity: 'moderate',
      });

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Gender: female');
      expect(result).toContain('Height: tall');
      expect(result).toContain('Skin color: olive');
      expect(result).toContain('Build: athletic');
      expect(result).toContain('Body composition: lean');
      expect(result).toContain('Body hair: moderate');
    });

    it('should extract all descriptor values including gender', async () => {
      const entity = createEntityWithGender('male', {
        height: 'short',
        build: 'stocky',
      });

      const result = await composer.composeDescription(entity);
      const values = extractDescriptorValues(result);

      expect(values).toMatchObject({
        Gender: 'male',
        Height: 'short',
        Build: 'stocky',
      });
    });
  });

  describe('Gender Consistency', () => {
    it('should generate consistent results across multiple calls', async () => {
      const entity = createEntityWithGender('female', { height: 'average' });

      const result1 = await composer.composeDescription(entity);
      const result2 = await composer.composeDescription(entity);
      const result3 = await composer.composeDescription(entity);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should produce identical normalized output', async () => {
      const entity = createEntityWithGender('neutral', { height: 'tall' });

      const result1 = normalizeDescription(
        await composer.composeDescription(entity)
      );
      const result2 = normalizeDescription(
        await composer.composeDescription(entity)
      );

      expect(result1).toBe(result2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with only gender (no other descriptors)', async () => {
      const entity = createEntityWithGender('female', {});

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Gender: female');
    });

    it('should handle entity with gender and single descriptor', async () => {
      const entity = createEntityWithGender('male', { height: 'tall' });

      const result = await composer.composeDescription(entity);
      const values = extractDescriptorValues(result);

      expect(values.Gender).toBe('male');
      expect(values.Height).toBe('tall');
    });
  });
});
