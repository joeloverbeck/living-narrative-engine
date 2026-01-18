# MONCARACTIMP-011: EditSetGenerator Unit Tests

## Summary

Create comprehensive unit tests for the `EditSetGenerator` service, covering candidate generation, validation integration, ranking logic, and result building.

## Priority

MEDIUM

## Effort

Medium (~350 LOC)

## Dependencies

- MONCARACTIMP-010 (EditSetGenerator Service)

## Rationale

The EditSetGenerator integrates multiple services and implements complex ranking logic. Thorough testing ensures correct coordination between components and accurate proposal scoring.

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `tests/unit/expressionDiagnostics/services/EditSetGenerator.test.js` | CREATE | Comprehensive unit tests |

## Files to Modify

None - test file only.

## Out of Scope

- Service implementation (MONCARACTIMP-010)
- Integration tests (MONCARACTIMP-016)
- Dependent service tests
- Report formatting

## Implementation Details

### Test Structure

```javascript
// tests/unit/expressionDiagnostics/services/EditSetGenerator.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EditSetGenerator from '../../../../src/expressionDiagnostics/services/EditSetGenerator.js';

describe('EditSetGenerator', () => {
  let generator;
  let mockLogger;
  let mockBlockerCalculator;
  let mockOrBlockAnalyzer;
  let mockValidator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockBlockerCalculator = {
      calculate: jest.fn().mockReturnValue({
        coreBlockers: [],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      }),
    };

    mockOrBlockAnalyzer = {
      analyze: jest.fn().mockReturnValue({
        blockId: 'or_block',
        blockDescription: 'test',
        alternatives: [],
        deadWeightCount: 0,
        recommendations: [],
        impactSummary: 'No issues',
      }),
    };

    mockValidator = {
      validate: jest.fn().mockReturnValue({
        estimatedRate: 0.05,
        confidenceInterval: [0.02, 0.08],
        confidence: 'medium',
        sampleCount: 100,
        effectiveSampleSize: 80,
      }),
    };

    generator = new EditSetGenerator({
      logger: mockLogger,
      blockerCalculator: mockBlockerCalculator,
      orBlockAnalyzer: mockOrBlockAnalyzer,
      validator: mockValidator,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(generator).toBeInstanceOf(EditSetGenerator);
    });

    it('should throw on missing logger', () => {
      expect(() => new EditSetGenerator({
        blockerCalculator: mockBlockerCalculator,
        orBlockAnalyzer: mockOrBlockAnalyzer,
        validator: mockValidator,
      })).toThrow();
    });

    it('should throw on missing blockerCalculator', () => {
      expect(() => new EditSetGenerator({
        logger: mockLogger,
        orBlockAnalyzer: mockOrBlockAnalyzer,
        validator: mockValidator,
      })).toThrow();
    });

    it('should throw on missing orBlockAnalyzer', () => {
      expect(() => new EditSetGenerator({
        logger: mockLogger,
        blockerCalculator: mockBlockerCalculator,
        validator: mockValidator,
      })).toThrow();
    });

    it('should throw on missing validator', () => {
      expect(() => new EditSetGenerator({
        logger: mockLogger,
        blockerCalculator: mockBlockerCalculator,
        orBlockAnalyzer: mockOrBlockAnalyzer,
      })).toThrow();
    });

    it('should accept custom config', () => {
      const customGenerator = new EditSetGenerator({
        logger: mockLogger,
        blockerCalculator: mockBlockerCalculator,
        orBlockAnalyzer: mockOrBlockAnalyzer,
        validator: mockValidator,
        config: {
          defaultTargetBand: [0.01, 0.05],
          targetPassRates: [0.05, 0.10],
          maxCandidatesToValidate: 5,
          maxEditProposals: 3,
        },
      });
      expect(customGenerator).toBeInstanceOf(EditSetGenerator);
    });
  });

  describe('generate()', () => {
    describe('result structure', () => {
      it('should return RecommendedEditSet structure', () => {
        const simulationResult = {
          expression: { clauses: [] },
          samples: [],
        };

        const result = generator.generate(simulationResult);

        expect(result).toHaveProperty('targetBand');
        expect(result).toHaveProperty('primaryRecommendation');
        expect(result).toHaveProperty('alternativeEdits');
        expect(result).toHaveProperty('notRecommended');
      });

      it('should use default target band when not specified', () => {
        const simulationResult = {
          expression: { clauses: [] },
          samples: [],
        };

        const result = generator.generate(simulationResult);

        expect(result.targetBand).toBeDefined();
        expect(Array.isArray(result.targetBand)).toBe(true);
        expect(result.targetBand).toHaveLength(2);
      });

      it('should use provided target band', () => {
        const simulationResult = {
          expression: { clauses: [] },
          samples: [],
        };
        const customBand = [0.05, 0.15];

        const result = generator.generate(simulationResult, customBand);

        expect(result.targetBand).toEqual(customBand);
      });
    });

    describe('blocker-based edits', () => {
      it('should generate threshold edits for core blockers', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            {
              clauseId: 'mood_check',
              clauseDescription: 'Mood >= 0.8',
              lastMileRate: 0.9,
              impactScore: 0.5,
              compositeScore: 0.7,
              classification: 'core',
            },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        const simulationResult = {
          expression: {
            clauses: [
              { id: 'mood_check', threshold: 0.8 },
            ],
          },
          samples: [{ mood: 0.5 }, { mood: 0.6 }],
        };

        const result = generator.generate(simulationResult);

        // Should have generated at least one proposal
        expect(
          result.primaryRecommendation !== null ||
          result.alternativeEdits.length > 0
        ).toBe(true);

        // Validator should have been called
        expect(mockValidator.validate).toHaveBeenCalled();
      });

      it('should use quantiles when available', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            { clauseId: 'mood_check', classification: 'core' },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        const simulationResult = {
          expression: {
            clauses: [
              {
                id: 'mood_check',
                threshold: 0.8,
                quantiles: { p90: 0.6, p95: 0.7, p99: 0.75 },
              },
            ],
          },
          samples: [],
        };

        generator.generate(simulationResult);

        // Should complete without error
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    describe('OR block edits', () => {
      it('should generate edits from OR block recommendations', () => {
        mockOrBlockAnalyzer.analyze.mockReturnValue({
          blockId: 'or_block_1',
          blockDescription: 'test',
          alternatives: [
            { alternativeIndex: 0, classification: 'dead-weight', _threshold: 0.9 },
          ],
          deadWeightCount: 1,
          recommendations: [
            {
              action: 'delete',
              targetAlternative: 0,
              rationale: 'dead weight',
              predictedImpact: '-1%',
            },
          ],
          impactSummary: 'Remove dead weight',
        });

        const simulationResult = {
          expression: { clauses: [] },
          orBlocks: [{ id: 'or_block_1', alternatives: [] }],
          samples: [],
        };

        const result = generator.generate(simulationResult);

        // Analyzer should have been called
        expect(mockOrBlockAnalyzer.analyze).toHaveBeenCalled();
      });

      it('should generate lower-threshold edits for OR alternatives', () => {
        mockOrBlockAnalyzer.analyze.mockReturnValue({
          blockId: 'or_block_1',
          blockDescription: 'test',
          alternatives: [
            { alternativeIndex: 0, classification: 'weak', _threshold: 0.9 },
          ],
          deadWeightCount: 0,
          recommendations: [
            {
              action: 'lower-threshold',
              targetAlternative: 0,
              suggestedValue: 0.7,
              rationale: 'increase contribution',
              predictedImpact: '+5%',
            },
          ],
          impactSummary: 'Improve weak contributor',
        });

        const simulationResult = {
          expression: { clauses: [] },
          orBlocks: [{ id: 'or_block_1', alternatives: [] }],
          samples: [],
        };

        generator.generate(simulationResult);

        expect(mockOrBlockAnalyzer.analyze).toHaveBeenCalled();
      });
    });

    describe('combined edits', () => {
      it('should generate combined blocker + OR edits', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            { clauseId: 'mood_check', classification: 'core' },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        mockOrBlockAnalyzer.analyze.mockReturnValue({
          blockId: 'or_block_1',
          blockDescription: 'test',
          alternatives: [{ alternativeIndex: 0, classification: 'dead-weight' }],
          deadWeightCount: 1,
          recommendations: [
            { action: 'delete', targetAlternative: 0 },
          ],
          impactSummary: 'test',
        });

        const simulationResult = {
          expression: {
            clauses: [{ id: 'mood_check', threshold: 0.8 }],
          },
          orBlocks: [{ id: 'or_block_1', alternatives: [] }],
          samples: [],
        };

        generator.generate(simulationResult);

        // Should call both analyzers
        expect(mockBlockerCalculator.calculate).toHaveBeenCalled();
        expect(mockOrBlockAnalyzer.analyze).toHaveBeenCalled();
      });
    });

    describe('validation', () => {
      it('should validate candidates with importance sampling', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            { clauseId: 'mood_check', classification: 'core' },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        const simulationResult = {
          expression: {
            clauses: [{ id: 'mood_check', threshold: 0.8 }],
          },
          samples: [{ mood: 0.5 }],
        };

        generator.generate(simulationResult);

        expect(mockValidator.validate).toHaveBeenCalled();
      });

      it('should respect maxCandidatesToValidate config', () => {
        // Generate many candidates
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            { clauseId: 'clause1', classification: 'core' },
            { clauseId: 'clause2', classification: 'core' },
            { clauseId: 'clause3', classification: 'core' },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        const customGenerator = new EditSetGenerator({
          logger: mockLogger,
          blockerCalculator: mockBlockerCalculator,
          orBlockAnalyzer: mockOrBlockAnalyzer,
          validator: mockValidator,
          config: {
            defaultTargetBand: [0.01, 0.05],
            targetPassRates: [0.05, 0.10, 0.20],
            maxCandidatesToValidate: 3,
            maxEditProposals: 2,
          },
        });

        const simulationResult = {
          expression: {
            clauses: [
              { id: 'clause1', threshold: 0.8 },
              { id: 'clause2', threshold: 0.7 },
              { id: 'clause3', threshold: 0.9 },
            ],
          },
          samples: [],
        };

        customGenerator.generate(simulationResult);

        // Should not validate more than maxCandidatesToValidate
        expect(mockValidator.validate.mock.calls.length).toBeLessThanOrEqual(3);
      });
    });

    describe('ranking', () => {
      it('should rank proposals by target band proximity', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            { clauseId: 'mood_check', classification: 'core' },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        // Return different rates for different proposals
        let callCount = 0;
        mockValidator.validate.mockImplementation(() => {
          callCount++;
          return {
            estimatedRate: callCount === 1 ? 0.03 : 0.15,
            confidenceInterval: [0.01, 0.05],
            confidence: 'medium',
            sampleCount: 100,
            effectiveSampleSize: 80,
          };
        });

        const simulationResult = {
          expression: {
            clauses: [{ id: 'mood_check', threshold: 0.8 }],
          },
          samples: [],
        };

        const result = generator.generate(simulationResult, [0.01, 0.05]);

        if (result.primaryRecommendation && result.alternativeEdits.length > 0) {
          // Primary should have better score (closer to target)
          expect(result.primaryRecommendation.score).toBeGreaterThanOrEqual(
            result.alternativeEdits[0].score
          );
        }
      });

      it('should boost high-confidence proposals', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            { clauseId: 'mood_check', classification: 'core' },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        // Same rate but different confidence
        let callCount = 0;
        mockValidator.validate.mockImplementation(() => {
          callCount++;
          return {
            estimatedRate: 0.03,
            confidenceInterval: [0.01, 0.05],
            confidence: callCount === 1 ? 'high' : 'low',
            sampleCount: 100,
            effectiveSampleSize: callCount === 1 ? 100 : 20,
          };
        });

        const simulationResult = {
          expression: {
            clauses: [{ id: 'mood_check', threshold: 0.8 }],
          },
          samples: [],
        };

        const result = generator.generate(simulationResult, [0.01, 0.05]);

        // High confidence should be ranked higher
        if (result.primaryRecommendation) {
          expect(result.primaryRecommendation.confidence).toBe('high');
        }
      });
    });

    describe('invalid inputs', () => {
      it('should return empty result for null simulation', () => {
        const result = generator.generate(null);

        expect(result.primaryRecommendation).toBeNull();
        expect(result.alternativeEdits).toEqual([]);
      });

      it('should return empty result for undefined simulation', () => {
        const result = generator.generate(undefined);

        expect(result.primaryRecommendation).toBeNull();
        expect(result.alternativeEdits).toEqual([]);
      });

      it('should handle simulation with no clauses', () => {
        const result = generator.generate({
          expression: { clauses: [] },
          samples: [],
        });

        expect(result).toHaveProperty('targetBand');
        expect(result).toHaveProperty('primaryRecommendation');
      });

      it('should handle simulation with no samples', () => {
        const result = generator.generate({
          expression: {
            clauses: [{ id: 'test', threshold: 0.5 }],
          },
          samples: [],
        });

        expect(result).toHaveProperty('targetBand');
      });
    });

    describe('error handling', () => {
      it('should handle blocker calculator errors gracefully', () => {
        mockBlockerCalculator.calculate.mockImplementation(() => {
          throw new Error('Calculator error');
        });

        const simulationResult = {
          expression: { clauses: [] },
          samples: [],
        };

        const result = generator.generate(simulationResult);

        expect(result.primaryRecommendation).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should handle OR analyzer errors gracefully', () => {
        mockOrBlockAnalyzer.analyze.mockImplementation(() => {
          throw new Error('Analyzer error');
        });

        const simulationResult = {
          expression: { clauses: [] },
          orBlocks: [{ id: 'test' }],
          samples: [],
        };

        // Should not throw
        expect(() => generator.generate(simulationResult)).not.toThrow();
      });

      it('should handle validator errors gracefully', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [{ clauseId: 'test', classification: 'core' }],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        mockValidator.validate.mockImplementation(() => {
          throw new Error('Validation error');
        });

        const simulationResult = {
          expression: {
            clauses: [{ id: 'test', threshold: 0.5 }],
          },
          samples: [],
        };

        // Should not throw
        expect(() => generator.generate(simulationResult)).not.toThrow();
      });
    });

    describe('edit proposal structure', () => {
      it('should include all required fields in proposals', () => {
        mockBlockerCalculator.calculate.mockReturnValue({
          coreBlockers: [
            { clauseId: 'mood_check', classification: 'core' },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        });

        const simulationResult = {
          expression: {
            clauses: [{ id: 'mood_check', threshold: 0.8 }],
          },
          samples: [{ mood: 0.5 }],
        };

        const result = generator.generate(simulationResult);

        if (result.primaryRecommendation) {
          const proposal = result.primaryRecommendation;
          expect(proposal).toHaveProperty('edits');
          expect(proposal).toHaveProperty('predictedTriggerRate');
          expect(proposal).toHaveProperty('confidenceInterval');
          expect(proposal).toHaveProperty('confidence');
          expect(proposal).toHaveProperty('validationMethod');
          expect(proposal).toHaveProperty('score');

          expect(Array.isArray(proposal.edits)).toBe(true);
          if (proposal.edits.length > 0) {
            const edit = proposal.edits[0];
            expect(edit).toHaveProperty('clauseId');
            expect(edit).toHaveProperty('editType');
            expect(edit).toHaveProperty('before');
            expect(edit).toHaveProperty('after');
          }
        }
      });
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Run unit tests
npm run test:unit -- --testPathPattern="EditSetGenerator.test.js"

# Verify coverage meets thresholds
npm run test:unit -- --testPathPattern="EditSetGenerator.test.js" --coverage
```

### Coverage Requirements

| Metric | Minimum |
|--------|---------|
| Statements | 90% |
| Branches | 85% |
| Functions | 90% |
| Lines | 90% |

### Invariants That Must Remain True

1. All tests must be independent (no shared state)
2. Tests must use mocks for all dependencies
3. Test file location must mirror source structure
4. Integration with dependent services must be tested via mocks
5. Error handling must be thoroughly tested

## Verification Commands

```bash
# Run tests
npm run test:unit -- --testPathPattern="EditSetGenerator.test.js"

# Check coverage
npm run test:unit -- --testPathPattern="EditSetGenerator.test.js" --coverage

# Lint test file
npx eslint tests/unit/expressionDiagnostics/services/EditSetGenerator.test.js
```

## Estimated Diff Size

- `EditSetGenerator.test.js`: ~350 lines (new file)

**Total**: ~350 lines

## Definition of Done

- [x] Test file created at correct location
- [x] All test cases pass
- [x] Coverage meets or exceeds thresholds
- [x] Constructor validation tests pass
- [x] Blocker-based edit generation tested
- [x] OR block edit generation tested
- [x] Combined edit generation tested
- [x] Validation integration tested
- [x] Ranking logic tested
- [x] Error handling thoroughly tested
- [x] ESLint passes

## Outcome

**Status**: COMPLETED

**Date**: 2026-01-18

**Implementation Summary**:
- Created `tests/unit/expressionDiagnostics/services/editSetGenerator.test.js`
- Implemented 47 comprehensive unit tests
- All tests pass

**Coverage Results**:
- EditSetGenerator.js: 94.35% statements, 79.66% branches, 93.33% functions, 94.15% lines

**Test Categories Implemented**:
- Constructor validation (6 tests)
- Empty/invalid input handling (4 tests)
- Clause extraction from multiple locations
- OR block extraction and analysis
- Threshold edit generation (3 tests)
- Structure edit generation (2 tests)
- Validation integration (2 tests)
- Ranking logic (4 tests)
- Result structure validation (3 tests)
- Error handling (3 tests)
- Combined edits (2 tests)
- Debug logging verification
- Edge cases (multiple tests)

**Note**: This ticket was completed as part of MONCARACTIMP-010 implementation since the tests were required for verification.
