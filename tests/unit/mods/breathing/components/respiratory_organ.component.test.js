/**
 * @file Unit tests for the breathing:respiratory_organ component schema
 */

import { describe, it, expect } from '@jest/globals';
import respiratoryOrganComponent from '../../../../../data/mods/breathing/components/respiratory_organ.component.json';

describe('breathing:respiratory_organ component', () => {
  describe('component definition', () => {
    it('has correct id', () => {
      expect(respiratoryOrganComponent.id).toBe('breathing:respiratory_organ');
    });

    it('has appropriate description', () => {
      expect(respiratoryOrganComponent.description).toContain(
        'respiratory organ'
      );
      expect(respiratoryOrganComponent.description).toContain('oxygen');
    });

    it('has standard component schema reference', () => {
      expect(respiratoryOrganComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('has correct dataSchema type', () => {
      expect(respiratoryOrganComponent.dataSchema.type).toBe('object');
    });
  });

  describe('respirationType property schema', () => {
    it('defines respirationType property', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.respirationType
      ).toBeDefined();
    });

    it('respirationType is type string', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.respirationType.type
      ).toBe('string');
    });

    it('respirationType has correct enum values', () => {
      const enumValues =
        respiratoryOrganComponent.dataSchema.properties.respirationType.enum;
      expect(enumValues).toEqual([
        'pulmonary',
        'cutaneous',
        'branchial',
        'tracheal',
        'unusual',
      ]);
    });

    it('respirationType is required', () => {
      expect(respiratoryOrganComponent.dataSchema.required).toContain(
        'respirationType'
      );
    });

    it('respirationType has description mentioning respiration types', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.respirationType
          .description
      ).toContain('pulmonary');
      expect(
        respiratoryOrganComponent.dataSchema.properties.respirationType
          .description
      ).toContain('gills');
    });
  });

  describe('oxygenCapacity property schema', () => {
    it('defines oxygenCapacity property', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.oxygenCapacity
      ).toBeDefined();
    });

    it('oxygenCapacity is type integer', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.oxygenCapacity.type
      ).toBe('integer');
    });

    it('oxygenCapacity has minimum of 1', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.oxygenCapacity.minimum
      ).toBe(1);
    });

    it('oxygenCapacity is required', () => {
      expect(respiratoryOrganComponent.dataSchema.required).toContain(
        'oxygenCapacity'
      );
    });
  });

  describe('currentOxygen property schema', () => {
    it('defines currentOxygen property', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.currentOxygen
      ).toBeDefined();
    });

    it('currentOxygen is type integer', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.currentOxygen.type
      ).toBe('integer');
    });

    it('currentOxygen has minimum of 0', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.currentOxygen.minimum
      ).toBe(0);
    });

    it('currentOxygen is required', () => {
      expect(respiratoryOrganComponent.dataSchema.required).toContain(
        'currentOxygen'
      );
    });
  });

  describe('depletionRate property schema', () => {
    it('defines depletionRate property', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.depletionRate
      ).toBeDefined();
    });

    it('depletionRate is type integer', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.depletionRate.type
      ).toBe('integer');
    });

    it('depletionRate has minimum of 1', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.depletionRate.minimum
      ).toBe(1);
    });

    it('depletionRate has default value of 1', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.depletionRate.default
      ).toBe(1);
    });

    it('depletionRate is not required (has default)', () => {
      expect(respiratoryOrganComponent.dataSchema.required).not.toContain(
        'depletionRate'
      );
    });
  });

  describe('restorationRate property schema', () => {
    it('defines restorationRate property', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.restorationRate
      ).toBeDefined();
    });

    it('restorationRate is type integer', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.restorationRate.type
      ).toBe('integer');
    });

    it('restorationRate has minimum of 1', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.restorationRate.minimum
      ).toBe(1);
    });

    it('restorationRate has default value of 10', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.restorationRate.default
      ).toBe(10);
    });

    it('restorationRate is not required (has default)', () => {
      expect(respiratoryOrganComponent.dataSchema.required).not.toContain(
        'restorationRate'
      );
    });
  });

  describe('environmentCompatibility property schema', () => {
    it('defines environmentCompatibility property', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.environmentCompatibility
      ).toBeDefined();
    });

    it('environmentCompatibility is type array', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.environmentCompatibility
          .type
      ).toBe('array');
    });

    it('environmentCompatibility items have correct enum values', () => {
      const enumValues =
        respiratoryOrganComponent.dataSchema.properties.environmentCompatibility
          .items.enum;
      expect(enumValues).toEqual(['air', 'water', 'any']);
    });

    it('environmentCompatibility has default of ["air"]', () => {
      expect(
        respiratoryOrganComponent.dataSchema.properties.environmentCompatibility
          .default
      ).toEqual(['air']);
    });

    it('environmentCompatibility is not required (has default)', () => {
      expect(respiratoryOrganComponent.dataSchema.required).not.toContain(
        'environmentCompatibility'
      );
    });
  });

  describe('schema constraints', () => {
    it('does not allow additional properties', () => {
      expect(respiratoryOrganComponent.dataSchema.additionalProperties).toBe(
        false
      );
    });

    it('has exactly six defined properties', () => {
      const propertyNames = Object.keys(
        respiratoryOrganComponent.dataSchema.properties
      );
      expect(propertyNames).toHaveLength(6);
      expect(propertyNames).toContain('respirationType');
      expect(propertyNames).toContain('oxygenCapacity');
      expect(propertyNames).toContain('currentOxygen');
      expect(propertyNames).toContain('depletionRate');
      expect(propertyNames).toContain('restorationRate');
      expect(propertyNames).toContain('environmentCompatibility');
    });

    it('has exactly three required properties', () => {
      expect(respiratoryOrganComponent.dataSchema.required).toHaveLength(3);
      expect(respiratoryOrganComponent.dataSchema.required).toContain(
        'respirationType'
      );
      expect(respiratoryOrganComponent.dataSchema.required).toContain(
        'oxygenCapacity'
      );
      expect(respiratoryOrganComponent.dataSchema.required).toContain(
        'currentOxygen'
      );
    });
  });

  describe('validationRules', () => {
    it('has validationRules defined', () => {
      expect(respiratoryOrganComponent.validationRules).toBeDefined();
    });

    it('generates validator', () => {
      expect(respiratoryOrganComponent.validationRules.generateValidator).toBe(
        true
      );
    });

    it('has errorMessages defined', () => {
      expect(
        respiratoryOrganComponent.validationRules.errorMessages
      ).toBeDefined();
    });

    it('has suggestions configuration', () => {
      expect(respiratoryOrganComponent.validationRules.suggestions).toBeDefined();
      expect(
        respiratoryOrganComponent.validationRules.suggestions.enableSimilarity
      ).toBe(true);
    });
  });
});
