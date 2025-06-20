import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';
import {
  setupManifests,
  getSummaryText,
} from '../../common/loaders/modsLoader.test-utils.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';
import MissingSchemaError from '../../../src/errors/missingSchemaError.js';

describe('ModsLoader helper methods', () => {
  /** @type {ReturnType<typeof createTestEnvironment>} */
  let env;
  beforeEach(() => {
    env = createTestEnvironment();
    setupManifests(env, new Map(), []);
  });

  describe('checkEssentialSchemas', () => {
    it('passes when all schemas are loaded', () => {
      expect(() => env.modsLoader._checkEssentialSchemas()).not.toThrow();
    });

    it('throws MissingSchemaError when a schema id is undefined', () => {
      const missingType = 'actions';
      const expectedLog = `ModsLoader: Essential schema type '${missingType}' is not configured (no schema ID found).`;
      const expectedErrorMsg = `Essential schema type '${missingType}' is not configured (no schema ID found).`;

      env.mockConfiguration.getContentTypeSchemaId.mockImplementation((type) =>
        type === missingType ? undefined : `schema:${type}`
      );

      let caughtError;
      try {
        env.modsLoader._checkEssentialSchemas();
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).toBeInstanceOf(MissingSchemaError);
      expect(caughtError.message).toBe(expectedErrorMsg);
      expect(caughtError.schemaId).toBeNull();
      expect(caughtError.contentType).toBe(missingType);
      expect(env.mockLogger.error).toHaveBeenCalledWith(expectedLog);
    });

    it('throws MissingSchemaError when a schema is not loaded', () => {
      const notLoadedType = 'actions';
      const notLoadedSchemaId = `schema:${notLoadedType}`;
      const expectedLog = `ModsLoader: Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;
      const expectedErrorMsg = `Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;

      env.mockConfiguration.getContentTypeSchemaId.mockImplementation((type) => {
        if (type === notLoadedType) return notLoadedSchemaId;
        return `schema:${type}`;
      });

      env.mockValidator.isSchemaLoaded.mockImplementation(
        (id) => id !== notLoadedSchemaId
      );

      let caughtError;
      try {
        env.modsLoader._checkEssentialSchemas();
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(MissingSchemaError);
      expect(caughtError.message).toBe(expectedErrorMsg);
      expect(caughtError.schemaId).toBe(notLoadedSchemaId);
      expect(caughtError.contentType).toBe(notLoadedType);
      expect(env.mockLogger.error).toHaveBeenCalledWith(expectedLog);
    });
  });

  describe('LoadResultAggregator', () => {
    it('aggregates counts into mod and total summaries', () => {
      const totals = {};
      const agg = new LoadResultAggregator(totals);
      agg.aggregate({ count: 2, overrides: 1, errors: 0 }, 'actions');
      expect(agg.modResults).toEqual({
        actions: { count: 2, overrides: 1, errors: 0 },
      });
      expect(totals).toEqual({
        actions: { count: 2, overrides: 1, errors: 0 },
      });
    });

    it('handles invalid result objects', () => {
      const totals = {};
      const agg = new LoadResultAggregator(totals);
      agg.aggregate(null, 'events');
      expect(agg.modResults).toEqual({
        events: { count: 0, overrides: 0, errors: 0 },
      });
      expect(totals).toEqual({ events: { count: 0, overrides: 0, errors: 0 } });
    });

    it('recordFailure increments error counts', () => {
      const totals = { rules: { count: 1, overrides: 0, errors: 0 } };
      const agg = new LoadResultAggregator(totals);
      agg.modResults = { rules: { count: 1, overrides: 0, errors: 0 } };
      agg.recordFailure('rules');
      agg.recordFailure('rules');
      expect(agg.modResults.rules.errors).toBe(2);
      expect(totals.rules.errors).toBe(2);
    });

    it('logs a formatted summary using WorldLoadSummaryLogger', () => {
      const totals = { actions: { count: 1, overrides: 0, errors: 0 } };
      env.modsLoader._summaryLogger.logSummary(
        env.mockLogger,
        'testWorld',
        ['core'],
        ['core'],
        0,
        totals
      );
      const summary = getSummaryText(env.mockLogger);
      expect(summary).toMatch(/actions\s+: C:1, O:0, E:0/);
      expect(summary).toMatch(/TOTAL\s+: C:1, O:0, E:0/);
    });
  });
});
