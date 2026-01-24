/**
 * @file Axis Registry Audit Tests (B1)
 *
 * Ensures all prototype weight keys exist in known axis registries.
 * This catches issues where prototypes reference axes that don't exist
 * or are misspelled, which would cause silent failures in intensity calculation.
 */
import { describe, it, expect } from '@jest/globals';
import {
  MOOD_AXES,
  AFFECT_TRAITS,
} from '../../../src/constants/moodAffectConstants.js';
import {
  SEXUAL_AXES,
  ALL_PROTOTYPE_WEIGHT_AXES_SET,
} from '../../../src/constants/prototypeAxisConstants.js';
import fs from 'fs';
import path from 'path';

describe('Axis Registry Audit (B1)', () => {
  // Known axis registries combined - now using centralized constants
  const KNOWN_MOOD_AXES = new Set(MOOD_AXES);
  const KNOWN_AFFECT_TRAITS = new Set(AFFECT_TRAITS);
  const KNOWN_SEXUAL_AXES = new Set([...SEXUAL_AXES, 'SA']); // 'SA' is an alias

  // All known axes for weight keys - from centralized constants
  const ALL_KNOWN_AXES = ALL_PROTOTYPE_WEIGHT_AXES_SET;

  describe('emotion_prototypes.lookup.json audit', () => {
    it('should have all prototype weight keys in known registries', () => {
      const prototypesPath = path.resolve(
        process.cwd(),
        'data/mods/core/lookups/emotion_prototypes.lookup.json'
      );

      // Skip if file doesn't exist (handled by integration tests)
      if (!fs.existsSync(prototypesPath)) {
        console.warn('emotion_prototypes.lookup.json not found, skipping audit');
        return;
      }

      const prototypes = JSON.parse(fs.readFileSync(prototypesPath, 'utf8'));
      const unknownAxes = [];

      for (const [protoName, proto] of Object.entries(prototypes.entries || {})) {
        if (!proto.weights) continue;
        for (const axis of Object.keys(proto.weights)) {
          if (!ALL_KNOWN_AXES.has(axis)) {
            unknownAxes.push({ prototype: protoName, axis });
          }
        }
      }

      if (unknownAxes.length > 0) {
        console.error('Unknown axes found in prototypes:', unknownAxes);
      }
      expect(unknownAxes).toEqual([]);
    });

    it('should correctly categorize unease prototype axes', () => {
      // Specific test for the unease prototype that revealed the bug
      const uneaseWeights = {
        threat: 0.5,
        arousal: 0.2,
        valence: -0.3,
        agency_control: -0.2,
        inhibitory_control: -0.2,
        self_control: -0.2,
      };

      const moodAxesUsed = [];
      const traitAxesUsed = [];

      for (const axis of Object.keys(uneaseWeights)) {
        if (KNOWN_MOOD_AXES.has(axis)) {
          moodAxesUsed.push(axis);
        } else if (KNOWN_AFFECT_TRAITS.has(axis)) {
          traitAxesUsed.push(axis);
        }
      }

      // Verify mood axes
      expect(moodAxesUsed).toContain('threat');
      expect(moodAxesUsed).toContain('arousal');
      expect(moodAxesUsed).toContain('valence');
      expect(moodAxesUsed).toContain('agency_control');
      expect(moodAxesUsed).toContain('inhibitory_control');

      // Verify affect traits
      expect(traitAxesUsed).toContain('self_control');

      // self_control is NOT a mood axis
      expect(moodAxesUsed).not.toContain('self_control');
    });
  });

  describe('sexual_prototypes.lookup.json audit', () => {
    it('should have all prototype weight keys in known registries', () => {
      const prototypesPath = path.resolve(
        process.cwd(),
        'data/mods/core/lookups/sexual_prototypes.lookup.json'
      );

      // Skip if file doesn't exist
      if (!fs.existsSync(prototypesPath)) {
        console.warn('sexual_prototypes.lookup.json not found, skipping audit');
        return;
      }

      const prototypes = JSON.parse(fs.readFileSync(prototypesPath, 'utf8'));
      const unknownAxes = [];

      for (const [protoName, proto] of Object.entries(prototypes.entries || {})) {
        if (!proto.weights) continue;
        for (const axis of Object.keys(proto.weights)) {
          if (!ALL_KNOWN_AXES.has(axis)) {
            unknownAxes.push({ prototype: protoName, axis });
          }
        }
      }

      if (unknownAxes.length > 0) {
        console.error('Unknown axes in sexual prototypes:', unknownAxes);
      }
      expect(unknownAxes).toEqual([]);
    });
  });

  describe('axis registry correctness', () => {
    it('should distinguish mood axes from affect traits', () => {
      // self_control is AFFECT_TRAIT, not MOOD_AXIS
      expect(MOOD_AXES).not.toContain('self_control');
      expect(AFFECT_TRAITS).toContain('self_control');

      // inhibitory_control is MOOD_AXIS, not AFFECT_TRAIT
      expect(MOOD_AXES).toContain('inhibitory_control');
      expect(AFFECT_TRAITS).not.toContain('inhibitory_control');
    });

    it('should include the baseline mood axes', () => {
      expect(new Set(MOOD_AXES).size).toBe(MOOD_AXES.length);
      expect(MOOD_AXES).toContain('valence');
      expect(MOOD_AXES).toContain('arousal');
      expect(MOOD_AXES).toContain('agency_control');
      expect(MOOD_AXES).toContain('threat');
      expect(MOOD_AXES).toContain('engagement');
      expect(MOOD_AXES).toContain('future_expectancy');
      expect(MOOD_AXES).toContain('self_evaluation');
      expect(MOOD_AXES).toContain('affiliation');
      expect(MOOD_AXES).toContain('inhibitory_control');
      expect(MOOD_AXES).toContain('uncertainty');
    });

    it('should have exactly 7 affect traits', () => {
      expect(AFFECT_TRAITS).toHaveLength(7);
      expect(AFFECT_TRAITS).toContain('affective_empathy');
      expect(AFFECT_TRAITS).toContain('cognitive_empathy');
      expect(AFFECT_TRAITS).toContain('harm_aversion');
      expect(AFFECT_TRAITS).toContain('self_control');
      expect(AFFECT_TRAITS).toContain('disgust_sensitivity');
      expect(AFFECT_TRAITS).toContain('ruminative_tendency');
      expect(AFFECT_TRAITS).toContain('evaluation_sensitivity');
    });

    it('should have no overlap between mood axes and affect traits', () => {
      const moodSet = new Set(MOOD_AXES);
      for (const trait of AFFECT_TRAITS) {
        expect(moodSet.has(trait)).toBe(false);
      }
    });
  });

  describe('naming convention validation', () => {
    it('should use snake_case for all axis names', () => {
      const snakeCaseRegex = /^[a-z]+(_[a-z]+)*$/;

      for (const axis of MOOD_AXES) {
        expect(axis).toMatch(snakeCaseRegex);
      }

      for (const trait of AFFECT_TRAITS) {
        expect(trait).toMatch(snakeCaseRegex);
      }
    });
  });
});
