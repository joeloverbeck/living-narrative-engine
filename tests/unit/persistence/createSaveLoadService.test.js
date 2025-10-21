import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../src/persistence/gameStateSerializer.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../src/persistence/checksumService.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../src/persistence/saveFileParser.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../src/persistence/saveValidationService.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../src/persistence/saveFileRepository.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../src/persistence/saveLoadService.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import createSaveLoadService from '../../../src/persistence/createSaveLoadService.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import SaveValidationService from '../../../src/persistence/saveValidationService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('createSaveLoadService', () => {
  let checksumInstance;
  let serializerInstance;
  let parserInstance;
  let validationInstance;
  let repositoryInstance;
  let saveLoadInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    checksumInstance = { kind: 'checksum' };
    serializerInstance = { kind: 'serializer' };
    parserInstance = { kind: 'parser' };
    validationInstance = { kind: 'validation' };
    repositoryInstance = { kind: 'repository' };
    saveLoadInstance = { kind: 'saveLoad' };

    ChecksumService.mockImplementation(() => checksumInstance);
    GameStateSerializer.mockImplementation(() => serializerInstance);
    SaveFileParser.mockImplementation(() => parserInstance);
    SaveValidationService.mockImplementation(() => validationInstance);
    SaveFileRepository.mockImplementation(() => repositoryInstance);
    SaveLoadService.mockImplementation(() => saveLoadInstance);
  });

  it('wires together the persistence dependencies with explicit crypto', () => {
    const logger = createLogger();
    const storageProvider = { id: 'storage' };
    const crypto = { subtle: {} };

    const service = createSaveLoadService({ logger, storageProvider, crypto });

    expect(ChecksumService).toHaveBeenCalledWith({ logger, crypto });
    expect(GameStateSerializer).toHaveBeenCalledWith({
      logger,
      checksumService: checksumInstance,
    });
    expect(SaveFileParser).toHaveBeenCalledWith({
      logger,
      storageProvider,
      serializer: serializerInstance,
    });
    expect(SaveValidationService).toHaveBeenCalledWith({
      logger,
      gameStateSerializer: serializerInstance,
    });
    expect(SaveFileRepository).toHaveBeenCalledWith({
      logger,
      storageProvider,
      serializer: serializerInstance,
      parser: parserInstance,
    });
    expect(SaveLoadService).toHaveBeenCalledWith({
      logger,
      saveFileRepository: repositoryInstance,
      gameStateSerializer: serializerInstance,
      saveValidationService: validationInstance,
    });
    expect(service).toBe(saveLoadInstance);
  });

  it('falls back to global crypto when none is provided', () => {
    const logger = createLogger();
    const storageProvider = { id: 'storage' };
    const expectedCrypto = globalThis.crypto;

    const service = createSaveLoadService({ logger, storageProvider });

    expect(ChecksumService).toHaveBeenCalledWith({
      logger,
      crypto: expectedCrypto,
    });
    expect(service).toBe(saveLoadInstance);
  });
});
