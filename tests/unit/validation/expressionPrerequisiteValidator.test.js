import { describe, it, expect } from '@jest/globals';
import ExpressionPrerequisiteValidator from '../../../src/validation/expressionPrerequisiteValidator.js';

const allowedOperations = new Set([
  'and',
  'or',
  '>=',
  '>',
  '<',
  '<=',
  '==',
  '!=',
  '-',
  'max',
  'var',
]);

const validKeysByRoot = {
  emotions: new Set(['joy']),
  sexualStates: new Set(['desire']),
  moodAxes: new Set(['valence']),
};

describe('ExpressionPrerequisiteValidator', () => {
  it('flags missing logic entries', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:test_expression',
      prerequisites: [{}],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/test.expression.json',
      validKeysByRoot,
    });

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].issueType).toBe('missing_logic');
    expect(result.violations[0].expressionId).toBe('emotions:test_expression');
  });

  it('flags invalid operators and argument counts', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:bad_operator',
      prerequisites: [
        { logic: { bogus: [1, 2] } },
        { logic: { '>=': [{ var: 'emotions.joy' }] } },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/bad.expression.json',
      validKeysByRoot,
    });

    expect(result.violations.some((v) => v.issueType === 'invalid_operator')).toBe(
      true
    );
    expect(result.violations.some((v) => v.issueType === 'invalid_args')).toBe(
      true
    );
  });

  it('flags disallowed var roots and unknown keys', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:bad_vars',
      prerequisites: [
        { logic: { '>=': [{ var: 'unknownRoot.value' }, 0.2] } },
        { logic: { '>=': [{ var: 'emotions.unknown' }, 0.2] } },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/bad_vars.expression.json',
      validKeysByRoot,
    });

    expect(result.violations.some((v) => v.issueType === 'invalid_var_root')).toBe(
      true
    );
    expect(result.violations.some((v) => v.issueType === 'unknown_var_key')).toBe(
      true
    );
  });

  it('flags range mismatches for known roots', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:range_mismatch',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.joy' }, 2] } },
        { logic: { '<=': [{ var: 'moodAxes.valence' }, 200] } },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/range.expression.json',
      validKeysByRoot,
    });

    expect(result.violations.some((v) => v.issueType === 'range_mismatch')).toBe(
      true
    );
  });

  it('allows delta comparisons that fall outside root ranges', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const validEmotionKeys = new Set([
      'numbness',
      'interest',
      'anxiety',
      'unease',
      'fear',
      'terror',
      'hypervigilance',
    ]);

    const dissociationExpression = {
      id: 'emotions:dissociation',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.numbness' }, 0.6] },
              {
                '>=': [
                  {
                    '-': [
                      { var: 'emotions.numbness' },
                      { var: 'previousEmotions.numbness' },
                    ],
                  },
                  0.2,
                ],
              },
              {
                '<=': [
                  {
                    '-': [
                      { var: 'emotions.interest' },
                      { var: 'previousEmotions.interest' },
                    ],
                  },
                  -0.2,
                ],
              },
            ],
          },
        },
      ],
    };

    const dissociationResult = validator.validateExpression(
      dissociationExpression,
      {
        modId: 'emotions',
        source: 'expressions/dissociation.expression.json',
        validKeysByRoot: { emotions: validEmotionKeys },
      }
    );

    expect(dissociationResult.violations).toHaveLength(0);

    const restlessExpression = {
      id: 'emotions:restless_anxiety',
      prerequisites: [
        {
          logic: {
            and: [
              {
                or: [
                  { '>=': [{ var: 'emotions.anxiety' }, 0.45] },
                  { '>=': [{ var: 'emotions.unease' }, 0.5] },
                ],
              },
              { '<': [{ var: 'emotions.fear' }, 0.65] },
              { '<': [{ var: 'emotions.terror' }, 0.45] },
              { '<': [{ var: 'emotions.hypervigilance' }, 0.65] },
              {
                '>=': [
                  {
                    max: [
                      {
                        '-': [
                          { var: 'emotions.anxiety' },
                          { var: 'previousEmotions.anxiety' },
                        ],
                      },
                      {
                        '-': [
                          { var: 'emotions.unease' },
                          { var: 'previousEmotions.unease' },
                        ],
                      },
                    ],
                  },
                  -0.05,
                ],
              },
            ],
          },
        },
      ],
    };

    const restlessResult = validator.validateExpression(restlessExpression, {
      modId: 'emotions',
      source: 'expressions/restless_anxiety.expression.json',
      validKeysByRoot: { emotions: validEmotionKeys },
    });

    expect(restlessResult.violations).toHaveLength(0);
  });

  it('warns on vacuous operators unless strict mode is enabled', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:vacuous',
      prerequisites: [{ logic: { and: [] } }],
    };

    const nonStrict = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/vacuous.expression.json',
      validKeysByRoot,
    });

    expect(nonStrict.warnings).toHaveLength(1);
    expect(nonStrict.violations).toHaveLength(0);

    const strict = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/vacuous.expression.json',
      validKeysByRoot,
      strictMode: true,
    });

    expect(strict.warnings).toHaveLength(0);
    expect(strict.violations).toHaveLength(1);
    expect(strict.violations[0].issueType).toBe('vacuous_operator');
  });
});
