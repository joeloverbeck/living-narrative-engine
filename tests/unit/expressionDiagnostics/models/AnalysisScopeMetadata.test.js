/**
 * @file Unit tests for AnalysisScopeMetadata model
 * @description Tests the scope metadata types and constants used to label analysis sections
 * in Monte Carlo reports, ensuring proper structure, immutability, and value correctness.
 */

import { describe, it, expect } from '@jest/globals';
import { SCOPE_METADATA } from '../../../../src/expressionDiagnostics/models/AnalysisScopeMetadata.js';

describe('AnalysisScopeMetadata Model', () => {
  describe('SCOPE_METADATA constant', () => {
    it('should be exported', () => {
      expect(SCOPE_METADATA).toBeDefined();
    });

    it('should have exactly 4 entries', () => {
      const keys = Object.keys(SCOPE_METADATA);
      expect(keys).toHaveLength(4);
    });

    it('should have the expected entry names', () => {
      const keys = Object.keys(SCOPE_METADATA);
      expect(keys).toContain('PROTOTYPE_FIT');
      expect(keys).toContain('BLOCKER_GLOBAL');
      expect(keys).toContain('BLOCKER_IN_REGIME');
      expect(keys).toContain('NON_AXIS_FEASIBILITY');
    });

    it('should be frozen (immutable outer object)', () => {
      expect(Object.isFrozen(SCOPE_METADATA)).toBe(true);
    });
  });

  describe('Entry structure', () => {
    const entries = [
      'PROTOTYPE_FIT',
      'BLOCKER_GLOBAL',
      'BLOCKER_IN_REGIME',
      'NON_AXIS_FEASIBILITY',
    ];

    it.each(entries)('%s should have scope property', (entryName) => {
      expect(SCOPE_METADATA[entryName]).toHaveProperty('scope');
      expect(typeof SCOPE_METADATA[entryName].scope).toBe('string');
    });

    it.each(entries)('%s should have population property', (entryName) => {
      expect(SCOPE_METADATA[entryName]).toHaveProperty('population');
      expect(typeof SCOPE_METADATA[entryName].population).toBe('string');
    });

    it.each(entries)('%s should have signal property', (entryName) => {
      expect(SCOPE_METADATA[entryName]).toHaveProperty('signal');
      expect(typeof SCOPE_METADATA[entryName].signal).toBe('string');
    });

    it.each(entries)('%s should have description property', (entryName) => {
      expect(SCOPE_METADATA[entryName]).toHaveProperty('description');
      expect(typeof SCOPE_METADATA[entryName].description).toBe('string');
      expect(SCOPE_METADATA[entryName].description.length).toBeGreaterThan(0);
    });

    it.each(entries)('%s should be frozen (immutable entry)', (entryName) => {
      expect(Object.isFrozen(SCOPE_METADATA[entryName])).toBe(true);
    });
  });

  describe('PROTOTYPE_FIT values', () => {
    it('should have scope === "axis_only"', () => {
      expect(SCOPE_METADATA.PROTOTYPE_FIT.scope).toBe('axis_only');
    });

    it('should have population === "in_regime"', () => {
      expect(SCOPE_METADATA.PROTOTYPE_FIT.population).toBe('in_regime');
    });

    it('should have signal === "raw"', () => {
      expect(SCOPE_METADATA.PROTOTYPE_FIT.signal).toBe('raw');
    });

    it('should have description mentioning axis constraints', () => {
      expect(SCOPE_METADATA.PROTOTYPE_FIT.description).toMatch(/axis/i);
    });
  });

  describe('BLOCKER_GLOBAL values', () => {
    it('should have scope === "full_prereqs"', () => {
      expect(SCOPE_METADATA.BLOCKER_GLOBAL.scope).toBe('full_prereqs');
    });

    it('should have population === "global"', () => {
      expect(SCOPE_METADATA.BLOCKER_GLOBAL.population).toBe('global');
    });

    it('should have signal === "final"', () => {
      expect(SCOPE_METADATA.BLOCKER_GLOBAL.signal).toBe('final');
    });

    it('should have description mentioning ALL prerequisites', () => {
      expect(SCOPE_METADATA.BLOCKER_GLOBAL.description).toMatch(/ALL/);
    });
  });

  describe('BLOCKER_IN_REGIME values', () => {
    it('should have scope === "full_prereqs"', () => {
      expect(SCOPE_METADATA.BLOCKER_IN_REGIME.scope).toBe('full_prereqs');
    });

    it('should have population === "in_regime"', () => {
      expect(SCOPE_METADATA.BLOCKER_IN_REGIME.population).toBe('in_regime');
    });

    it('should have signal === "final"', () => {
      expect(SCOPE_METADATA.BLOCKER_IN_REGIME.signal).toBe('final');
    });

    it('should have description mentioning mood-regime restriction', () => {
      expect(SCOPE_METADATA.BLOCKER_IN_REGIME.description).toMatch(
        /mood-regime/i
      );
    });
  });

  describe('NON_AXIS_FEASIBILITY values', () => {
    it('should have scope === "non_axis_subset"', () => {
      expect(SCOPE_METADATA.NON_AXIS_FEASIBILITY.scope).toBe('non_axis_subset');
    });

    it('should have population === "in_regime"', () => {
      expect(SCOPE_METADATA.NON_AXIS_FEASIBILITY.population).toBe('in_regime');
    });

    it('should have signal === "final"', () => {
      expect(SCOPE_METADATA.NON_AXIS_FEASIBILITY.signal).toBe('final');
    });

    it('should have description mentioning emotion/sexual/delta clauses', () => {
      expect(SCOPE_METADATA.NON_AXIS_FEASIBILITY.description).toMatch(
        /emotion|sexual|delta/i
      );
    });
  });

  describe('Immutability enforcement', () => {
    it('should not allow adding new entries to SCOPE_METADATA', () => {
      expect(() => {
        // @ts-expect-error Testing immutability
        SCOPE_METADATA.NEW_ENTRY = { scope: 'test' };
      }).toThrow();
    });

    it('should not allow modifying PROTOTYPE_FIT.scope', () => {
      expect(() => {
        // @ts-expect-error Testing immutability
        SCOPE_METADATA.PROTOTYPE_FIT.scope = 'full_prereqs';
      }).toThrow();
    });

    it('should not allow modifying BLOCKER_GLOBAL.population', () => {
      expect(() => {
        // @ts-expect-error Testing immutability
        SCOPE_METADATA.BLOCKER_GLOBAL.population = 'in_regime';
      }).toThrow();
    });
  });

  describe('Export verification via index.js', () => {
    it('should be importable from models/index.js barrel export', async () => {
      const { SCOPE_METADATA: barrelExport } = await import(
        '../../../../src/expressionDiagnostics/models/index.js'
      );
      expect(barrelExport).toBeDefined();
      expect(barrelExport).toBe(SCOPE_METADATA);
    });
  });

  describe('Scope type value coverage', () => {
    it('should have axis_only scope (PROTOTYPE_FIT)', () => {
      const axisOnlyEntries = Object.values(SCOPE_METADATA).filter(
        (e) => e.scope === 'axis_only'
      );
      expect(axisOnlyEntries.length).toBeGreaterThan(0);
    });

    it('should have full_prereqs scope (BLOCKER_*)', () => {
      const fullPrereqsEntries = Object.values(SCOPE_METADATA).filter(
        (e) => e.scope === 'full_prereqs'
      );
      expect(fullPrereqsEntries.length).toBe(2);
    });

    it('should have non_axis_subset scope (NON_AXIS_FEASIBILITY)', () => {
      const nonAxisEntries = Object.values(SCOPE_METADATA).filter(
        (e) => e.scope === 'non_axis_subset'
      );
      expect(nonAxisEntries.length).toBe(1);
    });
  });

  describe('Population type value coverage', () => {
    it('should have global population (BLOCKER_GLOBAL)', () => {
      const globalEntries = Object.values(SCOPE_METADATA).filter(
        (e) => e.population === 'global'
      );
      expect(globalEntries.length).toBe(1);
    });

    it('should have in_regime population (3 entries)', () => {
      const inRegimeEntries = Object.values(SCOPE_METADATA).filter(
        (e) => e.population === 'in_regime'
      );
      expect(inRegimeEntries.length).toBe(3);
    });
  });

  describe('Signal type value coverage', () => {
    it('should have raw signal (PROTOTYPE_FIT)', () => {
      const rawEntries = Object.values(SCOPE_METADATA).filter(
        (e) => e.signal === 'raw'
      );
      expect(rawEntries.length).toBe(1);
    });

    it('should have final signal (3 entries)', () => {
      const finalEntries = Object.values(SCOPE_METADATA).filter(
        (e) => e.signal === 'final'
      );
      expect(finalEntries.length).toBe(3);
    });
  });
});
