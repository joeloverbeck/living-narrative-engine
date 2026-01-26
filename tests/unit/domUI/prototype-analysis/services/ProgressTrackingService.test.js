/**
 * @file Unit tests for ProgressTrackingService
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ProgressTrackingService from '../../../../../src/domUI/prototype-analysis/services/ProgressTrackingService.js';

describe('ProgressTrackingService', () => {
  let service;
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
      progressPanel: document.createElement('div'),
      progressBar: document.createElement('div'),
      progressStatus: document.createElement('p'),
      runAnalysisBtn: document.createElement('button'),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    service = new ProgressTrackingService({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith('[ProgressTrackingService] Initialized.');
    });

    it('should throw if logger is missing', () => {
      expect(() => new ProgressTrackingService({})).toThrow();
    });

    it('should throw if logger is invalid', () => {
      expect(() => new ProgressTrackingService({ logger: {} })).toThrow();
    });
  });

  describe('showPanel', () => {
    it('should unhide progress panel', () => {
      const elements = createMockElements();
      elements.progressPanel.hidden = true;

      service.showPanel(elements);

      expect(elements.progressPanel.hidden).toBe(false);
    });

    it('should set initial progress to 0%', () => {
      const elements = createMockElements();

      service.showPanel(elements);

      expect(elements.progressBar.style.width).toBe('0%');
      expect(elements.progressBar.getAttribute('aria-valuenow')).toBe('0');
    });

    it('should set initial status text', () => {
      const elements = createMockElements();

      service.showPanel(elements);

      expect(elements.progressStatus.textContent).toBe('Initializing...');
    });

    it('should handle null progressPanel', () => {
      const elements = createMockElements();
      elements.progressPanel = null;

      expect(() => service.showPanel(elements)).not.toThrow();
    });
  });

  describe('hidePanel', () => {
    it('should hide progress panel', () => {
      const elements = createMockElements();
      elements.progressPanel.hidden = false;

      service.hidePanel(elements);

      expect(elements.progressPanel.hidden).toBe(true);
    });

    it('should handle null progressPanel', () => {
      const elements = createMockElements();
      elements.progressPanel = null;

      expect(() => service.hidePanel(elements)).not.toThrow();
    });
  });

  describe('updateProgress', () => {
    it('should update progress bar width', () => {
      const elements = createMockElements();

      service.updateProgress(50, 'Half done', elements);

      expect(elements.progressBar.style.width).toBe('50%');
    });

    it('should update aria-valuenow', () => {
      const elements = createMockElements();

      service.updateProgress(75, 'Almost done', elements);

      expect(elements.progressBar.getAttribute('aria-valuenow')).toBe('75');
    });

    it('should update status text', () => {
      const elements = createMockElements();

      service.updateProgress(50, 'Processing...', elements);

      expect(elements.progressStatus.textContent).toBe('Processing...');
    });

    it('should clamp percent to 0-100 range', () => {
      const elements = createMockElements();

      service.updateProgress(-10, 'Test', elements);
      expect(elements.progressBar.style.width).toBe('0%');

      service.updateProgress(150, 'Test', elements);
      expect(elements.progressBar.style.width).toBe('100%');
    });

    it('should handle null progressBar', () => {
      const elements = createMockElements();
      elements.progressBar = null;

      expect(() => service.updateProgress(50, 'Test', elements)).not.toThrow();
    });

    it('should handle null progressStatus', () => {
      const elements = createMockElements();
      elements.progressStatus = null;

      expect(() => service.updateProgress(50, 'Test', elements)).not.toThrow();
    });
  });

  describe('markComplete', () => {
    it('should set progress to 100%', () => {
      const elements = createMockElements();

      service.markComplete(elements);

      expect(elements.progressBar.style.width).toBe('100%');
    });

    it('should set status to complete message', () => {
      const elements = createMockElements();

      service.markComplete(elements);

      expect(elements.progressStatus.textContent).toBe('Analysis complete');
    });

    it('should update button text to 100%', () => {
      const elements = createMockElements();

      service.markComplete(elements);

      expect(elements.runAnalysisBtn.textContent).toBe('100%');
    });

    it('should handle null runAnalysisBtn', () => {
      const elements = createMockElements();
      elements.runAnalysisBtn = null;

      expect(() => service.markComplete(elements)).not.toThrow();
    });
  });

  describe('handleProgress - V3 mode', () => {
    describe('setup stage', () => {
      it('should calculate pool phase progress', () => {
        const elements = createMockElements();

        service.handleProgress(
          'setup',
          {
            totalStages: 5,
            stageNumber: 1,
            phase: 'pool',
            poolCurrent: 5,
            poolTotal: 10,
          },
          elements
        );

        // Pool phase: 0-70% of setup stage
        // 5/10 = 50% of pool phase = 35% of setup weight
        // Setup start=0, weight=15, so: 0 + 0.35 * 15 = 5.25%
        expect(elements.progressBar.style.width).toBe('5.25%');
        expect(elements.progressStatus.textContent).toContain('Generating context pool');
        expect(elements.progressStatus.textContent).toContain('50%');
      });

      it('should calculate vectors phase progress', () => {
        const elements = createMockElements();

        service.handleProgress(
          'setup',
          {
            totalStages: 5,
            stageNumber: 1,
            phase: 'vectors',
            vectorCurrent: 10,
            vectorTotal: 20,
          },
          elements
        );

        // Vectors phase: 70-90% of setup stage
        // 10/20 = 50% of vectors phase = 70% + 10% = 80% of setup
        // Setup start=0, weight=15, so: 0 + 0.8 * 15 = 12%
        expect(parseFloat(elements.progressBar.style.width)).toBeCloseTo(12, 1);
        expect(elements.progressStatus.textContent).toContain('Evaluating prototype vectors');
      });

      it('should calculate profiles phase progress', () => {
        const elements = createMockElements();

        service.handleProgress(
          'setup',
          {
            totalStages: 5,
            stageNumber: 1,
            phase: 'profiles',
          },
          elements
        );

        // Profiles phase: 90% of setup stage
        // Setup start=0, weight=15, so: 0 + 0.9 * 15 = 13.5%
        expect(elements.progressBar.style.width).toBe('13.5%');
        expect(elements.progressStatus.textContent).toContain('Computing prototype profiles');
      });

      it('should handle initial setup call', () => {
        const elements = createMockElements();

        service.handleProgress(
          'setup',
          {
            totalStages: 5,
            stageNumber: 1,
          },
          elements
        );

        expect(elements.progressBar.style.width).toBe('0%');
        expect(elements.progressStatus.textContent).toContain('Initializing V3 analysis');
      });
    });

    describe('filtering stage', () => {
      it('should calculate progress with new format', () => {
        const elements = createMockElements();

        service.handleProgress(
          'filtering',
          {
            totalStages: 5,
            stageNumber: 2,
            pairsProcessed: 50,
            totalPairs: 100,
          },
          elements
        );

        // Filtering in V3: start=15, weight=5
        // 50/100 = 50% of filtering = 15 + 0.5 * 5 = 17.5%
        expect(elements.progressBar.style.width).toBe('17.5%');
        expect(elements.progressStatus.textContent).toContain('Filtering candidate pairs');
      });

      it('should calculate progress with legacy format', () => {
        const elements = createMockElements();

        service.handleProgress(
          'filtering',
          {
            totalStages: 5,
            stageNumber: 2,
            current: 30,
            total: 100,
          },
          elements
        );

        // 30/100 = 30% of filtering
        expect(elements.progressBar.style.width).toBe('16.5%');
      });

      it('should show complete message when done', () => {
        const elements = createMockElements();

        service.handleProgress(
          'filtering',
          {
            totalStages: 5,
            stageNumber: 2,
            pairsProcessed: 100,
            totalPairs: 100,
          },
          elements
        );

        expect(elements.progressStatus.textContent).toContain('Filtering complete');
      });
    });

    describe('evaluating stage', () => {
      it('should calculate nested pair+sample progress', () => {
        const elements = createMockElements();

        service.handleProgress(
          'evaluating',
          {
            totalStages: 5,
            stageNumber: 3,
            pairIndex: 5,
            pairTotal: 10,
            sampleIndex: 250,
            sampleTotal: 500,
          },
          elements
        );

        // pairProgress = 5/10 = 0.5
        // sampleProgress = 250/500 = 0.5
        // stageProgress = 0.5 + 0.5/10 = 0.55
        // Evaluating in V3: start=20, weight=60
        // 20 + 0.55 * 60 = 53%
        expect(elements.progressBar.style.width).toBe('53%');
        expect(elements.progressStatus.textContent).toContain('Pair 6/10');
      });
    });

    describe('classifying stage', () => {
      it('should calculate progress', () => {
        const elements = createMockElements();

        service.handleProgress(
          'classifying',
          {
            totalStages: 5,
            stageNumber: 4,
            pairIndex: 3,
            pairTotal: 10,
          },
          elements
        );

        // Classifying in V3: start=80, weight=10
        // 3/10 = 30% of classifying = 80 + 0.3 * 10 = 83%
        expect(elements.progressBar.style.width).toBe('83%');
        expect(elements.progressStatus.textContent).toContain('Classifying overlap patterns');
      });
    });

    describe('recommending stage', () => {
      it('should calculate progress', () => {
        const elements = createMockElements();

        service.handleProgress(
          'recommending',
          {
            totalStages: 5,
            stageNumber: 5,
            pairIndex: 8,
            pairTotal: 10,
          },
          elements
        );

        // Recommending in V3: start=90, weight=5
        // 8/10 = 80% of recommending = 90 + 0.8 * 5 = 94%
        expect(elements.progressBar.style.width).toBe('94%');
        expect(elements.progressStatus.textContent).toContain('Building recommendations');
      });
    });

    describe('axis_gap_analysis stage', () => {
      it('should show indeterminate progress', () => {
        const elements = createMockElements();

        service.handleProgress(
          'axis_gap_analysis',
          {
            totalStages: 5,
            stageNumber: 5,
          },
          elements
        );

        // Axis gap: start=95, weight=5, indeterminate=50%
        // 95 + 0.5 * 5 = 97.5%
        expect(elements.progressBar.style.width).toBe('97.5%');
        expect(elements.progressStatus.textContent).toContain('Analyzing axis gaps');
      });
    });
  });

  describe('handleProgress - V2 mode', () => {
    it('should use V2 weights for 4 stages', () => {
      const elements = createMockElements();

      service.handleProgress(
        'filtering',
        {
          totalStages: 4,
          stageNumber: 1,
          pairsProcessed: 50,
          totalPairs: 100,
        },
        elements
      );

      // Filtering in V2: start=0, weight=5
      // 50/100 = 50% of filtering = 0 + 0.5 * 5 = 2.5%
      expect(elements.progressBar.style.width).toBe('2.5%');
    });

    it('should use higher evaluating weight in V2', () => {
      const elements = createMockElements();

      service.handleProgress(
        'evaluating',
        {
          totalStages: 4,
          stageNumber: 2,
          pairIndex: 5,
          pairTotal: 10,
          sampleIndex: 0,
          sampleTotal: 500,
        },
        elements
      );

      // Evaluating in V2: start=5, weight=80
      // pairProgress = 5/10 = 0.5
      // sampleProgress = 0
      // stageProgress = 0.5
      // 5 + 0.5 * 80 = 45%
      expect(elements.progressBar.style.width).toBe('45%');
    });
  });

  describe('handleProgress - unknown stage', () => {
    it('should ignore unknown stages', () => {
      const elements = createMockElements();
      elements.progressBar.style.width = '50%';

      service.handleProgress(
        'unknown_stage',
        { totalStages: 5 },
        elements
      );

      // Should not change progress
      expect(elements.progressBar.style.width).toBe('50%');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ProgressTrackingService] Unknown stage: unknown_stage'
      );
    });
  });

  describe('handleProgress - button update', () => {
    it('should update button text with percentage', () => {
      const elements = createMockElements();

      service.handleProgress(
        'evaluating',
        {
          totalStages: 5,
          stageNumber: 3,
          pairIndex: 5,
          pairTotal: 10,
          sampleIndex: 0,
          sampleTotal: 500,
        },
        elements
      );

      expect(elements.runAnalysisBtn.textContent).toMatch(/^\d+%$/);
    });

    it('should handle null button', () => {
      const elements = createMockElements();
      elements.runAnalysisBtn = null;

      expect(() =>
        service.handleProgress(
          'evaluating',
          { totalStages: 5, pairIndex: 5, pairTotal: 10 },
          elements
        )
      ).not.toThrow();
    });
  });

  describe('static constants', () => {
    it('should have V3 stage weights', () => {
      expect(ProgressTrackingService.V3_STAGE_WEIGHTS.setup).toEqual({ start: 0, weight: 15 });
      expect(ProgressTrackingService.V3_STAGE_WEIGHTS.evaluating).toEqual({ start: 20, weight: 60 });
    });

    it('should have V2 stage weights', () => {
      expect(ProgressTrackingService.V2_STAGE_WEIGHTS.filtering).toEqual({ start: 0, weight: 5 });
      expect(ProgressTrackingService.V2_STAGE_WEIGHTS.evaluating).toEqual({ start: 5, weight: 80 });
    });

    it('should have stage labels', () => {
      expect(ProgressTrackingService.STAGE_LABELS.setup).toBe('Setting up V3 analysis');
      expect(ProgressTrackingService.STAGE_LABELS.evaluating).toBe('Evaluating behavioral overlap');
    });
  });

  describe('edge cases', () => {
    it('should handle zero totalPairs', () => {
      const elements = createMockElements();

      service.handleProgress(
        'filtering',
        {
          totalStages: 5,
          stageNumber: 2,
          pairsProcessed: 0,
          totalPairs: 0,
        },
        elements
      );

      // Should not throw, progress should be 0
      expect(elements.progressBar.style.width).toBe('15%'); // start of filtering in V3
    });

    it('should handle zero pairTotal in evaluating', () => {
      const elements = createMockElements();

      service.handleProgress(
        'evaluating',
        {
          totalStages: 5,
          stageNumber: 3,
          pairIndex: 0,
          pairTotal: 0,
          sampleIndex: 0,
          sampleTotal: 0,
        },
        elements
      );

      // Should not throw
      expect(elements.progressBar.style.width).toBe('20%'); // start of evaluating in V3
    });

    it('should handle missing stageNumber', () => {
      const elements = createMockElements();

      service.handleProgress(
        'filtering',
        {
          totalStages: 5,
          pairsProcessed: 50,
          totalPairs: 100,
        },
        elements
      );

      // Should default stageNumber to 1
      expect(elements.progressStatus.textContent).toContain('Stage 1/5');
    });
  });
});
