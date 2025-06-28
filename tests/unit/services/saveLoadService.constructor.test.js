import { describe, test, expect, jest } from '@jest/globals';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import { encode, decode } from '@msgpack/msgpack';
import pako from 'pako';
import ChecksumService from '../../../src/persistence/checksumService.js';
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
  const checksumService = new ChecksumService({ logger, crypto: webcrypto });
  const serializer = new GameStateSerializer({
    logger,
    checksumService,
    encode,
    decode,
    gzip: pako.gzip,
    ungzip: pako.ungzip,
  });
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
