import { describe, it, expect } from '@jest/globals';
import NotesAnalyticsService from '../../../src/ai/notesAnalyticsService.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  async save(key, value) {
    const snapshot = JSON.parse(JSON.stringify(value));
    this.store.set(key, snapshot);
  }

  async load(key) {
    const value = this.store.get(key);
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  snapshot(key) {
    const value = this.store.get(key);
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }
}

const createLogger = () => new ConsoleLogger(LogLevel.NONE);

const createNote = (subjectType, overrides = {}) => ({
  text: `Note about ${subjectType}`,
  subject: `Subject for ${subjectType}`,
  subjectType,
  ...overrides,
});

describe('NotesAnalyticsService - Integration', () => {
  it('tracks analytics across a full lifecycle and produces a comprehensive report', async () => {
    const storage = new MemoryStorage();
    const analytics = new NotesAnalyticsService({
      logger: createLogger(),
      storage,
    });

    const entityNote = createNote(SUBJECT_TYPES.ENTITY, { context: 'origin story' });
    const eventNote = createNote(SUBJECT_TYPES.EVENT, { text: 'Festival scheduled next week' });
    const planNote = createNote(SUBJECT_TYPES.PLAN, {
      text: 'Arrange supplies before the festival',
      context: null,
    });

    analytics.recordNoteCreation(entityNote, { tags: ['backstory'], source: 'player' });
    analytics.recordNoteCreation(eventNote, { source: 'ai' });
    analytics.recordNoteCreation(planNote);

    analytics.recordCategorizationError(
      eventNote,
      SUBJECT_TYPES.EVENT,
      SUBJECT_TYPES.PLAN,
      'This describes a future intention'
    );
    analytics.recordCategorizationError(planNote, SUBJECT_TYPES.PLAN, SUBJECT_TYPES.EVENT);

    await analytics.saveAnalytics();

    const storedMetrics = storage.snapshot('notes-analytics');
    expect(storedMetrics).toBeDefined();
    expect(storedMetrics.totalNotes).toBe(3);
    expect(storedMetrics.categorizationErrors).toHaveLength(2);

    const summary = analytics.getAnalyticsSummary();
    expect(summary.summary.totalNotes).toBe(3);
    expect(summary.summary.totalErrors).toBe(2);
    expect(summary.typeDistribution[SUBJECT_TYPES.ENTITY]).toBe('33.33');
    expect(summary.topMisclassifications).toEqual(
      expect.arrayContaining([
        { pattern: `${SUBJECT_TYPES.EVENT}→${SUBJECT_TYPES.PLAN}`, count: 1 },
        { pattern: `${SUBJECT_TYPES.PLAN}→${SUBJECT_TYPES.EVENT}`, count: 1 },
      ])
    );
    expect(summary.underutilizedTypes).toContain(SUBJECT_TYPES.KNOWLEDGE);

    const report = analytics.generateReport();
    expect(report).toContain('# Notes Categorization Analytics Report');
    expect(report).toContain('## Summary');
    expect(report).toContain('## Type Distribution');
    expect(report).toContain('## Most Used Types');
    expect(report).toContain('## Underutilized Types (0 usage)');
    expect(report).toContain('## Top Misclassification Patterns');
    expect(report).toContain('## Categorization Errors');
    expect(report).toContain(`${SUBJECT_TYPES.EVENT}→${SUBJECT_TYPES.PLAN}`);
    expect(report.match(/\*\*Reason:\*\*/g)).toHaveLength(1);
  });

  it('persists analytics through storage and restores them for a new service instance', async () => {
    const sharedStorage = new MemoryStorage();
    const firstService = new NotesAnalyticsService({
      logger: createLogger(),
      storage: sharedStorage,
    });

    const subjectTypes = Object.values(SUBJECT_TYPES);
    subjectTypes.forEach((type, index) => {
      firstService.recordNoteCreation(
        createNote(type, { text: `Detail ${index}`, context: index % 2 === 0 ? 'context' : undefined })
      );
    });
    firstService.recordCategorizationError(
      createNote(SUBJECT_TYPES.EVENT),
      SUBJECT_TYPES.EVENT,
      SUBJECT_TYPES.PLAN,
      'Scenario misclassified'
    );
    firstService.recordCategorizationError(
      createNote(SUBJECT_TYPES.ENTITY),
      SUBJECT_TYPES.ENTITY,
      SUBJECT_TYPES.STATE
    );

    await firstService.saveAnalytics();

    const restoredService = new NotesAnalyticsService({
      logger: createLogger(),
      storage: sharedStorage,
    });
    await restoredService.loadAnalytics();

    const restoredSummary = restoredService.getAnalyticsSummary();
    expect(restoredSummary.summary.totalNotes).toBe(subjectTypes.length);
    expect(restoredSummary.underutilizedTypes).toHaveLength(0);
    expect(restoredSummary.topMisclassifications[0].pattern).toBe(
      `${SUBJECT_TYPES.EVENT}→${SUBJECT_TYPES.PLAN}`
    );

    const restoredReport = restoredService.generateReport();
    expect(restoredReport).not.toContain('## Underutilized Types (0 usage)');

    restoredService.resetAnalytics();
    const resetSummary = restoredService.getAnalyticsSummary();
    expect(resetSummary.summary.totalNotes).toBe(0);
    expect(resetSummary.summary.totalErrors).toBe(0);
  });

  it('handles storage absence, missing data, and persistence failures gracefully', async () => {
    const serviceWithoutStorage = new NotesAnalyticsService({ logger: createLogger() });
    serviceWithoutStorage.recordNoteCreation(createNote(SUBJECT_TYPES.KNOWLEDGE));
    await expect(serviceWithoutStorage.saveAnalytics()).resolves.toBeUndefined();
    await expect(serviceWithoutStorage.loadAnalytics()).resolves.toBeUndefined();

    const partialStorage = new (class {
      constructor() {
        this.savedValue = null;
        this.loadCount = 0;
      }
      async save(_key, value) {
        this.savedValue = JSON.parse(JSON.stringify(value));
      }
      async load() {
        this.loadCount += 1;
        if (this.loadCount === 1) {
          return undefined;
        }
        return JSON.parse(JSON.stringify(this.savedValue));
      }
    })();

    const serviceWithPartialStorage = new NotesAnalyticsService({
      logger: createLogger(),
      storage: partialStorage,
    });
    serviceWithPartialStorage.recordNoteCreation(createNote(SUBJECT_TYPES.ENTITY));
    await serviceWithPartialStorage.saveAnalytics();
    const beforeLoadSummary = serviceWithPartialStorage.getAnalyticsSummary();
    await expect(serviceWithPartialStorage.loadAnalytics()).resolves.toBeUndefined();
    const afterFirstLoadSummary = serviceWithPartialStorage.getAnalyticsSummary();
    expect(afterFirstLoadSummary.summary.totalNotes).toBe(beforeLoadSummary.summary.totalNotes);
    await serviceWithPartialStorage.loadAnalytics();
    const afterSecondLoadSummary = serviceWithPartialStorage.getAnalyticsSummary();
    expect(afterSecondLoadSummary.summary.totalNotes).toBe(beforeLoadSummary.summary.totalNotes);

    const failingStorage = new (class {
      async save() {
        throw new Error('save failed');
      }
      async load() {
        throw new Error('load failed');
      }
    })();

    const serviceWithFailingStorage = new NotesAnalyticsService({
      logger: createLogger(),
      storage: failingStorage,
    });
    await expect(serviceWithFailingStorage.saveAnalytics()).resolves.toBeUndefined();
    await expect(serviceWithFailingStorage.loadAnalytics()).resolves.toBeUndefined();
  });
});
