import { describe, it, expect } from '@jest/globals';
import { webcrypto as nodeWebcrypto } from 'crypto';
import SaveValidationService from '../../../src/persistence/saveValidationService.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';
import {
  MSG_CHECKSUM_MISMATCH,
  MSG_INTEGRITY_CALCULATION_ERROR,
} from '../../../src/persistence/persistenceMessages.js';

const defaultCrypto =
  typeof globalThis.crypto !== 'undefined' && globalThis.crypto?.subtle
    ? globalThis.crypto
    : nodeWebcrypto;

/**
 *
 * @param customCrypto
 */
function buildValidationStack(customCrypto) {
  const logger = new NoOpLogger();
  const checksumService = new ChecksumService({
    logger,
    crypto: customCrypto ?? defaultCrypto,
  });
  const serializer = new GameStateSerializer({ logger, checksumService });
  const validationService = new SaveValidationService({
    logger,
    gameStateSerializer: serializer,
  });
  return { validationService, serializer };
}

/**
 *
 */
function makeValidSaveStructure() {
  return {
    metadata: {
      playerName: 'Ada',
      lastSaved: '2024-07-12T12:00:00.000Z',
    },
    modManifest: {
      installed: ['core', 'expansion-pack'],
    },
    gameState: {
      world: { id: 'aurora-station', day: 42 },
      actors: [
        { id: 'hero-1', traits: ['brave', 'curious'] },
        { id: 'companion-77', traits: ['loyal'] },
      ],
    },
    integrityChecks: {
      gameStateChecksum: '',
    },
  };
}

describe('SaveValidationService with real serializer + checksum stack', () => {
  it('validates a well-formed save structure and checksum end-to-end', async () => {
    const { validationService, serializer } = buildValidationStack();
    const payload = makeValidSaveStructure();
    payload.integrityChecks.gameStateChecksum = await serializer.calculateGameStateChecksum(
      payload.gameState,
    );

    const structureResult = validationService.validateStructure(payload, 'slot-alpha');
    expect(structureResult).toEqual({ success: true });

    const checksumResult = await validationService.verifyChecksum(payload, 'slot-alpha');
    expect(checksumResult).toEqual({ success: true });

    const combinedResult = await validationService.validateLoadedSaveObject(
      payload,
      'slot-alpha',
    );
    expect(combinedResult).toEqual({ success: true });
  });

  it('fails structure validation when required sections are missing or malformed', () => {
    const { validationService } = buildValidationStack();
    const malformed = makeValidSaveStructure();
    malformed.metadata = null; // Not an object as required by the schema

    const result = validationService.validateStructure(malformed, 'slot-beta');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
  });

  it('short-circuits combined validation when structure checks fail', async () => {
    const { validationService } = buildValidationStack();
    const invalid = makeValidSaveStructure();
    delete invalid.modManifest; // Remove a required section entirely

    const combinedResult = await validationService.validateLoadedSaveObject(
      invalid,
      'slot-gamma',
    );

    expect(combinedResult.success).toBe(false);
    expect(combinedResult.error).toBeInstanceOf(PersistenceError);
    expect(combinedResult.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
  });

  it('rejects saves that lack checksum data before invoking the serializer', async () => {
    const { validationService } = buildValidationStack();
    const payload = makeValidSaveStructure();
    delete payload.integrityChecks.gameStateChecksum;

    const result = await validationService.verifyChecksum(payload, 'slot-delta');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
  });

  it('propagates checksum calculation failures with domain friendly messaging', async () => {
    const failingCrypto = {
      subtle: {
        digest: async () => {
          throw new Error('digest offline');
        },
      },
    };
    const { validationService } = buildValidationStack(failingCrypto);
    const payload = makeValidSaveStructure();
    payload.integrityChecks.gameStateChecksum = 'placeholder-checksum';

    const result = await validationService.verifyChecksum(payload, 'slot-epsilon');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.CHECKSUM_CALCULATION_ERROR);
    expect(result.error.message).toBe(MSG_INTEGRITY_CALCULATION_ERROR);
  });

  it('detects checksum mismatches using the real serializer output', async () => {
    const { validationService } = buildValidationStack();
    const payload = makeValidSaveStructure();
    payload.integrityChecks.gameStateChecksum = 'definitely-not-correct';

    const result = await validationService.verifyChecksum(payload, 'slot-zeta');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.CHECKSUM_MISMATCH);
    expect(result.error.message).toBe(MSG_CHECKSUM_MISMATCH);
  });
});
