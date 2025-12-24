/**
 * @file Unit tests for the breathing:hypoxic component schema
 */

import { describe, it, expect } from '@jest/globals';
import hypoxicComponent from '../../../../../data/mods/breathing/components/hypoxic.component.json';

describe('breathing:hypoxic component', () => {
  describe('component definition', () => {
    it('has correct id', () => {
      expect(hypoxicComponent.id).toBe('breathing:hypoxic');
    });

    it('has appropriate description', () => {
      expect(hypoxicComponent.description).toContain('oxygen deprivation');
      expect(hypoxicComponent.description).toContain('severity');
    });

    it('has standard component schema reference', () => {
      expect(hypoxicComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct dataSchema type', () => {
      expect(hypoxicComponent.dataSchema.type).toBe('object');
    });
  });

  describe('severity property schema', () => {
    it('defines severity property', () => {
      expect(hypoxicComponent.dataSchema.properties.severity).toBeDefined();
    });

    it('severity is type string', () => {
      expect(hypoxicComponent.dataSchema.properties.severity.type).toBe(
        'string'
      );
    });

    it('severity has correct enum values', () => {
      const enumValues = hypoxicComponent.dataSchema.properties.severity.enum;
      expect(enumValues).toEqual(['mild', 'moderate', 'severe']);
    });

    it('severity has default of mild', () => {
      expect(hypoxicComponent.dataSchema.properties.severity.default).toBe(
        'mild'
      );
    });

    it('severity is required', () => {
      expect(hypoxicComponent.dataSchema.required).toContain('severity');
    });

    it('severity has description', () => {
      expect(
        hypoxicComponent.dataSchema.properties.severity.description
      ).toBeDefined();
    });
  });

  describe('turnsInState property schema', () => {
    it('defines turnsInState property', () => {
      expect(
        hypoxicComponent.dataSchema.properties.turnsInState
      ).toBeDefined();
    });

    it('turnsInState is type integer', () => {
      expect(hypoxicComponent.dataSchema.properties.turnsInState.type).toBe(
        'integer'
      );
    });

    it('turnsInState has minimum of 0', () => {
      expect(hypoxicComponent.dataSchema.properties.turnsInState.minimum).toBe(
        0
      );
    });

    it('turnsInState has default of 0', () => {
      expect(hypoxicComponent.dataSchema.properties.turnsInState.default).toBe(
        0
      );
    });

    it('turnsInState is required', () => {
      expect(hypoxicComponent.dataSchema.required).toContain('turnsInState');
    });

    it('turnsInState has description', () => {
      expect(
        hypoxicComponent.dataSchema.properties.turnsInState.description
      ).toContain('turns');
    });
  });

  describe('actionPenalty property schema', () => {
    it('defines actionPenalty property', () => {
      expect(
        hypoxicComponent.dataSchema.properties.actionPenalty
      ).toBeDefined();
    });

    it('actionPenalty is type integer', () => {
      expect(hypoxicComponent.dataSchema.properties.actionPenalty.type).toBe(
        'integer'
      );
    });

    it('actionPenalty has minimum of 0', () => {
      expect(
        hypoxicComponent.dataSchema.properties.actionPenalty.minimum
      ).toBe(0);
    });

    it('actionPenalty has default of 0', () => {
      expect(
        hypoxicComponent.dataSchema.properties.actionPenalty.default
      ).toBe(0);
    });

    it('actionPenalty is not required (has default)', () => {
      expect(hypoxicComponent.dataSchema.required).not.toContain(
        'actionPenalty'
      );
    });

    it('actionPenalty has description', () => {
      expect(
        hypoxicComponent.dataSchema.properties.actionPenalty.description
      ).toContain('Penalty');
    });
  });

  describe('activityMetadata property schema', () => {
    it('defines activityMetadata property', () => {
      expect(
        hypoxicComponent.dataSchema.properties.activityMetadata
      ).toBeDefined();
    });

    it('activityMetadata is type object', () => {
      expect(hypoxicComponent.dataSchema.properties.activityMetadata.type).toBe(
        'object'
      );
    });

    it('activityMetadata does not allow additional properties', () => {
      expect(
        hypoxicComponent.dataSchema.properties.activityMetadata
          .additionalProperties
      ).toBe(false);
    });

    describe('shouldDescribeInActivity property', () => {
      it('defines shouldDescribeInActivity', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .shouldDescribeInActivity
        ).toBeDefined();
      });

      it('shouldDescribeInActivity is type boolean', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .shouldDescribeInActivity.type
        ).toBe('boolean');
      });

      it('shouldDescribeInActivity defaults to true', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .shouldDescribeInActivity.default
        ).toBe(true);
      });
    });

    describe('template property', () => {
      it('defines template', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .template
        ).toBeDefined();
      });

      it('template is type string', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .template.type
        ).toBe('string');
      });

      it('template has correct default value', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .template.default
        ).toBe('{actor} is struggling to breathe');
      });
    });

    describe('priority property', () => {
      it('defines priority', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .priority
        ).toBeDefined();
      });

      it('priority is type integer', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .priority.type
        ).toBe('integer');
      });

      it('priority has minimum of 0', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .priority.minimum
        ).toBe(0);
      });

      it('priority has maximum of 100', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .priority.maximum
        ).toBe(100);
      });

      it('priority has default of 80', () => {
        expect(
          hypoxicComponent.dataSchema.properties.activityMetadata.properties
            .priority.default
        ).toBe(80);
      });
    });

    it('activityMetadata is not required', () => {
      expect(hypoxicComponent.dataSchema.required).not.toContain(
        'activityMetadata'
      );
    });
  });

  describe('schema constraints', () => {
    it('does not allow additional properties', () => {
      expect(hypoxicComponent.dataSchema.additionalProperties).toBe(false);
    });

    it('has exactly four defined properties', () => {
      const propertyNames = Object.keys(
        hypoxicComponent.dataSchema.properties
      );
      expect(propertyNames).toHaveLength(4);
      expect(propertyNames).toContain('severity');
      expect(propertyNames).toContain('turnsInState');
      expect(propertyNames).toContain('actionPenalty');
      expect(propertyNames).toContain('activityMetadata');
    });

    it('has exactly two required properties', () => {
      expect(hypoxicComponent.dataSchema.required).toHaveLength(2);
      expect(hypoxicComponent.dataSchema.required).toContain('severity');
      expect(hypoxicComponent.dataSchema.required).toContain('turnsInState');
    });
  });
});
