/**
 * @file Unit tests for anatomy constants
 */

import {
  LIMB_DETACHED_EVENT_ID,
  MAX_RECURSION_DEPTH,
  DEFAULT_MAX_PATH_LENGTH,
  ANATOMY_CLOTHING_CACHE_CONFIG,
  ANATOMY_CONSTANTS,
} from '../../../../src/anatomy/constants/anatomyConstants.js';

const expectedCacheConfig = {
  MAX_SIZE: 500,
  TTL: 300000,
  UPDATE_AGE_ON_GET: true,
  MAX_MEMORY_USAGE: 104857600,
  TYPE_CONFIGS: {
    BLUEPRINT: {
      MAX_SIZE_MULTIPLIER: 2,
      TTL_MULTIPLIER: 2,
    },
    AVAILABLE_SLOTS: {
      MAX_SIZE_MULTIPLIER: 1,
      TTL_MULTIPLIER: 0.5,
    },
  },
};

describe('anatomyConstants', () => {
  it('exposes the expected limb detached event id', () => {
    expect(LIMB_DETACHED_EVENT_ID).toBe('anatomy:limb_detached');
  });

  it('defines recursion and path limits for anatomy traversal', () => {
    expect(MAX_RECURSION_DEPTH).toBe(100);
    expect(DEFAULT_MAX_PATH_LENGTH).toBe(50);
  });

  it('provides the full cache configuration for anatomy-clothing integration', () => {
    expect(ANATOMY_CLOTHING_CACHE_CONFIG).toEqual(expectedCacheConfig);
    expect(Object.isFrozen(ANATOMY_CLOTHING_CACHE_CONFIG)).toBe(false);
  });

  it('aggregates constants without cloning references', () => {
    expect(ANATOMY_CONSTANTS).toMatchObject({
      LIMB_DETACHED_EVENT_ID,
      MAX_RECURSION_DEPTH,
      DEFAULT_MAX_PATH_LENGTH,
      ANATOMY_CLOTHING_CACHE_CONFIG,
    });

    expect(ANATOMY_CONSTANTS.ANATOMY_CLOTHING_CACHE_CONFIG).toBe(
      ANATOMY_CLOTHING_CACHE_CONFIG
    );
  });
});
