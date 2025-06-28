import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import { webcrypto } from 'crypto';
import { createMockSaveValidationService } from '../testUtils.js';

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
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const storageProvider = {
    listFiles: jest.fn(),
    readFile: jest.fn(),
    writeFileAtomically: jest.fn(),
    deleteFile: jest.fn(),
    fileExists: jest.fn(),
    // intentionally no ensureDirectoryExists
  };
  const checksumService = new ChecksumService({ logger, crypto: webcrypto });
  const serializer = new GameStateSerializer({ logger, checksumService });
  const parser = new SaveFileParser({ logger, storageProvider, serializer });
  const saveFileRepository = new SaveFileRepository({
    logger,
    storageProvider,
    parser,
  });
  return {
    logger,
    storageProvider,
    serializer,
    saveFileRepository,
    saveValidationService: createMockSaveValidationService(),
  };
}

describe('SaveLoadService without ensureDirectoryExists', () => {
  it('saves successfully when directory helper is absent', async () => {
    const {
      logger,
      storageProvider,
      serializer,
      saveFileRepository,
      saveValidationService,
    } = makeDeps();
    const service = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService,
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
