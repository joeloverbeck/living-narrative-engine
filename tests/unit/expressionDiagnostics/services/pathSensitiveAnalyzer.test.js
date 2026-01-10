/**
 * @file Unit tests for PathSensitiveAnalyzer service
 * @see src/expressionDiagnostics/services/PathSensitiveAnalyzer.js
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PathSensitiveAnalyzer from '../../../../src/expressionDiagnostics/services/PathSensitiveAnalyzer.js';
import PathSensitiveResult from '../../../../src/expressionDiagnostics/models/PathSensitiveResult.js';

describe('PathSensitiveAnalyzer', () => {
  let mockDataRegistry;
  let mockGateConstraintAnalyzer;
  let mockIntensityBoundsCalculator;
  let mockLogger;

  beforeEach(() => {
    mockDataRegistry = {
      getLookupData: jest.fn(),
    };
    mockGateConstraintAnalyzer = {
      analyze: jest.fn(),
    };
    mockIntensityBoundsCalculator = {
      analyzeExpression: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
  });

  describe('Constructor Validation', () => {
    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new PathSensitiveAnalyzer({
            gateConstraintAnalyzer: mockGateConstraintAnalyzer,
            intensityBoundsCalculator: mockIntensityBoundsCalculator,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if gateConstraintAnalyzer is missing', () => {
      expect(
        () =>
          new PathSensitiveAnalyzer({
            dataRegistry: mockDataRegistry,
            intensityBoundsCalculator: mockIntensityBoundsCalculator,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if intensityBoundsCalculator is missing', () => {
      expect(
        () =>
          new PathSensitiveAnalyzer({
            dataRegistry: mockDataRegistry,
            gateConstraintAnalyzer: mockGateConstraintAnalyzer,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new PathSensitiveAnalyzer({
            dataRegistry: mockDataRegistry,
            gateConstraintAnalyzer: mockGateConstraintAnalyzer,
            intensityBoundsCalculator: mockIntensityBoundsCalculator,
          })
      ).toThrow();
    });

    it('should construct successfully with all dependencies', () => {
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
      expect(analyzer).toBeInstanceOf(PathSensitiveAnalyzer);
    });
  });

  describe('analyze() Method Validation', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should throw if expression has no id', () => {
      expect(() => analyzer.analyze({})).toThrow(
        'PathSensitiveAnalyzer requires expression with id'
      );
    });

    it('should throw if expression is null', () => {
      expect(() => analyzer.analyze(null)).toThrow();
    });

    it('should throw if expression is undefined', () => {
      expect(() => analyzer.analyze(undefined)).toThrow();
    });

    it('should return PathSensitiveResult', () => {
      const result = analyzer.analyze({ id: 'test:expression' });
      expect(result).toBeInstanceOf(PathSensitiveResult);
    });

    it('should set expressionId in result', () => {
      const result = analyzer.analyze({ id: 'test:expression' });
      expect(result.expressionId).toBe('test:expression');
    });

    it('should handle expression with no prerequisites', () => {
      const result = analyzer.analyze({ id: 'test:expression' });
      expect(result.branches).toHaveLength(1);
      expect(result.branches[0].description).toBe('Single path (no OR branches)');
    });

    it('should handle expression with empty prerequisites array', () => {
      const result = analyzer.analyze({ id: 'test:expression', prerequisites: [] });
      expect(result.branches).toHaveLength(1);
    });

    it('should log debug message when analyzing', () => {
      analyzer.analyze({ id: 'test:expression' });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PathSensitiveAnalyzer: Analyzing test:expression'
      );
    });
  });

  describe('Branch Enumeration - No OR Nodes', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should create single branch when no OR nodes present', () => {
      const expression = {
        id: 'test:simple',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches).toHaveLength(1);
      expect(result.branches[0].branchId).toBe('branch_0');
    });

    it('should collect prototypes from simple expression', () => {
      const expression = {
        id: 'test:simple',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches[0].requiredPrototypes).toContain('flow');
    });

    it('should handle AND block without OR nodes', () => {
      const expression = {
        id: 'test:and_only',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'emotions.interest' }, 0.3] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches).toHaveLength(1);
      expect(result.branches[0].requiredPrototypes).toContain('flow');
      expect(result.branches[0].requiredPrototypes).toContain('interest');
    });
  });

  describe('Branch Enumeration - Single OR Node', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should create N branches for single OR with N children', () => {
      const expression = {
        id: 'test:or_3',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.interest' }, 0.45] },
                { '>=': [{ var: 'emotions.fascination' }, 0.45] },
                { '>=': [{ var: 'emotions.entrancement' }, 0.40] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches).toHaveLength(3);
    });

    it('should create correct prototypes per branch', () => {
      const expression = {
        id: 'test:or_3',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.interest' }, 0.45] },
                { '>=': [{ var: 'emotions.fascination' }, 0.45] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // Each branch should have one prototype
      expect(result.branches[0].requiredPrototypes).toContain('interest');
      expect(result.branches[1].requiredPrototypes).toContain('fascination');
    });

    it('should generate meaningful descriptions including prototype names', () => {
      const expression = {
        id: 'test:or_desc',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.interest' }, 0.45] },
                { '>=': [{ var: 'emotions.fascination' }, 0.45] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches[0].description).toContain('interest');
      expect(result.branches[1].description).toContain('fascination');
    });
  });

  describe('Branch Enumeration - Multiple OR Nodes (Cartesian Product)', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should create N*M branches for two sequential ORs', () => {
      const expression = {
        id: 'test:or_nm',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.interest' }, 0.5] },
                    { '>=': [{ var: 'emotions.fascination' }, 0.5] },
                  ],
                },
                {
                  or: [
                    { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
                    { '>=': [{ var: 'sexualStates.excited' }, 0.4] },
                    { '>=': [{ var: 'sexualStates.passion' }, 0.5] },
                  ],
                },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      // 2 options * 3 options = 6 branches
      expect(result.branches).toHaveLength(6);
    });

    it('should combine prototypes from both OR choices in each branch', () => {
      const expression = {
        id: 'test:or_combined',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.interest' }, 0.5] },
                    { '>=': [{ var: 'emotions.fascination' }, 0.5] },
                  ],
                },
                {
                  or: [
                    { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
                    { '>=': [{ var: 'sexualStates.excited' }, 0.4] },
                  ],
                },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // First branch: interest + aroused
      const branch0 = result.branches[0];
      expect(branch0.requiredPrototypes).toContain('interest');
      expect(branch0.requiredPrototypes).toContain('aroused');

      // Check that each branch has exactly 2 prototypes
      for (const branch of result.branches) {
        expect(branch.requiredPrototypes.length).toBe(2);
      }
    });
  });

  describe('Branch Enumeration - Nested OR Nodes', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should handle nested ORs correctly', () => {
      const expression = {
        id: 'test:nested_or',
        prerequisites: [
          {
            logic: {
              or: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.flow' }, 0.5] },
                    { '>=': [{ var: 'emotions.interest' }, 0.5] },
                  ],
                },
                { '>=': [{ var: 'emotions.fascination' }, 0.5] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      // Nested OR (2 options) + outer option (1) = 3 branches
      expect(result.branches).toHaveLength(3);
    });
  });

  describe('Branch Enumeration - maxBranches Limit', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should respect maxBranches limit', () => {
      // Create expression with many OR branches (would produce 27 branches without limit)
      const expression = {
        id: 'test:many_or',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.a' }, 0.5] },
                    { '>=': [{ var: 'emotions.b' }, 0.5] },
                    { '>=': [{ var: 'emotions.c' }, 0.5] },
                  ],
                },
                {
                  or: [
                    { '>=': [{ var: 'emotions.d' }, 0.5] },
                    { '>=': [{ var: 'emotions.e' }, 0.5] },
                    { '>=': [{ var: 'emotions.f' }, 0.5] },
                  ],
                },
                {
                  or: [
                    { '>=': [{ var: 'emotions.g' }, 0.5] },
                    { '>=': [{ var: 'emotions.h' }, 0.5] },
                    { '>=': [{ var: 'emotions.i' }, 0.5] },
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression, { maxBranches: 5 });
      expect(result.branches.length).toBeLessThanOrEqual(5);
    });

    it('should log warning when limit reached', () => {
      const expression = {
        id: 'test:limit',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.a' }, 0.5] },
                    { '>=': [{ var: 'emotions.b' }, 0.5] },
                    { '>=': [{ var: 'emotions.c' }, 0.5] },
                  ],
                },
                {
                  or: [
                    { '>=': [{ var: 'emotions.d' }, 0.5] },
                    { '>=': [{ var: 'emotions.e' }, 0.5] },
                    { '>=': [{ var: 'emotions.f' }, 0.5] },
                  ],
                },
              ],
            },
          },
        ],
      };

      analyzer.analyze(expression, { maxBranches: 3 });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Branch limit')
      );
    });

    it('should use default maxBranches of 100', () => {
      // DEFAULT_OPTIONS should have maxBranches = 100
      expect(PathSensitiveAnalyzer.DEFAULT_OPTIONS.maxBranches).toBe(100);
    });
  });

  describe('Branch Enumeration - Edge Cases', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should handle empty OR arrays gracefully', () => {
      const expression = {
        id: 'test:empty_or',
        prerequisites: [
          {
            logic: {
              or: [],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      // Should still produce at least one branch
      expect(result.branches.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle deeply nested AND blocks', () => {
      const expression = {
        id: 'test:deep_and',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  and: [
                    { '>=': [{ var: 'emotions.flow' }, 0.5] },
                    { '>=': [{ var: 'emotions.interest' }, 0.3] },
                  ],
                },
                {
                  and: [
                    { '>=': [{ var: 'emotions.fascination' }, 0.4] },
                  ],
                },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches).toHaveLength(1);
      expect(result.branches[0].requiredPrototypes).toContain('flow');
      expect(result.branches[0].requiredPrototypes).toContain('interest');
      expect(result.branches[0].requiredPrototypes).toContain('fascination');
    });

    it('should handle null logic in prerequisite gracefully', () => {
      const expression = {
        id: 'test:null_logic',
        prerequisites: [{ logic: null }, { logic: { '>=': [{ var: 'emotions.flow' }, 0.5] } }],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle prerequisite without logic property', () => {
      const expression = {
        id: 'test:no_logic',
        prerequisites: [{ otherProp: 'value' }],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches).toHaveLength(1);
    });
  });

  describe('Prototype Extraction', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should extract prototype from "emotions.flow" pattern', () => {
      const expression = {
        id: 'test:emotions_pattern',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches[0].requiredPrototypes).toContain('flow');
    });

    it('should extract prototype from "sexualStates.aroused" pattern', () => {
      const expression = {
        id: 'test:sexual_pattern',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches[0].requiredPrototypes).toContain('aroused');
    });

    it('should deduplicate prototypes within a branch', () => {
      const expression = {
        id: 'test:duplicate_proto',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '<=': [{ var: 'emotions.flow' }, 0.9] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      const flowCount = result.branches[0].requiredPrototypes.filter(
        (p) => p === 'flow'
      ).length;
      expect(flowCount).toBe(1);
    });

    it('should handle nested var references', () => {
      const expression = {
        id: 'test:nested_var',
        prerequisites: [
          {
            logic: {
              if: [
                { '>=': [{ var: 'emotions.happiness' }, 0.5] },
                true,
                false,
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branches[0].requiredPrototypes).toContain('happiness');
    });
  });

  describe('Branch Descriptions', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should generate meaningful descriptions with prototype names', () => {
      const expression = {
        id: 'test:meaningful_desc',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.interest' }, 0.45] },
                { '>=': [{ var: 'emotions.fascination' }, 0.45] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // Descriptions should reference prototype names
      expect(result.branches[0].description).toMatch(/interest/i);
      expect(result.branches[1].description).toMatch(/fascination/i);
    });

    it('should use arrow separator for chained descriptions', () => {
      const expression = {
        id: 'test:chained',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.flow' }, 0.5] },
                    { '>=': [{ var: 'emotions.interest' }, 0.5] },
                  ],
                },
                {
                  or: [
                    { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
                    { '>=': [{ var: 'sexualStates.excited' }, 0.4] },
                  ],
                },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      // Description should use arrow separator for chained paths
      expect(result.branches[0].description).toContain('\u2192');
    });

    it('should describe AND blocks with multiple prototypes', () => {
      const expression = {
        id: 'test:and_desc',
        prerequisites: [
          {
            logic: {
              or: [
                {
                  and: [
                    { '>=': [{ var: 'emotions.flow' }, 0.5] },
                    { '>=': [{ var: 'emotions.interest' }, 0.3] },
                  ],
                },
                { '>=': [{ var: 'emotions.fascination' }, 0.5] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      // First branch should mention combined prototypes
      expect(result.branches[0].description).toMatch(/flow|interest/i);
    });
  });

  describe('Static Exports', () => {
    it('should export DEFAULT_OPTIONS', () => {
      expect(PathSensitiveAnalyzer.DEFAULT_OPTIONS).toBeDefined();
    });

    it('should have DEFAULT_OPTIONS frozen', () => {
      expect(Object.isFrozen(PathSensitiveAnalyzer.DEFAULT_OPTIONS)).toBe(true);
    });

    it('should have maxBranches in DEFAULT_OPTIONS', () => {
      expect(PathSensitiveAnalyzer.DEFAULT_OPTIONS.maxBranches).toBe(100);
    });

    it('should have knifeEdgeThreshold in DEFAULT_OPTIONS', () => {
      expect(PathSensitiveAnalyzer.DEFAULT_OPTIONS.knifeEdgeThreshold).toBe(0.02);
    });

    it('should have computeVolume in DEFAULT_OPTIONS', () => {
      expect(PathSensitiveAnalyzer.DEFAULT_OPTIONS.computeVolume).toBe(false);
    });
  });

  describe('Result Structure', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should return reachabilityByBranch array (populated by ticket 006)', () => {
      const result = analyzer.analyze({ id: 'test:result' });
      expect(Array.isArray(result.reachabilityByBranch)).toBe(true);
    });

    it('should return null feasibilityVolume (to be computed by ticket 009)', () => {
      const result = analyzer.analyze({ id: 'test:result' });
      expect(result.feasibilityVolume).toBeNull();
    });

    it('should have unique branch IDs', () => {
      const expression = {
        id: 'test:unique_ids',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.a' }, 0.5] },
                { '>=': [{ var: 'emotions.b' }, 0.5] },
                { '>=': [{ var: 'emotions.c' }, 0.5] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      const ids = result.branches.map((b) => b.branchId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should not modify original expression', () => {
      const expression = {
        id: 'test:immutable',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const originalJson = JSON.stringify(expression);
      analyzer.analyze(expression);
      expect(JSON.stringify(expression)).toBe(originalJson);
    });
  });

  describe('Integration with PathSensitiveResult', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should produce valid PathSensitiveResult that can be serialized', () => {
      const expression = {
        id: 'test:serialize',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'emotions.interest' }, 0.5] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      const json = result.toJSON();

      expect(json.expressionId).toBe('test:serialize');
      expect(json.branches).toHaveLength(2);
      expect(json.branchCount).toBe(2);
    });

    it('should produce result with correct branchCount', () => {
      const expression = {
        id: 'test:count',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.a' }, 0.5] },
                { '>=': [{ var: 'emotions.b' }, 0.5] },
                { '>=': [{ var: 'emotions.c' }, 0.5] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);
      expect(result.branchCount).toBe(3);
    });
  });

  // =====================================================================
  // CONSTRAINT ANALYSIS TESTS (EXPDIAPATSENANA-006)
  // =====================================================================

  describe('Constraint Analysis - Axis Intervals', () => {
    let analyzer;

    beforeEach(() => {
      // Set up mock with realistic prototype data
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: {
                gates: ['valence >= 0.3', 'arousal >= 0.2'],
                weights: { valence: 0.6, arousal: 0.4 },
              },
              interest: {
                gates: ['valence >= 0.1', 'arousal <= 0.7'],
                weights: { valence: 0.5, arousal: 0.5 },
              },
              sadness: {
                gates: ['valence <= -0.2'],
                weights: { valence: -0.8, arousal: 0.2 },
              },
            },
          };
        }
        return null;
      });

      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should compute intervals for specified prototypes only', () => {
      const expression = {
        id: 'test:intervals',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // Should have axisIntervals from flow prototype gates
      expect(result.branches[0].axisIntervals).toBeInstanceOf(Map);
      expect(result.branches[0].axisIntervals.has('valence')).toBe(true);
    });

    it('should not include gates from other prototypes', () => {
      // Set up mock where interest has a very restrictive gate
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: {
                gates: ['valence >= 0.3'],
                weights: { valence: 1.0 },
              },
              // interest not in the branch, so its gates should not apply
              interest: {
                gates: ['valence >= 0.9'], // Very restrictive
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:isolation',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // Valence interval should be [0.3, 1] from flow, not [0.9, 1] from interest
      const valenceInterval = result.branches[0].axisIntervals.get('valence');
      expect(valenceInterval.min).toBeCloseTo(0.3, 2);
    });

    it('should return empty Map when lookup data is missing', () => {
      mockDataRegistry.getLookupData.mockReturnValue(null);

      const expression = {
        id: 'test:no_lookup',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].axisIntervals.size).toBe(0);
    });
  });

  describe('Constraint Analysis - Conflict Detection', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should return empty conflicts array when no conflicts', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: {
                gates: ['valence >= 0.3', 'valence <= 0.8'],
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:no_conflict',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].conflicts).toEqual([]);
    });

    it('should detect empty intervals as conflicts', () => {
      // Create conflicting gates that produce an empty interval
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              conflicting: {
                gates: ['valence >= 0.8', 'valence <= 0.2'], // Impossible!
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:conflict',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.conflicting' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].conflicts.length).toBeGreaterThan(0);
      expect(result.branches[0].conflicts[0].axis).toBe('valence');
    });

    it('should mark branch as infeasible when conflicts exist', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              conflicting: {
                gates: ['valence >= 0.9', 'valence <= 0.1'],
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:infeasible',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.conflicting' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].isInfeasible).toBe(true);
    });
  });

  describe('Constraint Analysis - Knife-Edge Detection', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should return empty array when no narrow intervals', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              wide: {
                gates: ['valence >= 0.2', 'valence <= 0.8'], // Width = 0.6
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:wide',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.wide' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].knifeEdges).toEqual([]);
    });

    it('should detect intervals at threshold boundary', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              narrow: {
                gates: ['valence >= 0.5', 'valence <= 0.519'], // Width = 0.019 (just under threshold of 0.02)
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:threshold',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.narrow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].knifeEdges.length).toBe(1);
      expect(result.branches[0].knifeEdges[0].axis).toBe('valence');
    });

    it('should detect zero-width intervals', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              point: {
                gates: ['valence >= 0.5', 'valence <= 0.5'], // Width = 0
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:zero_width',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.point' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].knifeEdges.length).toBe(1);
      expect(result.branches[0].knifeEdges[0].width).toBe(0);
    });

    it('should include contributing prototypes and gates', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              narrow: {
                gates: ['valence >= 0.5', 'valence <= 0.51'],
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:contributors',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.narrow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const ke = result.branches[0].knifeEdges[0];
      expect(ke.contributingPrototypes).toContain('narrow');
      expect(ke.contributingGates.length).toBeGreaterThan(0);
    });

    it('should respect custom knifeEdgeThreshold option', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              medium: {
                gates: ['valence >= 0.5', 'valence <= 0.55'], // Width = 0.05
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:custom_threshold',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.medium' }, 0.5] },
          },
        ],
      };

      // Default threshold (0.02) should not flag this
      const result1 = analyzer.analyze(expression);
      expect(result1.branches[0].knifeEdges).toEqual([]);

      // Custom threshold (0.1) should flag this
      const result2 = analyzer.analyze(expression, { knifeEdgeThreshold: 0.1 });
      expect(result2.branches[0].knifeEdges.length).toBe(1);
    });
  });

  describe('Constraint Analysis - Max Intensity Calculation', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should return 1.0 for unconstrained axes', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              unconstrained: {
                gates: [], // No gates
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:unconstrained',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.unconstrained' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // With no constraints, max should be 1.0
      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'unconstrained'
      );
      expect(reachability.maxPossible).toBe(1.0);
    });

    it('should return reduced max for constrained axes', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              constrained: {
                gates: ['valence <= 0.5'], // Cap at 0.5
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:constrained',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.constrained' }, 0.3] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'constrained'
      );
      expect(reachability.maxPossible).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Constraint Analysis - Threshold Extraction', () => {
    let analyzer;

    beforeEach(() => {
      mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should extract thresholds from nested AND blocks', () => {
      const expression = {
        id: 'test:nested_and',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                {
                  and: [{ '>=': [{ var: 'emotions.interest' }, 0.3] }],
                },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // Should have reachability entries for both flow and interest
      const flowReach = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'flow'
      );
      const interestReach = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'interest'
      );

      expect(flowReach).toBeDefined();
      expect(flowReach.threshold).toBe(0.5);
      expect(interestReach).toBeDefined();
      expect(interestReach.threshold).toBe(0.3);
    });

    it('should extract thresholds from nested OR blocks', () => {
      const expression = {
        id: 'test:nested_or',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'emotions.interest' }, 0.3] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // Should have reachability entries - each branch has its own threshold
      expect(result.reachabilityByBranch.length).toBeGreaterThan(0);
    });

    it('should handle emotion and sexual types', () => {
      const expression = {
        id: 'test:both_types',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'sexualStates.aroused' }, 0.3] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const emotionReach = result.reachabilityByBranch.find(
        (r) => r.type === 'emotion'
      );
      const sexualReach = result.reachabilityByBranch.find(
        (r) => r.type === 'sexual'
      );

      expect(emotionReach).toBeDefined();
      expect(sexualReach).toBeDefined();
    });
  });

  describe('Constraint Analysis - Full Analysis Integration', () => {
    let analyzer;

    beforeEach(() => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: {
                gates: ['valence >= 0.3', 'arousal >= 0.2'],
                weights: { valence: 0.6, arousal: 0.4 },
              },
              interest: {
                gates: ['valence >= 0.1'],
                weights: { valence: 0.7, arousal: 0.3 },
              },
            },
          };
        }
        return null;
      });

      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should populate branch.axisIntervals', () => {
      const expression = {
        id: 'test:full_analysis',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(result.branches[0].axisIntervals).toBeInstanceOf(Map);
      expect(result.branches[0].axisIntervals.size).toBeGreaterThan(0);
    });

    it('should populate branch.conflicts', () => {
      const expression = {
        id: 'test:full_conflicts',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(Array.isArray(result.branches[0].conflicts)).toBe(true);
    });

    it('should populate branch.knifeEdges', () => {
      const expression = {
        id: 'test:full_knife_edges',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(Array.isArray(result.branches[0].knifeEdges)).toBe(true);
    });

    it('should populate reachabilityByBranch', () => {
      const expression = {
        id: 'test:full_reachability',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      expect(Array.isArray(result.reachabilityByBranch)).toBe(true);
      expect(result.reachabilityByBranch.length).toBeGreaterThan(0);
    });

    it('should have unique branch data for each OR branch', () => {
      const expression = {
        id: 'test:per_branch',
        prerequisites: [
          {
            logic: {
              or: [
                { '>=': [{ var: 'emotions.flow' }, 0.5] },
                { '>=': [{ var: 'emotions.interest' }, 0.3] },
              ],
            },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      // Each branch should have its own intervals based on its prototype
      expect(result.branches.length).toBe(2);

      // First branch should have flow's gates applied
      expect(result.branches[0].requiredPrototypes).toContain('flow');

      // Second branch should have interest's gates applied
      expect(result.branches[1].requiredPrototypes).toContain('interest');
    });
  });

  describe('Constraint Analysis - Reachability Calculations', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should correctly calculate isReachable when threshold is achievable', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              easy: {
                gates: [], // No constraints
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:reachable',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.easy' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'easy'
      );
      expect(reachability.isReachable).toBe(true);
    });

    it('should correctly calculate isReachable when threshold is NOT achievable', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              hard: {
                gates: ['valence <= 0.3'], // Max at 0.3
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:unreachable',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.hard' }, 0.9] }, // Requires 0.9
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'hard'
      );
      expect(reachability.isReachable).toBe(false);
    });

    it('should correctly calculate gap for unreachable thresholds', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              limited: {
                gates: ['valence <= 0.4'], // Max at 0.4
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:gap',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.limited' }, 0.7] }, // Requires 0.7
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'limited'
      );

      // Gap should be threshold - maxPossible = 0.7 - 0.4 = 0.3
      expect(reachability.gap).toBeGreaterThan(0);
    });

    it('should return gap of 0 when threshold is reachable', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              achievable: {
                gates: [],
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:no_gap',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.achievable' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'achievable'
      );
      expect(reachability.gap).toBe(0);
    });

    it('should handle infeasible branches with maxPossible = 0', () => {
      mockDataRegistry.getLookupData.mockImplementation((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              impossible: {
                gates: ['valence >= 0.8', 'valence <= 0.2'], // Conflict!
                weights: { valence: 1.0 },
              },
            },
          };
        }
        return null;
      });

      const expression = {
        id: 'test:infeasible_reach',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.impossible' }, 0.5] },
          },
        ],
      };
      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'impossible'
      );
      expect(reachability.maxPossible).toBe(0);
      expect(reachability.isReachable).toBe(false);
    });
  });

  // =====================================================================
  // FEASIBILITY VOLUME TESTS (EXPDIAPATSENANA-009)
  // =====================================================================

  describe('Feasibility Volume Calculation', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    describe('computeVolume option', () => {
      it('should return null feasibilityVolume when computeVolume is false (default)', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const result = analyzer.analyze({ id: 'test:no_volume' });
        expect(result.feasibilityVolume).toBeNull();
      });

      it('should return null feasibilityVolume when computeVolume is explicitly false', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const result = analyzer.analyze(
          { id: 'test:explicit_no_volume' },
          { computeVolume: false }
        );
        expect(result.feasibilityVolume).toBeNull();
      });

      it('should compute feasibilityVolume when computeVolume is true', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const result = analyzer.analyze(
          { id: 'test:with_volume' },
          { computeVolume: true }
        );
        expect(result.feasibilityVolume).not.toBeNull();
        expect(typeof result.feasibilityVolume).toBe('number');
      });
    });

    describe('volume value computation', () => {
      it('should return 1 when no constraints (full volume)', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const result = analyzer.analyze(
          { id: 'test:no_constraints' },
          { computeVolume: true }
        );
        expect(result.feasibilityVolume).toBe(1);
      });

      it('should return 1 for expression with no gates', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                unconstrained: {
                  gates: [],
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:no_gates_volume',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.unconstrained' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression, { computeVolume: true });
        expect(result.feasibilityVolume).toBe(1);
      });

      it('should return volume < 1 for tight constraints', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                tight: {
                  gates: ['valence >= 0.40', 'valence <= 0.60'], // 20% of range
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:tight_volume',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.tight' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression, { computeVolume: true });
        expect(result.feasibilityVolume).toBeGreaterThan(0);
        expect(result.feasibilityVolume).toBeLessThan(1);
        // Volume should be approximately 0.2 (20% of range)
        expect(result.feasibilityVolume).toBeCloseTo(0.2, 1);
      });

      it('should return 0 for infeasible branches (all branches infeasible)', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                impossible: {
                  gates: ['valence >= 0.8', 'valence <= 0.2'], // Conflict
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:impossible_volume',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.impossible' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression, { computeVolume: true });
        expect(result.feasibilityVolume).toBe(0);
      });

      it('should return maximum volume across multiple feasible branches', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                tight: {
                  gates: ['valence >= 0.45', 'valence <= 0.55'], // 10% of range
                  weights: { valence: 1.0 },
                },
                loose: {
                  gates: ['valence >= 0.20', 'valence <= 0.80'], // 60% of range
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:max_volume',
          prerequisites: [
            {
              logic: {
                or: [
                  { '>=': [{ var: 'emotions.tight' }, 0.5] },
                  { '>=': [{ var: 'emotions.loose' }, 0.5] },
                ],
              },
            },
          ],
        };
        const result = analyzer.analyze(expression, { computeVolume: true });
        // Volume should be max of 0.1 and 0.6, so approximately 0.6
        expect(result.feasibilityVolume).toBeGreaterThan(0.5);
      });

      it('should compute product of multiple constrained axes', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                multiaxis: {
                  // Two constraints: valence 50% × arousal 50% = 25%
                  gates: [
                    'valence >= 0.25',
                    'valence <= 0.75',
                    'arousal >= 0.25',
                    'arousal <= 0.75',
                  ],
                  weights: { valence: 0.5, arousal: 0.5 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:multiaxis_volume',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.multiaxis' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression, { computeVolume: true });
        // Volume should be approximately 0.5 × 0.5 = 0.25
        expect(result.feasibilityVolume).toBeCloseTo(0.25, 1);
      });

      it('should handle knife-edge constraint (very narrow interval)', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                knifeEdge: {
                  // Knife-edge: 2% of range
                  gates: ['valence >= 0.49', 'valence <= 0.51'],
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:knife_edge_volume',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.knifeEdge' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression, { computeVolume: true });
        // Volume should be approximately 0.02
        expect(result.feasibilityVolume).toBeCloseTo(0.02, 2);
        expect(result.feasibilityVolume).toBeGreaterThan(0);
        expect(result.feasibilityVolume).toBeLessThan(0.05);
      });

      it('should return max volume when some branches are infeasible', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                feasible: {
                  gates: ['valence >= 0.30', 'valence <= 0.70'], // 40%
                  weights: { valence: 1.0 },
                },
                infeasible: {
                  gates: ['valence >= 0.8', 'valence <= 0.2'], // Conflict
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:mixed_feasibility',
          prerequisites: [
            {
              logic: {
                or: [
                  { '>=': [{ var: 'emotions.feasible' }, 0.5] },
                  { '>=': [{ var: 'emotions.infeasible' }, 0.5] },
                ],
              },
            },
          ],
        };
        const result = analyzer.analyze(expression, { computeVolume: true });
        // Should return 0.4 (the feasible branch), not 0
        expect(result.feasibilityVolume).toBeCloseTo(0.4, 1);
      });

      it('should handle volume bounded [0, 1]', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const result = analyzer.analyze(
          { id: 'test:bounds' },
          { computeVolume: true }
        );
        expect(result.feasibilityVolume).toBeGreaterThanOrEqual(0);
        expect(result.feasibilityVolume).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('interpretVolume static method', () => {
    it('should return impossible category for volume 0', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0);
      expect(result.category).toBe('impossible');
      expect(result.emoji).toBe('🔴');
      expect(result.description).toContain('Cannot trigger');
    });

    it('should return extremely_unlikely category for volume < 0.001', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.0005);
      expect(result.category).toBe('extremely_unlikely');
      expect(result.emoji).toBe('🟠');
      expect(result.description).toContain('<0.1%');
    });

    it('should return very_unlikely category for volume between 0.001 and 0.01', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.005);
      expect(result.category).toBe('very_unlikely');
      expect(result.emoji).toBe('🟡');
      expect(result.description).toContain('0.1-1%');
    });

    it('should return unlikely category for volume between 0.01 and 0.1', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.05);
      expect(result.category).toBe('unlikely');
      expect(result.emoji).toBe('🟡');
      expect(result.description).toContain('1-10%');
    });

    it('should return moderate category for volume between 0.1 and 0.5', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.3);
      expect(result.category).toBe('moderate');
      expect(result.emoji).toBe('🟢');
      expect(result.description).toContain('10-50%');
    });

    it('should return likely category for volume >= 0.5', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.7);
      expect(result.category).toBe('likely');
      expect(result.emoji).toBe('🟢');
      expect(result.description).toContain('>50%');
    });

    it('should return likely category for volume = 1', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(1);
      expect(result.category).toBe('likely');
      expect(result.emoji).toBe('🟢');
    });

    it('should handle boundary value 0.001 (extremely_unlikely boundary)', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.001);
      expect(result.category).toBe('very_unlikely');
    });

    it('should handle boundary value 0.01 (very_unlikely boundary)', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.01);
      expect(result.category).toBe('unlikely');
    });

    it('should handle boundary value 0.1 (unlikely boundary)', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.1);
      expect(result.category).toBe('moderate');
    });

    it('should handle boundary value 0.5 (moderate boundary)', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.5);
      expect(result.category).toBe('likely');
    });

    it('should return object with category, description, and emoji', () => {
      const result = PathSensitiveAnalyzer.interpretVolume(0.25);
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('emoji');
      expect(typeof result.category).toBe('string');
      expect(typeof result.description).toBe('string');
      expect(typeof result.emoji).toBe('string');
    });
  });

  // =====================================================================
  // LOW THRESHOLD REACHABILITY TESTS (BUG FIX)
  // Tests for direction-aware threshold reachability
  // =====================================================================

  describe('LOW Threshold Reachability - Direction Awareness', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    describe('LOW direction detection', () => {
      it('should extract LOW direction for < operator', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const expression = {
          id: 'test:low_less_than',
          prerequisites: [
            {
              logic: { '<': [{ var: 'emotions.despair' }, 0.65] },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'despair'
        );
        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('low');
      });

      it('should extract LOW direction for <= operator', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const expression = {
          id: 'test:low_less_equal',
          prerequisites: [
            {
              logic: { '<=': [{ var: 'emotions.sadness' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'sadness'
        );
        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('low');
      });

      it('should extract HIGH direction for >= operator', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const expression = {
          id: 'test:high_greater_equal',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'flow'
        );
        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('high');
      });

      it('should extract HIGH direction for > operator', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const expression = {
          id: 'test:high_greater_than',
          prerequisites: [
            {
              logic: { '>': [{ var: 'emotions.interest' }, 0.3] },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'interest'
        );
        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('high');
      });
    });

    describe('LOW direction reachability calculation', () => {
      it('should mark LOW threshold as REACHABLE when maxPossible < threshold', () => {
        // This is the core bug fix test - mimics lonely_isolation.expression.json's despair condition
        // despair < 0.65 should be REACHABLE if max despair is 0.46
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                despair: {
                  // Despair prototype with gates that constrain max intensity
                  gates: ['future_expectancy <= -0.25'],
                  weights: {
                    future_expectancy: -1.0,
                    agency_control: -0.7,
                    valence: -0.6,
                    arousal: -0.3,
                  },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:despair_low_threshold',
          prerequisites: [
            {
              logic: {
                and: [
                  // LOW threshold: despair must stay BELOW 0.65
                  { '<': [{ var: 'emotions.despair' }, 0.65] },
                ],
              },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'despair'
        );

        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('low');
        // The key assertion: LOW threshold should be REACHABLE when max < threshold
        // If maxPossible is 0.46 and threshold is 0.65, then despair CAN stay below 0.65
        expect(reachability.isReachable).toBe(true);
      });

      it('should mark LOW threshold as REACHABLE because LOW prototype gates are not enforced', () => {
        // Architecture decision: LOW prototype gates are NOT enforced
        // because the prototype is expected to be inactive (gated off)
        // So minPossible is calculated without gate constraints = 0
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                alwaysHigh: {
                  // These gates would force minimum high IF enforced
                  // But for LOW direction, gates are ignored
                  gates: ['valence >= 0.8'],
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:low_reachable_despite_gates',
          prerequisites: [
            {
              logic: {
                // LOW threshold: requires alwaysHigh < 0.3
                // Gates are ignored for LOW direction, so min = 0
                '<': [{ var: 'emotions.alwaysHigh' }, 0.3],
              },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'alwaysHigh'
        );

        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('low');
        // Reachable because LOW prototype gates are not enforced (minPossible = 0)
        expect(reachability.isReachable).toBe(true);
        expect(reachability.gap).toBe(0);
      });

      it('should return gap of 0 for LOW direction when gates are not enforced', () => {
        // Architecture decision: LOW prototype gates are NOT enforced
        // So even with gates that would force high intensity, minPossible = 0
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                forced: {
                  // These gates would force min at ~0.7 IF enforced
                  // But for LOW direction, gates are ignored
                  gates: ['valence >= 0.7'],
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:low_gap_zero',
          prerequisites: [
            {
              logic: {
                // Requires forced < 0.5
                // Gates ignored for LOW, so min = 0, which is < 0.5 = reachable
                '<': [{ var: 'emotions.forced' }, 0.5],
              },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'forced'
        );

        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('low');
        // Reachable because gates ignored, minPossible = 0
        expect(reachability.isReachable).toBe(true);
        expect(reachability.gap).toBe(0);
      });

      it('should return gap of 0 for reachable LOW threshold', () => {
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                controllable: {
                  gates: [], // No constraints, can go to 0
                  weights: { valence: 1.0 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:low_no_gap',
          prerequisites: [
            {
              logic: {
                // Requires controllable < 0.8, easily achievable
                '<': [{ var: 'emotions.controllable' }, 0.8],
              },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'controllable'
        );

        expect(reachability).toBeDefined();
        expect(reachability.direction).toBe('low');
        expect(reachability.isReachable).toBe(true);
        expect(reachability.gap).toBe(0);
      });
    });

    describe('mixed HIGH and LOW thresholds in same expression', () => {
      it('should handle both HIGH and LOW thresholds correctly', () => {
        // This mimics lonely_isolation which has both:
        // - withdrawn_isolation >= 0.55 (HIGH)
        // - despair < 0.65 (LOW)
        mockDataRegistry.getLookupData.mockImplementation((key) => {
          if (key === 'core:emotion_prototypes') {
            return {
              entries: {
                withdrawn_isolation: {
                  gates: [],
                  weights: { engagement: -0.8, valence: -0.4 },
                },
                despair: {
                  gates: ['future_expectancy <= -0.25'],
                  weights: { future_expectancy: -1.0, valence: -0.6 },
                },
              },
            };
          }
          return null;
        });

        const expression = {
          id: 'test:mixed_directions',
          prerequisites: [
            {
              logic: {
                and: [
                  { '>=': [{ var: 'emotions.withdrawn_isolation' }, 0.55] },
                  { '<': [{ var: 'emotions.despair' }, 0.65] },
                ],
              },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const withdrawnReach = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'withdrawn_isolation'
        );
        const despairReach = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'despair'
        );

        expect(withdrawnReach).toBeDefined();
        expect(withdrawnReach.direction).toBe('high');

        expect(despairReach).toBeDefined();
        expect(despairReach.direction).toBe('low');
        // Since despair gates limit max intensity, LOW threshold should be reachable
        expect(despairReach.isReachable).toBe(true);
      });
    });

    describe('toSummary displays correct direction context', () => {
      it('should display >= for HIGH direction in summary', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const expression = {
          id: 'test:summary_high',
          prerequisites: [
            {
              logic: { '>=': [{ var: 'emotions.flow' }, 0.5] },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'flow'
        );
        const summary = reachability.toSummary();

        expect(summary).toContain('>=');
        expect(summary).toContain('flow');
      });

      it('should display < for LOW direction in summary', () => {
        mockDataRegistry.getLookupData.mockReturnValue({ entries: {} });

        const expression = {
          id: 'test:summary_low',
          prerequisites: [
            {
              logic: { '<': [{ var: 'emotions.despair' }, 0.65] },
            },
          ],
        };
        const result = analyzer.analyze(expression);

        const reachability = result.reachabilityByBranch.find(
          (r) => r.prototypeId === 'despair'
        );
        const summary = reachability.toSummary();

        expect(summary).toContain('<');
        expect(summary).toContain('despair');
      });
    });
  });
});
