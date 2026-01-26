/**
 * @file Unit tests for IntegrityRenderer
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import IntegrityRenderer from '../../../../../src/domUI/prototype-analysis/renderers/IntegrityRenderer.js';

describe('IntegrityRenderer', () => {
  let renderer;
  let mockLogger;

  function createMockLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }

  function createMockElements() {
    return {
      axisRegistryStatus: document.createElement('span'),
      schemaStatus: document.createElement('span'),
      weightRangeStatus: document.createElement('span'),
      noDuplicatesStatus: document.createElement('span'),
      summary: document.createElement('p'),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    renderer = new IntegrityRenderer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(renderer).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('[IntegrityRenderer] Initialized.');
    });

    it('should throw if logger is missing', () => {
      expect(() => new IntegrityRenderer({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new IntegrityRenderer({ logger: {} })).toThrow();
    });
  });

  describe('updateIntegrityDisplay', () => {
    describe('status badges', () => {
      it('should show checkmark for passing checks', () => {
        const elements = createMockElements();

        renderer.updateIntegrityDisplay(elements);

        expect(elements.axisRegistryStatus.textContent).toBe('✓');
        expect(elements.schemaStatus.textContent).toBe('✓');
        expect(elements.weightRangeStatus.textContent).toBe('✓');
        expect(elements.noDuplicatesStatus.textContent).toBe('✓');
      });

      it('should add pass class to all status elements', () => {
        const elements = createMockElements();

        renderer.updateIntegrityDisplay(elements);

        expect(elements.axisRegistryStatus.classList.contains('pass')).toBe(true);
        expect(elements.schemaStatus.classList.contains('pass')).toBe(true);
        expect(elements.weightRangeStatus.classList.contains('pass')).toBe(true);
        expect(elements.noDuplicatesStatus.classList.contains('pass')).toBe(true);
      });

      it('should remove pending class from status elements', () => {
        const elements = createMockElements();
        elements.axisRegistryStatus.classList.add('pending');
        elements.schemaStatus.classList.add('pending');

        renderer.updateIntegrityDisplay(elements);

        expect(elements.axisRegistryStatus.classList.contains('pending')).toBe(false);
        expect(elements.schemaStatus.classList.contains('pending')).toBe(false);
      });

      it('should remove fail class from status elements', () => {
        const elements = createMockElements();
        elements.axisRegistryStatus.classList.add('fail');

        renderer.updateIntegrityDisplay(elements);

        expect(elements.axisRegistryStatus.classList.contains('fail')).toBe(false);
        expect(elements.axisRegistryStatus.classList.contains('pass')).toBe(true);
      });
    });

    describe('summary display', () => {
      it('should show all-pass message when all checks pass', () => {
        const elements = createMockElements();

        renderer.updateIntegrityDisplay(elements);

        expect(elements.summary.textContent).toContain('All integrity checks passed');
        expect(elements.summary.textContent).toContain('validated against axis registry');
      });

      it('should add all-pass class when all checks pass', () => {
        const elements = createMockElements();

        renderer.updateIntegrityDisplay(elements);

        expect(elements.summary.classList.contains('all-pass')).toBe(true);
        expect(elements.summary.classList.contains('has-failures')).toBe(false);
      });

      it('should remove previous class states', () => {
        const elements = createMockElements();
        elements.summary.classList.add('has-failures');

        renderer.updateIntegrityDisplay(elements);

        expect(elements.summary.classList.contains('has-failures')).toBe(false);
        expect(elements.summary.classList.contains('all-pass')).toBe(true);
      });
    });

    describe('null element handling', () => {
      it('should handle null axisRegistryStatus', () => {
        const elements = createMockElements();
        elements.axisRegistryStatus = null;

        expect(() => renderer.updateIntegrityDisplay(elements)).not.toThrow();
        expect(elements.summary.textContent).toContain('All integrity checks passed');
      });

      it('should handle null schemaStatus', () => {
        const elements = createMockElements();
        elements.schemaStatus = null;

        expect(() => renderer.updateIntegrityDisplay(elements)).not.toThrow();
      });

      it('should handle null weightRangeStatus', () => {
        const elements = createMockElements();
        elements.weightRangeStatus = null;

        expect(() => renderer.updateIntegrityDisplay(elements)).not.toThrow();
      });

      it('should handle null noDuplicatesStatus', () => {
        const elements = createMockElements();
        elements.noDuplicatesStatus = null;

        expect(() => renderer.updateIntegrityDisplay(elements)).not.toThrow();
      });

      it('should handle null summary', () => {
        const elements = createMockElements();
        elements.summary = null;

        expect(() => renderer.updateIntegrityDisplay(elements)).not.toThrow();
      });

      it('should handle all null elements', () => {
        const elements = {
          axisRegistryStatus: null,
          schemaStatus: null,
          weightRangeStatus: null,
          noDuplicatesStatus: null,
          summary: null,
        };

        expect(() => renderer.updateIntegrityDisplay(elements)).not.toThrow();
      });
    });

    describe('logging', () => {
      it('should log debug message with allPass status', () => {
        const elements = createMockElements();

        renderer.updateIntegrityDisplay(elements);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('allPass=true')
        );
      });
    });
  });
});
