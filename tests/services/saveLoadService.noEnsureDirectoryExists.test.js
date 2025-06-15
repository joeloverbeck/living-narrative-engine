import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import { webcrypto } from 'crypto';

beforeAll(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  }
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
});

/**
 *
 */
function makeDeps() {
  return {
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    storageProvider: {
      listFiles: jest.fn(),
      readFile: jest.fn(),
      writeFileAtomically: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      // intentionally no ensureDirectoryExists
    },
  };
}

describe('SaveLoadService without ensureDirectoryExists', () => {
  it('saves successfully when directory helper is absent', async () => {
    const { logger, storageProvider } = makeDeps();
    const service = new SaveLoadService({
      logger,
      storageProvider,
      crypto: webcrypto,
    });

    storageProvider.writeFileAtomically.mockResolvedValue({ success: true });

    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };

    const res = await service.saveManualGame('Slot', obj);

    expect(res.success).toBe(true);
    expect(storageProvider.writeFileAtomically).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
