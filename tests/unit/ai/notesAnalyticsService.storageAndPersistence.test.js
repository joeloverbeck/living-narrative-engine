/**
 * @file Additional coverage for NotesAnalyticsService focusing on
 * persistence flows and comprehensive reporting output.
 */

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import NotesAnalyticsService from '../../../src/ai/notesAnalyticsService.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('NotesAnalyticsService storage and reporting coverage', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let logger;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    logger = createMockLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('tracks analytics across note creation and categorization errors', () => {
    const service = new NotesAnalyticsService({ logger });

    service.recordNoteCreation(
      {
        subjectType: SUBJECT_TYPES.ENTITY,
        subject: 'Hero',
        text: 'Meets the guide.',
        context: 'intro',
      },
      { importance: 'high' }
    );
    jest.advanceTimersByTime(10);
    service.recordNoteCreation(
      {
        subjectType: SUBJECT_TYPES.PLAN,
        subject: 'Strategy',
        text: 'Formulate rescue.',
        context: null,
      },
      { thread: 'rescue' }
    );
    jest.advanceTimersByTime(10);
    service.recordNoteCreation(
      {
        subjectType: SUBJECT_TYPES.ENTITY,
        subject: 'Mentor',
        text: 'Provides guidance.',
        context: 'council',
      },
      { mood: 'encouraging' }
    );

    const erroneousNote = {
      subject: 'Hero',
      text: 'Misfiled note',
    };
    service.recordCategorizationError(
      erroneousNote,
      SUBJECT_TYPES.OTHER,
      SUBJECT_TYPES.ENTITY,
      'Entity misidentified'
    );
    service.recordCategorizationError(
      erroneousNote,
      SUBJECT_TYPES.EVENT,
      SUBJECT_TYPES.ENTITY,
      'Timeline confusion'
    );

    const summary = service.getAnalyticsSummary();

    expect(summary.summary.totalNotes).toBe(3);
    expect(summary.summary.totalErrors).toBe(2);
    expect(summary.summary.accuracy).toBe('33.33%');
    expect(summary.typeDistribution.entity).toBe('66.67');
    expect(summary.mostUsedTypes[0]).toEqual(
      expect.objectContaining({ type: SUBJECT_TYPES.ENTITY, count: 2 })
    );
    expect(summary.topMisclassifications[0]).toEqual(
      expect.objectContaining({ pattern: `${SUBJECT_TYPES.OTHER}→${SUBJECT_TYPES.ENTITY}` })
    );
    expect(summary.underutilizedTypes).toContain(SUBJECT_TYPES.KNOWLEDGE);
    expect(summary.categorizationErrors).toHaveLength(2);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Recorded note creation - entity')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Categorization error - other→entity'),
      expect.any(Object)
    );
  });

  it('generates a report containing all dynamic sections', () => {
    const service = new NotesAnalyticsService({ logger });

    service.recordNoteCreation({
      subjectType: SUBJECT_TYPES.KNOWLEDGE,
      subject: 'Foreshadowing',
      text: 'Dark omen recorded.',
      context: 'prophecy',
    });
    service.recordCategorizationError(
      {
        subject: 'Foreshadowing',
        text: 'Misinterpreted',
      },
      SUBJECT_TYPES.PLAN,
      SUBJECT_TYPES.KNOWLEDGE,
      'Planning artifact'
    );

    const report = service.generateReport();

    expect(report).toContain('# Notes Categorization Analytics Report');
    expect(report).toContain('## Summary');
    expect(report).toContain('## Type Distribution');
    expect(report).toContain('## Most Used Types');
    expect(report).toContain('## Underutilized Types');
    expect(report).toContain('## Top Misclassification Patterns');
    expect(report).toContain('## Categorization Errors');
    expect(report).toContain('plan→knowledge');
  });

  it('resets analytics metrics and refreshes the session timestamp', () => {
    const service = new NotesAnalyticsService({ logger });
    service.recordNoteCreation({
      subjectType: SUBJECT_TYPES.STATE,
      subject: 'Allies',
      text: 'Alliance forged.',
      context: 'treaty',
    });

    const beforeReset = service.getAnalyticsSummary().summary.sessionStart;
    jest.advanceTimersByTime(5000);
    service.resetAnalytics();

    const summaryAfterReset = service.getAnalyticsSummary();
    expect(summaryAfterReset.summary.totalNotes).toBe(0);
    expect(summaryAfterReset.summary.totalErrors).toBe(0);
    expect(summaryAfterReset.summary.sessionStart).not.toBe(beforeReset);
    expect(logger.info).toHaveBeenCalledWith('Analytics: Resetting metrics');
  });

  describe('persistent storage integration', () => {
    it('warns when saving without configured storage', async () => {
      const service = new NotesAnalyticsService({ logger });
      await service.saveAnalytics();
      expect(logger.warn).toHaveBeenCalledWith(
        'Analytics: No storage configured, cannot save'
      );
    });

    it('persists analytics and logs success when storage resolves', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const storage = { save };
      const service = new NotesAnalyticsService({ logger, storage });

      service.recordNoteCreation({
        subjectType: SUBJECT_TYPES.EVENT,
        subject: 'Festival',
        text: 'Crowd gathers.',
        context: 'celebration',
      });

      await service.saveAnalytics();

      expect(save).toHaveBeenCalledWith(
        'notes-analytics',
        expect.objectContaining({ totalNotes: 1 })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Analytics: Saved to persistent storage'
      );
    });

    it('reports failures from storage.save', async () => {
      const error = new Error('disk full');
      const storage = { save: jest.fn().mockRejectedValue(error) };
      const service = new NotesAnalyticsService({ logger, storage });

      await service.saveAnalytics();

      expect(logger.error).toHaveBeenCalledWith(
        'Analytics: Failed to save',
        error
      );
    });

    it('warns when loading without configured storage', async () => {
      const service = new NotesAnalyticsService({ logger });
      await service.loadAnalytics();
      expect(logger.warn).toHaveBeenCalledWith(
        'Analytics: No storage configured, cannot load'
      );
    });

    it('loads analytics from storage and replaces metrics', async () => {
      const loadedMetrics = {
        totalNotes: 4,
        typeDistribution: { [SUBJECT_TYPES.ENTITY]: 4 },
        categorizationErrors: [],
        misclassificationPatterns: {},
        sessionData: [],
        lastReset: Date.now(),
      };

      const storage = {
        save: jest.fn(),
        load: jest.fn().mockResolvedValue(loadedMetrics),
      };
      const service = new NotesAnalyticsService({ logger, storage });

      await service.loadAnalytics();

      const summary = service.getAnalyticsSummary();
      expect(summary.summary.totalNotes).toBe(4);
      expect(summary.typeDistribution.entity).toBe('100.00');
      expect(logger.info).toHaveBeenCalledWith(
        'Analytics: Loaded from persistent storage'
      );
    });

    it('reports failures from storage.load', async () => {
      const error = new Error('corrupt payload');
      const storage = { load: jest.fn().mockRejectedValue(error), save: jest.fn() };
      const service = new NotesAnalyticsService({ logger, storage });

      await service.loadAnalytics();

      expect(logger.error).toHaveBeenCalledWith(
        'Analytics: Failed to load',
        error
      );
    });
  });
});

