/**
 * @file Integration tests for grabbing-states mod component validation.
 * @description Verifies the grabbing_neck and neck_grabbed components are
 * correctly structured with proper schemas and activity metadata.
 */

import { describe, it, expect } from '@jest/globals';
import grabbingNeckComponent from '../../../../data/mods/grabbing-states/components/grabbing_neck.component.json' assert { type: 'json' };
import neckGrabbedComponent from '../../../../data/mods/grabbing-states/components/neck_grabbed.component.json' assert { type: 'json' };

describe('grabbing-states component validation', () => {
  describe('grabbing_neck component', () => {
    it('has valid schema reference', () => {
      expect(grabbingNeckComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct ID format', () => {
      expect(grabbingNeckComponent.id).toBe('grabbing-states:grabbing_neck');
    });

    it('has meaningful description', () => {
      expect(grabbingNeckComponent.description).toBeDefined();
      expect(grabbingNeckComponent.description.length).toBeGreaterThan(10);
    });

    it('requires grabbed_entity_id', () => {
      expect(grabbingNeckComponent.dataSchema.required).toContain(
        'grabbed_entity_id'
      );
    });

    it('requires initiated', () => {
      expect(grabbingNeckComponent.dataSchema.required).toContain('initiated');
    });

    it('grabbed_entity_id has correct pattern for entity IDs', () => {
      const { pattern } =
        grabbingNeckComponent.dataSchema.properties.grabbed_entity_id;
      // Pattern should allow both namespaced (mod:id) and simple (id) entity IDs
      expect(pattern).toBe(
        '^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$'
      );
    });

    it('has consented field with default false', () => {
      const { consented } = grabbingNeckComponent.dataSchema.properties;
      expect(consented.type).toBe('boolean');
      expect(consented.default).toBe(false);
    });

    it('has activityMetadata', () => {
      expect(
        grabbingNeckComponent.dataSchema.properties.activityMetadata
      ).toBeDefined();
      expect(
        grabbingNeckComponent.dataSchema.properties.activityMetadata.type
      ).toBe('object');
    });

    it('activityMetadata has correct template with {actor} and {target} placeholders', () => {
      const { template } =
        grabbingNeckComponent.dataSchema.properties.activityMetadata.properties;
      expect(template.default).toContain('{actor}');
      expect(template.default).toContain('{target}');
    });

    it('activityMetadata has targetRole pointing to grabbed_entity_id', () => {
      const { targetRole } =
        grabbingNeckComponent.dataSchema.properties.activityMetadata.properties;
      expect(targetRole.default).toBe('grabbed_entity_id');
    });

    it('activityMetadata has priority 70', () => {
      const { priority } =
        grabbingNeckComponent.dataSchema.properties.activityMetadata.properties;
      expect(priority.default).toBe(70);
    });

    it('has shouldDescribeInActivity default true', () => {
      const { shouldDescribeInActivity } =
        grabbingNeckComponent.dataSchema.properties.activityMetadata.properties;
      expect(shouldDescribeInActivity.default).toBe(true);
    });

    it('uses additionalProperties false', () => {
      expect(grabbingNeckComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('neck_grabbed component', () => {
    it('has valid schema reference', () => {
      expect(neckGrabbedComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct ID format', () => {
      expect(neckGrabbedComponent.id).toBe('grabbing-states:neck_grabbed');
    });

    it('has meaningful description', () => {
      expect(neckGrabbedComponent.description).toBeDefined();
      expect(neckGrabbedComponent.description.length).toBeGreaterThan(10);
    });

    it('requires grabbing_entity_id', () => {
      expect(neckGrabbedComponent.dataSchema.required).toContain(
        'grabbing_entity_id'
      );
    });

    it('does NOT require initiated (passive role)', () => {
      expect(neckGrabbedComponent.dataSchema.required).not.toContain(
        'initiated'
      );
    });

    it('grabbing_entity_id has correct pattern for entity IDs', () => {
      const { pattern } =
        neckGrabbedComponent.dataSchema.properties.grabbing_entity_id;
      // Pattern should allow both namespaced (mod:id) and simple (id) entity IDs
      expect(pattern).toBe(
        '^([a-zA-Z0-9_]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_]+)$'
      );
    });

    it('has consented field with default false', () => {
      const { consented } = neckGrabbedComponent.dataSchema.properties;
      expect(consented.type).toBe('boolean');
      expect(consented.default).toBe(false);
    });

    it('has activityMetadata', () => {
      expect(
        neckGrabbedComponent.dataSchema.properties.activityMetadata
      ).toBeDefined();
      expect(
        neckGrabbedComponent.dataSchema.properties.activityMetadata.type
      ).toBe('object');
    });

    it('activityMetadata has correct template with {actor} and {target} placeholders', () => {
      const { template } =
        neckGrabbedComponent.dataSchema.properties.activityMetadata.properties;
      expect(template.default).toContain('{actor}');
      expect(template.default).toContain('{target}');
    });

    it('activityMetadata has targetRole pointing to grabbing_entity_id', () => {
      const { targetRole } =
        neckGrabbedComponent.dataSchema.properties.activityMetadata.properties;
      expect(targetRole.default).toBe('grabbing_entity_id');
    });

    it('activityMetadata has priority 66', () => {
      const { priority } =
        neckGrabbedComponent.dataSchema.properties.activityMetadata.properties;
      expect(priority.default).toBe(66);
    });

    it('has shouldDescribeInActivity default true', () => {
      const { shouldDescribeInActivity } =
        neckGrabbedComponent.dataSchema.properties.activityMetadata.properties;
      expect(shouldDescribeInActivity.default).toBe(true);
    });

    it('uses additionalProperties false', () => {
      expect(neckGrabbedComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('cross-component validation', () => {
    it('grabbing_neck priority is higher than neck_grabbed priority', () => {
      const grabbingNeckPriority =
        grabbingNeckComponent.dataSchema.properties.activityMetadata.properties
          .priority.default;
      const neckGrabbedPriority =
        neckGrabbedComponent.dataSchema.properties.activityMetadata.properties
          .priority.default;

      expect(grabbingNeckPriority).toBeGreaterThan(neckGrabbedPriority);
    });

    it('both components use additionalProperties false', () => {
      expect(grabbingNeckComponent.dataSchema.additionalProperties).toBe(false);
      expect(neckGrabbedComponent.dataSchema.additionalProperties).toBe(false);
    });

    it('entity ID fields use same pattern in both components', () => {
      const grabbingNeckPattern =
        grabbingNeckComponent.dataSchema.properties.grabbed_entity_id.pattern;
      const neckGrabbedPattern =
        neckGrabbedComponent.dataSchema.properties.grabbing_entity_id.pattern;

      expect(grabbingNeckPattern).toBe(neckGrabbedPattern);
    });

    it('both components have shouldDescribeInActivity default true', () => {
      const grabbingNeckDefault =
        grabbingNeckComponent.dataSchema.properties.activityMetadata.properties
          .shouldDescribeInActivity.default;
      const neckGrabbedDefault =
        neckGrabbedComponent.dataSchema.properties.activityMetadata.properties
          .shouldDescribeInActivity.default;

      expect(grabbingNeckDefault).toBe(true);
      expect(neckGrabbedDefault).toBe(true);
    });
  });
});
