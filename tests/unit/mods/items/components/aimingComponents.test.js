import { describe, it, expect } from '@jest/globals';

describe('Aiming States Mod - Aiming Components', () => {
  describe('aiming:aimable component', () => {
    it('should be a valid marker component with empty schema', () => {
      const aimable = require('../../../../../data/mods/aiming-states/components/aimable.component.json');
      expect(aimable.id).toBe('aiming:aimable');
      expect(aimable.dataSchema.properties).toEqual({});
      expect(aimable.dataSchema.additionalProperties).toBe(false);
    });

    it('should have correct schema reference', () => {
      const aimable = require('../../../../../data/mods/aiming-states/components/aimable.component.json');
      expect(aimable.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should have descriptive documentation', () => {
      const aimable = require('../../../../../data/mods/aiming-states/components/aimable.component.json');
      expect(aimable.description).toBeDefined();
      expect(aimable.description).toContain('aimed');
      expect(aimable.description.length).toBeGreaterThan(50);
    });
  });

  describe('aiming:aimed_at component', () => {
    it('should have required fields for state tracking', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      expect(aimedAt.id).toBe('aiming:aimed_at');
      expect(aimedAt.dataSchema.required).toEqual(['targetId', 'aimedBy']);
      expect(aimedAt.dataSchema.properties.targetId.$ref).toBe(
        'schema://living-narrative-engine/common.schema.json#/definitions/namespacedId'
      );
      expect(aimedAt.dataSchema.properties.aimedBy.$ref).toBe(
        'schema://living-narrative-engine/common.schema.json#/definitions/namespacedId'
      );
      expect(aimedAt.dataSchema.properties.activityMetadata).toBeDefined();
    });

    it('should have correct schema reference', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      expect(aimedAt.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should have activityMetadata with correct structure', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      const activityMetadata = aimedAt.dataSchema.properties.activityMetadata;

      expect(activityMetadata.type).toBe('object');
      expect(
        activityMetadata.properties.shouldDescribeInActivity
      ).toBeDefined();
      expect(activityMetadata.properties.template).toBeDefined();
      expect(activityMetadata.properties.targetRole).toBeDefined();
      expect(activityMetadata.properties.priority).toBeDefined();
    });

    it('should have correct activityMetadata defaults', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      const activityMetadata =
        aimedAt.dataSchema.properties.activityMetadata.properties;

      expect(activityMetadata.shouldDescribeInActivity.default).toBe(true);
      expect(activityMetadata.template.default).toBe(
        '{item} is aimed at {target} by {actor}'
      );
      expect(activityMetadata.targetRole.default).toBe('targetId');
      expect(activityMetadata.priority.default).toBe(70);
    });

    it('should have priority field with valid constraints', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      const priority =
        aimedAt.dataSchema.properties.activityMetadata.properties.priority;

      expect(priority.type).toBe('integer');
      expect(priority.minimum).toBe(0);
      expect(priority.maximum).toBe(100);
    });

    it('should have descriptive documentation', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      expect(aimedAt.description).toBeDefined();
      expect(aimedAt.description).toContain('aimed');
      expect(aimedAt.description.length).toBeGreaterThan(50);
    });

    it('should disallow additional properties', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      expect(aimedAt.dataSchema.additionalProperties).toBe(false);
    });

    it('should have proper field descriptions', () => {
      const aimedAt = require('../../../../../data/mods/aiming-states/components/aimed_at.component.json');
      const props = aimedAt.dataSchema.properties;

      expect(props.targetId.description).toBeDefined();
      expect(props.aimedBy.description).toBeDefined();
      expect(props.activityMetadata.description).toBeDefined();
    });
  });
});
