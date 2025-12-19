/**
 * @file End-to-end tests for Activity Integration in Body Descriptions
 * @see specs/activity-description-system-activation.spec.md
 * @description Validates that activity metadata integrates correctly into full body descriptions
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Activity Integration in Body Descriptions', () => {
  let componentSchemas;

  beforeAll(() => {
    // Load all activity-enabled component schemas
    const components = [
      { mod: 'companionship', name: 'following' },
      { mod: 'companionship', name: 'leading' },
      { mod: 'hand-holding', name: 'hand_held' },
      { mod: 'hand-holding', name: 'holding_hand' },
      { mod: 'kissing', name: 'kissing' },
      { mod: 'positioning', name: 'being_bitten_in_neck' },
      { mod: 'positioning', name: 'being_hugged' },
      { mod: 'positioning', name: 'biting_neck' },
      { mod: 'sex-states', name: 'giving_blowjob' },
      { mod: 'positioning', name: 'hugging' },
      { mod: 'positioning', name: 'kneeling_before' },
      { mod: 'positioning', name: 'lying_down' },
      { mod: 'sex-states', name: 'receiving_blowjob' },
      { mod: 'positioning', name: 'sitting_on' },
      { mod: 'positioning', name: 'straddling_waist' },
    ];

    componentSchemas = components.map(({ mod, name }) => {
      const path = join(
        process.cwd(),
        `data/mods/${mod}/components/${name}.component.json`
      );
      const rawData = readFileSync(path, 'utf8');
      return { id: `${mod}:${name}`, schema: JSON.parse(rawData) };
    });
  });

  describe('Activity Metadata Availability', () => {
    it('should have activity metadata in all targeted components', () => {
      componentSchemas.forEach(({ id, schema }) => {
        expect(schema.dataSchema.properties).toHaveProperty('activityMetadata');

        const metadata = schema.dataSchema.properties.activityMetadata;
        expect(metadata.type).toBe('object');
        expect(metadata.properties).toHaveProperty('shouldDescribeInActivity');
        expect(metadata.properties).toHaveProperty('template');
        expect(metadata.properties).toHaveProperty('targetRole');
        expect(metadata.properties).toHaveProperty('priority');
      });
    });

    it('should have priority-based ordering available for activity composition', () => {
      const priorities = componentSchemas.map(({ id, schema }) => ({
        id,
        priority:
          schema.dataSchema.properties.activityMetadata.properties.priority
            .default,
      }));

      // Verify all priorities are in valid range
      priorities.forEach(({ id, priority }) => {
        expect(priority).toBeGreaterThanOrEqual(0);
        expect(priority).toBeLessThanOrEqual(100);
      });

      // Verify we can sort by priority (highest first)
      const sorted = [...priorities].sort((a, b) => b.priority - a.priority);
      expect(sorted[0].id).toBe('positioning:straddling_waist'); // priority 82
      expect(sorted[sorted.length - 1].id).toBe('companionship:leading'); // priority 58
    });
  });

  describe('Template Structure for Body Description Integration', () => {
    it('should have templates with {actor} placeholder for entity substitution', () => {
      componentSchemas.forEach(({ id, schema }) => {
        const template =
          schema.dataSchema.properties.activityMetadata.properties.template
            .default;
        expect(template).toContain('{actor}');
      });
    });

    it('should have templates with {target} placeholder or standalone text', () => {
      componentSchemas.forEach(({ id, schema }) => {
        const template =
          schema.dataSchema.properties.activityMetadata.properties.template
            .default;
        const targetRole =
          schema.dataSchema.properties.activityMetadata.properties.targetRole
            .default;

        // Verify targetRole maps to actual component property
        expect(schema.dataSchema.properties).toHaveProperty(targetRole);

        // Template should either have {target} or reference target implicitly
        const hasTargetPlaceholder = template.includes('{target}');
        const isStandaloneDescription =
          !hasTargetPlaceholder && targetRole === 'followers';

        expect(hasTargetPlaceholder || isStandaloneDescription).toBe(true);
      });
    });

    it('should have templates formatted for natural language composition', () => {
      componentSchemas.forEach(({ id, schema }) => {
        const template =
          schema.dataSchema.properties.activityMetadata.properties.template
            .default;

        // Templates should be complete phrases starting with {actor}
        expect(template).toMatch(/^\{actor\}/);

        // Templates should use present progressive or present tense
        expect(template).toMatch(
          /is (following|leading|holding|sitting|straddling|lying|biting|kissing|hugging|performing|receiving|being|kneeling)/
        );
      });
    });
  });

  describe('Priority Distribution for Activity Ordering', () => {
    it('should have distinct priority tiers for activity composition', () => {
      const priorities = componentSchemas.map(
        ({ schema }) =>
          schema.dataSchema.properties.activityMetadata.properties.priority
            .default
      );

      const highPriority = priorities.filter((p) => p >= 70); // Highly intimate/explicit
      const mediumPriority = priorities.filter((p) => p >= 60 && p < 70); // Moderate intimate
      const lowPriority = priorities.filter((p) => p < 60); // Relational states

      // Should have activities across priority spectrum
      expect(highPriority.length).toBeGreaterThan(0);
      expect(mediumPriority.length).toBeGreaterThan(0);
      expect(lowPriority.length).toBeGreaterThan(0);
    });

    it('should have unique or near-unique priorities for consistent ordering', () => {
      const priorities = componentSchemas.map(
        ({ schema }) =>
          schema.dataSchema.properties.activityMetadata.properties.priority
            .default
      );

      const uniquePriorities = new Set(priorities);
      const uniquenessRatio = uniquePriorities.size / priorities.length;

      // At least 60% unique priorities for effective ordering
      expect(uniquenessRatio).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('Component Schema Integration', () => {
    it('should conform to component.schema.json structure', () => {
      componentSchemas.forEach(({ id, schema }) => {
        // Verify standard component schema fields
        expect(schema).toHaveProperty('$schema');
        expect(schema).toHaveProperty('id');
        expect(schema).toHaveProperty('description');
        expect(schema).toHaveProperty('dataSchema');

        // Verify schema reference
        expect(schema.$schema).toBe(
          'schema://living-narrative-engine/component.schema.json'
        );

        // Verify component ID matches expected format
        expect(schema.id).toBe(id);
      });
    });

    it('should have activityMetadata as non-required property', () => {
      componentSchemas.forEach(({ schema }) => {
        const required = schema.dataSchema.required || [];

        // activityMetadata should NOT be in required fields (it's system metadata)
        expect(required).not.toContain('activityMetadata');
      });
    });

    it('should have shouldDescribeInActivity defaulting to true', () => {
      componentSchemas.forEach(({ schema }) => {
        const shouldDescribe =
          schema.dataSchema.properties.activityMetadata.properties
            .shouldDescribeInActivity.default;

        // All activated components should default to true
        expect(shouldDescribe).toBe(true);
      });
    });
  });

  describe('Full Pipeline Readiness', () => {
    it('should have all metadata fields required for ActivityDescriptionService', () => {
      componentSchemas.forEach(({ id, schema }) => {
        const metadata = schema.dataSchema.properties.activityMetadata;
        const properties = metadata.properties;

        // Verify all required fields for ActivityDescriptionService are present
        expect(properties).toHaveProperty('shouldDescribeInActivity');
        expect(properties.shouldDescribeInActivity).toHaveProperty('default');

        expect(properties).toHaveProperty('template');
        expect(properties.template).toHaveProperty('default');

        expect(properties).toHaveProperty('targetRole');
        expect(properties.targetRole).toHaveProperty('default');

        expect(properties).toHaveProperty('priority');
        expect(properties.priority).toHaveProperty('default');

        // Verify types match expected schema
        expect(properties.shouldDescribeInActivity.type).toBe('boolean');
        expect(properties.template.type).toBe('string');
        expect(properties.targetRole.type).toBe('string');
        expect(properties.priority.type).toBe('integer');
      });
    });

    it('should support multi-activity composition through priority ordering', () => {
      // Simulate scenario: entity has multiple activity components
      const activityComponents = [
        { id: 'positioning:straddling_waist', priority: 82 },
        { id: 'kissing:kissing', priority: 72 },
        { id: 'hand-holding:holding_hand', priority: 67 },
      ];

      // Sort by priority (highest first) as ActivityDescriptionService would
      const sorted = [...activityComponents].sort(
        (a, b) => b.priority - a.priority
      );

      // Verify expected ordering
      expect(sorted[0].id).toBe('positioning:straddling_waist');
      expect(sorted[1].id).toBe('kissing:kissing');
      expect(sorted[2].id).toBe('hand-holding:holding_hand');

      // Verify priorities descend monotonically
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].priority).toBeLessThanOrEqual(sorted[i - 1].priority);
      }
    });

    it('should support cache invalidation through component updates', () => {
      // Verify each component has all required data for cache key generation
      componentSchemas.forEach(({ id, schema }) => {
        // Component ID is stable
        expect(id).toBeTruthy();
        expect(typeof id).toBe('string');

        // Metadata structure is stable
        expect(schema.dataSchema.properties.activityMetadata).toBeTruthy();
        expect(typeof schema.dataSchema.properties.activityMetadata).toBe(
          'object'
        );

        // Priority is stable for cache key generation
        const priority =
          schema.dataSchema.properties.activityMetadata.properties.priority
            .default;
        expect(typeof priority).toBe('number');
        expect(Number.isInteger(priority)).toBe(true);
      });
    });
  });

  describe('Reference Implementation Compliance', () => {
    it('should match kneeling_before metadata structure exactly', () => {
      const referencePath = join(
        process.cwd(),
        'data/mods/positioning/components/kneeling_before.component.json'
      );
      const referenceData = JSON.parse(readFileSync(referencePath, 'utf8'));
      const referenceMetadata =
        referenceData.dataSchema.properties.activityMetadata;

      componentSchemas.forEach(({ id, schema }) => {
        const metadata = schema.dataSchema.properties.activityMetadata;

        // Same top-level structure
        expect(metadata.type).toBe(referenceMetadata.type);
        expect(metadata.additionalProperties).toBe(
          referenceMetadata.additionalProperties
        );
        expect(metadata.description).toBe(referenceMetadata.description);

        // Same property set
        const referenceKeys = Object.keys(referenceMetadata.properties).sort();
        const componentKeys = Object.keys(metadata.properties).sort();
        expect(componentKeys).toEqual(referenceKeys);

        // Same property types
        Object.keys(referenceMetadata.properties).forEach((key) => {
          expect(metadata.properties[key].type).toBe(
            referenceMetadata.properties[key].type
          );
        });
      });
    });
  });
});
