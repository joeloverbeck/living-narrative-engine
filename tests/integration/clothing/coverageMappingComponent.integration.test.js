/**
 * @file Integration test for clothing:coverage_mapping component loading
 * @see data/mods/clothing/components/coverage_mapping.component.json
 */

import { describe, test, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('Clothing Coverage Mapping Component Integration', () => {
  describe('Component File Loading', () => {
    test('should load coverage_mapping component file successfully', async () => {
      const componentPath = path.resolve(
        './data/mods/clothing/components/coverage_mapping.component.json'
      );

      // Verify file exists and can be read
      const fileExists = await fs
        .access(componentPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file contains valid JSON
      const content = await fs.readFile(componentPath, 'utf8');
      const component = JSON.parse(content);

      // Verify component structure
      expect(component.id).toBe('clothing:coverage_mapping');
      expect(component.description).toBe(
        'Defines additional body slots that clothing items cover when equipped'
      );
      expect(component.dataSchema).toBeDefined();
      expect(component.dataSchema.type).toBe('object');
      expect(component.dataSchema.properties).toBeDefined();
      expect(component.dataSchema.required).toEqual([
        'covers',
        'coveragePriority',
      ]);
    });

    test('should define correct slot names compatible with SlotAccessResolver', async () => {
      const componentPath = path.resolve(
        './data/mods/clothing/components/coverage_mapping.component.json'
      );
      const content = await fs.readFile(componentPath, 'utf8');
      const component = JSON.parse(content);

      const slotNames = component.dataSchema.properties.covers.items.enum;
      const expectedSlots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      expect(slotNames).toEqual(expectedSlots);
    });

    test('should define correct priority levels compatible with wearable component', async () => {
      const componentPath = path.resolve(
        './data/mods/clothing/components/coverage_mapping.component.json'
      );
      const content = await fs.readFile(componentPath, 'utf8');
      const component = JSON.parse(content);

      const priorities = component.dataSchema.properties.coveragePriority.enum;
      const expectedPriorities = [
        'outer',
        'armor',
        'base',
        'underwear',
        'accessories',
      ];

      expect(priorities).toEqual(expectedPriorities);
    });

    test('should define proper validation constraints', async () => {
      const componentPath = path.resolve(
        './data/mods/clothing/components/coverage_mapping.component.json'
      );
      const content = await fs.readFile(componentPath, 'utf8');
      const component = JSON.parse(content);

      const coversProperty = component.dataSchema.properties.covers;

      // Verify array constraints
      expect(coversProperty.type).toBe('array');
      expect(coversProperty.uniqueItems).toBe(true);
      expect(coversProperty.minItems).toBe(1);

      // Verify required fields
      expect(component.dataSchema.required).toContain('covers');
      expect(component.dataSchema.required).toContain('coveragePriority');

      // Verify no additional properties allowed
      expect(component.dataSchema.additionalProperties).toBe(false);
    });
  });
});
