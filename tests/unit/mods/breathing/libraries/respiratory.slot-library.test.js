/**
 * @file Unit tests for the breathing:respiratory_slots slot library
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import respiratorySlotLibrary from '../../../../../data/mods/breathing/libraries/respiratory.slot-library.json';
import anatomySlotLibrarySchema from '../../../../../data/schemas/anatomy.slot-library.schema.json';
import anatomyBlueprintSchema from '../../../../../data/schemas/anatomy.blueprint.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

describe('breathing:respiratory_slots slot library', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Add referenced schemas to AJV instance
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    ajv.addSchema(
      anatomyBlueprintSchema,
      'schema://living-narrative-engine/anatomy.blueprint.schema.json'
    );

    // Compile the slot library schema
    validate = ajv.compile(anatomySlotLibrarySchema);
  });

  describe('schema validation', () => {
    it('passes anatomy.slot-library.schema.json validation', () => {
      const ok = validate(respiratorySlotLibrary);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('library definition', () => {
    it('has correct id format', () => {
      expect(respiratorySlotLibrary.id).toBe('breathing:respiratory_slots');
    });

    it('has standard slot library schema reference', () => {
      expect(respiratorySlotLibrary.$schema).toBe(
        'schema://living-narrative-engine/anatomy.slot-library.schema.json'
      );
    });

    it('has appropriate description', () => {
      expect(respiratorySlotLibrary.description).toBeDefined();
      expect(respiratorySlotLibrary.description).toContain('respiratory');
    });
  });

  describe('standard_lung slot definition', () => {
    it('defines standard_lung slot', () => {
      expect(respiratorySlotLibrary.slotDefinitions.standard_lung).toBeDefined();
    });

    it('has correct socket', () => {
      expect(respiratorySlotLibrary.slotDefinitions.standard_lung.socket).toBe(
        'lung_socket'
      );
    });

    it('requires lung partType', () => {
      expect(
        respiratorySlotLibrary.slotDefinitions.standard_lung.requirements.partType
      ).toBe('lung');
    });

    it('requires anatomy:part component', () => {
      expect(
        respiratorySlotLibrary.slotDefinitions.standard_lung.requirements.components
      ).toContain('anatomy:part');
    });

    it('requires breathing-states:respiratory_organ component', () => {
      expect(
        respiratorySlotLibrary.slotDefinitions.standard_lung.requirements.components
      ).toContain('breathing-states:respiratory_organ');
    });

    it('has exactly two required components', () => {
      expect(
        respiratorySlotLibrary.slotDefinitions.standard_lung.requirements.components
      ).toHaveLength(2);
    });
  });

  describe('invariants', () => {
    it('does not define clothing definitions (lungs do not need clothes)', () => {
      expect(respiratorySlotLibrary.clothingDefinitions).toBeUndefined();
    });

    it('has exactly one slot definition', () => {
      expect(Object.keys(respiratorySlotLibrary.slotDefinitions)).toHaveLength(1);
    });
  });
});
