/**
 * @file Tests for the core:emotion_prototypes lookup file
 * @description Validates the emotion prototype definitions with weights and gates
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const lookupPath = path.resolve(
  'data/mods/core/lookups/emotion_prototypes.lookup.json'
);
const fileContents = fs.readFileSync(lookupPath, 'utf-8');
const lookupData = JSON.parse(fileContents);

describe('core:emotion_prototypes lookup', () => {
  describe('structure validation', () => {
    it('should have required top-level properties', () => {
      expect(lookupData.$schema).toBe(
        'schema://living-narrative-engine/lookup.schema.json'
      );
      expect(lookupData.id).toBe('core:emotion_prototypes');
      expect(lookupData.description).toBeDefined();
      expect(lookupData.dataSchema).toBeDefined();
      expect(lookupData.entries).toBeDefined();
    });

    it('should have more than 50 emotion entries', () => {
      const entryCount = Object.keys(lookupData.entries).length;
      expect(entryCount).toBeGreaterThan(50);
    });

    it('should have dataSchema with weights and gates properties', () => {
      expect(lookupData.dataSchema.type).toBe('object');
      expect(lookupData.dataSchema.properties.weights).toBeDefined();
      expect(lookupData.dataSchema.properties.gates).toBeDefined();
      expect(lookupData.dataSchema.required).toContain('weights');
    });
  });

  describe('emotion category completeness', () => {
    const expectedEmotions = {
      'Low-Arousal Positive': ['calm', 'contentment', 'relief', 'safety_confidence'],
      'High-Arousal Positive': ['joy', 'enthusiasm', 'amusement', 'awe', 'inspiration'],
      'Engagement-Based': ['interest', 'curiosity', 'fascination', 'flow'],
      'Future-Oriented Positive': ['hope', 'optimism', 'determination', 'anticipation'],
      'Low-Arousal Negative': [
        'sadness',
        'grief',
        'disappointment',
        'despair',
        'numbness',
        'fatigue',
        'loneliness',
      ],
      Disengagement: ['boredom', 'apathy'],
      'Threat-Based': [
        'unease',
        'anxiety',
        'fear',
        'terror',
        'dread',
        'hypervigilance',
        'alarm',
      ],
      'Anger Family': [
        'irritation',
        'frustration',
        'anger',
        'rage',
        'resentment',
        'contempt',
        'disgust',
      ],
      'Self-Evaluation': ['pride', 'shame', 'embarrassment', 'guilt', 'humiliation'],
      'Self-Comparison': ['envy', 'jealousy'],
      'Social/Relational': ['trust', 'admiration', 'gratitude'],
      Attachment: ['affection', 'love_attachment', 'hatred'],
      'Surprise/Confusion': ['surprise_startle', 'confusion'],
    };

    Object.entries(expectedEmotions).forEach(([category, emotions]) => {
      describe(`${category} emotions`, () => {
        emotions.forEach((emotion) => {
          it(`should include ${emotion}`, () => {
            expect(lookupData.entries[emotion]).toBeDefined();
          });
        });
      });
    });
  });

  describe('weight validation', () => {
    const validAxes = [
      'valence',
      'arousal',
      'agency_control',
      'threat',
      'engagement',
      'future_expectancy',
      'self_evaluation',
      'sexual_arousal',
    ];

    Object.entries(lookupData.entries).forEach(([emotionName, emotionData]) => {
      describe(`${emotionName} weights`, () => {
        it('should have weights object', () => {
          expect(emotionData.weights).toBeDefined();
          expect(typeof emotionData.weights).toBe('object');
        });

        it('should only use valid axis names', () => {
          const axisNames = Object.keys(emotionData.weights);
          axisNames.forEach((axis) => {
            expect(validAxes).toContain(axis);
          });
        });

        it('should have weight values in range [-1.0, 1.0]', () => {
          Object.values(emotionData.weights).forEach((weight) => {
            expect(weight).toBeGreaterThanOrEqual(-1);
            expect(weight).toBeLessThanOrEqual(1);
          });
        });
      });
    });
  });

  describe('gate validation', () => {
    const gatePattern =
      /^(valence|arousal|agency_control|threat|engagement|future_expectancy|self_evaluation|sexual_arousal)\s*(>=|<=|>|<|==)\s*-?[0-9]+(\.[0-9]+)?$/;

    Object.entries(lookupData.entries).forEach(([emotionName, emotionData]) => {
      if (emotionData.gates) {
        describe(`${emotionName} gates`, () => {
          it('should have gates as array', () => {
            expect(Array.isArray(emotionData.gates)).toBe(true);
          });

          emotionData.gates.forEach((gate, index) => {
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

  describe('specific emotion configurations', () => {
    it('joy should have high positive valence weight', () => {
      expect(lookupData.entries.joy.weights.valence).toBeGreaterThanOrEqual(0.8);
    });

    it('fear should have high threat weight', () => {
      expect(lookupData.entries.fear.weights.threat).toBeGreaterThanOrEqual(0.8);
    });

    it('calm should have negative arousal weight', () => {
      expect(lookupData.entries.calm.weights.arousal).toBeLessThan(0);
    });

    it('anger should have high arousal and negative valence', () => {
      expect(lookupData.entries.anger.weights.arousal).toBeGreaterThan(0.5);
      expect(lookupData.entries.anger.weights.valence).toBeLessThan(0);
    });

    it('shame should have strongly negative self_evaluation', () => {
      expect(lookupData.entries.shame.weights.self_evaluation).toBeLessThanOrEqual(
        -0.8
      );
    });

    it('affection should include sexual_arousal weight', () => {
      expect(lookupData.entries.affection.weights.sexual_arousal).toBeDefined();
    });

    it('love_attachment should include sexual_arousal weight', () => {
      expect(lookupData.entries.love_attachment.weights.sexual_arousal).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should not have any empty entries', () => {
      Object.entries(lookupData.entries).forEach(([name, data]) => {
        expect(Object.keys(data.weights).length).toBeGreaterThan(0);
      });
    });

    it('should use snake_case for all emotion names', () => {
      const emotionNames = Object.keys(lookupData.entries);
      emotionNames.forEach((name) => {
        expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
      });
    });
  });
});
