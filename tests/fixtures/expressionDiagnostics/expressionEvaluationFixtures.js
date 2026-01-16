/**
 * @file Fixtures for MonteCarloSimulator expression evaluation integration tests.
 */

export const operatorExpressions = {
  gte: {
    id: 'test:operator_gte',
    description: '>= comparison on mood axes',
    prerequisites: [
      {
        logic: { '>=': [{ var: 'moodAxes.valence' }, 50] },
      },
    ],
  },
  lte: {
    id: 'test:operator_lte',
    description: '<= comparison on mood axes',
    prerequisites: [
      {
        logic: { '<=': [{ var: 'moodAxes.threat' }, 30] },
      },
    ],
  },
  gt: {
    id: 'test:operator_gt',
    description: '> comparison on mood axes',
    prerequisites: [
      {
        logic: { '>': [{ var: 'moodAxes.arousal' }, 5] },
      },
    ],
  },
  lt: {
    id: 'test:operator_lt',
    description: '< comparison on mood axes',
    prerequisites: [
      {
        logic: { '<': [{ var: 'moodAxes.valence' }, 80] },
      },
    ],
  },
  eq: {
    id: 'test:operator_eq',
    description: '== comparison on mood axes',
    prerequisites: [
      {
        logic: { '==': [{ var: 'moodAxes.valence' }, 60] },
      },
    ],
  },
};

export const prerequisiteAndExpression = {
  id: 'test:prereq_and',
  description: 'Multiple prerequisites combine as AND',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
    { logic: { '<=': [{ var: 'moodAxes.threat' }, 30] } },
  ],
};

export const orExpression = {
  id: 'test:or_expression',
  description: 'OR logic within a clause',
  prerequisites: [
    {
      logic: {
        or: [
          { '>=': [{ var: 'moodAxes.valence' }, 50] },
          { '>=': [{ var: 'moodAxes.arousal' }, 80] },
        ],
      },
    },
  ],
};

export const variableResolutionExpression = {
  id: 'test:variable_resolution',
  description: 'Mixed mood, emotion, and sexual state vars',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'moodAxes.valence' }, 50] },
          { '>=': [{ var: 'emotions.joy' }, 0.1] },
          { '>=': [{ var: 'sexualStates.aroused' }, 0.1] },
        ],
      },
    },
  ],
};

export const emptyPrereqsExpression = {
  id: 'test:empty_prereqs',
  description: 'No prerequisites should always pass',
  prerequisites: [],
};

export const undefinedVarExpression = {
  id: 'test:undefined_var',
  description: 'Missing variable should evaluate as false',
  prerequisites: [
    {
      logic: { '>=': [{ var: 'moodAxes.missing_axis' }, 1] },
    },
  ],
};
