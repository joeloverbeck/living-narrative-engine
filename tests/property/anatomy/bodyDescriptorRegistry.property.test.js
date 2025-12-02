/**
 * @file Property-based tests for Body Descriptor Registry
 * Uses fast-check to verify registry invariants hold for all descriptors
 */

import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import {
  BODY_DESCRIPTOR_REGISTRY,
  validateDescriptorValue,
  getAllDescriptorNames,
} from '../../../src/anatomy/registries/bodyDescriptorRegistry.js';

/**
 * Required properties for each registry entry
 */
const REQUIRED_PROPERTIES = [
  'schemaProperty',
  'displayLabel',
  'displayKey',
  'dataPath',
  'validValues',
  'displayOrder',
  'extractor',
  'formatter',
  'required',
];

/**
 * Get descriptors with enumerated validValues (not null)
 *
 * @returns {string[]} Descriptor names with enum constraints
 */
function getEnumeratedDescriptors() {
  return getAllDescriptorNames().filter(
    (name) => BODY_DESCRIPTOR_REGISTRY[name].validValues !== null
  );
}

/**
 * Get descriptors with free-form values (validValues === null)
 *
 * @returns {string[]} Descriptor names without enum constraints
 */
function getFreeFormDescriptors() {
  return getAllDescriptorNames().filter(
    (name) => BODY_DESCRIPTOR_REGISTRY[name].validValues === null
  );
}

describe('Body Descriptor Registry - Property Tests', () => {
  describe('Descriptor Exhaustiveness', () => {
    it('should accept all validValues for each enumerated descriptor via validateDescriptorValue', () => {
      // Property: ∀ descriptor with validValues, ∀ value in validValues,
      //           validateDescriptorValue(descriptor, value) === true
      const enumeratedDescriptors = getEnumeratedDescriptors();

      for (const descriptorName of enumeratedDescriptors) {
        const validValues = BODY_DESCRIPTOR_REGISTRY[descriptorName].validValues;

        // For each enumerated descriptor, all valid values must pass validation
        fc.assert(
          fc.property(fc.constantFrom(...validValues), (value) => {
            const result = validateDescriptorValue(descriptorName, value);
            expect(result.valid).toBe(true);
          }),
          {
            numRuns: validValues.length,
            seed: 42, // Deterministic for reproducibility
          }
        );
      }
    });

    it('should reject invalid values for enumerated descriptors', () => {
      // Property: ∀ descriptor with validValues, arbitrary invalid string → false
      const enumeratedDescriptors = getEnumeratedDescriptors();

      for (const descriptorName of enumeratedDescriptors) {
        const validValues = BODY_DESCRIPTOR_REGISTRY[descriptorName].validValues;

        // Generate strings that are guaranteed not to be in validValues
        fc.assert(
          fc.property(
            fc.string().filter((s) => !validValues.includes(s)),
            (invalidValue) => {
              const result = validateDescriptorValue(
                descriptorName,
                invalidValue
              );
              expect(result.valid).toBe(false);
            }
          ),
          { numRuns: 20 }
        );
      }
    });

    it('should accept any non-empty string for free-form descriptors', () => {
      // Property: ∀ descriptor with validValues === null,
      //           ∀ non-empty string → validateDescriptorValue returns true
      const freeFormDescriptors = getFreeFormDescriptors();

      for (const descriptorName of freeFormDescriptors) {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1 }), // Non-empty strings
            (value) => {
              const result = validateDescriptorValue(descriptorName, value);
              expect(result.valid).toBe(true);
            }
          ),
          { numRuns: 50 }
        );
      }
    });
  });

  describe('Registry Structure', () => {
    it('should have all required properties for each entry', () => {
      // Property: ∀ entry in registry, entry has all required properties
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];

          for (const prop of REQUIRED_PROPERTIES) {
            expect(entry).toHaveProperty(prop);
          }
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should have validValues as null or Array for each entry', () => {
      // Property: ∀ entry, validValues === null OR Array.isArray(validValues)
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
          const validValues = entry.validValues;

          const isNullOrArray =
            validValues === null || Array.isArray(validValues);
          expect(isNullOrArray).toBe(true);
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should have positive displayOrder for each entry', () => {
      // Property: ∀ entry, displayOrder > 0
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
          expect(typeof entry.displayOrder).toBe('number');
          expect(entry.displayOrder).toBeGreaterThan(0);
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should have callable extractor function for each entry', () => {
      // Property: ∀ entry, extractor is a function
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
          expect(typeof entry.extractor).toBe('function');
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should have callable formatter function for each entry', () => {
      // Property: ∀ entry, formatter is a function
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
          expect(typeof entry.formatter).toBe('function');
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should have boolean required field for each entry', () => {
      // Property: ∀ entry, required is boolean
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
          expect(typeof entry.required).toBe('boolean');
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should have string type for schemaProperty, displayLabel, displayKey, dataPath', () => {
      // Property: ∀ entry, string fields are strings
      const stringFields = [
        'schemaProperty',
        'displayLabel',
        'displayKey',
        'dataPath',
      ];
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];

          for (const field of stringFields) {
            expect(typeof entry[field]).toBe('string');
            expect(entry[field].length).toBeGreaterThan(0);
          }
        }),
        { numRuns: descriptorNames.length }
      );
    });
  });

  describe('Registry Consistency', () => {
    it('should have unique displayOrder values across entries', () => {
      // Property: No two entries share the same displayOrder
      const descriptorNames = getAllDescriptorNames();
      const displayOrders = descriptorNames.map(
        (name) => BODY_DESCRIPTOR_REGISTRY[name].displayOrder
      );
      const uniqueOrders = new Set(displayOrders);

      expect(uniqueOrders.size).toBe(displayOrders.length);
    });

    it('should match registry keys with schemaProperty values', () => {
      // Property: ∀ key in registry, key === entry.schemaProperty
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
          expect(descriptorName).toBe(entry.schemaProperty);
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should have valid dataPath format for each entry', () => {
      // Property: ∀ entry, dataPath starts with "body.descriptors."
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
          expect(entry.dataPath).toMatch(/^body\.descriptors\./);
        }),
        { numRuns: descriptorNames.length }
      );
    });
  });

  describe('Extractor and Formatter Behavior', () => {
    it('should not throw when extractor is called with undefined body component', () => {
      // Property: Extractors handle undefined gracefully
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(fc.constantFrom(...descriptorNames), (descriptorName) => {
          const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];

          expect(() => entry.extractor(undefined)).not.toThrow();
          expect(() => entry.extractor(null)).not.toThrow();
          expect(() => entry.extractor({})).not.toThrow();
        }),
        { numRuns: descriptorNames.length }
      );
    });

    it('should return string from formatter for any value', () => {
      // Property: Formatters return strings
      const descriptorNames = getAllDescriptorNames();

      fc.assert(
        fc.property(
          fc.constantFrom(...descriptorNames),
          fc.string(),
          (descriptorName, value) => {
            const entry = BODY_DESCRIPTOR_REGISTRY[descriptorName];
            const result = entry.formatter(value);

            expect(typeof result).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
