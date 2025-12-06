import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import NotesAnalyticsService from '../../../src/ai/notesAnalyticsService.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

/**
 * Additional coverage for NotesAnalyticsService focusing on optional branches
 * and storage edge cases.
 */
describe('NotesAnalyticsService optional branch coverage', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('omits optional report sections when all subject types have activity and no errors occur', () => {
    const service = new NotesAnalyticsService({ logger: mockLogger });

    let index = 0;
    for (const type of Object.values(SUBJECT_TYPES)) {
      service.recordNoteCreation({
        text: `Note ${index}`,
        subject: `Subject ${index}`,
        subjectType: type,
      });
      index++;
    }

    const report = service.generateReport();

    expect(report).not.toContain('## Underutilized Types (0 usage)');
    expect(report).not.toContain('## Categorization Errors');
    expect(report).not.toContain('## Top Misclassification Patterns');
  });

  it('excludes the reason line for categorization corrections when none is provided', () => {
    const service = new NotesAnalyticsService({ logger: mockLogger });
    const note = {
      text: 'Ambiguous entry',
      subject: 'Mystery',
      subjectType: SUBJECT_TYPES.EVENT,
    };

    service.recordNoteCreation(note);
    service.recordCategorizationError(
      note,
      SUBJECT_TYPES.EVENT,
      SUBJECT_TYPES.PLAN
    );

    const report = service.generateReport();

    expect(report).toContain('- **Incorrect Type:** event');
    expect(report).toContain('- **Correct Type:** plan');
    expect(report).not.toContain('**Reason:**');
  });

  it('does not log a load success message when storage returns null and retains existing metrics', async () => {
    const mockStorage = {
      save: jest.fn(),
      load: jest.fn().mockResolvedValue(null),
    };

    const service = new NotesAnalyticsService({
      logger: mockLogger,
      storage: mockStorage,
    });

    service.recordNoteCreation({
      text: 'Existing note',
      subject: 'History',
      subjectType: SUBJECT_TYPES.TIMELINE,
    });

    const beforeLoad = service.getAnalyticsSummary();

    await service.loadAnalytics();

    expect(mockStorage.load).toHaveBeenCalledWith('notes-analytics');
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      'Analytics: Loaded from persistent storage'
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      'Analytics: No storage configured, cannot load'
    );

    const afterLoad = service.getAnalyticsSummary();
    expect(afterLoad.summary.totalNotes).toBe(beforeLoad.summary.totalNotes);
    expect(afterLoad.typeDistribution.timeline).toBe(
      beforeLoad.typeDistribution.timeline
    );
  });

  it('updates the session start timestamp when analytics are reset', () => {
    const service = new NotesAnalyticsService({ logger: mockLogger });
    const initialSummary = service.getAnalyticsSummary();

    const newTimestamp = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(newTimestamp);

    service.resetAnalytics();

    const postResetSummary = service.getAnalyticsSummary();
    expect(postResetSummary.summary.sessionStart).toBe(
      new Date(newTimestamp).toISOString()
    );
    expect(postResetSummary.summary.sessionStart).not.toBe(
      initialSummary.summary.sessionStart
    );

    nowSpy.mockRestore();
  });
});
