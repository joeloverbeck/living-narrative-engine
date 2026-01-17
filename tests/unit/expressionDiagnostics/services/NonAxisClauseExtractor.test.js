/**
 * @file NonAxisClauseExtractor.test.js
 * @description Unit tests for NonAxisClauseExtractor service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import NonAxisClauseExtractor from '../../../../src/expressionDiagnostics/services/NonAxisClauseExtractor.js';

describe('NonAxisClauseExtractor', () => {
  let extractor;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    extractor = new NonAxisClauseExtractor({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is missing', () => {
      expect(() => new NonAxisClauseExtractor({})).toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      expect(
        () => new NonAxisClauseExtractor({ logger: { info: jest.fn() } })
      ).toThrow();
    });
  });

  describe('extract - basic extraction tests', () => {
    it('should extract emotions.* comparison clauses', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        clauseType: 'emotion',
        sourcePath: 'prereqs[0]',
      });
    });

    it('should extract sexualStates.* comparison clauses', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'sexualStates.arousal' }, 0.5] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        varPath: 'sexualStates.arousal',
        operator: '>=',
        threshold: 0.5,
        clauseType: 'sexual',
      });
    });

    it('should extract previousEmotions.* clauses', () => {
      const prereqs = [
        { logic: { '<=': [{ var: 'previousEmotions.anger' }, 0.3] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        varPath: 'previousEmotions.anger',
        operator: '<=',
        threshold: 0.3,
        clauseType: 'emotion',
      });
    });

    it('should extract previousSexualStates.* clauses', () => {
      const prereqs = [
        { logic: { '>': [{ var: 'previousSexualStates.desire' }, 0.1] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        varPath: 'previousSexualStates.desire',
        operator: '>',
        threshold: 0.1,
        clauseType: 'sexual',
      });
    });

    it('should handle reversed comparison (number op var)', () => {
      const prereqs = [{ logic: { '<=': [0.5, { var: 'emotions.joy' }] } }];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        varPath: 'emotions.joy',
        operator: '<=',
        threshold: 0.5,
        clauseType: 'emotion',
      });
    });
  });

  describe('extract - axis exclusion tests', () => {
    it('should NOT extract moodAxes.* clauses', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, -0.5] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(0);
    });

    it('should NOT extract mood.* clauses (alias)', () => {
      const prereqs = [{ logic: { '>=': [{ var: 'mood.valence' }, 0.3] } }];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(0);
    });

    it('should NOT extract sexualAxes.* clauses', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'sexualAxes.dominance' }, 0.2] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(0);
    });

    it('should NOT extract affectTraits.* clauses', () => {
      const prereqs = [
        { logic: { '<=': [{ var: 'affectTraits.stability' }, 0.8] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(0);
    });

    it('should extract non-axis and exclude axis in mixed prerequisites', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } },
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } },
        { logic: { '<=': [{ var: 'sexualAxes.arousal' }, 0.5] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].varPath).toBe('emotions.confusion');
    });
  });

  describe('extract - delta pattern tests', () => {
    it('should extract delta pattern { "-": [current, previous] }', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.joy' },
                  { var: 'previousEmotions.joy' },
                ],
              },
              0.1,
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.1,
        isDelta: true,
        clauseType: 'delta',
      });
    });

    it('should set isDelta: true for delta clauses', () => {
      const prereqs = [
        {
          logic: {
            '>': [
              {
                '-': [
                  { var: 'sexualStates.arousal' },
                  { var: 'previousSexualStates.arousal' },
                ],
              },
              0.05,
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].isDelta).toBe(true);
    });

    it('should set clauseType: "delta" for delta clauses', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.anger' },
                  { var: 'previousEmotions.anger' },
                ],
              },
              0.2,
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].clauseType).toBe('delta');
    });

    it('should extract delta pattern with different emotion types', () => {
      const prereqs = [
        {
          logic: {
            '<=': [
              {
                '-': [
                  { var: 'emotions.sadness' },
                  { var: 'previousEmotions.sadness' },
                ],
              },
              -0.1,
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].varPath).toBe('emotions.sadness');
      expect(clauses[0].threshold).toBe(-0.1);
    });
  });

  describe('extract - operator handling tests', () => {
    it('should handle >= operator', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].operator).toBe('>=');
    });

    it('should handle > operator', () => {
      const prereqs = [
        { logic: { '>': [{ var: 'emotions.fear' }, 0.3] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].operator).toBe('>');
    });

    it('should handle <= operator', () => {
      const prereqs = [
        { logic: { '<=': [{ var: 'emotions.calm' }, 0.8] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].operator).toBe('<=');
    });

    it('should handle < operator', () => {
      const prereqs = [
        { logic: { '<': [{ var: 'emotions.surprise' }, 0.2] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].operator).toBe('<');
    });

    it('should handle == operator', () => {
      const prereqs = [
        { logic: { '==': [{ var: 'emotions.neutral' }, 0.0] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].operator).toBe('==');
    });

    it('should handle != operator', () => {
      const prereqs = [
        { logic: { '!=': [{ var: 'emotions.disgust' }, 0.0] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].operator).toBe('!=');
    });
  });

  describe('extract - compound logic traversal tests', () => {
    it('should traverse and arrays', () => {
      const prereqs = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.3] },
              { '<=': [{ var: 'emotions.anger' }, 0.2] },
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(2);
      expect(clauses[0].varPath).toBe('emotions.joy');
      expect(clauses[0].sourcePath).toBe('prereqs[0].and[0]');
      expect(clauses[1].varPath).toBe('emotions.anger');
      expect(clauses[1].sourcePath).toBe('prereqs[0].and[1]');
    });

    it('should traverse or arrays', () => {
      const prereqs = [
        {
          logic: {
            or: [
              { '>=': [{ var: 'emotions.fear' }, 0.5] },
              { '>=': [{ var: 'emotions.surprise' }, 0.5] },
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(2);
      expect(clauses[0].sourcePath).toBe('prereqs[0].or[0]');
      expect(clauses[1].sourcePath).toBe('prereqs[0].or[1]');
    });

    it('should handle nested compound logic', () => {
      const prereqs = [
        {
          logic: {
            and: [
              {
                or: [
                  { '>=': [{ var: 'emotions.joy' }, 0.3] },
                  { '>=': [{ var: 'emotions.excitement' }, 0.4] },
                ],
              },
              { '<=': [{ var: 'emotions.sadness' }, 0.2] },
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(3);
      expect(clauses[0].sourcePath).toBe('prereqs[0].and[0].or[0]');
      expect(clauses[1].sourcePath).toBe('prereqs[0].and[0].or[1]');
      expect(clauses[2].sourcePath).toBe('prereqs[0].and[1]');
    });

    it('should handle deeply nested logic', () => {
      const prereqs = [
        {
          logic: {
            and: [
              {
                and: [
                  {
                    or: [
                      { '>=': [{ var: 'emotions.confusion' }, 0.25] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].sourcePath).toBe('prereqs[0].and[0].and[0].or[0]');
    });
  });

  describe('extract - edge case tests', () => {
    it('should return empty array for empty prerequisites', () => {
      const clauses = extractor.extract([]);

      expect(clauses).toEqual([]);
    });

    it('should return empty array for axis-only prerequisites', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } },
        { logic: { '<=': [{ var: 'moodAxes.arousal' }, 0.6] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toEqual([]);
    });

    it('should handle null prerequisites gracefully', () => {
      const clauses = extractor.extract(null);

      expect(clauses).toEqual([]);
    });

    it('should handle undefined prerequisites gracefully', () => {
      const clauses = extractor.extract(undefined);

      expect(clauses).toEqual([]);
    });

    it('should handle malformed logic nodes without crashing', () => {
      const prereqs = [
        { logic: null },
        { logic: 'invalid' },
        { logic: { '>=': null } },
        { logic: { '>=': 'not an array' } },
        { logic: { '>=': [] } },
        { logic: { '>=': [{ var: 'emotions.joy' }] } }, // Missing threshold
        { logic: { unknown_op: [{ var: 'emotions.joy' }, 0.5] } },
      ];

      expect(() => {
        extractor.extract(prereqs);
      }).not.toThrow();

      const clauses = extractor.extract(prereqs);
      expect(Array.isArray(clauses)).toBe(true);
    });

    it('should handle prerequisites without logic property', () => {
      const prereqs = [{ description: 'No logic here' }, {}];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toEqual([]);
    });

    it('should not crash on non-array prerequisites', () => {
      expect(() => extractor.extract('not an array')).not.toThrow();
      expect(() => extractor.extract(123)).not.toThrow();
      expect(() => extractor.extract({})).not.toThrow();
    });
  });

  describe('extract - classification tests', () => {
    it('should classify emotions.* as clauseType: "emotion"', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].clauseType).toBe('emotion');
    });

    it('should classify previousEmotions.* as clauseType: "emotion"', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'previousEmotions.joy' }, 0.3] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].clauseType).toBe('emotion');
    });

    it('should classify sexualStates.* as clauseType: "sexual"', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'sexualStates.arousal' }, 0.5] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].clauseType).toBe('sexual');
    });

    it('should classify previousSexualStates.* as clauseType: "sexual"', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'previousSexualStates.desire' }, 0.4] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].clauseType).toBe('sexual');
    });

    it('should classify delta patterns as clauseType: "delta"', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              { '-': [{ var: 'emotions.joy' }, { var: 'previousEmotions.joy' }] },
              0.1,
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].clauseType).toBe('delta');
    });

    it('should classify unknown paths as clauseType: "other"', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'customState.value' }, 0.5] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].clauseType).toBe('other');
    });
  });

  describe('extract - sourcePath accuracy tests', () => {
    it('should track sourcePath accurately for simple prerequisites', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } },
        { logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].sourcePath).toBe('prereqs[0]');
      expect(clauses[1].sourcePath).toBe('prereqs[1]');
    });

    it('should track sourcePath accurately for compound logic', () => {
      const prereqs = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.3] },
              {
                or: [
                  { '>=': [{ var: 'emotions.excitement' }, 0.4] },
                  { '>=': [{ var: 'emotions.surprise' }, 0.5] },
                ],
              },
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses[0].sourcePath).toBe('prereqs[0].and[0]');
      expect(clauses[1].sourcePath).toBe('prereqs[0].and[1].or[0]');
      expect(clauses[2].sourcePath).toBe('prereqs[0].and[1].or[1]');
    });
  });

  describe('extract - invariants', () => {
    it('should never return null (always returns array)', () => {
      expect(extractor.extract(null)).toEqual([]);
      expect(extractor.extract(undefined)).toEqual([]);
      expect(extractor.extract([])).toEqual([]);
    });

    it('should log debug message with extraction count', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } },
        { logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } },
      ];

      extractor.extract(prereqs);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('extracted 2 non-axis clause(s)')
      );
    });
  });

  describe('extract - multiple prerequisites', () => {
    it('should extract clauses from multiple prerequisites', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } },
        { logic: { '>=': [{ var: 'sexualStates.arousal' }, 0.5] } },
        {
          logic: {
            '>=': [
              { '-': [{ var: 'emotions.anger' }, { var: 'previousEmotions.anger' }] },
              0.1,
            ],
          },
        },
      ];

      const clauses = extractor.extract(prereqs);

      expect(clauses).toHaveLength(3);
      expect(clauses[0].clauseType).toBe('emotion');
      expect(clauses[1].clauseType).toBe('sexual');
      expect(clauses[2].clauseType).toBe('delta');
    });
  });
});
