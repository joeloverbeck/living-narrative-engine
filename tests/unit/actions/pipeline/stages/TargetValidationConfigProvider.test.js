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
