/**
 * @file Unit tests for Activity Metadata Schema Validation
 * @see specs/activity-description-system-activation.spec.md
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Activity Metadata Schema Validation', () => {
  const componentsToTest = [
    {
      mod: 'companionship',
      name: 'following',
      targetRole: 'leaderId',
      priority: 60,
    },
    {
      mod: 'companionship',
      name: 'leading',
      targetRole: 'followers',
      priority: 58,
    },
    {
      mod: 'hand-holding',
      name: 'hand_held',
      targetRole: 'holding_entity_id',
      priority: 65,
    },
    {
      mod: 'hand-holding',
      name: 'holding_hand',
      targetRole: 'held_entity_id',
      priority: 67,
    },
    { mod: 'kissing', name: 'kissing', targetRole: 'partner', priority: 72 },
    {
      mod: 'positioning',
      name: 'being_bitten_in_neck',
      targetRole: 'biting_entity_id',
      priority: 70,
    },
    {
      mod: 'hugging-states',
      name: 'being_hugged',
      targetRole: 'hugging_entity_id',
      priority: 63,
    },
    {
      mod: 'physical-control-states',
      name: 'being_restrained',
      targetRole: 'restraining_entity_id',
      priority: 64,
    },
    {
      mod: 'bending-states',
      name: 'bending_over',
      targetRole: 'surface_id',
      priority: 68,
    },
    {
      mod: 'positioning',
      name: 'biting_neck',
      targetRole: 'bitten_entity_id',
      priority: 73,
    },
    {
      mod: 'sex-states',
      name: 'giving_blowjob',
      targetRole: 'receiving_entity_id',
      priority: 80,
    },
    {
      mod: 'hugging-states',
      name: 'hugging',
      targetRole: 'embraced_entity_id',
      priority: 66,
    },
    {
      mod: 'physical-control-states',
      name: 'restraining',
      targetRole: 'restrained_entity_id',
      priority: 67,
    },
    {
      mod: 'lying-states',
      name: 'lying_on',
      targetRole: 'furniture_id',
      priority: 64,
    },
    {
      mod: 'sex-states',
      name: 'receiving_blowjob',
      targetRole: 'giving_entity_id',
      priority: 78,
    },
    {
      mod: 'sitting-states',
      name: 'sitting_on',
      targetRole: 'furniture_id',
      priority: 62,
    },
    {
      mod: 'straddling-states',
      name: 'straddling_waist',
      targetRole: 'target_id',
      priority: 82,
    },
  ];

  componentsToTest.forEach(({ mod, name, targetRole, priority }) => {
    const componentId = `${mod}:${name}`;

    describe(`${componentId}`, () => {
      let componentSchema;

      beforeAll(() => {
        const componentPath = join(
          process.cwd(),
          `data/mods/${mod}/components/${name}.component.json`
        );
        const rawData = readFileSync(componentPath, 'utf8');
        componentSchema = JSON.parse(rawData);
      });

      it('should have activityMetadata property in dataSchema', () => {
        expect(componentSchema.dataSchema.properties).toHaveProperty(
          'activityMetadata'
        );
      });

      it('should have valid activityMetadata structure', () => {
        const metadata = componentSchema.dataSchema.properties.activityMetadata;
        expect(metadata.type).toBe('object');
        expect(metadata.additionalProperties).toBe(false);
        expect(metadata.description).toContain(
          'Inline metadata for activity description generation'
        );
      });

      it('should have all required activityMetadata fields', () => {
        const metadata = componentSchema.dataSchema.properties.activityMetadata;
        expect(metadata.properties).toHaveProperty('shouldDescribeInActivity');
        expect(metadata.properties).toHaveProperty('template');
        expect(metadata.properties).toHaveProperty('targetRole');
        expect(metadata.properties).toHaveProperty('priority');
      });

      it('should have correct shouldDescribeInActivity configuration', () => {
        const field =
          componentSchema.dataSchema.properties.activityMetadata.properties
            .shouldDescribeInActivity;
        expect(field.type).toBe('boolean');
        expect(field.default).toBe(true);
      });

      it('should have template with {actor} placeholder', () => {
        const field =
          componentSchema.dataSchema.properties.activityMetadata.properties
            .template;
        expect(field.type).toBe('string');
        expect(field.default).toContain('{actor}');
      });

      it('should have correct targetRole mapping', () => {
        const field =
          componentSchema.dataSchema.properties.activityMetadata.properties
            .targetRole;
        expect(field.type).toBe('string');
        expect(field.default).toBe(targetRole);
      });

      it('should have priority in valid range (0-100)', () => {
        const field =
          componentSchema.dataSchema.properties.activityMetadata.properties
            .priority;
        expect(field.type).toBe('integer');
        expect(field.minimum).toBe(0);
        expect(field.maximum).toBe(100);
        expect(field.default).toBe(priority);
        expect(priority).toBeGreaterThanOrEqual(0);
        expect(priority).toBeLessThanOrEqual(100);
      });

      it('should have targetRole that matches a property in dataSchema', () => {
        const properties = componentSchema.dataSchema.properties;
        expect(properties).toHaveProperty(targetRole);
      });
    });
  });

  describe('Priority Distribution', () => {
    it('should have unique priorities for better ordering', () => {
      const priorities = componentsToTest.map((c) => c.priority);
      const uniquePriorities = new Set(priorities);
      // Most should be unique (allowing some pairs to share priorities)
      expect(uniquePriorities.size).toBeGreaterThanOrEqual(10);
    });

    it('should have priorities in expected range distribution', () => {
      const priorities = componentsToTest.map((c) => c.priority);
      const highPriority = priorities.filter((p) => p >= 70).length;
      const mediumPriority = priorities.filter((p) => p >= 60 && p < 70).length;

      // Should have both high and medium priority components
      expect(highPriority).toBeGreaterThan(0);
      expect(mediumPriority).toBeGreaterThan(0);
    });
  });
});
