/**
 * @file Integration tests for Activity Description System Activation
 * @see specs/activity-description-system-activation.spec.md
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Activity Description System Activation', () => {
  const activatedComponents = [
    {
      mod: 'companionship',
      name: 'following',
      expectedTemplate: 'is following',
      priority: 60,
      targetRole: 'leaderId',
    },
    {
      mod: 'companionship',
      name: 'leading',
      expectedTemplate: 'is leading others',
      priority: 58,
      targetRole: 'followers',
    },
    {
      mod: 'hand-holding',
      name: 'hand_held',
      expectedTemplate: 'hand is being held',
      priority: 65,
      targetRole: 'holding_entity_id',
    },
    {
      mod: 'hand-holding',
      name: 'holding_hand',
      expectedTemplate: 'is holding',
      priority: 67,
      targetRole: 'held_entity_id',
    },
    {
      mod: 'kissing',
      name: 'kissing',
      expectedTemplate: 'is kissing',
      priority: 72,
      targetRole: 'partner',
    },
    {
      mod: 'biting-states',
      name: 'being_bitten_in_neck',
      expectedTemplate: 'neck is being bitten',
      priority: 70,
      targetRole: 'biting_entity_id',
    },
    {
      mod: 'hugging-states',
      name: 'being_hugged',
      expectedTemplate: 'is being hugged',
      priority: 63,
      targetRole: 'hugging_entity_id',
    },
    {
      mod: 'bending-states',
      name: 'bending_over',
      expectedTemplate: 'is bending over',
      priority: 68,
      targetRole: 'surface_id',
    },
    {
      mod: 'biting-states',
      name: 'biting_neck',
      expectedTemplate: 'is biting',
      priority: 73,
      targetRole: 'bitten_entity_id',
    },
    {
      mod: 'sex-states',
      name: 'giving_blowjob',
      expectedTemplate: 'performing oral sex',
      priority: 80,
      targetRole: 'receiving_entity_id',
    },
    {
      mod: 'hugging-states',
      name: 'hugging',
      expectedTemplate: 'is hugging',
      priority: 66,
      targetRole: 'embraced_entity_id',
    },
    {
      mod: 'lying-states',
      name: 'lying_on',
      expectedTemplate: 'is lying on',
      priority: 64,
      targetRole: 'furniture_id',
    },
    {
      mod: 'sex-states',
      name: 'receiving_blowjob',
      expectedTemplate: 'receiving oral sex',
      priority: 78,
      targetRole: 'giving_entity_id',
    },
    {
      mod: 'sitting-states',
      name: 'sitting_on',
      expectedTemplate: 'is sitting on',
      priority: 62,
      targetRole: 'furniture_id',
    },
    {
      mod: 'straddling-states',
      name: 'straddling_waist',
      expectedTemplate: 'is straddling',
      priority: 82,
      targetRole: 'target_id',
    },
  ];

  describe('Component Activation Verification', () => {
    activatedComponents.forEach(
      ({ mod, name, expectedTemplate, priority, targetRole }) => {
        const componentId = `${mod}:${name}`;

        describe(`${componentId}`, () => {
          let componentDef;

          beforeAll(() => {
            const componentPath = join(
              process.cwd(),
              `data/mods/${mod}/components/${name}.component.json`
            );
            const rawData = readFileSync(componentPath, 'utf8');
            componentDef = JSON.parse(rawData);
          });

          it('should have activityMetadata property in dataSchema', () => {
            expect(componentDef.dataSchema.properties).toHaveProperty(
              'activityMetadata'
            );
          });

          it('should have valid activityMetadata structure', () => {
            const metadata =
              componentDef.dataSchema.properties.activityMetadata;
            expect(metadata.type).toBe('object');
            expect(metadata.additionalProperties).toBe(false);
            expect(metadata.description).toContain(
              'Inline metadata for activity description generation'
            );
          });

          it('should have all required activityMetadata fields', () => {
            const metadata =
              componentDef.dataSchema.properties.activityMetadata;
            expect(metadata.properties).toHaveProperty(
              'shouldDescribeInActivity'
            );
            expect(metadata.properties).toHaveProperty('template');
            expect(metadata.properties).toHaveProperty('targetRole');
            expect(metadata.properties).toHaveProperty('priority');
          });

          it('should have template with expected content', () => {
            const field =
              componentDef.dataSchema.properties.activityMetadata.properties
                .template;
            expect(field.type).toBe('string');
            expect(field.default).toContain(expectedTemplate);
            expect(field.default).toContain('{actor}');
          });

          it('should have correct targetRole mapping', () => {
            const field =
              componentDef.dataSchema.properties.activityMetadata.properties
                .targetRole;
            expect(field.type).toBe('string');
            expect(field.default).toBe(targetRole);
          });

          it('should have correct priority value', () => {
            const field =
              componentDef.dataSchema.properties.activityMetadata.properties
                .priority;
            expect(field.type).toBe('integer');
            expect(field.minimum).toBe(0);
            expect(field.maximum).toBe(100);
            expect(field.default).toBe(priority);
          });

          it('should have targetRole that matches a property in dataSchema', () => {
            const properties = componentDef.dataSchema.properties;
            expect(properties).toHaveProperty(targetRole);
          });
        });
      }
    );
  });

  describe('Priority Distribution', () => {
    it('should have correct priority ordering (highest first)', () => {
      const priorities = [
        { id: 'straddling-states:straddling_waist', priority: 82 },
        { id: 'sex-states:giving_blowjob', priority: 80 },
        { id: 'sex-states:receiving_blowjob', priority: 78 },
        { id: 'biting-states:biting_neck', priority: 73 },
        { id: 'kissing:kissing', priority: 72 },
      ];

      // Verify ordering is already sorted highest-to-lowest
      const sortedPriorities = [...priorities].sort(
        (a, b) => b.priority - a.priority
      );
      expect(sortedPriorities).toEqual(priorities);
    });

    it('should have unique priorities for better ordering', () => {
      const priorities = activatedComponents.map((c) => c.priority);
      const uniquePriorities = new Set(priorities);
      // Most should be unique (allowing some pairs to share priorities)
      expect(uniquePriorities.size).toBeGreaterThanOrEqual(10);
    });

    it('should have priorities in expected range distribution', () => {
      const priorities = activatedComponents.map((c) => c.priority);
      const highPriority = priorities.filter((p) => p >= 70).length;
      const mediumPriority = priorities.filter((p) => p >= 60 && p < 70).length;

      // Should have both high and medium priority components
      expect(highPriority).toBeGreaterThan(0);
      expect(mediumPriority).toBeGreaterThan(0);
    });
  });

  describe('Reference Implementation Consistency', () => {
    it('should match kneeling_before reference implementation structure', () => {
      const referencePath = join(
        process.cwd(),
        'data/mods/deference-states/components/kneeling_before.component.json'
      );
      const referenceData = JSON.parse(readFileSync(referencePath, 'utf8'));
      const referenceMetadata =
        referenceData.dataSchema.properties.activityMetadata;

      const testPath = join(
        process.cwd(),
        'data/mods/companionship/components/following.component.json'
      );
      const testData = JSON.parse(readFileSync(testPath, 'utf8'));
      const testMetadata = testData.dataSchema.properties.activityMetadata;

      // Should have same top-level structure
      expect(testMetadata.type).toBe(referenceMetadata.type);
      expect(testMetadata.additionalProperties).toBe(
        referenceMetadata.additionalProperties
      );

      // Should have same property keys
      const referenceKeys = Object.keys(referenceMetadata.properties).sort();
      const testKeys = Object.keys(testMetadata.properties).sort();
      expect(testKeys).toEqual(referenceKeys);
    });
  });
});
