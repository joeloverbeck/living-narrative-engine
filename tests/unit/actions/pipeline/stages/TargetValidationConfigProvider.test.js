/**
 * @file Unit tests for TargetValidationConfigProvider
 * @see src/actions/pipeline/stages/TargetValidationConfigProvider.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import TargetValidationConfigProvider from '../../../../../src/actions/pipeline/stages/TargetValidationConfigProvider.js';

describe('TargetValidationConfigProvider', () => {
  it('caches configuration snapshot after first resolution', () => {
    const loader = jest.fn(() => ({
      targetValidation: {
        enabled: true,
        strictness: 'strict',
        logDetails: false,
        performanceThreshold: 10,
        skipForActionTypes: ['SKIP_TYPE'],
        skipForMods: ['skipMod'],
      },
      performance: {
        enabled: false,
        skipNonCriticalStages: false,
      },
    }));

    const provider = new TargetValidationConfigProvider({
      configLoader: loader,
    });

    const firstSnapshot = provider.getSnapshot();
    const secondSnapshot = provider.getSnapshot();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(secondSnapshot).toBe(firstSnapshot);
    expect(firstSnapshot.validationEnabled).toBe(true);
    expect(firstSnapshot.strictness).toBe('strict');
    expect(firstSnapshot.shouldSkipAction({ type: 'SKIP_TYPE' })).toBe(true);
    expect(firstSnapshot.shouldSkipAction({ id: 'skipMod:action' })).toBe(true);
    expect(
      firstSnapshot.shouldSkipAction({ id: 'other:action', type: 'OTHER' })
    ).toBe(false);
  });

  it('invalidates the cached snapshot when requested', () => {
    const loader = jest
      .fn()
      .mockImplementationOnce(() => ({
        targetValidation: {
          enabled: true,
          strictness: 'strict',
        },
        performance: {},
      }))
      .mockImplementationOnce(() => ({
        targetValidation: {
          enabled: true,
          strictness: 'lenient',
          logDetails: true,
        },
        performance: {},
      }));

    const provider = new TargetValidationConfigProvider({
      configLoader: loader,
    });

    const first = provider.getSnapshot();
    expect(first.strictness).toBe('strict');
    expect(loader).toHaveBeenCalledTimes(1);

    provider.invalidateCache();

    const second = provider.getSnapshot();
    expect(second.strictness).toBe('lenient');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });

  it('disables validation when strictness is off and respects performance mode skipping', () => {
    const loader = jest.fn(() => ({
      targetValidation: {
        enabled: true,
        strictness: 'off',
        logDetails: true,
      },
      performance: {
        enabled: true,
        skipNonCriticalStages: true,
      },
    }));

    const provider = new TargetValidationConfigProvider({
      configLoader: loader,
    });
    const snapshot = provider.getSnapshot();

    expect(snapshot.validationEnabled).toBe(false);
    expect(snapshot.skipValidation).toBe(true);
    expect(snapshot.shouldSkipAction({ id: 'any:action', type: 'ANY' })).toBe(
      true
    );
  });

  it('returns false when provided action is not an object despite validation being enabled', () => {
    const loader = jest.fn(() => ({
      targetValidation: {
        enabled: true,
        strictness: 'strict',
      },
      performance: {},
    }));

    const provider = new TargetValidationConfigProvider({
      configLoader: loader,
    });

    const snapshot = provider.getSnapshot();

    expect(snapshot.validationEnabled).toBe(true);
    expect(snapshot.shouldSkipAction(null)).toBe(false);
    expect(snapshot.shouldSkipAction(undefined)).toBe(false);
    expect(snapshot.shouldSkipAction('not-an-object')).toBe(false);
  });

  it('skips actions when performance mode is enabled and non-critical stages are skipped', () => {
    const loader = jest.fn(() => ({
      targetValidation: {
        enabled: true,
        strictness: 'lenient',
      },
      performance: {
        enabled: true,
        skipNonCriticalStages: true,
      },
    }));

    const provider = new TargetValidationConfigProvider({
      configLoader: loader,
    });

    const snapshot = provider.getSnapshot();

    expect(snapshot.validationEnabled).toBe(true);
    expect(snapshot.shouldSkipAction({ id: 'mod:action', type: 'KEEP' })).toBe(
      true
    );
  });

  it('provides sensible defaults when the loader returns nullish configuration', () => {
    const loader = jest.fn(() => null);

    const provider = new TargetValidationConfigProvider({
      configLoader: loader,
    });

    const snapshot = provider.getSnapshot();

    expect(snapshot.validationEnabled).toBe(false);
    expect(snapshot.strictness).toBe('strict');
    expect(snapshot.skipForActionTypes).toEqual([]);
    expect(snapshot.skipForMods).toEqual([]);
    expect(snapshot.performanceModeEnabled).toBe(false);
    expect(snapshot.shouldSkipAction({ id: 42, type: 'ANY' })).toBe(true);
  });

  it('does not skip when action id is not a string and no other skip rules match', () => {
    const loader = jest.fn(() => ({
      targetValidation: {
        enabled: true,
        strictness: 'strict',
      },
      performance: {
        enabled: false,
      },
    }));

    const provider = new TargetValidationConfigProvider({
      configLoader: loader,
    });

    const snapshot = provider.getSnapshot();

    expect(snapshot.shouldSkipAction({ id: 42, type: 'ANY' })).toBe(false);
  });

  it('uses the default configuration loader when no options are provided', () => {
    const provider = new TargetValidationConfigProvider();

    const snapshot = provider.getSnapshot();

    expect(snapshot.validationEnabled).toBe(true);
    expect(snapshot.shouldSkipAction({ id: 'core:action', type: 'GENERIC' })).toBe(
      false
    );
  });
});
