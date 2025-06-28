import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import SaveValidationService from '../../../src/persistence/saveValidationService.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { webcrypto } from 'crypto';
import { createMockLogger } from '../testUtils.js';

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

describe('SaveValidationService', () => {
  let logger;
  let serializer;
  let service;

  beforeEach(() => {
    logger = createMockLogger();
    const checksumService = new ChecksumService({ logger, crypto: webcrypto });
    serializer = new GameStateSerializer({ logger, checksumService });
    service = new SaveValidationService({
      logger,
      gameStateSerializer: serializer,
    });
  });

  it('validateStructure succeeds with complete object', () => {
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    const result = service.validateStructure(obj, 'id');
    expect(result).toEqual({ success: true });
  });

  it('validateStructure fails when section missing', () => {
    const obj = { metadata: {}, modManifest: {}, gameState: {} };
    const result = service.validateStructure(obj, 'bad');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
  });

  it('verifyChecksum succeeds on match', async () => {
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: { a: 1 },
      integrityChecks: {},
    };
    obj.integrityChecks.gameStateChecksum =
      await serializer.calculateGameStateChecksum(obj.gameState);
    const result = await service.verifyChecksum(obj, 'id');
    expect(result).toEqual({ success: true });
  });

  it('verifyChecksum fails when missing', async () => {
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    const result = await service.verifyChecksum(obj, 'id');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
  });

  it('verifyChecksum fails on mismatch', async () => {
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: { x: 1 },
      integrityChecks: { gameStateChecksum: 'bad' },
    };
    const result = await service.verifyChecksum(obj, 'id');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.CHECKSUM_MISMATCH);
  });

  it('validateLoadedSaveObject stops on structure failure', async () => {
    const obj = { metadata: {}, gameState: {}, integrityChecks: {} };
    const result = await service.validateLoadedSaveObject(obj, 'id');
    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });
});
