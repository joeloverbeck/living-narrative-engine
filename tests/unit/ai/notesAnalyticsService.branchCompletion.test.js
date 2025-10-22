import { describe, it, expect, jest } from '@jest/globals';
import NotesAnalyticsService from '../../../src/ai/notesAnalyticsService.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('NotesAnalyticsService branch completion', () => {
  it('omits the underutilized types section when every subject type has activity', () => {
    const logger = createMockLogger();
    const service = new NotesAnalyticsService({ logger });

    Object.values(SUBJECT_TYPES).forEach((type, index) => {
      service.recordNoteCreation({
        subjectType: type,
        subject: `Subject-${index}`,
        text: `Notes for ${type}`,
      });
    });

    const summary = service.getAnalyticsSummary();
    expect(summary.underutilizedTypes).toHaveLength(0);

    const report = service.generateReport();
    expect(report).not.toContain('## Underutilized Types (0 usage)');
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Underutilized Types')
    );
  });

  it('does not replace metrics when persistent storage returns a falsy payload', async () => {
    const logger = createMockLogger();
    const storage = {
      save: jest.fn(),
      load: jest.fn().mockResolvedValue(null),
    };
    const service = new NotesAnalyticsService({ logger, storage });

    const before = service.getAnalyticsSummary();
    await service.loadAnalytics();

    expect(storage.load).toHaveBeenCalledWith('notes-analytics');
    expect(logger.info).not.toHaveBeenCalledWith(
      'Analytics: Loaded from persistent storage'
    );

    const after = service.getAnalyticsSummary();
    expect(after.summary.totalNotes).toBe(before.summary.totalNotes);
    expect(after.summary.totalErrors).toBe(before.summary.totalErrors);
  });
});
