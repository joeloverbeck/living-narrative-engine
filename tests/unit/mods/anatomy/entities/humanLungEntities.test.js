/**
 * @file Test suite to validate human lung entity definitions
 * @see data/mods/anatomy/entities/definitions/human_lung_left.entity.json
 * @see data/mods/anatomy/entities/definitions/human_lung_right.entity.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Component schemas for validation ---
import partComponent from '../../../../../data/mods/anatomy/components/part.component.json';
import partHealthComponent from '../../../../../data/mods/anatomy/components/part_health.component.json';
import respiratoryOrganComponent from '../../../../../data/mods/breathing-states/components/respiratory_organ.component.json';
import nameComponent from '../../../../../data/mods/core/components/name.component.json';
import weightComponent from '../../../../../data/mods/core/components/weight.component.json';

// --- Entity files to validate ---
import humanLungLeft from '../../../../../data/mods/anatomy/entities/definitions/human_lung_left.entity.json';
import humanLungRight from '../../../../../data/mods/anatomy/entities/definitions/human_lung_right.entity.json';

/**
 * Test suite – Human Lung Entity Validation.
 *
 * This suite validates that human lung entities have all required components
 * correctly configured according to OXYDROSYS-006 acceptance criteria.
 */
describe('Human Lung Entities', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validatePart;
  /** @type {import('ajv').ValidateFunction} */
  let validatePartHealth;
  /** @type {import('ajv').ValidateFunction} */
  let validateRespiratoryOrgan;
  /** @type {import('ajv').ValidateFunction} */
  let validateName;
  /** @type {import('ajv').ValidateFunction} */
  let validateWeight;

  beforeAll(() => {
    const ajv = new Ajv({
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    validatePart = ajv.compile(partComponent.dataSchema);
    validatePartHealth = ajv.compile(partHealthComponent.dataSchema);
    validateRespiratoryOrgan = ajv.compile(respiratoryOrganComponent.dataSchema);
    validateName = ajv.compile(nameComponent.dataSchema);
    validateWeight = ajv.compile(weightComponent.dataSchema);
  });

  describe('anatomy:human_lung_left (Left Lung)', () => {
    test('should have correct entity ID', () => {
      expect(humanLungLeft.id).toBe('anatomy:human_lung_left');
    });

    test('should have core:name component with text property', () => {
      const component = humanLungLeft.components['core:name'];
      expect(component).toBeDefined();
      expect(component.text).toBe('left lung');
    });

    test('should pass core:name schema validation', () => {
      const component = humanLungLeft.components['core:name'];
      const valid = validateName(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validateName.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have core:weight component', () => {
      const component = humanLungLeft.components['core:weight'];
      expect(component).toBeDefined();
      expect(component.weight).toBe(0.6);
    });

    test('should pass core:weight schema validation', () => {
      const component = humanLungLeft.components['core:weight'];
      const valid = validateWeight(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validateWeight.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have anatomy:part component with lung subType', () => {
      const component = humanLungLeft.components['anatomy:part'];
      expect(component).toBeDefined();
      expect(component.subType).toBe('lung');
    });

    test('should have left orientation', () => {
      const component = humanLungLeft.components['anatomy:part'];
      expect(component.orientation).toBe('left');
    });

    test('should have hit_probability_weight of 0 (protected organ)', () => {
      const component = humanLungLeft.components['anatomy:part'];
      expect(component.hit_probability_weight).toBe(0);
    });

    test('should pass anatomy:part schema validation', () => {
      const component = humanLungLeft.components['anatomy:part'];
      const valid = validatePart(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validatePart.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have anatomy:part_health component with correct values', () => {
      const component = humanLungLeft.components['anatomy:part_health'];
      expect(component).toBeDefined();
      expect(component.maxHealth).toBe(30);
      expect(component.currentHealth).toBe(30);
      expect(component.state).toBe('healthy');
    });

    test('should pass anatomy:part_health schema validation', () => {
      const component = humanLungLeft.components['anatomy:part_health'];
      const valid = validatePartHealth(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validatePartHealth.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have breathing-states:respiratory_organ component', () => {
      const component = humanLungLeft.components['breathing-states:respiratory_organ'];
      expect(component).toBeDefined();
    });

    test('should have pulmonary respiration type', () => {
      const component = humanLungLeft.components['breathing-states:respiratory_organ'];
      expect(component.respirationType).toBe('pulmonary');
    });

    test('should have oxygenCapacity of 10', () => {
      const component = humanLungLeft.components['breathing-states:respiratory_organ'];
      expect(component.oxygenCapacity).toBe(10);
    });

    test('should have currentOxygen of 10', () => {
      const component = humanLungLeft.components['breathing-states:respiratory_organ'];
      expect(component.currentOxygen).toBe(10);
    });

    test('should pass breathing-states:respiratory_organ schema validation', () => {
      const component = humanLungLeft.components['breathing-states:respiratory_organ'];
      const valid = validateRespiratoryOrgan(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validateRespiratoryOrgan.errors, null, 2));
      }
      expect(valid).toBe(true);
    });
  });

  describe('anatomy:human_lung_right (Right Lung)', () => {
    test('should have correct entity ID', () => {
      expect(humanLungRight.id).toBe('anatomy:human_lung_right');
    });

    test('should have core:name component with text property', () => {
      const component = humanLungRight.components['core:name'];
      expect(component).toBeDefined();
      expect(component.text).toBe('right lung');
    });

    test('should pass core:name schema validation', () => {
      const component = humanLungRight.components['core:name'];
      const valid = validateName(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validateName.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have core:weight component', () => {
      const component = humanLungRight.components['core:weight'];
      expect(component).toBeDefined();
      expect(component.weight).toBe(0.6);
    });

    test('should pass core:weight schema validation', () => {
      const component = humanLungRight.components['core:weight'];
      const valid = validateWeight(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validateWeight.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have anatomy:part component with lung subType', () => {
      const component = humanLungRight.components['anatomy:part'];
      expect(component).toBeDefined();
      expect(component.subType).toBe('lung');
    });

    test('should have right orientation', () => {
      const component = humanLungRight.components['anatomy:part'];
      expect(component.orientation).toBe('right');
    });

    test('should have hit_probability_weight of 0 (protected organ)', () => {
      const component = humanLungRight.components['anatomy:part'];
      expect(component.hit_probability_weight).toBe(0);
    });

    test('should pass anatomy:part schema validation', () => {
      const component = humanLungRight.components['anatomy:part'];
      const valid = validatePart(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validatePart.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have anatomy:part_health component with correct values', () => {
      const component = humanLungRight.components['anatomy:part_health'];
      expect(component).toBeDefined();
      expect(component.maxHealth).toBe(30);
      expect(component.currentHealth).toBe(30);
      expect(component.state).toBe('healthy');
    });

    test('should pass anatomy:part_health schema validation', () => {
      const component = humanLungRight.components['anatomy:part_health'];
      const valid = validatePartHealth(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validatePartHealth.errors, null, 2));
      }
      expect(valid).toBe(true);
    });

    test('should have breathing-states:respiratory_organ component', () => {
      const component = humanLungRight.components['breathing-states:respiratory_organ'];
      expect(component).toBeDefined();
    });

    test('should have pulmonary respiration type', () => {
      const component = humanLungRight.components['breathing-states:respiratory_organ'];
      expect(component.respirationType).toBe('pulmonary');
    });

    test('should have oxygenCapacity of 10', () => {
      const component = humanLungRight.components['breathing-states:respiratory_organ'];
      expect(component.oxygenCapacity).toBe(10);
    });

    test('should have currentOxygen of 10', () => {
      const component = humanLungRight.components['breathing-states:respiratory_organ'];
      expect(component.currentOxygen).toBe(10);
    });

    test('should pass breathing-states:respiratory_organ schema validation', () => {
      const component = humanLungRight.components['breathing-states:respiratory_organ'];
      const valid = validateRespiratoryOrgan(component);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validateRespiratoryOrgan.errors, null, 2));
      }
      expect(valid).toBe(true);
    });
  });

  describe('Component Completeness', () => {
    test('left lung should have all 5 required components', () => {
      const requiredComponents = [
        'core:name',
        'core:weight',
        'anatomy:part',
        'anatomy:part_health',
        'breathing-states:respiratory_organ',
      ];

      for (const componentId of requiredComponents) {
        expect(humanLungLeft.components[componentId]).toBeDefined();
      }
    });

    test('right lung should have all 5 required components', () => {
      const requiredComponents = [
        'core:name',
        'core:weight',
        'anatomy:part',
        'anatomy:part_health',
        'breathing-states:respiratory_organ',
      ];

      for (const componentId of requiredComponents) {
        expect(humanLungRight.components[componentId]).toBeDefined();
      }
    });
  });

  describe('Vital Organ Protection Pattern', () => {
    test('both lungs should follow protected organ pattern (hit_probability_weight = 0)', () => {
      expect(humanLungLeft.components['anatomy:part'].hit_probability_weight).toBe(0);
      expect(humanLungRight.components['anatomy:part'].hit_probability_weight).toBe(0);
    });

    test('both lungs should have health_calculation_weight for contribution to overall health', () => {
      expect(humanLungLeft.components['anatomy:part'].health_calculation_weight).toBeDefined();
      expect(humanLungRight.components['anatomy:part'].health_calculation_weight).toBeDefined();
    });
  });
});
