import { describe, test, expect, jest } from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import { webcrypto } from 'crypto';

/**
 *
 */
function makeDeps() {
  return {
    logger: { debug: jest.fn(), error: jest.fn() },
    storageProvider: {
      writeFileAtomically: jest.fn(),
      listFiles: jest.fn(),
      readFile: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
    },
  };
}

describe('SaveLoadService constructor validation', () => {
  test('throws if logger missing', () => {
    const deps = makeDeps();
    expect(
      () =>
        new SaveLoadService({
          storageProvider: deps.storageProvider,
          crypto: webcrypto,
        })
    ).toThrow();
  });

  test('throws if storageProvider missing', () => {
    const deps = makeDeps();
    expect(
      () => new SaveLoadService({ logger: deps.logger, crypto: webcrypto })
    ).toThrow();
  });
});
