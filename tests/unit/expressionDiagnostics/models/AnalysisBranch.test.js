/**
 * @file Unit tests for AnalysisBranch model
 * @description Tests the foundational model for path-sensitive OR-branch analysis.
 */

import { describe, it, expect } from '@jest/globals';
import AnalysisBranch from '../../../../src/expressionDiagnostics/models/AnalysisBranch.js';
import AxisInterval from '../../../../src/expressionDiagnostics/models/AxisInterval.js';

describe('AnalysisBranch Model', () => {
  describe('Constructor Validation', () => {
    it('should throw if branchId is missing', () => {
      expect(
        () =>
          new AnalysisBranch({
            description: 'test branch',
          })
      ).toThrow('AnalysisBranch requires non-empty branchId string');
    });

    it('should throw if branchId is empty string', () => {
      expect(
        () =>
          new AnalysisBranch({
            branchId: '',
            description: 'test branch',
          })
      ).toThrow('AnalysisBranch requires non-empty branchId string');
    });

    it('should throw if branchId is whitespace only', () => {
      expect(
        () =>
          new AnalysisBranch({
            branchId: '   ',
            description: 'test branch',
          })
      ).toThrow('AnalysisBranch requires non-empty branchId string');
    });

    it('should throw if branchId is not a string', () => {
      expect(
        () =>
          new AnalysisBranch({
            branchId: 123,
            description: 'test branch',
          })
      ).toThrow('AnalysisBranch requires non-empty branchId string');
    });

    it('should throw if description is missing', () => {
      expect(
        () =>
          new AnalysisBranch({
            branchId: '0.1',
          })
      ).toThrow('AnalysisBranch requires description string');
    });

    it('should throw if description is not a string', () => {
      expect(
        () =>
          new AnalysisBranch({
            branchId: '0.1',
            description: 42,
          })
      ).toThrow('AnalysisBranch requires description string');
    });

    it('should throw if requiredPrototypes is not an array', () => {
      expect(
        () =>
          new AnalysisBranch({
            branchId: '0.1',
            description: 'test',
            requiredPrototypes: 'not-an-array',
          })
      ).toThrow('AnalysisBranch requiredPrototypes must be an array');
    });

    it('should accept valid parameters with defaults', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1.0',
        description: 'entrancement branch',
      });

      expect(branch.branchId).toBe('0.1.0');
      expect(branch.description).toBe('entrancement branch');
      expect(branch.requiredPrototypes).toEqual([]);
      expect(branch.axisIntervals.size).toBe(0);
      expect(branch.conflicts).toEqual([]);
      expect(branch.knifeEdges).toEqual([]);
      expect(branch.isInfeasible).toBe(false);
    });

    it('should accept all optional parameters', () => {
      const intervals = new Map([
        ['engagement', new AxisInterval(0.4, 1.0)],
        ['arousal', new AxisInterval(0.25, 0.6)],
      ]);
      const conflicts = [{ axis: 'agency_control', message: 'test conflict' }];
      const knifeEdges = [{ axis: 'agency_control', width: 0 }];

      const branch = new AnalysisBranch({
        branchId: '0.2.1',
        description: 'fascination path',
        requiredPrototypes: ['flow', 'fascination'],
        axisIntervals: intervals,
        conflicts,
        knifeEdges,
      });

      expect(branch.branchId).toBe('0.2.1');
      expect(branch.description).toBe('fascination path');
      expect(branch.requiredPrototypes).toEqual(['flow', 'fascination']);
      expect(branch.axisIntervals.size).toBe(2);
      expect(branch.conflicts).toHaveLength(1);
      expect(branch.knifeEdges).toHaveLength(1);
      expect(branch.isInfeasible).toBe(true);
    });

    it('should allow empty string description', () => {
      const branch = new AnalysisBranch({
        branchId: '0',
        description: '',
      });
      expect(branch.description).toBe('');
    });
  });

  describe('Getters - Immutability', () => {
    it('requiredPrototypes getter returns copy, not reference', () => {
      const originalProtos = ['flow', 'interest'];
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: originalProtos,
      });

      const returned1 = branch.requiredPrototypes;
      const returned2 = branch.requiredPrototypes;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalProtos);
      expect(returned1).toEqual(originalProtos);

      // Mutating returned array should not affect internal state
      returned1.push('mutated');
      expect(branch.requiredPrototypes).toEqual(['flow', 'interest']);
    });

    it('axisIntervals getter returns copy of Map', () => {
      const intervals = new Map([
        ['engagement', new AxisInterval(0.4, 1.0)],
      ]);
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        axisIntervals: intervals,
      });

      const returned1 = branch.axisIntervals;
      const returned2 = branch.axisIntervals;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(intervals);

      // Mutating returned map should not affect internal state
      returned1.set('mutated', new AxisInterval(0, 1));
      expect(branch.axisIntervals.has('mutated')).toBe(false);
    });

    it('conflicts getter returns copy, not reference', () => {
      const originalConflicts = [{ axis: 'test', message: 'conflict' }];
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        conflicts: originalConflicts,
      });

      const returned1 = branch.conflicts;
      const returned2 = branch.conflicts;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalConflicts);
      expect(returned1).toEqual(originalConflicts);

      // Mutating returned array should not affect internal state
      returned1.push({ axis: 'mutated', message: 'new' });
      expect(branch.conflicts).toHaveLength(1);
    });

    it('knifeEdges getter returns copy, not reference', () => {
      const originalEdges = [{ axis: 'agency_control', width: 0 }];
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        knifeEdges: originalEdges,
      });

      const returned1 = branch.knifeEdges;
      const returned2 = branch.knifeEdges;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalEdges);
      expect(returned1).toEqual(originalEdges);

      // Mutating returned array should not affect internal state
      returned1.push({ axis: 'mutated', width: 0.01 });
      expect(branch.knifeEdges).toHaveLength(1);
    });

    it('activePrototypes getter returns copy, not reference', () => {
      const originalActive = ['flow', 'interest'];
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        activePrototypes: originalActive,
      });

      const returned1 = branch.activePrototypes;
      const returned2 = branch.activePrototypes;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalActive);
      expect(returned1).toEqual(originalActive);

      // Mutating returned array should not affect internal state
      returned1.push('mutated');
      expect(branch.activePrototypes).toEqual(['flow', 'interest']);
    });

    it('inactivePrototypes getter returns copy, not reference', () => {
      const originalInactive = ['panic', 'jealousy'];
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        inactivePrototypes: originalInactive,
      });

      const returned1 = branch.inactivePrototypes;
      const returned2 = branch.inactivePrototypes;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalInactive);
      expect(returned1).toEqual(originalInactive);

      // Mutating returned array should not affect internal state
      returned1.push('mutated');
      expect(branch.inactivePrototypes).toEqual(['panic', 'jealousy']);
    });

    it('branchId getter returns correct value', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1.2',
        description: 'test',
      });
      expect(branch.branchId).toBe('0.1.2');
    });

    it('description getter returns correct value', () => {
      const branch = new AnalysisBranch({
        branchId: '0',
        description: 'entrancement branch',
      });
      expect(branch.description).toBe('entrancement branch');
    });
  });

  describe('isInfeasible', () => {
    it('returns true when conflicts exist', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        conflicts: [{ axis: 'engagement', message: 'impossible constraint' }],
      });
      expect(branch.isInfeasible).toBe(true);
    });

    it('returns false when no conflicts', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        conflicts: [],
      });
      expect(branch.isInfeasible).toBe(false);
    });

    it('returns true with multiple conflicts', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        conflicts: [
          { axis: 'engagement', message: 'conflict 1' },
          { axis: 'arousal', message: 'conflict 2' },
        ],
      });
      expect(branch.isInfeasible).toBe(true);
    });
  });

  describe('hasPrototype()', () => {
    it('returns true for included prototype', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: ['flow', 'interest', 'fascination'],
      });

      expect(branch.hasPrototype('flow')).toBe(true);
      expect(branch.hasPrototype('interest')).toBe(true);
      expect(branch.hasPrototype('fascination')).toBe(true);
    });

    it('returns false for missing prototype', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: ['flow', 'interest'],
      });

      expect(branch.hasPrototype('entrancement')).toBe(false);
      expect(branch.hasPrototype('unknown')).toBe(false);
    });

    it('returns false when requiredPrototypes is empty', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: [],
      });

      expect(branch.hasPrototype('flow')).toBe(false);
    });
  });

  describe('getAxisInterval()', () => {
    it('returns interval for existing axis', () => {
      const engagementInterval = new AxisInterval(0.4, 1.0);
      const intervals = new Map([['engagement', engagementInterval]]);

      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        axisIntervals: intervals,
      });

      const result = branch.getAxisInterval('engagement');
      expect(result).toBe(engagementInterval);
      expect(result.min).toBe(0.4);
      expect(result.max).toBe(1.0);
    });

    it('returns undefined for missing axis', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        axisIntervals: new Map([
          ['engagement', new AxisInterval(0.4, 1.0)],
        ]),
      });

      expect(branch.getAxisInterval('arousal')).toBeUndefined();
      expect(branch.getAxisInterval('nonexistent')).toBeUndefined();
    });

    it('returns undefined when no intervals set', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
      });

      expect(branch.getAxisInterval('engagement')).toBeUndefined();
    });
  });

  describe('withAxisIntervals()', () => {
    it('creates new instance with updated intervals', () => {
      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'original',
        requiredPrototypes: ['flow'],
      });

      const newIntervals = new Map([
        ['engagement', new AxisInterval(0.5, 0.9)],
      ]);

      const updated = original.withAxisIntervals(newIntervals);

      expect(updated).not.toBe(original);
      expect(updated).toBeInstanceOf(AnalysisBranch);
      expect(updated.axisIntervals.get('engagement').min).toBe(0.5);
      expect(original.axisIntervals.size).toBe(0);
    });

    it('preserves other properties', () => {
      const conflicts = [{ axis: 'test', message: 'conflict' }];
      const knifeEdges = [{ axis: 'test', width: 0.01 }];

      const original = new AnalysisBranch({
        branchId: '0.1.2',
        description: 'preserved description',
        requiredPrototypes: ['flow', 'interest'],
        conflicts,
        knifeEdges,
      });

      const updated = original.withAxisIntervals(
        new Map([['engagement', new AxisInterval(0, 1)]])
      );

      expect(updated.branchId).toBe('0.1.2');
      expect(updated.description).toBe('preserved description');
      expect(updated.requiredPrototypes).toEqual(['flow', 'interest']);
      expect(updated.conflicts).toEqual(conflicts);
      expect(updated.knifeEdges).toEqual(knifeEdges);
      expect(updated.isInfeasible).toBe(true);
    });
  });

  describe('withConflicts()', () => {
    it('creates new instance with updated conflicts', () => {
      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
      });

      const newConflicts = [{ axis: 'engagement', message: 'new conflict' }];
      const updated = original.withConflicts(newConflicts);

      expect(updated).not.toBe(original);
      expect(updated).toBeInstanceOf(AnalysisBranch);
      expect(updated.conflicts).toEqual(newConflicts);
      expect(original.conflicts).toEqual([]);
    });

    it('updates isInfeasible accordingly', () => {
      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
      });
      expect(original.isInfeasible).toBe(false);

      const withConflict = original.withConflicts([
        { axis: 'test', message: 'conflict' },
      ]);
      expect(withConflict.isInfeasible).toBe(true);

      const withoutConflict = withConflict.withConflicts([]);
      expect(withoutConflict.isInfeasible).toBe(false);
    });

    it('preserves other properties', () => {
      const intervals = new Map([
        ['engagement', new AxisInterval(0.4, 1.0)],
      ]);

      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: ['flow'],
        axisIntervals: intervals,
        knifeEdges: [{ axis: 'test', width: 0.01 }],
      });

      const updated = original.withConflicts([
        { axis: 'new', message: 'conflict' },
      ]);

      expect(updated.branchId).toBe('0.1');
      expect(updated.description).toBe('test');
      expect(updated.requiredPrototypes).toEqual(['flow']);
      expect(updated.axisIntervals.size).toBe(1);
      expect(updated.knifeEdges).toHaveLength(1);
    });
  });

  describe('withKnifeEdges()', () => {
    it('creates new instance with updated knife-edges', () => {
      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
      });

      const newEdges = [{ axis: 'agency_control', width: 0 }];
      const updated = original.withKnifeEdges(newEdges);

      expect(updated).not.toBe(original);
      expect(updated).toBeInstanceOf(AnalysisBranch);
      expect(updated.knifeEdges).toEqual(newEdges);
      expect(original.knifeEdges).toEqual([]);
    });

    it('preserves other properties', () => {
      const conflicts = [{ axis: 'test', message: 'conflict' }];

      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: ['flow'],
        axisIntervals: new Map([['engagement', new AxisInterval(0, 1)]]),
        conflicts,
      });

      const updated = original.withKnifeEdges([{ axis: 'new', width: 0.02 }]);

      expect(updated.branchId).toBe('0.1');
      expect(updated.description).toBe('test');
      expect(updated.requiredPrototypes).toEqual(['flow']);
      expect(updated.axisIntervals.size).toBe(1);
      expect(updated.conflicts).toEqual(conflicts);
      expect(updated.isInfeasible).toBe(true);
    });
  });

  describe('withPrototypePartitioning()', () => {
    it('creates new instance with active/inactive prototypes', () => {
      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: ['flow', 'panic', 'trust'],
      });

      const updated = original.withPrototypePartitioning(
        ['flow', 'trust'],
        ['panic']
      );

      expect(updated).not.toBe(original);
      expect(updated).toBeInstanceOf(AnalysisBranch);
      expect(updated.activePrototypes).toEqual(['flow', 'trust']);
      expect(updated.inactivePrototypes).toEqual(['panic']);
      expect(original.activePrototypes).toEqual([]);
      expect(original.inactivePrototypes).toEqual([]);
    });

    it('preserves other properties', () => {
      const intervals = new Map([
        ['engagement', new AxisInterval(0.4, 1.0)],
      ]);
      const conflicts = [{ axis: 'test', message: 'conflict' }];
      const knifeEdges = [{ axis: 'test', width: 0.01 }];

      const original = new AnalysisBranch({
        branchId: '0.1.2',
        description: 'preserved description',
        requiredPrototypes: ['flow', 'interest'],
        axisIntervals: intervals,
        conflicts,
        knifeEdges,
      });

      const updated = original.withPrototypePartitioning(
        ['flow'],
        ['interest']
      );

      expect(updated.branchId).toBe('0.1.2');
      expect(updated.description).toBe('preserved description');
      expect(updated.requiredPrototypes).toEqual(['flow', 'interest']);
      expect(updated.axisIntervals.size).toBe(1);
      expect(updated.conflicts).toEqual(conflicts);
      expect(updated.knifeEdges).toEqual(knifeEdges);
      expect(updated.isInfeasible).toBe(true);
    });
  });

  describe('toJSON()', () => {
    it('includes all properties', () => {
      const intervals = new Map([
        ['engagement', new AxisInterval(0.4, 1.0)],
        ['arousal', new AxisInterval(0.25, 0.6)],
      ]);
      const conflicts = [{ axis: 'agency', message: 'test conflict' }];
      const knifeEdges = [{ axis: 'agency_control', width: 0 }];

      const branch = new AnalysisBranch({
        branchId: '0.2.1',
        description: 'fascination path',
        requiredPrototypes: ['flow', 'fascination'],
        activePrototypes: ['flow'],
        inactivePrototypes: ['fascination'],
        axisIntervals: intervals,
        conflicts,
        knifeEdges,
      });

      const json = branch.toJSON();

      expect(json.branchId).toBe('0.2.1');
      expect(json.description).toBe('fascination path');
      expect(json.requiredPrototypes).toEqual(['flow', 'fascination']);
      expect(json.activePrototypes).toEqual(['flow']);
      expect(json.inactivePrototypes).toEqual(['fascination']);
      expect(json.conflicts).toEqual(conflicts);
      expect(json.knifeEdges).toEqual(knifeEdges);
      expect(json.isInfeasible).toBe(true);
    });

    it('serializes axisIntervals correctly', () => {
      const intervals = new Map([
        ['engagement', new AxisInterval(0.4, 1.0)],
        ['arousal', new AxisInterval(-0.5, 0.5)],
      ]);

      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        axisIntervals: intervals,
      });

      const json = branch.toJSON();

      expect(json.axisIntervals).toEqual({
        engagement: { min: 0.4, max: 1.0 },
        arousal: { min: -0.5, max: 0.5 },
      });
    });

    it('is JSON.stringify compatible', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: ['flow'],
        axisIntervals: new Map([['engagement', new AxisInterval(0, 1)]]),
      });

      const str = JSON.stringify(branch);
      expect(() => JSON.parse(str)).not.toThrow();

      const parsed = JSON.parse(str);
      expect(parsed.branchId).toBe('0.1');
      expect(parsed.axisIntervals.engagement).toEqual({ min: 0, max: 1 });
    });

    it('returns deep copies of arrays', () => {
      const original = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        requiredPrototypes: ['flow'],
        conflicts: [{ axis: 'test', message: 'conflict' }],
      });

      const json1 = original.toJSON();
      const json2 = original.toJSON();

      expect(json1.requiredPrototypes).not.toBe(json2.requiredPrototypes);
      expect(json1.conflicts).not.toBe(json2.conflicts);
    });
  });

  describe('toSummary()', () => {
    it('returns formatted string with active/inactive prototypes', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1.0',
        description: 'entrancement branch',
        requiredPrototypes: ['flow', 'entrancement'],
        activePrototypes: ['flow'],
        inactivePrototypes: ['entrancement'],
        conflicts: [{ axis: 'agency', message: 'conflict' }],
        knifeEdges: [
          { axis: 'agency_control', width: 0 },
          { axis: 'arousal', width: 0.01 },
        ],
      });

      const summary = branch.toSummary();

      expect(summary).toContain('Branch 0.1.0: entrancement branch');
      expect(summary).toContain('Active (gates enforced): flow');
      expect(summary).toContain('Inactive (gates ignored): entrancement');
      expect(summary).toContain('Conflicts: 1');
      expect(summary).toContain('Knife-edges: 2');
    });

    it('shows correct status indicator - infeasible', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
        conflicts: [{ axis: 'test', message: 'conflict' }],
      });

      const summary = branch.toSummary();
      expect(summary).toContain('❌ Infeasible');
    });

    it('shows correct status indicator - feasible', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'test',
      });

      const summary = branch.toSummary();
      expect(summary).toContain('✅ Feasible');
    });

    it('shows "none" when no active or inactive prototypes', () => {
      const branch = new AnalysisBranch({
        branchId: '0',
        description: 'no prototypes',
        requiredPrototypes: [],
        activePrototypes: [],
        inactivePrototypes: [],
      });

      const summary = branch.toSummary();
      expect(summary).toContain('Active (gates enforced): none');
      expect(summary).toContain('Inactive (gates ignored): none');
    });

    it('shows only active when no inactive prototypes', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'active only',
        activePrototypes: ['flow', 'interest'],
        inactivePrototypes: [],
      });

      const summary = branch.toSummary();
      expect(summary).toContain('Active (gates enforced): flow, interest');
      expect(summary).toContain('Inactive (gates ignored): none');
    });

    it('shows only inactive when no active prototypes', () => {
      const branch = new AnalysisBranch({
        branchId: '0.1',
        description: 'inactive only',
        activePrototypes: [],
        inactivePrototypes: ['panic', 'jealousy'],
      });

      const summary = branch.toSummary();
      expect(summary).toContain('Active (gates enforced): none');
      expect(summary).toContain('Inactive (gates ignored): panic, jealousy');
    });
  });
});
