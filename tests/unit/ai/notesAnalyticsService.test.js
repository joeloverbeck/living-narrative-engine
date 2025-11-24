/**
 * @file Unit tests for NotesAnalyticsService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import NotesAnalyticsService from '../../../src/ai/notesAnalyticsService.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('NotesAnalyticsService', () => {
  let analyticsService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    analyticsService = new NotesAnalyticsService({ logger: mockLogger });
  });

  describe('Note recording', () => {
    it('should record note creation', () => {
      const note = {
        text: 'Test note',
        subject: 'Test',
        subjectType: 'entity',
        context: 'test',
      };

      analyticsService.recordNoteCreation(note);

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(1);
      expect(summary.typeDistribution.entity).toBe('100.00');
    });

    it('should track type distribution', () => {
      const notes = [
        { text: 'Note 1', subject: 's1', subjectType: 'entity' },
        { text: 'Note 2', subject: 's2', subjectType: 'entity' },
        { text: 'Note 3', subject: 's3', subjectType: 'plan' },
        { text: 'Note 4', subject: 's4', subjectType: 'event' },
      ];

      notes.forEach((note) => analyticsService.recordNoteCreation(note));

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(4);
      expect(summary.typeDistribution.entity).toBe('50.00');
      expect(summary.typeDistribution.plan).toBe('25.00');
      expect(summary.typeDistribution.event).toBe('25.00');
    });

    it('should include metadata in session data', () => {
      const note = {
        text: 'Test note',
        subject: 'Test',
        subjectType: 'event',
      };

      analyticsService.recordNoteCreation(note, {
        entityId: 'entity-123',
        source: 'ai-generated',
      });

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Analytics: Recorded note creation - event'
      );
    });
  });

  describe('Error tracking', () => {
    it('should record categorization errors', () => {
      const note = {
        text: 'Test note',
        subject: 'Test plan',
        subjectType: 'event',
      };

      analyticsService.recordCategorizationError(
        note,
        'event',
        'plan',
        'This is a future intention, not a past event'
      );

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalErrors).toBe(1);
      expect(summary.topMisclassifications).toContainEqual({
        pattern: 'event→plan',
        count: 1,
      });
    });

    it('should calculate accuracy correctly', () => {
      // Add 10 notes (9 correct, 1 error)
      for (let i = 0; i < 9; i++) {
        analyticsService.recordNoteCreation({
          text: `Note ${i}`,
          subject: `s${i}`,
          subjectType: 'entity',
        });
      }

      analyticsService.recordNoteCreation({
        text: 'Incorrect note',
        subject: 'plan',
        subjectType: 'event',
      });

      analyticsService.recordCategorizationError(
        { text: 'Incorrect note', subject: 'plan', subjectType: 'event' },
        'event',
        'plan'
      );

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.accuracy).toBe('90.00%');
    });

    it('should track multiple misclassification patterns', () => {
      const errors = [
        { note: { text: 'N1', subject: 'S1' }, incorrect: 'event', correct: 'plan' },
        { note: { text: 'N2', subject: 'S2' }, incorrect: 'event', correct: 'plan' },
        {
          note: { text: 'N3', subject: 'S3' },
          incorrect: 'entity',
          correct: 'knowledge',
        },
      ];

      errors.forEach(({ note, incorrect, correct }) => {
        analyticsService.recordCategorizationError(note, incorrect, correct);
      });

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.topMisclassifications).toContainEqual({
        pattern: 'event→plan',
        count: 2,
      });
      expect(summary.topMisclassifications).toContainEqual({
        pattern: 'entity→knowledge',
        count: 1,
      });
    });
  });

  describe('Summary generation', () => {
    it('should identify most used types', () => {
      const notes = [
        { text: 'N1', subject: 's1', subjectType: 'entity' },
        { text: 'N2', subject: 's2', subjectType: 'entity' },
        { text: 'N3', subject: 's3', subjectType: 'entity' },
        { text: 'N4', subject: 's4', subjectType: 'plan' },
        { text: 'N5', subject: 's5', subjectType: 'plan' },
        { text: 'N6', subject: 's6', subjectType: 'event' },
      ];

      notes.forEach((note) => analyticsService.recordNoteCreation(note));

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.mostUsedTypes[0].type).toBe('entity');
      expect(summary.mostUsedTypes[0].count).toBe(3);
      expect(summary.mostUsedTypes[1].type).toBe('plan');
      expect(summary.mostUsedTypes[1].count).toBe(2);
    });

    it('should identify underutilized types', () => {
      analyticsService.recordNoteCreation({
        text: 'Test',
        subject: 's1',
        subjectType: 'entity',
      });

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.underutilizedTypes).toContain('plan');
      expect(summary.underutilizedTypes).toContain('event');
      expect(summary.underutilizedTypes).not.toContain('entity');
    });

    it('should handle zero notes gracefully', () => {
      const summary = analyticsService.getAnalyticsSummary();

      expect(summary.summary.totalNotes).toBe(0);
      expect(summary.summary.accuracy).toBe('100%');
      // mostUsedTypes includes all types with 0 count when no notes exist
      expect(summary.mostUsedTypes.length).toBeGreaterThan(0);
      expect(summary.mostUsedTypes.every((t) => t.count === 0)).toBe(true);
    });

    it('should calculate percentages correctly with single note', () => {
      analyticsService.recordNoteCreation({
        text: 'Single note',
        subject: 'Test',
        subjectType: 'event',
      });

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.typeDistribution.event).toBe('100.00');
      expect(summary.typeDistribution.entity).toBe('0.00');
    });
  });

  describe('Report generation', () => {
    it('should generate markdown report', () => {
      analyticsService.recordNoteCreation({
        text: 'Test note',
        subject: 'Test',
        subjectType: 'entity',
      });

      const report = analyticsService.generateReport();

      expect(report).toContain('# Notes Categorization Analytics Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Type Distribution');
      expect(report).toContain('| Subject Type | Count | Percentage |');
    });

    it('should include most used types in report', () => {
      analyticsService.recordNoteCreation({
        text: 'N1',
        subject: 's1',
        subjectType: 'entity',
      });
      analyticsService.recordNoteCreation({
        text: 'N2',
        subject: 's2',
        subjectType: 'knowledge',
      });

      const report = analyticsService.generateReport();

      expect(report).toContain('## Most Used Types');
      expect(report).toContain('entity');
      expect(report).toContain('knowledge');
    });

    it('should include underutilized types section when present', () => {
      analyticsService.recordNoteCreation({
        text: 'Test',
        subject: 's1',
        subjectType: 'entity',
      });

      const report = analyticsService.generateReport();

      expect(report).toContain('## Underutilized Types (0 usage)');
      expect(report).toContain('- plan');
    });

    it('should include categorization errors in report', () => {
      const note = {
        text: 'Future plan',
        subject: 'Shopping',
        subjectType: 'event',
      };

      analyticsService.recordNoteCreation(note);
      analyticsService.recordCategorizationError(
        note,
        'event',
        'plan',
        'This describes future intention'
      );

      const report = analyticsService.generateReport();

      expect(report).toContain('## Categorization Errors');
      expect(report).toContain('Shopping');
      expect(report).toContain('Future plan');
      expect(report).toContain('- **Incorrect Type:** event');
      expect(report).toContain('- **Correct Type:** plan');
      expect(report).toContain('- **Reason:** This describes future intention');
    });

    it('should limit categorization errors to 10 in report', () => {
      // Add 15 errors
      for (let i = 0; i < 15; i++) {
        analyticsService.recordCategorizationError(
          { text: `Error ${i}`, subject: `S${i}` },
          'event',
          'plan'
        );
      }

      const report = analyticsService.generateReport();

      // Count how many error sections are in the report
      const errorSections = (report.match(/### S\d+/g) || []).length;
      expect(errorSections).toBe(10);
    });
  });

  describe('Reset functionality', () => {
    it('should reset metrics', () => {
      analyticsService.recordNoteCreation({
        text: 'Test',
        subject: 's1',
        subjectType: 'entity',
      });

      let summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(1);

      analyticsService.resetAnalytics();

      summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Analytics: Resetting metrics');
    });

    it('should clear all errors on reset', () => {
      analyticsService.recordCategorizationError(
        { text: 'Error', subject: 'Test' },
        'event',
        'plan'
      );

      analyticsService.resetAnalytics();

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalErrors).toBe(0);
      expect(summary.topMisclassifications).toEqual([]);
    });
  });

  describe('Storage integration', () => {
    it('should warn when saving without storage', async () => {
      await analyticsService.saveAnalytics();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Analytics: No storage configured, cannot save'
      );
    });

    it('should warn when loading without storage', async () => {
      await analyticsService.loadAnalytics();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Analytics: No storage configured, cannot load'
      );
    });

    it('should save to storage when configured', async () => {
      const mockStorage = {
        save: jest.fn().mockResolvedValue(undefined),
        load: jest.fn(),
      };

      const service = new NotesAnalyticsService({
        logger: mockLogger,
        storage: mockStorage,
      });

      service.recordNoteCreation({
        text: 'Test',
        subject: 's1',
        subjectType: 'entity',
      });

      await service.saveAnalytics();

      expect(mockStorage.save).toHaveBeenCalledWith(
        'notes-analytics',
        expect.objectContaining({
          totalNotes: 1,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics: Saved to persistent storage'
      );
    });

    it('should load from storage when configured', async () => {
      const mockMetrics = {
        totalNotes: 5,
        typeDistribution: { entity: 5 },
        categorizationErrors: [],
        misclassificationPatterns: {},
        sessionData: [],
        lastReset: Date.now(),
      };

      const mockStorage = {
        save: jest.fn(),
        load: jest.fn().mockResolvedValue(mockMetrics),
      };

      const service = new NotesAnalyticsService({
        logger: mockLogger,
        storage: mockStorage,
      });

      await service.loadAnalytics();

      expect(mockStorage.load).toHaveBeenCalledWith('notes-analytics');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics: Loaded from persistent storage'
      );

      const summary = service.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(5);
    });

    it('should handle storage save errors gracefully', async () => {
      const mockStorage = {
        save: jest.fn().mockRejectedValue(new Error('Storage error')),
        load: jest.fn(),
      };

      const service = new NotesAnalyticsService({
        logger: mockLogger,
        storage: mockStorage,
      });

      await service.saveAnalytics();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Analytics: Failed to save',
        expect.any(Error)
      );
    });

    it('should handle storage load errors gracefully', async () => {
      const mockStorage = {
        save: jest.fn(),
        load: jest.fn().mockRejectedValue(new Error('Load error')),
      };

      const service = new NotesAnalyticsService({
        logger: mockLogger,
        storage: mockStorage,
      });

      await service.loadAnalytics();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Analytics: Failed to load',
        expect.any(Error)
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle 100% error rate', () => {
      analyticsService.recordNoteCreation({
        text: 'Error note',
        subject: 'Test',
        subjectType: 'event',
      });

      analyticsService.recordCategorizationError(
        { text: 'Error note', subject: 'Test' },
        'event',
        'plan'
      );

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.accuracy).toBe('0.00%');
    });

    it('should handle notes without context', () => {
      const note = {
        text: 'No context',
        subject: 'Test',
        subjectType: 'entity',
      };

      analyticsService.recordNoteCreation(note);

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(1);
    });

    it('should return empty array for top misclassifications when none exist', () => {
      analyticsService.recordNoteCreation({
        text: 'Test',
        subject: 's1',
        subjectType: 'entity',
      });

      const summary = analyticsService.getAnalyticsSummary();
      expect(summary.topMisclassifications).toEqual([]);
    });
  });
});
