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
});
