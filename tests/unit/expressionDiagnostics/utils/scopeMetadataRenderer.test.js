/**
 * @file Unit tests for scopeMetadataRenderer utility
 * @description Tests the markdown badge rendering for analysis scope metadata headers.
 */

import { describe, it, expect } from '@jest/globals';
import { renderScopeMetadataHeader } from '../../../../src/expressionDiagnostics/utils/scopeMetadataRenderer.js';
import { SCOPE_METADATA } from '../../../../src/expressionDiagnostics/models/AnalysisScopeMetadata.js';

describe('scopeMetadataRenderer', () => {
  describe('renderScopeMetadataHeader export', () => {
    it('should be exported', () => {
      expect(renderScopeMetadataHeader).toBeDefined();
      expect(typeof renderScopeMetadataHeader).toBe('function');
    });
  });

  describe('Badge rendering tests', () => {
    it('should return string containing scope badge', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).toContain('[AXIS-ONLY FIT]');
    });

    it('should return string containing population badge', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).toContain('[IN-REGIME]');
    });

    it('should return string containing description', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).toContain(SCOPE_METADATA.PROTOTYPE_FIT.description);
    });
  });

  describe('Scope badge mapping tests', () => {
    it('should map "axis_only" to "AXIS-ONLY FIT"', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).toContain('AXIS-ONLY FIT');
    });

    it('should map "full_prereqs" to "FULL PREREQS"', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.BLOCKER_GLOBAL);
      expect(result).toContain('FULL PREREQS');
    });

    it('should map "non_axis_subset" to "NON-AXIS ONLY"', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.NON_AXIS_FEASIBILITY);
      expect(result).toContain('NON-AXIS ONLY');
    });

    it('should fall back to uppercase for unknown scope', () => {
      const customMetadata = {
        scope: 'custom_scope',
        population: 'in_regime',
        signal: 'final',
        description: 'Test description',
      };
      const result = renderScopeMetadataHeader(customMetadata);
      expect(result).toContain('[CUSTOM_SCOPE]');
    });
  });

  describe('Population badge mapping tests', () => {
    it('should map "in_regime" to "IN-REGIME"', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).toContain('IN-REGIME');
    });

    it('should map "global" to "GLOBAL"', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.BLOCKER_GLOBAL);
      expect(result).toContain('GLOBAL');
    });

    it('should fall back to uppercase for unknown population', () => {
      const customMetadata = {
        scope: 'axis_only',
        population: 'custom_population',
        signal: 'raw',
        description: 'Test description',
      };
      const result = renderScopeMetadataHeader(customMetadata);
      expect(result).toContain('[CUSTOM_POPULATION]');
    });
  });

  describe('Format verification tests', () => {
    it('should output starting with "> **["', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result.startsWith('> **[')).toBe(true);
    });

    it('should contain blockquote description line with italics', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).toContain('> *');
      expect(result).toContain('*\n');
    });

    it('should end with empty line', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result.endsWith('\n')).toBe(true);
    });

    it('should have exactly 3 lines (badges, description, empty)', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^> \*\*\[.+\]\*\* \*\*\[.+\]\*\*$/);
      expect(lines[1]).toMatch(/^> \*.+\*$/);
      expect(lines[2]).toBe('');
    });
  });

  describe('Integration with SCOPE_METADATA constants', () => {
    it('should render PROTOTYPE_FIT with [AXIS-ONLY FIT]', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).toContain('[AXIS-ONLY FIT]');
      expect(result).toContain('[IN-REGIME]');
    });

    it('should render BLOCKER_GLOBAL with [GLOBAL]', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.BLOCKER_GLOBAL);
      expect(result).toContain('[GLOBAL]');
      expect(result).toContain('[FULL PREREQS]');
    });

    it('should render BLOCKER_IN_REGIME with [FULL PREREQS] and [IN-REGIME]', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.BLOCKER_IN_REGIME);
      expect(result).toContain('[FULL PREREQS]');
      expect(result).toContain('[IN-REGIME]');
    });

    it('should render NON_AXIS_FEASIBILITY with [NON-AXIS ONLY]', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.NON_AXIS_FEASIBILITY);
      expect(result).toContain('[NON-AXIS ONLY]');
      expect(result).toContain('[IN-REGIME]');
    });
  });

  describe('Invariant tests', () => {
    it('should always return a string (never null/undefined)', () => {
      const metadata = {
        scope: 'test',
        population: 'test',
        signal: 'test',
        description: '',
      };
      const result = renderScopeMetadataHeader(metadata);
      expect(typeof result).toBe('string');
    });

    it('should render empty description with just empty italics', () => {
      const metadata = {
        scope: 'axis_only',
        population: 'global',
        signal: 'raw',
        description: '',
      };
      const result = renderScopeMetadataHeader(metadata);
      expect(result).toContain('> **');
      expect(result).toContain('\n');
    });

    it('should have badge text always uppercase', () => {
      const customMetadata = {
        scope: 'some_custom_scope',
        population: 'some_population',
        signal: 'raw',
        description: 'Test',
      };
      const result = renderScopeMetadataHeader(customMetadata);
      // Extract badges from result
      const match = result.match(/\[([A-Z_\- ]+)\]/g);
      expect(match).not.toBeNull();
      // Verify all badge content is uppercase
      for (const badge of match) {
        const content = badge.slice(1, -1); // Remove [ ]
        expect(content).toBe(content.toUpperCase());
      }
    });

    it('should not contain HTML tags (markdown only)', () => {
      const result = renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT);
      expect(result).not.toMatch(/<[a-zA-Z][^>]*>/);
    });
  });

  describe('All SCOPE_METADATA entries render correctly', () => {
    const entries = Object.entries(SCOPE_METADATA);

    it.each(entries)('%s should render without throwing', (name, metadata) => {
      expect(() => renderScopeMetadataHeader(metadata)).not.toThrow();
    });

    it.each(entries)('%s should include its description', (name, metadata) => {
      const result = renderScopeMetadataHeader(metadata);
      expect(result).toContain(metadata.description);
    });
  });
});
