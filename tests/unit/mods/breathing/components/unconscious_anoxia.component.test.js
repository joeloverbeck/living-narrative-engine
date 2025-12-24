/**
 * @file Unit tests for the breathing:unconscious_anoxia component schema
 */

import { describe, it, expect } from '@jest/globals';
import unconsciousAnoxiaComponent from '../../../../../data/mods/breathing/components/unconscious_anoxia.component.json';
import hypoxicComponent from '../../../../../data/mods/breathing/components/hypoxic.component.json';

describe('breathing:unconscious_anoxia component', () => {
  describe('component definition', () => {
    it('has correct id', () => {
      expect(unconsciousAnoxiaComponent.id).toBe('breathing:unconscious_anoxia');
    });

    it('has appropriate description', () => {
      expect(unconsciousAnoxiaComponent.description).toContain('Unconscious');
      expect(unconsciousAnoxiaComponent.description).toContain(
        'oxygen deprivation'
      );
    });

    it('has standard component schema reference', () => {
      expect(unconsciousAnoxiaComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct dataSchema type', () => {
      expect(unconsciousAnoxiaComponent.dataSchema.type).toBe('object');
    });
  });

  describe('turnsUnconscious property schema', () => {
    it('defines turnsUnconscious property', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.turnsUnconscious
      ).toBeDefined();
    });

    it('turnsUnconscious is type integer', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.turnsUnconscious.type
      ).toBe('integer');
    });

    it('turnsUnconscious has minimum of 0', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.turnsUnconscious
          .minimum
      ).toBe(0);
    });

    it('turnsUnconscious has default of 0', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.turnsUnconscious
          .default
      ).toBe(0);
    });

    it('turnsUnconscious is required', () => {
      expect(unconsciousAnoxiaComponent.dataSchema.required).toContain(
        'turnsUnconscious'
      );
    });

    it('turnsUnconscious has description', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.turnsUnconscious
          .description
      ).toContain('Turns');
    });
  });

  describe('brainDamageStarted property schema', () => {
    it('defines brainDamageStarted property', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.brainDamageStarted
      ).toBeDefined();
    });

    it('brainDamageStarted is type boolean', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.brainDamageStarted.type
      ).toBe('boolean');
    });

    it('brainDamageStarted has default of false', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.brainDamageStarted
          .default
      ).toBe(false);
    });

    it('brainDamageStarted is not required (has default)', () => {
      expect(unconsciousAnoxiaComponent.dataSchema.required).not.toContain(
        'brainDamageStarted'
      );
    });

    it('brainDamageStarted has description', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.brainDamageStarted
          .description
      ).toContain('brain damage');
    });
  });

  describe('activityMetadata property schema', () => {
    it('defines activityMetadata property', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
      ).toBeDefined();
    });

    it('activityMetadata is type object', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata.type
      ).toBe('object');
    });

    it('activityMetadata does not allow additional properties', () => {
      expect(
        unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
          .additionalProperties
      ).toBe(false);
    });

    describe('shouldDescribeInActivity property', () => {
      it('defines shouldDescribeInActivity', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.shouldDescribeInActivity
        ).toBeDefined();
      });

      it('shouldDescribeInActivity is type boolean', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.shouldDescribeInActivity.type
        ).toBe('boolean');
      });

      it('shouldDescribeInActivity defaults to true', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.shouldDescribeInActivity.default
        ).toBe(true);
      });
    });

    describe('template property', () => {
      it('defines template', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.template
        ).toBeDefined();
      });

      it('template is type string', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.template.type
        ).toBe('string');
      });

      it('template has correct default value', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.template.default
        ).toBe('{actor} has lost consciousness from lack of oxygen');
      });
    });

    describe('priority property', () => {
      it('defines priority', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.priority
        ).toBeDefined();
      });

      it('priority is type integer', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.priority.type
        ).toBe('integer');
      });

      it('priority has minimum of 0', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.priority.minimum
        ).toBe(0);
      });

      it('priority has maximum of 100', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.priority.maximum
        ).toBe(100);
      });

      it('priority has default of 95', () => {
        expect(
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.priority.default
        ).toBe(95);
      });

      it('priority (95) is higher than hypoxic priority (80)', () => {
        const unconsciousPriority =
          unconsciousAnoxiaComponent.dataSchema.properties.activityMetadata
            .properties.priority.default;
        const hypoxicPriority =
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .priority.default;
        expect(unconsciousPriority).toBeGreaterThan(hypoxicPriority);
      });
    });

    it('activityMetadata is not required', () => {
      expect(unconsciousAnoxiaComponent.dataSchema.required).not.toContain(
        'activityMetadata'
      );
    });
  });

  describe('schema constraints', () => {
    it('does not allow additional properties', () => {
      expect(unconsciousAnoxiaComponent.dataSchema.additionalProperties).toBe(
        false
      );
    });

    it('has exactly three defined properties', () => {
      const propertyNames = Object.keys(
        unconsciousAnoxiaComponent.dataSchema.properties
      );
      expect(propertyNames).toHaveLength(3);
      expect(propertyNames).toContain('turnsUnconscious');
      expect(propertyNames).toContain('brainDamageStarted');
      expect(propertyNames).toContain('activityMetadata');
    });

    it('has exactly one required property', () => {
      expect(unconsciousAnoxiaComponent.dataSchema.required).toHaveLength(1);
      expect(unconsciousAnoxiaComponent.dataSchema.required).toContain(
        'turnsUnconscious'
      );
    });
  });
});
