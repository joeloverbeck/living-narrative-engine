/**
 * @file Fixtures for MonteCarloSimulator violation analysis integration tests.
 */

export const simpleViolationExpression = {
  id: 'test:violation_simple_gte',
  description: 'Simple >= violation on mood axes',
  prerequisites: [
    {
      logic: { '>=': [{ var: 'moodAxes.valence' }, 70] },
    },
  ],
};

export const lteViolationExpression = {
  id: 'test:violation_lte',
  description: '<= violation on mood axes',
  prerequisites: [
    {
      logic: { '<=': [{ var: 'moodAxes.threat' }, 30] },
    },
  ],
};

export const ltViolationExpression = {
  id: 'test:violation_lt',
  description: '< violation on mood axes',
  prerequisites: [
    {
      logic: { '<': [{ var: 'moodAxes.threat' }, 10] },
    },
  ],
};

export const rightSideVarViolationExpression = {
  id: 'test:violation_right_side_var',
  description: 'Threshold literal on the left side of the comparison',
  prerequisites: [
    {
      logic: { '>=': [50, { var: 'moodAxes.valence' }] },
    },
  ],
};

export const unknownVarViolationExpression = {
  id: 'test:violation_unknown_var',
  description: 'Unknown var reference for null operand handling',
  prerequisites: [
    {
      logic: { '>=': [{ var: 'moodAxes.unknown_axis' }, 50] },
    },
  ],
};

export const partialFailureExpression = {
  id: 'test:violation_partial_failure',
  description: 'AND clause with one passing and one failing leaf',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'moodAxes.valence' }, 70] },
          { '<=': [{ var: 'moodAxes.threat' }, 20] },
        ],
      },
    },
  ],
};

export const failedLeavesLimitExpression = {
  id: 'test:violation_failed_leaves_limit',
  description: 'AND clause with more than five failing leaves',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'moodAxes.valence' }, 70] },
          { '>=': [{ var: 'moodAxes.arousal' }, 30] },
          { '>=': [{ var: 'moodAxes.agency_control' }, 10] },
          { '>=': [{ var: 'moodAxes.threat' }, 40] },
          { '>=': [{ var: 'moodAxes.engagement' }, 20] },
          { '>=': [{ var: 'moodAxes.affiliation' }, 50] },
        ],
      },
    },
  ],
};

export const compoundCeilingExpression = {
  id: 'test:violation_compound_ceiling',
  description: 'Compound clause with multiple ceiling gaps',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'moodAxes.valence' }, 80] },
          { '>=': [{ var: 'moodAxes.arousal' }, 60] },
        ],
      },
    },
  ],
};

export const passingExpression = {
  id: 'test:violation_passing',
  description: 'Expression that should always pass for base samples',
  prerequisites: [
    {
      logic: { '>=': [{ var: 'moodAxes.valence' }, 10] },
    },
  ],
};
