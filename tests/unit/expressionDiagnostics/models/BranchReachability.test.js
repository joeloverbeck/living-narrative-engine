/**
 * @file Unit tests for BranchReachability model
 * @see src/expressionDiagnostics/models/BranchReachability.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import BranchReachability from '../../../../src/expressionDiagnostics/models/BranchReachability.js';
import KnifeEdge from '../../../../src/expressionDiagnostics/models/KnifeEdge.js';

describe('BranchReachability', () => {
  const validParams = {
    branchId: '0.1',
    branchDescription: 'interest branch',
    prototypeId: 'flow',
    type: 'emotion',
    threshold: 0.85,
    maxPossible: 0.9,
    knifeEdges: [],
  };

  describe('constructor validation', () => {
    describe('branchId validation', () => {
      it('should throw if branchId is missing', () => {
        const params = { ...validParams };
        delete params.branchId;

        expect(() => new BranchReachability(params)).toThrow(
          'BranchReachability requires non-empty branchId string'
        );
      });

      it('should throw if branchId is empty string', () => {
        expect(
          () => new BranchReachability({ ...validParams, branchId: '' })
        ).toThrow('BranchReachability requires non-empty branchId string');
      });

      it('should throw if branchId is whitespace only', () => {
        expect(
          () => new BranchReachability({ ...validParams, branchId: '   ' })
        ).toThrow('BranchReachability requires non-empty branchId string');
      });

      it('should throw if branchId is not a string', () => {
        expect(
          () => new BranchReachability({ ...validParams, branchId: 123 })
        ).toThrow('BranchReachability requires non-empty branchId string');
      });
    });

    describe('branchDescription validation', () => {
      it('should throw if branchDescription is missing', () => {
        const params = { ...validParams };
        delete params.branchDescription;

        expect(() => new BranchReachability(params)).toThrow(
          'BranchReachability requires branchDescription string'
        );
      });

      it('should throw if branchDescription is not a string', () => {
        expect(
          () =>
            new BranchReachability({ ...validParams, branchDescription: 123 })
        ).toThrow('BranchReachability requires branchDescription string');
      });

      it('should accept empty string for branchDescription', () => {
        // Empty description is allowed (just not undefined/null)
        expect(
          () =>
            new BranchReachability({ ...validParams, branchDescription: '' })
        ).not.toThrow();
      });
    });

    describe('prototypeId validation', () => {
      it('should throw if prototypeId is missing', () => {
        const params = { ...validParams };
        delete params.prototypeId;

        expect(() => new BranchReachability(params)).toThrow(
          'BranchReachability requires non-empty prototypeId string'
        );
      });

      it('should throw if prototypeId is empty string', () => {
        expect(
          () => new BranchReachability({ ...validParams, prototypeId: '' })
        ).toThrow('BranchReachability requires non-empty prototypeId string');
      });

      it('should throw if prototypeId is whitespace only', () => {
        expect(
          () => new BranchReachability({ ...validParams, prototypeId: '  ' })
        ).toThrow('BranchReachability requires non-empty prototypeId string');
      });
    });

    describe('type validation', () => {
      it('should throw if type is not "emotion" or "sexual"', () => {
        expect(
          () => new BranchReachability({ ...validParams, type: 'invalid' })
        ).toThrow('BranchReachability type must be "emotion" or "sexual"');
      });

      it('should throw if type is missing', () => {
        const params = { ...validParams };
        delete params.type;

        expect(() => new BranchReachability(params)).toThrow(
          'BranchReachability type must be "emotion" or "sexual"'
        );
      });

      it('should accept "emotion" type', () => {
        expect(
          () => new BranchReachability({ ...validParams, type: 'emotion' })
        ).not.toThrow();
      });

      it('should accept "sexual" type', () => {
        expect(
          () => new BranchReachability({ ...validParams, type: 'sexual' })
        ).not.toThrow();
      });
    });

    describe('threshold validation', () => {
      it('should throw if threshold is missing', () => {
        const params = { ...validParams };
        delete params.threshold;

        expect(() => new BranchReachability(params)).toThrow(
          'BranchReachability requires numeric threshold'
        );
      });

      it('should throw if threshold is NaN', () => {
        expect(
          () => new BranchReachability({ ...validParams, threshold: NaN })
        ).toThrow('BranchReachability requires numeric threshold');
      });

      it('should throw if threshold is not a number', () => {
        expect(
          () => new BranchReachability({ ...validParams, threshold: '0.85' })
        ).toThrow('BranchReachability requires numeric threshold');
      });

      it('should accept 0 as threshold', () => {
        expect(
          () => new BranchReachability({ ...validParams, threshold: 0 })
        ).not.toThrow();
      });

      it('should accept negative threshold', () => {
        expect(
          () => new BranchReachability({ ...validParams, threshold: -0.5 })
        ).not.toThrow();
      });
    });

    describe('maxPossible validation', () => {
      it('should throw if maxPossible is missing', () => {
        const params = { ...validParams };
        delete params.maxPossible;

        expect(() => new BranchReachability(params)).toThrow(
          'BranchReachability requires numeric maxPossible'
        );
      });

      it('should throw if maxPossible is NaN', () => {
        expect(
          () => new BranchReachability({ ...validParams, maxPossible: NaN })
        ).toThrow('BranchReachability requires numeric maxPossible');
      });

      it('should throw if maxPossible is not a number', () => {
        expect(
          () => new BranchReachability({ ...validParams, maxPossible: '0.9' })
        ).toThrow('BranchReachability requires numeric maxPossible');
      });
    });

    describe('knifeEdges validation', () => {
      it('should throw if knifeEdges is not an array', () => {
        expect(
          () =>
            new BranchReachability({ ...validParams, knifeEdges: 'not-array' })
        ).toThrow('BranchReachability knifeEdges must be an array');
      });

      it('should throw if knifeEdges is an object', () => {
        expect(
          () => new BranchReachability({ ...validParams, knifeEdges: {} })
        ).toThrow('BranchReachability knifeEdges must be an array');
      });

      it('should accept missing knifeEdges (defaults to empty array)', () => {
        const params = { ...validParams };
        delete params.knifeEdges;

        const result = new BranchReachability(params);
        expect(result.knifeEdges).toEqual([]);
      });
    });

    it('should accept valid parameters', () => {
      expect(() => new BranchReachability(validParams)).not.toThrow();
    });
  });

  describe('calculated properties', () => {
    describe('isReachable calculation', () => {
      it('should calculate isReachable as true when maxPossible >= threshold', () => {
        const result = new BranchReachability({
          ...validParams,
          threshold: 0.85,
          maxPossible: 0.9,
        });
        expect(result.isReachable).toBe(true);
      });

      it('should calculate isReachable as true when maxPossible == threshold', () => {
        const result = new BranchReachability({
          ...validParams,
          threshold: 0.85,
          maxPossible: 0.85,
        });
        expect(result.isReachable).toBe(true);
      });

      it('should calculate isReachable as false when maxPossible < threshold', () => {
        const result = new BranchReachability({
          ...validParams,
          threshold: 0.85,
          maxPossible: 0.77,
        });
        expect(result.isReachable).toBe(false);
      });
    });

    describe('gap calculation', () => {
      it('should set gap to 0 when reachable', () => {
        const result = new BranchReachability({
          ...validParams,
          threshold: 0.85,
          maxPossible: 0.9,
        });
        expect(result.gap).toBe(0);
      });

      it('should calculate gap correctly when unreachable', () => {
        const result = new BranchReachability({
          ...validParams,
          threshold: 0.85,
          maxPossible: 0.77,
        });
        expect(result.gap).toBeCloseTo(0.08, 10);
      });

      it('should calculate gap as positive value', () => {
        const result = new BranchReachability({
          ...validParams,
          threshold: 1.0,
          maxPossible: 0.5,
        });
        expect(result.gap).toBe(0.5);
        expect(result.gap).toBeGreaterThan(0);
      });
    });
  });

  describe('getters', () => {
    let instance;

    beforeEach(() => {
      instance = new BranchReachability(validParams);
    });

    it('should return correct branchId', () => {
      expect(instance.branchId).toBe('0.1');
    });

    it('should return correct branchDescription', () => {
      expect(instance.branchDescription).toBe('interest branch');
    });

    it('should return correct prototypeId', () => {
      expect(instance.prototypeId).toBe('flow');
    });

    it('should return correct type', () => {
      expect(instance.type).toBe('emotion');
    });

    it('should return correct threshold', () => {
      expect(instance.threshold).toBe(0.85);
    });

    it('should return correct maxPossible', () => {
      expect(instance.maxPossible).toBe(0.9);
    });

    describe('knifeEdges immutability', () => {
      it('should return copy of knifeEdges array, not reference', () => {
        const knifeEdge = new KnifeEdge({
          axis: 'agency_control',
          min: 0.1,
          max: 0.1,
        });
        const instance = new BranchReachability({
          ...validParams,
          knifeEdges: [knifeEdge],
        });

        const edges1 = instance.knifeEdges;
        const edges2 = instance.knifeEdges;

        expect(edges1).not.toBe(edges2);
        expect(edges1).toEqual(edges2);
      });

      it('should not allow modification of internal array', () => {
        const instance = new BranchReachability({
          ...validParams,
          knifeEdges: [],
        });

        const edges = instance.knifeEdges;
        edges.push('should not appear');

        expect(instance.knifeEdges).toHaveLength(0);
      });
    });
  });

  describe('hasKnifeEdges', () => {
    it('should return true when knifeEdges present', () => {
      const knifeEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      const result = new BranchReachability({
        ...validParams,
        knifeEdges: [knifeEdge],
      });

      expect(result.hasKnifeEdges).toBe(true);
    });

    it('should return false when knifeEdges empty', () => {
      const result = new BranchReachability({
        ...validParams,
        knifeEdges: [],
      });

      expect(result.hasKnifeEdges).toBe(false);
    });
  });

  describe('status property', () => {
    it('should return "unreachable" when not reachable', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.77,
      });

      expect(result.status).toBe('unreachable');
    });

    it('should return "knife-edge" when reachable with knife-edges', () => {
      const knifeEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.9,
        knifeEdges: [knifeEdge],
      });

      expect(result.status).toBe('knife-edge');
    });

    it('should return "reachable" when reachable without knife-edges', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.9,
        knifeEdges: [],
      });

      expect(result.status).toBe('reachable');
    });
  });

  describe('statusEmoji property', () => {
    it('should return ✅ for reachable status', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.9,
        knifeEdges: [],
      });

      expect(result.statusEmoji).toBe('\u2705');
    });

    it('should return ❌ for unreachable status', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.77,
      });

      expect(result.statusEmoji).toBe('\u274C');
    });

    it('should return ⚠️ for knife-edge status', () => {
      const knifeEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.9,
        knifeEdges: [knifeEdge],
      });

      expect(result.statusEmoji).toBe('\u26A0\uFE0F');
    });
  });

  describe('gapPercentage property', () => {
    it('should calculate gap percentage correctly', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.77,
      });

      // gap = 0.08, percentage = 0.08 / 0.85 * 100 ≈ 9.41%
      expect(result.gapPercentage).toBeCloseTo(9.41, 1);
    });

    it('should return 0 when threshold is 0', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0,
        maxPossible: -0.1, // unreachable with 0 threshold
      });

      expect(result.gapPercentage).toBe(0);
    });

    it('should return 0 when reachable (gap is 0)', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.5,
        maxPossible: 0.6,
      });

      expect(result.gapPercentage).toBe(0);
    });
  });

  describe('toSummary()', () => {
    it('should include all relevant information when reachable', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.9,
        knifeEdges: [],
      });

      const summary = result.toSummary();

      expect(summary).toContain('flow >= 0.85');
      expect(summary).toContain('Reachable');
      expect(summary).toContain('Max possible: 0.90');
      expect(summary).toContain('Branch: interest branch');
    });

    it('should include gap when unreachable', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.77,
      });

      const summary = result.toSummary();

      expect(summary).toContain('Unreachable (gap: 0.08)');
    });

    it('should include knife-edge count when present', () => {
      const ke1 = new KnifeEdge({ axis: 'agency_control', min: 0.1, max: 0.1 });
      const ke2 = new KnifeEdge({ axis: 'arousal', min: 0.25, max: 0.27 });
      const result = new BranchReachability({
        ...validParams,
        knifeEdges: [ke1, ke2],
      });

      const summary = result.toSummary();

      expect(summary).toContain('[2 knife-edge(s)]');
    });
  });

  describe('toJSON()', () => {
    it('should include all properties', () => {
      const knifeEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
      });
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.77,
        knifeEdges: [knifeEdge],
      });

      const json = result.toJSON();

      expect(json.branchId).toBe('0.1');
      expect(json.branchDescription).toBe('interest branch');
      expect(json.prototypeId).toBe('flow');
      expect(json.type).toBe('emotion');
      expect(json.threshold).toBe(0.85);
      expect(json.maxPossible).toBe(0.77);
      expect(json.isReachable).toBe(false);
      expect(json.gap).toBeCloseTo(0.08, 10);
      expect(json.knifeEdges).toHaveLength(1);
    });

    it('should include calculated status property', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.9,
      });

      const json = result.toJSON();

      expect(json.status).toBe('reachable');
    });

    it('should serialize knifeEdges using their toJSON method', () => {
      const knifeEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      const result = new BranchReachability({
        ...validParams,
        knifeEdges: [knifeEdge],
      });

      const json = result.toJSON();

      expect(json.knifeEdges[0]).toHaveProperty('axis', 'agency_control');
      expect(json.knifeEdges[0]).toHaveProperty('min', 0.1);
      expect(json.knifeEdges[0]).toHaveProperty('max', 0.1);
      expect(json.knifeEdges[0]).toHaveProperty('severity', 'critical');
    });

    it('should handle plain object knifeEdges without toJSON', () => {
      const plainKnifeEdge = { axis: 'test', min: 0, max: 0.01, width: 0.01 };
      const result = new BranchReachability({
        ...validParams,
        knifeEdges: [plainKnifeEdge],
      });

      const json = result.toJSON();

      expect(json.knifeEdges[0]).toEqual(plainKnifeEdge);
    });
  });

  describe('fromJSON()', () => {
    it('should reconstruct correctly from JSON', () => {
      const original = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.77,
      });
      const json = original.toJSON();

      const reconstructed = BranchReachability.fromJSON(json);

      expect(reconstructed.branchId).toBe(original.branchId);
      expect(reconstructed.branchDescription).toBe(original.branchDescription);
      expect(reconstructed.prototypeId).toBe(original.prototypeId);
      expect(reconstructed.type).toBe(original.type);
      expect(reconstructed.threshold).toBe(original.threshold);
      expect(reconstructed.maxPossible).toBe(original.maxPossible);
      expect(reconstructed.isReachable).toBe(original.isReachable);
      expect(reconstructed.gap).toBe(original.gap);
    });

    it('should handle missing knifeEdges in JSON', () => {
      const json = {
        branchId: '0.1',
        branchDescription: 'test',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.5,
        maxPossible: 0.6,
        // knifeEdges intentionally missing
      };

      const result = BranchReachability.fromJSON(json);

      expect(result.knifeEdges).toEqual([]);
    });

    it('should recalculate isReachable and gap on reconstruction', () => {
      // Even if JSON has wrong isReachable/gap, the reconstructed object
      // should calculate them fresh from threshold and maxPossible
      const json = {
        branchId: '0.1',
        branchDescription: 'test',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.5,
        maxPossible: 0.3,
        isReachable: true, // Intentionally wrong
        gap: 0, // Intentionally wrong
      };

      const result = BranchReachability.fromJSON(json);

      expect(result.isReachable).toBe(false); // Correctly recalculated
      expect(result.gap).toBeCloseTo(0.2, 10); // Correctly recalculated
    });
  });

  describe('toTableRow()', () => {
    it('should return UI-ready format', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.85,
        maxPossible: 0.9,
        knifeEdges: [],
      });

      const row = result.toTableRow();

      expect(row).toEqual({
        prototype: 'flow',
        type: 'emotion',
        direction: 'high',
        required: '>= 0.85',
        maxPossible: '0.90',
        minPossible: '0.00',
        gap: '0.00',
        status: '\u2705',
        branch: 'interest branch',
      });
    });

    it('should format values with 2 decimal places', () => {
      const result = new BranchReachability({
        ...validParams,
        threshold: 0.855555,
        maxPossible: 0.777777,
      });

      const row = result.toTableRow();

      expect(row.required).toBe('>= 0.86');
      expect(row.maxPossible).toBe('0.78');
      expect(row.gap).toBe('0.08');
    });
  });

  describe('integration scenarios', () => {
    it('should handle flow_absorption entrancement branch scenario', () => {
      // From the spec: entrancement branch has knife-edge on agency_control
      // and flow >= 0.85 is NOT reachable (max ~0.77)
      const knifeEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
        contributingGates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
      });

      const result = new BranchReachability({
        branchId: '0.2',
        branchDescription: 'entrancement branch',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.85,
        maxPossible: 0.7666,
        knifeEdges: [knifeEdge],
      });

      expect(result.isReachable).toBe(false);
      expect(result.gap).toBeCloseTo(0.0834, 3);
      expect(result.status).toBe('unreachable');
      expect(result.hasKnifeEdges).toBe(true);
    });

    it('should handle flow_absorption interest branch scenario', () => {
      // From the spec: interest branch is fully reachable
      const result = new BranchReachability({
        branchId: '0.0',
        branchDescription: 'interest branch',
        prototypeId: 'flow',
        type: 'emotion',
        threshold: 0.85,
        maxPossible: 1.0,
        knifeEdges: [],
      });

      expect(result.isReachable).toBe(true);
      expect(result.gap).toBe(0);
      expect(result.status).toBe('reachable');
      expect(result.hasKnifeEdges).toBe(false);
    });
  });
});
