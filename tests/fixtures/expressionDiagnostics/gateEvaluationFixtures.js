/**
 * @file Fixtures for MonteCarloSimulator gate evaluation integration tests.
 */

export const gateClampPlanExpression = {
  id: 'test:gate_plan',
  description: 'Expression referencing emotion + sexual prototypes with gates',
  prerequisites: [
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
    { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.4] } },
  ],
};

export const gateCompatibilityExpression = {
  id: 'test:gate_compatibility',
  description: 'Expression with mood regime constraints and gated prototypes',
  prerequisites: [
    { logic: { '<=': [{ var: 'moodAxes.valence' }, 20] } },
    { logic: { '>=': [{ var: 'emotions.serenity' }, 0.4] } },
    { logic: { '>=': [{ var: 'emotions.panic' }, 0.4] } },
  ],
};

export const gateOutcomeExpression = {
  id: 'test:gate_outcome',
  description: 'Expression that records gate pass/fail and lost passes',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
};

export const gateEvaluationPrototypes = {
  emotions: {
    joy: {
      weights: { valence: 1 },
      gates: ['threat >= 0.7'],
    },
    serenity: {
      weights: { valence: 1 },
      gates: ['valence >= 0.1'],
    },
    panic: {
      weights: { valence: 1 },
      gates: ['valence >= 0.8'],
    },
  },
  sexualStates: {
    aroused: {
      weights: { sex_excitation: 1 },
      gates: ['sex_excitation >= 0.6'],
    },
  },
};
