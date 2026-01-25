/**
 * @file Fixtures for MonteCarloSimulator context-building integration tests.
 */

export const simpleContextExpression = {
  id: 'test:simple_context',
  description: 'Expression referencing emotion + sexual prototypes',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.1] },
          { '>=': [{ var: 'sexualStates.aroused' }, 0.1] },
          { '>=': [{ var: 'moodAxes.valence' }, -100] },
          { '>=': [{ var: 'sexualAxes.sex_excitation' }, -100] },
        ],
      },
    },
  ],
};

export const unknownVarExpression = {
  id: 'test:unknown_context_key',
  description: 'Expression with unknown context key for warnings',
  prerequisites: [{ logic: { '>=': [{ var: 'unknown.axis' }, 0.1] } }],
};

export const moodRegimeExpression = {
  id: 'test:mood_regime_context',
  description: 'Expression that triggers mood-regime histogram tracking',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, -100] } },
    { logic: { '>=': [{ var: 'sexualAxes.sex_excitation' }, -100] } },
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.1] } },
    { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.1] } },
  ],
};

export const prototypeLookups = {
  emotions: {
    joy: {
      weights: { valence: 1 },
      gates: ['valence >= -0.25'],
    },
  },
  sexualStates: {
    aroused: {
      weights: { sex_excitation: 1 },
      gates: ['sex_excitation >= 0.6'],
    },
  },
};
