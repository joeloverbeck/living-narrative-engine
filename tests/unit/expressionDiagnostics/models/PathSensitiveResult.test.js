/**
 * @file Unit tests for PathSensitiveResult model
 * @description Tests the aggregated result model for path-sensitive analysis.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import PathSensitiveResult from '../../../../src/expressionDiagnostics/models/PathSensitiveResult.js';
import AnalysisBranch from '../../../../src/expressionDiagnostics/models/AnalysisBranch.js';
import BranchReachability from '../../../../src/expressionDiagnostics/models/BranchReachability.js';
import KnifeEdge from '../../../../src/expressionDiagnostics/models/KnifeEdge.js';

describe('PathSensitiveResult Model', () => {
  // Test fixtures
  let feasibleBranch;
  let infeasibleBranch;
  let branchWithKnifeEdge;
  let reachableReachability;
  let unreachableReachability;

  beforeEach(() => {
    feasibleBranch = new AnalysisBranch({
      branchId: '0.1',
      description: 'interest path',
      requiredPrototypes: ['flow', 'interest'],
    });

    infeasibleBranch = new AnalysisBranch({
      branchId: '0.2',
      description: 'infeasible path',
      requiredPrototypes: ['flow', 'entrancement'],
      conflicts: [{ axis: 'agency_control', message: 'impossible constraint' }],
    });

    const knifeEdge = new KnifeEdge({
      axis: 'agency_control',
      min: 0.1,
      max: 0.1,
      contributingPrototypes: ['flow', 'entrancement'],
    });

    branchWithKnifeEdge = new AnalysisBranch({
      branchId: '0.3',
      description: 'knife-edge path',
      requiredPrototypes: ['flow', 'fascination'],
      knifeEdges: [knifeEdge],
    });

    reachableReachability = new BranchReachability({
      branchId: '0.1',
      branchDescription: 'interest path',
      prototypeId: 'flow',
      type: 'emotion',
      threshold: 0.85,
      maxPossible: 1.0,
    });

    unreachableReachability = new BranchReachability({
      branchId: '0.2',
      branchDescription: 'infeasible path',
      prototypeId: 'flow',
      type: 'emotion',
      threshold: 0.85,
      maxPossible: 0.77,
    });
  });

  describe('Constructor Validation', () => {
    it('should throw if expressionId is missing', () => {
      expect(
        () =>
          new PathSensitiveResult({
            branches: [],
          })
      ).toThrow('PathSensitiveResult requires non-empty expressionId string');
    });

    it('should throw if expressionId is empty string', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: '',
            branches: [],
          })
      ).toThrow('PathSensitiveResult requires non-empty expressionId string');
    });

    it('should throw if expressionId is whitespace only', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: '   ',
            branches: [],
          })
      ).toThrow('PathSensitiveResult requires non-empty expressionId string');
    });

    it('should throw if expressionId is not a string', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: 123,
            branches: [],
          })
      ).toThrow('PathSensitiveResult requires non-empty expressionId string');
    });

    it('should throw if branches is not an array', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: 'test:expression',
            branches: 'not-an-array',
          })
      ).toThrow('PathSensitiveResult requires branches array');
    });

    it('should throw if branches is null', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: 'test:expression',
            branches: null,
          })
      ).toThrow('PathSensitiveResult requires branches array');
    });

    it('should throw if reachabilityByBranch is not an array', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: 'test:expression',
            branches: [],
            reachabilityByBranch: 'not-an-array',
          })
      ).toThrow('PathSensitiveResult reachabilityByBranch must be an array');
    });

    it('should throw if feasibilityVolume is not null or number', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: 'test:expression',
            branches: [],
            feasibilityVolume: 'invalid',
          })
      ).toThrow('PathSensitiveResult feasibilityVolume must be null or a number');
    });

    it('should throw if feasibilityVolume is NaN', () => {
      expect(
        () =>
          new PathSensitiveResult({
            expressionId: 'test:expression',
            branches: [],
            feasibilityVolume: NaN,
          })
      ).toThrow('PathSensitiveResult feasibilityVolume must be null or a number');
    });

    it('should accept valid parameters with defaults', () => {
      const result = new PathSensitiveResult({
        expressionId: 'emotions-attention:flow_absorption',
        branches: [feasibleBranch],
      });

      expect(result.expressionId).toBe('emotions-attention:flow_absorption');
      expect(result.branches).toHaveLength(1);
      expect(result.reachabilityByBranch).toEqual([]);
      expect(result.feasibilityVolume).toBeNull();
    });

    it('should set analyzedAt to current time', () => {
      const beforeCreate = new Date();
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
      });
      const afterCreate = new Date();

      expect(result.analyzedAt).toBeInstanceOf(Date);
      expect(result.analyzedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
      expect(result.analyzedAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime()
      );
    });

    it('should accept all optional parameters', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [reachableReachability],
        feasibilityVolume: 0.75,
      });

      expect(result.expressionId).toBe('test:expression');
      expect(result.branches).toHaveLength(2);
      expect(result.reachabilityByBranch).toHaveLength(1);
      expect(result.feasibilityVolume).toBe(0.75);
    });

    it('should accept feasibilityVolume of 0', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
        feasibilityVolume: 0,
      });

      expect(result.feasibilityVolume).toBe(0);
    });
  });

  describe('Getters - Basic Properties', () => {
    it('expressionId getter returns correct value', () => {
      const result = new PathSensitiveResult({
        expressionId: 'emotions-attention:flow_absorption',
        branches: [],
      });
      expect(result.expressionId).toBe('emotions-attention:flow_absorption');
    });

    it('feasibilityVolume getter returns correct value', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
        feasibilityVolume: 0.42,
      });
      expect(result.feasibilityVolume).toBe(0.42);
    });

    it('analyzedAt getter returns Date instance', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
      });
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });
  });

  describe('Getters - Immutability', () => {
    it('branches getter returns copy, not reference', () => {
      const originalBranches = [feasibleBranch];
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: originalBranches,
      });

      const returned1 = result.branches;
      const returned2 = result.branches;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalBranches);
      expect(returned1).toHaveLength(1);

      // Mutating returned array should not affect internal state
      returned1.push(infeasibleBranch);
      expect(result.branches).toHaveLength(1);
    });

    it('reachabilityByBranch getter returns copy, not reference', () => {
      const originalReachability = [reachableReachability];
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: originalReachability,
      });

      const returned1 = result.reachabilityByBranch;
      const returned2 = result.reachabilityByBranch;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalReachability);
      expect(returned1).toHaveLength(1);

      // Mutating returned array should not affect internal state
      returned1.push(unreachableReachability);
      expect(result.reachabilityByBranch).toHaveLength(1);
    });
  });

  describe('Computed Properties - Branch Counts', () => {
    it('branchCount returns correct count', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch, branchWithKnifeEdge],
      });
      expect(result.branchCount).toBe(3);
    });

    it('branchCount returns 0 for empty branches', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
      });
      expect(result.branchCount).toBe(0);
    });

    it('feasibleBranchCount counts only non-infeasible branches', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch, branchWithKnifeEdge],
      });
      expect(result.feasibleBranchCount).toBe(2);
    });

    it('feasibleBranchCount returns 0 when all branches are infeasible', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [infeasibleBranch],
      });
      expect(result.feasibleBranchCount).toBe(0);
    });

    it('infeasibleBranchCount counts only infeasible branches', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch, branchWithKnifeEdge],
      });
      expect(result.infeasibleBranchCount).toBe(1);
    });

    it('infeasibleBranchCount returns 0 when no branches are infeasible', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, branchWithKnifeEdge],
      });
      expect(result.infeasibleBranchCount).toBe(0);
    });
  });

  describe('Computed Properties - Reachability', () => {
    it('hasFullyReachableBranch returns true when at least one branch is fully reachable', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [reachableReachability, unreachableReachability],
      });
      expect(result.hasFullyReachableBranch).toBe(true);
    });

    it('hasFullyReachableBranch returns false when no branch is fully reachable', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [infeasibleBranch],
        reachabilityByBranch: [unreachableReachability],
      });
      expect(result.hasFullyReachableBranch).toBe(false);
    });

    it('hasFullyReachableBranch returns false when branches array is empty', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
        reachabilityByBranch: [],
      });
      expect(result.hasFullyReachableBranch).toBe(false);
    });

    it('hasFullyReachableBranch ignores infeasible branches even with reachable thresholds', () => {
      // Create a reachability that would be "reachable" but for an infeasible branch
      const reachabilityForInfeasible = new BranchReachability({
        branchId: '0.2', // matches infeasibleBranch
        branchDescription: 'infeasible path',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.5,
        maxPossible: 1.0, // technically reachable
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [infeasibleBranch],
        reachabilityByBranch: [reachabilityForInfeasible],
      });

      // Should be false because the branch is infeasible
      expect(result.hasFullyReachableBranch).toBe(false);
    });

    it('fullyReachableBranchIds returns correct IDs', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [reachableReachability, unreachableReachability],
      });
      expect(result.fullyReachableBranchIds).toEqual(['0.1']);
    });

    it('fullyReachableBranchIds excludes infeasible branches', () => {
      const reachabilityForInfeasible = new BranchReachability({
        branchId: '0.2',
        branchDescription: 'infeasible path',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.5,
        maxPossible: 1.0,
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [reachableReachability, reachabilityForInfeasible],
      });

      expect(result.fullyReachableBranchIds).toEqual(['0.1']);
      expect(result.fullyReachableBranchIds).not.toContain('0.2');
    });

    it('fullyReachableBranchIds returns empty array when no branches are fully reachable', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [infeasibleBranch],
        reachabilityByBranch: [unreachableReachability],
      });
      expect(result.fullyReachableBranchIds).toEqual([]);
    });

    it('fullyReachableBranchIds handles multiple thresholds per branch', () => {
      const secondReachability = new BranchReachability({
        branchId: '0.1',
        branchDescription: 'interest path',
        prototypeId: 'interest',
        type: 'emotion',
        threshold: 0.45,
        maxPossible: 0.8,
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability, secondReachability],
      });

      expect(result.fullyReachableBranchIds).toEqual(['0.1']);
    });

    it('fullyReachableBranchIds excludes branch if any threshold is unreachable', () => {
      const unreachableSecondThreshold = new BranchReachability({
        branchId: '0.1',
        branchDescription: 'interest path',
        prototypeId: 'interest',
        type: 'emotion',
        threshold: 0.9,
        maxPossible: 0.5, // unreachable
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability, unreachableSecondThreshold],
      });

      expect(result.fullyReachableBranchIds).toEqual([]);
    });
  });

  describe('Computed Properties - Knife Edges', () => {
    it('allKnifeEdges aggregates from all branches', () => {
      const ke1 = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      const ke2 = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.27,
      });

      const branch1 = new AnalysisBranch({
        branchId: '0.1',
        description: 'branch 1',
        knifeEdges: [ke1],
      });
      const branch2 = new AnalysisBranch({
        branchId: '0.2',
        description: 'branch 2',
        knifeEdges: [ke2],
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [branch1, branch2],
      });

      expect(result.allKnifeEdges).toHaveLength(2);
    });

    it('allKnifeEdges returns empty array when no knife-edges', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
      });
      expect(result.allKnifeEdges).toEqual([]);
    });

    it('totalKnifeEdgeCount returns correct count', () => {
      const ke1 = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      const ke2 = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.27,
      });
      const ke3 = new KnifeEdge({
        axis: 'valence',
        min: 0.5,
        max: 0.52,
      });

      const branch1 = new AnalysisBranch({
        branchId: '0.1',
        description: 'branch 1',
        knifeEdges: [ke1, ke2],
      });
      const branch2 = new AnalysisBranch({
        branchId: '0.2',
        description: 'branch 2',
        knifeEdges: [ke3],
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [branch1, branch2],
      });

      expect(result.totalKnifeEdgeCount).toBe(3);
    });

    it('totalKnifeEdgeCount returns 0 when no knife-edges', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
      });
      expect(result.totalKnifeEdgeCount).toBe(0);
    });
  });

  describe('Query Methods', () => {
    it('getBranch() returns correct branch', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
      });

      const branch = result.getBranch('0.1');
      expect(branch).toBe(feasibleBranch);
      expect(branch.description).toBe('interest path');
    });

    it('getBranch() returns undefined for missing ID', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
      });

      expect(result.getBranch('nonexistent')).toBeUndefined();
      expect(result.getBranch('0.99')).toBeUndefined();
    });

    it('getReachabilityForBranch() returns filtered results', () => {
      const reachability2 = new BranchReachability({
        branchId: '0.1',
        branchDescription: 'interest path',
        prototypeId: 'interest',
        type: 'emotion',
        threshold: 0.45,
        maxPossible: 0.8,
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [
          reachableReachability,
          reachability2,
          unreachableReachability,
        ],
      });

      const branch1Reachability = result.getReachabilityForBranch('0.1');
      expect(branch1Reachability).toHaveLength(2);
      expect(branch1Reachability[0].prototypeId).toBe('flow');
      expect(branch1Reachability[1].prototypeId).toBe('interest');
    });

    it('getReachabilityForBranch() returns empty array for missing branch', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });

      expect(result.getReachabilityForBranch('nonexistent')).toEqual([]);
    });

    it('getReachabilityForPrototype() returns filtered results', () => {
      const interestReachability = new BranchReachability({
        branchId: '0.1',
        branchDescription: 'interest path',
        prototypeId: 'interest',
        type: 'emotion',
        threshold: 0.45,
        maxPossible: 0.8,
      });

      const flowReachability2 = new BranchReachability({
        branchId: '0.3',
        branchDescription: 'another path',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.7,
        maxPossible: 0.9,
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, branchWithKnifeEdge],
        reachabilityByBranch: [
          reachableReachability,
          interestReachability,
          flowReachability2,
        ],
      });

      const flowResults = result.getReachabilityForPrototype('flow');
      expect(flowResults).toHaveLength(2);
      expect(flowResults[0].branchId).toBe('0.1');
      expect(flowResults[1].branchId).toBe('0.3');
    });

    it('getReachabilityForPrototype() returns empty array for missing prototype', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });

      expect(result.getReachabilityForPrototype('nonexistent')).toEqual([]);
    });

    it('getUnreachableThresholds() returns only unreachable', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [reachableReachability, unreachableReachability],
      });

      const unreachable = result.getUnreachableThresholds();
      expect(unreachable).toHaveLength(1);
      expect(unreachable[0].isReachable).toBe(false);
      expect(unreachable[0].branchId).toBe('0.2');
    });

    it('getUnreachableThresholds() returns empty array when all reachable', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });

      expect(result.getUnreachableThresholds()).toEqual([]);
    });
  });

  describe('Status Determination', () => {
    it("overallStatus returns 'fully_reachable' when hasFullyReachableBranch", () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });
      expect(result.overallStatus).toBe('fully_reachable');
    });

    it("overallStatus returns 'partially_reachable' when feasible but not fully reachable", () => {
      // Branch is feasible (no conflicts) but threshold is unreachable
      const unreachableForFeasible = new BranchReachability({
        branchId: '0.1',
        branchDescription: 'interest path',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.95,
        maxPossible: 0.8, // unreachable
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [unreachableForFeasible],
      });

      expect(result.overallStatus).toBe('partially_reachable');
    });

    it("overallStatus returns 'unreachable' when all infeasible", () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [infeasibleBranch],
        reachabilityByBranch: [unreachableReachability],
      });
      expect(result.overallStatus).toBe('unreachable');
    });

    it('statusEmoji returns correct emoji for each status', () => {
      const fullyReachable = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });
      expect(fullyReachable.statusEmoji).toBe('🟢');

      const unreachableForFeasible = new BranchReachability({
        branchId: '0.1',
        branchDescription: 'interest path',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.95,
        maxPossible: 0.8,
      });
      const partiallyReachable = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [unreachableForFeasible],
      });
      expect(partiallyReachable.statusEmoji).toBe('🟡');

      const unreachable = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [infeasibleBranch],
        reachabilityByBranch: [unreachableReachability],
      });
      expect(unreachable.statusEmoji).toBe('🔴');
    });

    it('getSummaryMessage() returns appropriate message for fully_reachable', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });

      const message = result.getSummaryMessage();
      expect(message).toContain('Expression CAN trigger');
      expect(message).toContain('1 of 1 branches');
    });

    it('getSummaryMessage() returns appropriate message for partially_reachable', () => {
      const unreachableForFeasible = new BranchReachability({
        branchId: '0.1',
        branchDescription: 'interest path',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.95,
        maxPossible: 0.8,
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [unreachableForFeasible],
      });

      const message = result.getSummaryMessage();
      expect(message).toContain('1 feasible branches');
      expect(message).toContain('thresholds may be unreachable');
    });

    it('getSummaryMessage() returns appropriate message for unreachable', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [infeasibleBranch],
        reachabilityByBranch: [unreachableReachability],
      });

      const message = result.getSummaryMessage();
      expect(message).toContain('Expression CANNOT trigger');
      expect(message).toContain('all 1 branches are infeasible');
    });
  });

  describe('Serialization - toJSON()', () => {
    it('includes all properties', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [reachableReachability],
        feasibilityVolume: 0.75,
      });

      const json = result.toJSON();

      expect(json.expressionId).toBe('test:expression');
      expect(json.branches).toHaveLength(2);
      expect(json.branchCount).toBe(2);
      expect(json.feasibleBranchCount).toBe(1);
      expect(json.reachabilityByBranch).toHaveLength(1);
      expect(json.hasFullyReachableBranch).toBe(true);
      expect(json.fullyReachableBranchIds).toEqual(['0.1']);
      expect(json.allKnifeEdges).toEqual([]);
      expect(json.feasibilityVolume).toBe(0.75);
      expect(json.overallStatus).toBe('fully_reachable');
      expect(json.analyzedAt).toBeDefined();
    });

    it('serializes nested objects with toJSON methods', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });

      const json = result.toJSON();

      // Branch should be serialized via toJSON
      expect(json.branches[0].branchId).toBe('0.1');
      expect(json.branches[0].description).toBe('interest path');

      // Reachability should be serialized via toJSON
      expect(json.reachabilityByBranch[0].prototypeId).toBe('flow');
      expect(json.reachabilityByBranch[0].isReachable).toBe(true);
    });

    it('handles objects without toJSON methods', () => {
      // Create a plain object branch-like structure without toJSON
      const plainBranch = {
        branchId: '0.plain',
        description: 'plain object',
        isInfeasible: false,
        knifeEdges: [],
      };

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [plainBranch],
        reachabilityByBranch: [],
      });

      const json = result.toJSON();
      expect(json.branches[0]).toEqual(plainBranch);
    });

    it('analyzedAt is serialized as ISO string', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
      });

      const json = result.toJSON();
      expect(typeof json.analyzedAt).toBe('string');
      expect(() => new Date(json.analyzedAt)).not.toThrow();
    });

    it('is JSON.stringify compatible', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
        feasibilityVolume: 0.5,
      });

      const str = JSON.stringify(result);
      expect(() => JSON.parse(str)).not.toThrow();

      const parsed = JSON.parse(str);
      expect(parsed.expressionId).toBe('test:expression');
      expect(parsed.overallStatus).toBe('fully_reachable');
    });
  });

  describe('Serialization - toSummary()', () => {
    it('returns compact string with status emoji', () => {
      const result = new PathSensitiveResult({
        expressionId: 'emotions-attention:flow_absorption',
        branches: [feasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });

      const summary = result.toSummary();
      expect(summary).toContain('🟢');
      expect(summary).toContain('emotions-attention:flow_absorption');
    });

    it('includes branch counts in summary', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch],
        reachabilityByBranch: [reachableReachability],
      });

      const summary = result.toSummary();
      expect(summary).toContain('1/2 branches fully reachable');
    });

    it('includes knife-edge count in summary', () => {
      const ke = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      const branchWithKE = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        knifeEdges: [ke],
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [branchWithKE],
      });

      const summary = result.toSummary();
      expect(summary).toContain('1 knife-edge(s)');
    });

    it('shows 0 knife-edges when none present', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
      });

      const summary = result.toSummary();
      expect(summary).toContain('0 knife-edge(s)');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty branches array gracefully', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [],
      });

      expect(result.branchCount).toBe(0);
      expect(result.feasibleBranchCount).toBe(0);
      expect(result.infeasibleBranchCount).toBe(0);
      expect(result.hasFullyReachableBranch).toBe(false);
      expect(result.fullyReachableBranchIds).toEqual([]);
      expect(result.allKnifeEdges).toEqual([]);
      expect(result.totalKnifeEdgeCount).toBe(0);
      expect(result.overallStatus).toBe('unreachable');
    });

    it('handles branches with no reachability data', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, branchWithKnifeEdge],
        reachabilityByBranch: [],
      });

      expect(result.hasFullyReachableBranch).toBe(false);
      expect(result.fullyReachableBranchIds).toEqual([]);
      // Should be partially_reachable since feasible branches exist but no reachability data
      expect(result.overallStatus).toBe('partially_reachable');
    });

    it('handles all branches being feasible with no reachability', () => {
      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch],
        reachabilityByBranch: [],
      });

      // No reachability data means we can't confirm full reachability
      expect(result.hasFullyReachableBranch).toBe(false);
      expect(result.overallStatus).toBe('partially_reachable');
    });

    it('correctly handles mixed feasible/infeasible with mixed reachability', () => {
      // Complex scenario: 3 branches, 2 feasible, 1 infeasible
      // 1 feasible branch fully reachable, 1 feasible branch not fully reachable
      const thirdBranch = new AnalysisBranch({
        branchId: '0.3',
        description: 'third path',
        requiredPrototypes: ['flow'],
      });

      const unreachableForThird = new BranchReachability({
        branchId: '0.3',
        branchDescription: 'third path',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.99,
        maxPossible: 0.5,
      });

      const result = new PathSensitiveResult({
        expressionId: 'test:expression',
        branches: [feasibleBranch, infeasibleBranch, thirdBranch],
        reachabilityByBranch: [
          reachableReachability,
          unreachableReachability,
          unreachableForThird,
        ],
      });

      expect(result.branchCount).toBe(3);
      expect(result.feasibleBranchCount).toBe(2);
      expect(result.infeasibleBranchCount).toBe(1);
      expect(result.hasFullyReachableBranch).toBe(true);
      expect(result.fullyReachableBranchIds).toEqual(['0.1']);
      expect(result.overallStatus).toBe('fully_reachable');
    });
  });
});
