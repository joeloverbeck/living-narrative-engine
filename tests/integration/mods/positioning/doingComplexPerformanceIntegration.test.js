/**
 * @file Integration tests for positioning mod doing_complex_performance component
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import { resolve } from 'path';

describe('Positioning Mod - doing_complex_performance Integration', () => {
  describe('Component Definition', () => {
    it('should have a valid component definition file', async () => {
      const componentPath = resolve(
        'data/mods/positioning/components/doing_complex_performance.component.json'
      );

      const content = await fs.readFile(componentPath, 'utf8');
      const component = JSON.parse(content);

      expect(component.id).toBe('positioning:doing_complex_performance');
      expect(component.description).toBeDefined();
      expect(component.dataSchema).toBeDefined();
      expect(component.dataSchema.type).toBe('object');
      expect(component.dataSchema.properties).toEqual({});
      expect(component.dataSchema.additionalProperties).toBe(false);
    });

    it('should be a marker component with no properties', async () => {
      const componentPath = resolve(
        'data/mods/positioning/components/doing_complex_performance.component.json'
      );

      const content = await fs.readFile(componentPath, 'utf8');
      const component = JSON.parse(content);

      // Marker components have empty data schemas
      expect(Object.keys(component.dataSchema.properties)).toHaveLength(0);
    });

    it('should have descriptive documentation', async () => {
      const componentPath = resolve(
        'data/mods/positioning/components/doing_complex_performance.component.json'
      );

      const content = await fs.readFile(componentPath, 'utf8');
      const component = JSON.parse(content);

      expect(component.description).toContain('complex performance');
      expect(component.description).toContain('concentration');
    });
  });
});
