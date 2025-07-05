import { describe, it, expect, afterEach, jest } from '@jest/globals';

/**
 * Additional branch coverage for engineVersion.js
 * Ensures invalid SemVer strings cause an error on import.
 */
describe('ENGINE_VERSION invalid version handling', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../../../package.json');
  });

  it('throws an error when package.json version is not valid SemVer', async () => {
    jest.doMock('../../../package.json', () => ({
      default: { version: 'invalid' },
    }));

    await expect(
      import('../../../src/engine/engineVersion.js')
    ).rejects.toThrow('Invalid engine version');
  });
});
