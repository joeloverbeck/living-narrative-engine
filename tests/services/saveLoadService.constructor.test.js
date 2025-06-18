import { describe, test, expect, jest } from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../src/persistence/saveFileRepository.js';
import GameStateSerializer from '../../src/persistence/gameStateSerializer.js';
import { webcrypto } from 'crypto';
import { createMockSaveValidationService } from '../testUtils.js';

/**
 *
 */
function makeDeps() {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
  const storageProvider = {
    writeFileAtomically: jest.fn(),
    listFiles: jest.fn(),
    readFile: jest.fn(),
    deleteFile: jest.fn(),
    fileExists: jest.fn(),
  };
  const serializer = new GameStateSerializer({ logger, crypto: webcrypto });
  const saveFileRepository = new SaveFileRepository({
    logger,
    storageProvider,
    serializer,
  });
  return {
    logger,
    storageProvider,
    serializer,
    saveFileRepository,
    saveValidationService: createMockSaveValidationService(),
  };
}

describe('SaveLoadService constructor validation', () => {
  test('throws if logger missing', () => {
    const deps = makeDeps();
    expect(
      () =>
        new SaveLoadService({
          saveFileRepository: deps.saveFileRepository,
          gameStateSerializer: deps.serializer,
          saveValidationService: deps.saveValidationService,
        })
    ).toThrow();
  });

  test('throws if saveFileRepository missing', () => {
    const deps = makeDeps();
    expect(
      () =>
        new SaveLoadService({
          logger: deps.logger,
          gameStateSerializer: deps.serializer,
          saveValidationService: deps.saveValidationService,
        })
    ).toThrow();
  });
});
