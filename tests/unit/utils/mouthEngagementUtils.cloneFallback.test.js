import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

/**
 * These tests target coverage gaps in mouthEngagementUtils by exercising the
 * clone fallback path that relies on deepClone when structuredClone is not
 * available in the environment.
 */
describe('mouthEngagementUtils clone fallback behavior', () => {
  const originalStructuredCloneDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'structuredClone'
  );

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (Reflect.has(globalThis, 'structuredClone')) {
      Reflect.deleteProperty(globalThis, 'structuredClone');
    }
  });

  afterEach(() => {
    if (originalStructuredCloneDescriptor) {
      Object.defineProperty(
        globalThis,
        'structuredClone',
        originalStructuredCloneDescriptor
      );
    } else {
      Reflect.deleteProperty(globalThis, 'structuredClone');
    }
    jest.resetModules();
  });

  test('cloneComponent falls back to deepClone when structuredClone is unavailable', async () => {
    await jest.isolateModulesAsync(async () => {
      const cloneUtilsModule = await import('../../../src/utils/cloneUtils.js');
      const deepCloneSpy = jest.spyOn(cloneUtilsModule, 'deepClone');

      const { __testing__ } = await import('../../../src/utils/mouthEngagementUtils.js');

      if (Reflect.has(globalThis, 'structuredClone')) {
        Reflect.deleteProperty(globalThis, 'structuredClone');
      }
      expect(Reflect.has(globalThis, 'structuredClone')).toBe(false);

      const component = { locked: false, forcedOverride: true };
      const cloned = __testing__.cloneComponent(component);

      expect(deepCloneSpy).toHaveBeenCalledWith(component);
      expect(cloned).toEqual(component);
      expect(cloned).not.toBe(component);

      deepCloneSpy.mockRestore();
    });
  });

  test('cloneComponent uses structuredClone when available', async () => {
    await jest.isolateModulesAsync(async () => {
      const structuredCloneMock = jest.fn((value) => ({ ...value }));
      Object.defineProperty(globalThis, 'structuredClone', {
        configurable: true,
        writable: true,
        value: structuredCloneMock,
      });

      const { __testing__ } = await import('../../../src/utils/mouthEngagementUtils.js');
      const component = { locked: false, forcedOverride: false };

      const cloned = __testing__.cloneComponent(component);

      expect(structuredCloneMock).toHaveBeenCalledWith(component);
      expect(cloned).toEqual(component);
      expect(cloned).not.toBe(component);
    });
  });
});
