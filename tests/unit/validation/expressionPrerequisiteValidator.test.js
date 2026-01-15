import { describe, it, expect } from '@jest/globals';
import ExpressionPrerequisiteValidator, {
  DEFAULT_MOOD_AXES,
} from '../../../src/validation/expressionPrerequisiteValidator.js';

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
  'min',
  '*',
  '/',
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

  it('flags unknown mood axes keys', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:bad_mood_axis',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.affective_empathy' }, 50] } },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/bad_mood_axis.expression.json',
      validKeysByRoot,
    });

    expect(result.violations.some((v) => v.issueType === 'unknown_var_key')).toBe(
      true
    );
  });

  it('allows affectTraits roots and validates their keys', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:affect_traits_gate',
      prerequisites: [
        { logic: { '>=': [{ var: 'affectTraits.affective_empathy' }, 55] } },
        { logic: { '>=': [{ var: 'affectTraits.unknown_trait' }, 10] } },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/affect_traits_gate.expression.json',
      validKeysByRoot: {
        ...validKeysByRoot,
        affectTraits: new Set(['affective_empathy', 'cognitive_empathy']),
      },
    });

    expect(result.violations.some((v) => v.issueType === 'invalid_var_root')).toBe(
      false
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
      id: 'emotions-dissociation:dissociation',
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
        modId: 'emotions-dissociation',
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

  it('flags fractional mood axis thresholds and allows integers', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const fractionalExpression = {
      id: 'emotions:mood_axes_fractional',
      prerequisites: [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, 0.44] } },
      ],
    };

    const fractionalResult = validator.validateExpression(
      fractionalExpression,
      {
        modId: 'emotions',
        source: 'expressions/fractional.expression.json',
        validKeysByRoot,
      }
    );

    expect(
      fractionalResult.violations.some(
        (v) => v.issueType === 'mood_axes_fractional_threshold'
      )
    ).toBe(true);

    const integerExpression = {
      id: 'emotions:mood_axes_integer',
      prerequisites: [
        { logic: { '<=': [{ var: 'moodAxes.valence' }, 44] } },
      ],
    };

    const integerResult = validator.validateExpression(integerExpression, {
      modId: 'emotions',
      source: 'expressions/integer.expression.json',
      validKeysByRoot,
    });

    expect(integerResult.violations).toHaveLength(0);
  });

  it('flags nested mood axes comparisons with fractional thresholds', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:mood_axes_nested',
      prerequisites: [
        {
          logic: {
            '<': [
              {
                '-': [
                  { var: 'moodAxes.valence' },
                  { var: 'previousMoodAxes.valence' },
                ],
              },
              0.12,
            ],
          },
        },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/nested.expression.json',
      validKeysByRoot,
    });

    expect(
      result.violations.some(
        (v) => v.issueType === 'mood_axes_fractional_threshold'
      )
    ).toBe(true);
  });

  it('warns on mixed-scale mood axes comparisons and escalates in strict mode', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:mood_axes_mixed_scale',
      prerequisites: [
        {
          logic: {
            '<': [
              {
                max: [
                  { var: 'emotions.joy' },
                  { var: 'moodAxes.valence' },
                ],
              },
              12,
            ],
          },
        },
      ],
    };

    const nonStrict = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/mixed_scale.expression.json',
      validKeysByRoot,
    });

    expect(
      nonStrict.warnings.some(
        (v) => v.issueType === 'mood_axes_mixed_scale'
      )
    ).toBe(true);

    const strict = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/mixed_scale.expression.json',
      validKeysByRoot,
      strictMode: true,
    });

    expect(
      strict.violations.some((v) => v.issueType === 'mood_axes_mixed_scale')
    ).toBe(true);
  });

  it('allows mixed-scale comparisons when normalized roots are scaled to mood axes', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:mood_axes_scaled',
      prerequisites: [
        {
          logic: {
            '>=': [
              {
                max: [
                  {
                    '*': [
                      {
                        '-': [
                          { var: 'emotions.joy' },
                          { var: 'previousEmotions.joy' },
                        ],
                      },
                      100,
                    ],
                  },
                  {
                    '-': [
                      { var: 'moodAxes.valence' },
                      { var: 'previousMoodAxes.valence' },
                    ],
                  },
                ],
              },
              12,
            ],
          },
        },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/scaled.expression.json',
      validKeysByRoot,
    });

    expect(
      result.warnings.some((v) => v.issueType === 'mood_axes_mixed_scale')
    ).toBe(false);
    expect(
      result.violations.some((v) => v.issueType === 'mood_axes_mixed_scale')
    ).toBe(false);
  });

  it('warns on mixed-scale max/min operations without comparisons', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:mood_axes_mixed_scale_max',
      prerequisites: [
        {
          logic: {
            max: [{ var: 'emotions.joy' }, { var: 'moodAxes.valence' }],
          },
        },
      ],
    };

    const nonStrict = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/mixed_scale_max.expression.json',
      validKeysByRoot,
    });

    expect(
      nonStrict.warnings.some(
        (v) => v.issueType === 'mood_axes_mixed_scale'
      )
    ).toBe(true);

    const strict = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/mixed_scale_max.expression.json',
      validKeysByRoot,
      strictMode: true,
    });

    expect(
      strict.violations.some((v) => v.issueType === 'mood_axes_mixed_scale')
    ).toBe(true);
  });

  it('allows mixed-scale min operations when normalized roots are scaled', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'emotions:mood_axes_scaled_min',
      prerequisites: [
        {
          logic: {
            min: [
              { '*': [{ var: 'emotions.joy' }, 100] },
              { var: 'moodAxes.valence' },
            ],
          },
        },
      ],
    };

    const result = validator.validateExpression(expression, {
      modId: 'emotions',
      source: 'expressions/scaled_min.expression.json',
      validKeysByRoot,
    });

    expect(
      result.warnings.some((v) => v.issueType === 'mood_axes_mixed_scale')
    ).toBe(false);
    expect(
      result.violations.some((v) => v.issueType === 'mood_axes_mixed_scale')
    ).toBe(false);
  });

  it('accepts affiliation as a valid mood axis in both moodAxes and previousMoodAxes', () => {
    const validator = new ExpressionPrerequisiteValidator({
      allowedOperations,
    });
    const expression = {
      id: 'test:affiliation_mood_axis',
      prerequisites: [
        {
          logic: {
            and: [
              { '<=': [{ var: 'moodAxes.affiliation' }, 25] },
              {
                '>=': [
                  {
                    '-': [
                      { var: 'previousMoodAxes.affiliation' },
                      { var: 'moodAxes.affiliation' },
                    ],
                  },
                  10,
                ],
              },
            ],
          },
        },
      ],
    };

    // Use DEFAULT_MOOD_AXES (as modValidationOrchestrator does) to verify 'affiliation' is included
    const result = validator.validateExpression(expression, {
      modId: 'test',
      source: 'expressions/test.expression.json',
      validKeysByRoot: {
        moodAxes: new Set(DEFAULT_MOOD_AXES),
      },
    });

    // If 'affiliation' is NOT in DEFAULT_MOOD_AXES, we expect violations
    // This test verifies that after the fix, there are no violations
    const affiliationViolations = result.violations.filter(
      (v) => v.issueType === 'unknown_var_key'
    );
    // Should be 0 after the fix - each reference to affiliation would create a violation if not fixed
    expect(affiliationViolations).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  it('includes affiliation in DEFAULT_MOOD_AXES', () => {
    // Sanity check that the exported constant includes all expected mood axes
    expect(DEFAULT_MOOD_AXES).toContain('valence');
    expect(DEFAULT_MOOD_AXES).toContain('arousal');
    expect(DEFAULT_MOOD_AXES).toContain('agency_control');
    expect(DEFAULT_MOOD_AXES).toContain('threat');
    expect(DEFAULT_MOOD_AXES).toContain('engagement');
    expect(DEFAULT_MOOD_AXES).toContain('future_expectancy');
    expect(DEFAULT_MOOD_AXES).toContain('self_evaluation');
    expect(DEFAULT_MOOD_AXES).toContain('affiliation');
  });

  // Test Group 1: Basic Input Validation
  describe('basic input validation', () => {
    it('flags null prerequisite entries', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:null_prereq',
        prerequisites: [null],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('missing_logic');
      expect(result.violations[0].message).toContain('entry is missing logic');
    });

    it('flags primitive prerequisite entries', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:primitive_prereq',
        prerequisites: ['string', 42, true],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(3);
      expect(
        result.violations.every((v) => v.issueType === 'missing_logic')
      ).toBe(true);
    });

    it('flags logic that is a string', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:string_logic',
        prerequisites: [{ logic: 'not-an-object' }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_logic');
      expect(result.violations[0].message).toContain('must be a JSON object');
    });

    it('flags logic that is an array', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:array_logic',
        prerequisites: [{ logic: [1, 2, 3] }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_logic');
    });

    it('flags empty object logic', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:empty_logic',
        prerequisites: [{ logic: {} }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_logic');
      expect(result.violations[0].message).toContain('must include an operator');
    });

    it('flags logic with multiple operators', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:multi_operator',
        prerequisites: [{ logic: { and: [], or: [] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_logic');
      expect(result.violations[0].message).toContain('single operator');
    });

    it('handles null expression ID gracefully', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.expressionId).toBe('unknown');
      expect(result.violations).toHaveLength(0);
    });

    it('handles non-array prerequisites gracefully', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:non_array_prereqs',
        prerequisites: 'not-an-array',
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });
  });

  // Test Group 2: Operator Argument Validation
  describe('operator argument validation', () => {
    it('flags non-array args for array-expecting operator', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:non_array_args',
        prerequisites: [{ logic: { '>=': 'not-an-array' } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_args');
      expect(result.violations[0].message).toContain(
        'expects an array of arguments'
      );
    });
  });

  // Test Group 3: Var Operator Validation
  describe('var operator validation', () => {
    it('flags empty var array', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:empty_var_array',
        prerequisites: [{ logic: { var: [] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_args');
      expect(result.violations[0].message).toContain('requires a path');
    });

    it('flags var with too many arguments', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:too_many_var_args',
        prerequisites: [{ logic: { var: ['emotions.joy', 0.5, 'extra'] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.violations.some((v) => v.message.includes('at most two'))
      ).toBe(true);
    });

    it('flags var array with non-string first element', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:non_string_var_path',
        prerequisites: [{ logic: { var: [123, 'default'] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_args');
      expect(result.violations[0].message).toContain('path must be a string');
    });

    it('flags var with non-string/non-array value', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:invalid_var_type',
        prerequisites: [{ logic: { var: 123 } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_args');
      expect(result.violations[0].message).toContain('string or an array');
    });

    it('flags whitespace-only path as empty', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // Note: Empty string '' triggers early return at line 359 (!path check)
      // Only whitespace-only strings reach the trimmedPath === '' check
      const expression = {
        id: 'test:empty_path',
        prerequisites: [{ logic: { var: '   ' } }, { logic: { var: '\t\n' } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(2);
      expect(
        result.violations.every((v) => v.message.includes('cannot be empty'))
      ).toBe(true);
    });
  });

  // Test Group 4: Path Validation
  describe('path validation', () => {
    it('flags sexualArousal with nested path', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:sexual_arousal_nested',
        prerequisites: [
          { logic: { '>=': [{ var: 'sexualArousal.nested.path' }, 0.5] } },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_var_path');
      expect(result.violations[0].message).toContain(
        'does not support nested paths'
      );
    });

    it('flags root-only path when key is required', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:missing_key',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions' }, 0.5] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_var_path');
      expect(result.violations[0].message).toContain('must include a key');
    });
  });

  // Test Group 5: Early Returns in Comparison
  describe('comparison range validation early returns', () => {
    it('handles numeric-only comparisons without violations', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:numeric_only_comparison',
        prerequisites: [{ logic: { '>=': [5, 3] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('handles var-only mood axes comparisons', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:var_only_mood_axes_comparison',
        prerequisites: [
          {
            logic: {
              '>=': [
                { var: 'moodAxes.valence' },
                { var: 'moodAxes.arousal' },
              ],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot: {
          ...validKeysByRoot,
          moodAxes: new Set(['valence', 'arousal']),
        },
      });

      expect(
        result.violations.some(
          (v) => v.issueType === 'mood_axes_fractional_threshold'
        )
      ).toBe(false);
    });
  });

  // Test Group 6: Mixed Scale Validation
  describe('mixed scale operation validation', () => {
    it('handles max with non-array args', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:max_non_array',
        prerequisites: [{ logic: { max: 'not-an-array' } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations.some((v) => v.issueType === 'invalid_args')).toBe(
        true
      );
    });

    it('handles max with numeric-only args', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:max_numeric_only',
        prerequisites: [{ logic: { max: [1, 2, 3] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.warnings.some((v) => v.issueType === 'mood_axes_mixed_scale')
      ).toBe(false);
    });

    it('handles min with non-array args', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:min_non_array',
        prerequisites: [{ logic: { min: { var: 'emotions.joy' } } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations.some((v) => v.issueType === 'invalid_args')).toBe(
        true
      );
    });
  });

  // Test Group 7: Division Operator Scale Handling
  describe('division operator scale tracking', () => {
    it('allows mixed-scale comparison when division normalizes mood axes', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:division_scale',
        prerequisites: [
          {
            logic: {
              '>=': [
                {
                  max: [
                    { var: 'emotions.joy' },
                    { '/': [{ var: 'moodAxes.valence' }, 100] },
                  ],
                },
                0,
              ],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.warnings.some((v) => v.issueType === 'mood_axes_mixed_scale')
      ).toBe(false);
    });

    it('handles division with non-numeric denominator', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:division_var_denominator',
        prerequisites: [
          {
            logic: {
              '>=': [
                {
                  max: [
                    { var: 'emotions.joy' },
                    {
                      '/': [
                        { var: 'moodAxes.valence' },
                        { var: 'emotions.joy' },
                      ],
                    },
                  ],
                },
                50,
              ],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.warnings.some((v) => v.issueType === 'mood_axes_mixed_scale')
      ).toBe(true);
    });

    it('handles division with zero denominator', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:division_zero_denominator',
        prerequisites: [
          {
            logic: {
              '>=': [
                {
                  max: [
                    { var: 'emotions.joy' },
                    { '/': [{ var: 'moodAxes.valence' }, 0] },
                  ],
                },
                50,
              ],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.warnings.some((v) => v.issueType === 'mood_axes_mixed_scale')
      ).toBe(true);
    });

    it('handles division with extra arguments', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:division_extra_args',
        prerequisites: [
          {
            logic: {
              '>=': [
                {
                  max: [
                    { var: 'emotions.joy' },
                    {
                      '/': [
                        { var: 'moodAxes.valence' },
                        100,
                        { var: 'emotions.joy' },
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });
  });

  // Test Group 8: Array-form Var Extraction
  describe('array-form var path extraction', () => {
    it('extracts path from array-form var with default value', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:array_var_with_default',
        prerequisites: [
          {
            logic: {
              '>=': [{ var: ['emotions.joy', 0.5] }, 0.3],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });

    it('reports unknown key in array-form var', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:array_var_unknown_key',
        prerequisites: [
          {
            logic: {
              '>=': [{ var: ['emotions.unknown_emotion', 0.5] }, 0.3],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.violations.some((v) => v.issueType === 'unknown_var_key')
      ).toBe(true);
    });

    it('handles array-form var in nested arithmetic', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:array_var_nested',
        prerequisites: [
          {
            logic: {
              '>=': [
                { '-': [{ var: ['emotions.joy', 0] }, 0.1] },
                0.2,
              ],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });
  });

  // Test Group 9: Missing validKeysByRoot Entries
  describe('validKeysByRoot resolution', () => {
    it('skips key validation when sexualStates not in validKeysByRoot', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:missing_sexual_states_keys',
        prerequisites: [
          { logic: { '>=': [{ var: 'sexualStates.desire' }, 0.5] } },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot: {
          emotions: new Set(['joy']),
          moodAxes: new Set(['valence']),
        },
      });

      expect(
        result.violations.some((v) => v.issueType === 'unknown_var_key')
      ).toBe(false);
    });

    it('skips key validation for actor root', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:actor_path',
        prerequisites: [{ logic: { '==': [{ var: 'actor.name' }, 'Test'] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.violations.some((v) => v.issueType === 'invalid_var_root')
      ).toBe(false);
      expect(
        result.violations.some((v) => v.issueType === 'unknown_var_key')
      ).toBe(false);
    });

    it('skips key validation when affectTraits not in validKeysByRoot', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:missing_affect_traits_keys',
        prerequisites: [
          { logic: { '>=': [{ var: 'affectTraits.empathy' }, 50] } },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot: {
          emotions: new Set(['joy']),
          moodAxes: new Set(['valence']),
        },
      });

      expect(
        result.violations.some((v) => v.issueType === 'unknown_var_key')
      ).toBe(false);
    });

    it('skips key validation for previousSexualStates without sexualStates key set', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:prev_sexual_states',
        prerequisites: [
          { logic: { '>=': [{ var: 'previousSexualStates.desire' }, 0.5] } },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot: {
          emotions: new Set(['joy']),
        },
      });

      expect(
        result.violations.some((v) => v.issueType === 'unknown_var_key')
      ).toBe(false);
    });
  });

  // Test Group 10: Arity Formatting
  describe('arity formatting', () => {
    it('formats exact arity for operators with min === max', () => {
      const extendedOps = new Set([...allowedOperations, '!']);
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations: extendedOps,
      });
      const expression = {
        id: 'test:not_wrong_arity',
        prerequisites: [{ logic: { '!': [true, false] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_args');
      expect(result.violations[0].message).toBe(
        'Operator "!" expects 1 arguments.'
      );
    });

    it('formats range arity for operators with min < max', () => {
      const extendedOps = new Set([...allowedOperations, 'substr']);
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations: extendedOps,
      });
      const expression = {
        id: 'test:substr_wrong_arity',
        prerequisites: [{ logic: { substr: ['hello', 0, 3, 'extra'] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_args');
      expect(result.violations[0].message).toBe(
        'Operator "substr" expects 2-3 arguments.'
      );
    });

    it('formats at least N arity for operators with no max', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:min_only_arity',
        prerequisites: [{ logic: { and: [] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
        strictMode: true,
      });

      expect(result.violations.some((v) => v.issueType === 'vacuous_operator')).toBe(
        true
      );
    });

    it('uses in operator with wrong arity to test exact formatting', () => {
      const extendedOps = new Set([...allowedOperations, 'in']);
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations: extendedOps,
      });
      const expression = {
        id: 'test:in_wrong_arity',
        prerequisites: [{ logic: { in: ['a'] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issueType).toBe('invalid_args');
      expect(result.violations[0].message).toBe(
        'Operator "in" expects 2 arguments.'
      );
    });
  });

  // Additional coverage tests
  describe('additional coverage tests', () => {
    it('handles unknown operators without specific arity rules', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations: new Set(['custom_op']),
      });
      const expression = {
        id: 'test:custom_operator',
        prerequisites: [{ logic: { custom_op: [1, 2, 3] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });

    it('handles deeply nested logic structures', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:deep_nesting',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.joy' }, 0.5] },
                    {
                      and: [
                        { '<=': [{ var: 'moodAxes.valence' }, 50] },
                        { '>=': [{ var: 'moodAxes.valence' }, -50] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });

    it('truncates long logic summaries', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // The JSON.stringify output must exceed 160 chars to trigger truncation
      // {">=": [{"var": "emotions.<key>"}, 0.5]} needs key > ~130 chars
      const longKey =
        'a_very_long_emotion_key_that_will_make_the_summary_exceed_160_characters_' +
        'and_should_be_truncated_properly_in_the_output_with_even_more_text_here_' +
        'to_ensure_we_definitely_hit_the_160_character_limit_for_truncation';
      const expression = {
        id: 'test:long_summary',
        prerequisites: [
          {
            logic: {
              '>=': [{ var: `emotions.${longKey}` }, 0.5],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.violations.some((v) => v.issueType === 'unknown_var_key')
      ).toBe(true);
      const violation = result.violations.find(
        (v) => v.issueType === 'unknown_var_key'
      );
      expect(violation.logicSummary).toMatch(/\.\.\.$/);
    });

    it('handles constructor with no options', () => {
      const validator = new ExpressionPrerequisiteValidator();
      const expression = {
        id: 'test:no_options',
        prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });

    it('validates sexualArousal without nested path', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      const expression = {
        id: 'test:sexual_arousal_valid',
        prerequisites: [{ logic: { '>=': [{ var: 'sexualArousal' }, 0.5] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(result.violations).toHaveLength(0);
    });

    it('handles null var path early return', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // null path triggers !path check at line 359, returning early
      const expression = {
        id: 'test:null_path',
        prerequisites: [{ logic: { var: null } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      // null triggers "must be a string or an array" error at line 352
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain('string or an array');
    });

    it('flags mood axes value outside valid range', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // Value 150 is outside -100..100 range for mood axes
      const expression = {
        id: 'test:out_of_range',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 150] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      expect(
        result.violations.some((v) => v.issueType === 'range_mismatch')
      ).toBe(true);
      expect(result.violations.some((v) => v.message.includes('outside expected range'))).toBe(
        true
      );
    });

    it('handles var with numeric value type', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // numeric value triggers #extractVarPath returning null (line 729)
      const expression = {
        id: 'test:numeric_var',
        prerequisites: [{ logic: { var: 123 } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      // Should get "must be a string or an array" violation
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain('string or an array');
    });

    it('handles var with array containing numeric first element', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // Array with numeric first element triggers line 325 check for non-string path
      const expression = {
        id: 'test:numeric_array_var',
        prerequisites: [{ logic: { var: [123, 'default'] } }],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      // Should get "path must be a string" error because array[0] is not a string
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain('path must be a string');
    });

    it('flags mood axes value outside range in comparison with non-direct args', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // To trigger line 535 range check, we need:
      // - mood axes comparison (moodAxesPaths.length > 0)
      // - skipMoodAxesRangeCheck to be false (requires hasNonDirectArg OR no direct var paths)
      // Using multiplication creates non-direct args context
      const expression = {
        id: 'test:range_check',
        prerequisites: [
          {
            logic: {
              '>=': [{ '*': [{ var: 'moodAxes.valence' }, 1] }, 150],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      // Should get range_mismatch for value 150 being outside -100..100
      expect(
        result.violations.some(
          (v) =>
            v.issueType === 'range_mismatch' &&
            v.message.includes('outside expected range')
        )
      ).toBe(true);
    });

    it('handles mixed scale check with normalized entries but no mood axes entries', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // Comparison with normalized root (emotions) and mood axes in value
      // but actual mood axes var not present in same comparison context
      // Use a valid range value (0.5) to avoid range_mismatch
      const expression = {
        id: 'test:normalized_only',
        prerequisites: [
          {
            logic: {
              // Compare emotions value with a number in valid range - no moodAxes var here
              // hasNormalizedRoot will be true but moodAxesEntries will be empty
              '>=': [{ var: 'emotions.joy' }, 0.5],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      // This should not generate mixed scale warning (line 656 branch hit)
      // because moodAxesEntries is empty, so isMixedScaleComparisonCompatible returns false
      // No warning should be generated - the check passes because no mixing detected
      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('handles extractVarPath returning null for numeric var value in comparison', () => {
      const validator = new ExpressionPrerequisiteValidator({
        allowedOperations,
      });
      // In comparison context, #extractVarPath is called on each arg
      // If var value is a number (not string or array), it returns null (line 733)
      const expression = {
        id: 'test:numeric_var_in_comparison',
        prerequisites: [
          {
            logic: {
              // { var: 123 } has numeric value, extractVarPath returns null
              '>=': [{ var: 123 }, 5],
            },
          },
        ],
      };

      const result = validator.validateExpression(expression, {
        modId: 'test',
        validKeysByRoot,
      });

      // Should get "must be a string or an array" violation from validateVarArgs
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain('string or an array');
    });
  });
});
