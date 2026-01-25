/**
 * @file Fixtures for MonteCarloSimulator prototype evaluation integration tests.
 */

export const singlePrototypeExpression = {
  id: 'test:single_prototype_eval',
  description: 'Expression referencing a single emotion prototype',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.4] } }],
};

export const multiplePrototypeExpression = {
  id: 'test:multiple_prototype_eval',
  description: 'Expression with nested prototype references',
  prerequisites: [
    {
      logic: {
        or: [
          { '>=': [{ var: 'emotions.joy' }, 0.6] },
          { '>=': [{ var: 'emotions.trust' }, 0.5] },
        ],
      },
    },
    { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.3] } },
  ],
};

export const dedupePrototypeExpression = {
  id: 'test:prototype_dedupe',
  description: 'Expression with duplicate prototype references',
  prerequisites: [
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.2] } },
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.8] } },
  ],
};

export const moodRegimePrototypeExpression = {
  id: 'test:mood_regime_prototype',
  description: 'Expression with mood constraint and prototype reference',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, -100] } },
    { logic: { '<=': [{ var: 'moodAxes.valence' }, 0] } },
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.1] } },
  ],
};

export const noPrototypeExpression = {
  id: 'test:no_prototype_refs',
  description: 'Expression without prototype references',
  prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 20] } }],
};

export const missingPrototypeExpression = {
  id: 'test:missing_prototype_refs',
  description: 'Expression referencing a missing prototype',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.missing' }, 0.2] } }],
};

export const zeroWeightExpression = {
  id: 'test:zero_weight_prototype',
  description: 'Expression referencing an all-zero prototype',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.neutral' }, 0.1] } }],
};

export const negativeScoreExpression = {
  id: 'test:negative_score_prototype',
  description: 'Expression referencing a prototype that can score below zero',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.sad' }, 0.1] } }],
};

export const prototypeEvaluationPrototypes = {
  emotions: {
    joy: {
      weights: { valence: 1 },
      gates: ['valence >= 0.25'],
    },
    trust: {
      weights: { valence: 0.5, agency_control: 0.5 },
      gates: [],
    },
    neutral: {
      weights: { valence: 0 },
      gates: [],
    },
    sad: {
      weights: { valence: 1 },
      gates: [],
    },
  },
  sexualStates: {
    aroused: {
      weights: { sex_excitation: 1 },
      gates: ['sex_excitation >= 0.4'],
    },
  },
};

// Gate thresholds used by tests (for reference):
// - joy gate: valence >= 0.25 (normalized), so raw valence >= 25
// - aroused gate: sex_excitation >= 0.4 (normalized), so raw >= 40
