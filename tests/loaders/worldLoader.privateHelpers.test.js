import { describe, it, expect, beforeEach } from '@jest/globals';
import WorldLoader from '../../src/loaders/worldLoader.js';

/**
 * Helper to create a bare WorldLoader instance without running the constructor.
 * This allows direct testing of private helper methods.
 *
 * @returns {WorldLoader}
 */
function makeBareWorldLoader() {
  return Object.create(WorldLoader.prototype);
}

describe('WorldLoader private helpers', () => {
  let loader;

  beforeEach(() => {
    loader = makeBareWorldLoader();
  });

  it('_aggregateLoaderResult updates mod and total counts', () => {
    const modResults = {};
    const totals = {};

    loader._aggregateLoaderResult(modResults, totals, 'actions', {
      count: 2,
      overrides: 1,
      errors: 0,
    });

    expect(modResults).toEqual({
      actions: { count: 2, overrides: 1, errors: 0 },
    });
    expect(totals).toEqual({ actions: { count: 2, overrides: 1, errors: 0 } });
  });

  it('_aggregateLoaderResult handles invalid results', () => {
    const modResults = {};
    const totals = {};

    loader._aggregateLoaderResult(modResults, totals, 'rules', null);

    expect(modResults).toEqual({
      rules: { count: 0, overrides: 0, errors: 0 },
    });
    expect(totals).toEqual({ rules: { count: 0, overrides: 0, errors: 0 } });
  });

  it('_recordLoaderError increments error counts', () => {
    const modResults = { events: { count: 5, overrides: 0, errors: 0 } };
    const totals = { events: { count: 5, overrides: 0, errors: 0 } };

    loader._recordLoaderError(modResults, totals, 'events', 'boom');
    loader._recordLoaderError(modResults, totals, 'events', 'boom again');

    expect(modResults.events.errors).toBe(2);
    expect(totals.events.errors).toBe(2);
  });
});
