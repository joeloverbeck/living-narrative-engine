/**
 * @file Tests to ensure inline schemas in prototype lookups stay synchronized
 * with centralized axis constants.
 * @description This test suite catches drift between the inline dataSchema properties
 * and the centralized axis constants, preventing future schema-data mismatches.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_PROTOTYPE_WEIGHT_AXES,
  ALL_PROTOTYPE_WEIGHT_AXES_SET,
} from '../../../../../src/constants/prototypeAxisConstants.js';

describe('Prototype Schema Synchronization', () => {
  const emotionPrototypesPath = path.resolve(
    'data/mods/core/lookups/emotion_prototypes.lookup.json'
  );
  const sexualPrototypesPath = path.resolve(
    'data/mods/core/lookups/sexual_prototypes.lookup.json'
  );

  const emotionLookup = JSON.parse(fs.readFileSync(emotionPrototypesPath, 'utf-8'));
  const sexualLookup = JSON.parse(fs.readFileSync(sexualPrototypesPath, 'utf-8'));

  describe('emotion_prototypes inline schema sync', () => {
    it('should have weights schema properties that are a subset of centralized constants', () => {
      const schemaProperties = Object.keys(
        emotionLookup.dataSchema.properties.weights.properties
      );

      const missingFromConstants = schemaProperties.filter(
        (prop) => !ALL_PROTOTYPE_WEIGHT_AXES_SET.has(prop)
      );

      if (missingFromConstants.length > 0) {
        console.error(
          'emotion_prototypes schema has axes not in centralized constants:',
          missingFromConstants
        );
      }
      expect(missingFromConstants).toEqual([]);
    });

    it('should have all data weight keys declared in inline schema', () => {
      const schemaProperties = new Set(
        Object.keys(emotionLookup.dataSchema.properties.weights.properties)
      );

      const undeclaredAxes = [];
      for (const [entryName, entry] of Object.entries(emotionLookup.entries)) {
        if (entry.weights) {
          for (const axis of Object.keys(entry.weights)) {
            if (!schemaProperties.has(axis)) {
              undeclaredAxes.push({ entry: entryName, axis });
            }
          }
        }
      }

      if (undeclaredAxes.length > 0) {
        console.error(
          'emotion_prototypes has weight axes not declared in schema:',
          undeclaredAxes
        );
      }
      expect(undeclaredAxes).toEqual([]);
    });
  });

  describe('sexual_prototypes inline schema sync', () => {
    it('should have weights schema properties that are a subset of centralized constants', () => {
      const schemaProperties = Object.keys(
        sexualLookup.dataSchema.properties.weights.properties
      );

      const missingFromConstants = schemaProperties.filter(
        (prop) => !ALL_PROTOTYPE_WEIGHT_AXES_SET.has(prop)
      );

      if (missingFromConstants.length > 0) {
        console.error(
          'sexual_prototypes schema has axes not in centralized constants:',
          missingFromConstants
        );
      }
      expect(missingFromConstants).toEqual([]);
    });

    it('should have all data weight keys declared in inline schema', () => {
      const schemaProperties = new Set(
        Object.keys(sexualLookup.dataSchema.properties.weights.properties)
      );

      const undeclaredAxes = [];
      for (const [entryName, entry] of Object.entries(sexualLookup.entries)) {
        if (entry.weights) {
          for (const axis of Object.keys(entry.weights)) {
            if (!schemaProperties.has(axis)) {
              undeclaredAxes.push({ entry: entryName, axis });
            }
          }
        }
      }

      if (undeclaredAxes.length > 0) {
        console.error(
          'sexual_prototypes has weight axes not declared in schema:',
          undeclaredAxes
        );
      }
      expect(undeclaredAxes).toEqual([]);
    });
  });

  describe('centralized constants completeness', () => {
    it('should include all axes used in emotion_prototypes', () => {
      const usedAxes = new Set();
      for (const entry of Object.values(emotionLookup.entries)) {
        if (entry.weights) {
          for (const axis of Object.keys(entry.weights)) {
            usedAxes.add(axis);
          }
        }
      }

      const missingFromConstants = [...usedAxes].filter(
        (axis) => !ALL_PROTOTYPE_WEIGHT_AXES_SET.has(axis)
      );

      if (missingFromConstants.length > 0) {
        console.error(
          'Axes used in emotion_prototypes but missing from centralized constants:',
          missingFromConstants
        );
      }
      expect(missingFromConstants).toEqual([]);
    });

    it('should include all axes used in sexual_prototypes', () => {
      const usedAxes = new Set();
      for (const entry of Object.values(sexualLookup.entries)) {
        if (entry.weights) {
          for (const axis of Object.keys(entry.weights)) {
            usedAxes.add(axis);
          }
        }
      }

      const missingFromConstants = [...usedAxes].filter(
        (axis) => !ALL_PROTOTYPE_WEIGHT_AXES_SET.has(axis)
      );

      if (missingFromConstants.length > 0) {
        console.error(
          'Axes used in sexual_prototypes but missing from centralized constants:',
          missingFromConstants
        );
      }
      expect(missingFromConstants).toEqual([]);
    });

    it('should have the expected number of axes', () => {
      // 14 mood axes + 7 affect traits + 4 sexual axes = 25 total
      // Sexual axes: sexual_arousal, sex_excitation, sex_inhibition, baseline_libido
      expect(ALL_PROTOTYPE_WEIGHT_AXES).toHaveLength(25);
    });
  });

  describe('additionalProperties enforcement', () => {
    it('emotion_prototypes weights schema should have additionalProperties: false', () => {
      expect(
        emotionLookup.dataSchema.properties.weights.additionalProperties
      ).toBe(false);
    });

    it('sexual_prototypes weights schema should have additionalProperties: false', () => {
      expect(
        sexualLookup.dataSchema.properties.weights.additionalProperties
      ).toBe(false);
    });
  });
});
