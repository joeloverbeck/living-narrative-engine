/**
 * @file Tests for the core:sexual_prototypes lookup file
 * @description Validates the sexual state prototype definitions with weights and gates
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_PROTOTYPE_WEIGHT_AXES } from '../../../../../src/constants/prototypeAxisConstants.js';

const lookupPath = path.resolve(
  'data/mods/core/lookups/sexual_prototypes.lookup.json'
);
const fileContents = fs.readFileSync(lookupPath, 'utf-8');
const lookupData = JSON.parse(fileContents);

describe('core:sexual_prototypes lookup', () => {
  describe('structure validation', () => {
    it('should have required top-level properties', () => {
      expect(lookupData.$schema).toBe(
        'schema://living-narrative-engine/lookup.schema.json'
      );
      expect(lookupData.id).toBe('core:sexual_prototypes');
      expect(lookupData.description).toBeDefined();
      expect(lookupData.dataSchema).toBeDefined();
      expect(lookupData.entries).toBeDefined();
    });

    it('should have more than 10 sexual state entries', () => {
      const entryCount = Object.keys(lookupData.entries).length;
      expect(entryCount).toBeGreaterThan(10);
    });

    it('should have dataSchema with weights and gates properties', () => {
      expect(lookupData.dataSchema.type).toBe('object');
      expect(lookupData.dataSchema.properties.weights).toBeDefined();
      expect(lookupData.dataSchema.properties.gates).toBeDefined();
      expect(lookupData.dataSchema.required).toContain('weights');
    });
  });

  describe('sexual state completeness', () => {
    const requiredStates = [
      'sexual_lust',
      'sexual_sensual_pleasure',
      'sexual_playfulness',
      'romantic_yearning',
      'sexual_confidence',
      'aroused_with_shame',
      'fearful_arousal',
      'sexual_performance_anxiety',
      'sexual_frustration',
      'aroused_with_disgust',
      'sexual_indifference',
      'sexual_repulsion',
    ];

    requiredStates.forEach((state) => {
      it(`should include ${state}`, () => {
        expect(lookupData.entries[state]).toBeDefined();
      });
    });
  });

  describe('weight validation', () => {
    // Using centralized constants from prototypeAxisConstants.js
    const validAxes = ALL_PROTOTYPE_WEIGHT_AXES;

    Object.entries(lookupData.entries).forEach(([stateName, stateData]) => {
      describe(`${stateName} weights`, () => {
        it('should have weights object', () => {
          expect(stateData.weights).toBeDefined();
          expect(typeof stateData.weights).toBe('object');
        });

        it('should only use valid axis names', () => {
          const axisNames = Object.keys(stateData.weights);
          axisNames.forEach((axis) => {
            expect(validAxes).toContain(axis);
          });
        });

        it('should have weight values in range [-1.0, 1.0]', () => {
          Object.values(stateData.weights).forEach((weight) => {
            expect(weight).toBeGreaterThanOrEqual(-1);
            expect(weight).toBeLessThanOrEqual(1);
          });
        });

        it('should include sexual_arousal in weights when expected', () => {
          const allowsNoSexualArousal = new Set([
            'sexual_indifference',
            'sexual_repulsion',
          ]);

          if (allowsNoSexualArousal.has(stateName)) {
            expect(stateData.weights.sexual_arousal).toBeUndefined();
            return;
          }

          expect(stateData.weights.sexual_arousal).toBeDefined();
        });
      });
    });
  });

  describe('gate validation', () => {
    // Pattern includes mood axes (including uncertainty), sexual axes, and affect traits
    const gatePattern =
      /^(valence|arousal|agency_control|threat|engagement|future_expectancy|self_evaluation|affiliation|inhibitory_control|uncertainty|sexual_arousal|sex_excitation|sex_inhibition|sexual_inhibition|self_control)\s*(>=|<=|>|<|==)\s*-?[0-9]+(\.[0-9]+)?$/;

    Object.entries(lookupData.entries).forEach(([stateName, stateData]) => {
      if (stateData.gates) {
        describe(`${stateName} gates`, () => {
          it('should have gates as array', () => {
            expect(Array.isArray(stateData.gates)).toBe(true);
          });

          stateData.gates.forEach((gate, index) => {
            it(`gate[${index}] should match expected pattern`, () => {
              expect(gate).toMatch(gatePattern);
            });

            it(`gate[${index}] should have value in normalized range [-1.0, 1.0]`, () => {
              const valueMatch = gate.match(/-?[0-9]+(\.[0-9]+)?$/);
              if (valueMatch) {
                const value = parseFloat(valueMatch[0]);
                expect(value).toBeGreaterThanOrEqual(-1);
                expect(value).toBeLessThanOrEqual(1);
              }
            });
          });
        });
      }
    });
  });

  describe('sexual_arousal gate requirements', () => {
    const statesRequiringSexualArousalGate = [
      'sexual_lust',
      'sexual_sensual_pleasure',
      'sexual_playfulness',
      'sexual_confidence',
      'aroused_with_shame',
      'fearful_arousal',
      'sexual_performance_anxiety',
      'sexual_frustration',
      'aroused_with_disgust',
    ];

    statesRequiringSexualArousalGate.forEach((state) => {
      it(`${state} should have sexual_arousal gate`, () => {
        const gates = lookupData.entries[state].gates || [];
        const hasSexualArousalGate = gates.some((gate) =>
          gate.startsWith('sexual_arousal')
        );
        expect(hasSexualArousalGate).toBe(true);
      });
    });

  });

  describe('specific state configurations', () => {
    it('sexual_lust should have high sexual_arousal weight', () => {
      expect(
        lookupData.entries.sexual_lust.weights.sexual_arousal
      ).toBeGreaterThanOrEqual(0.8);
    });

    it('sexual_lust should have negative threat weight (safe context)', () => {
      expect(lookupData.entries.sexual_lust.weights.threat).toBeLessThan(0);
    });

    it('aroused_with_shame should have negative self_evaluation', () => {
      expect(
        lookupData.entries.aroused_with_shame.weights.self_evaluation
      ).toBeLessThan(0);
    });

    it('fearful_arousal should have high threat weight', () => {
      expect(
        lookupData.entries.fearful_arousal.weights.threat
      ).toBeGreaterThan(0.5);
    });

    it('sexual_frustration should have negative valence', () => {
      expect(lookupData.entries.sexual_frustration.weights.valence).toBeLessThan(0);
    });

    it('sexual_confident should have positive agency_control', () => {
      expect(
        lookupData.entries.sexual_confidence.weights.agency_control
      ).toBeGreaterThan(0.3);
    });

    it('romantic_yearning should have engagement and future_expectancy weights', () => {
      expect(lookupData.entries.romantic_yearning.weights.engagement).toBeDefined();
      expect(
        lookupData.entries.romantic_yearning.weights.future_expectancy
      ).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should not have any empty entries', () => {
      Object.entries(lookupData.entries).forEach(([name, data]) => {
        expect(Object.keys(data.weights).length).toBeGreaterThan(0);
      });
    });

    it('should use snake_case for all state names', () => {
      const stateNames = Object.keys(lookupData.entries);
      stateNames.forEach((name) => {
        expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
      });
    });

    it('all entries should have gates array', () => {
      Object.entries(lookupData.entries).forEach(([name, data]) => {
        expect(data.gates).toBeDefined();
        expect(Array.isArray(data.gates)).toBe(true);
      });
    });
  });
});
