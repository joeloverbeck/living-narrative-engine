// tests/integration/persistence/gameStateSerializer.integration.test.js
import {
  describe,
  beforeAll,
  beforeEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { webcrypto } from 'crypto';
import { encode } from '@msgpack/msgpack';
import pako from 'pako';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import { cloneAndPrepareState } from '../../../src/persistence/savePreparation.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const buildGameState = () => ({
  metadata: { title: 'Integration World' },
  modManifest: { activeMods: [{ modId: 'core', version: '1.0.0' }] },
  gameState: {
    world: { id: 'world-1', name: 'Integration World' },
    actors: [{ id: 'hero', location: 'world-1' }],
  },
  integrityChecks: {},
});

describe('GameStateSerializer integration', () => {
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

  let logger;
  let serializer;

  beforeEach(() => {
    logger = buildLogger();
    const checksumService = new ChecksumService({ logger, crypto: webcrypto });
    serializer = new GameStateSerializer({ logger, checksumService });
  });

  test('compressPreparedState integrates with checksum service and round-trips payloads', async () => {
    const initialState = buildGameState();
    const preparedResult = cloneAndPrepareState(
      'ManualSlot',
      initialState,
      logger
    );
    expect(preparedResult.success).toBe(true);
    const preparedState = preparedResult.data;

    const { compressedData, finalSaveObject } =
      await serializer.compressPreparedState(preparedState);

    expect(finalSaveObject).toBe(preparedState);
    expect(finalSaveObject.metadata.saveName).toBe('ManualSlot');

    const checksum = finalSaveObject.integrityChecks.gameStateChecksum;
    expect(typeof checksum).toBe('string');

    const recomputed = await serializer.calculateGameStateChecksum(
      finalSaveObject.gameState
    );
    expect(checksum).toBe(recomputed);

    const encodedGameState = encode(finalSaveObject.gameState);
    const directChecksum = await serializer.generateChecksum(encodedGameState);
    expect(directChecksum).toBe(recomputed);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Calculated gameStateChecksum: ${checksum}`)
    );

    const roundTrip = serializer.decompressAndDeserialize(compressedData);
    expect(roundTrip.success).toBe(true);
    expect(roundTrip.data).toEqual(finalSaveObject);

    const rawState = buildGameState();
    const serialized = await serializer.serializeAndCompress(rawState);
    expect(serialized.finalSaveObject).not.toBe(rawState);
    expect(serialized.finalSaveObject.integrityChecks.gameStateChecksum).toBe(
      recomputed
    );
    const fromSerialize = serializer.decompressAndDeserialize(
      serialized.compressedData
    );
    expect(fromSerialize.success).toBe(true);
    expect(fromSerialize.data).toEqual(serialized.finalSaveObject);
  });

  test('serializeAndCompress surfaces validation errors for invalid save objects', async () => {
    const invalidState = {
      metadata: { title: 'Broken Save' },
      integrityChecks: {},
    };

    await expect(
      serializer.serializeAndCompress(invalidState)
    ).rejects.toMatchObject({
      code: PersistenceErrorCodes.INVALID_GAME_STATE,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Invalid or missing gameState property in save object.'
      )
    );
  });

  test('decompressAndDeserialize reports deserialization failures when payload is tampered', async () => {
    const baseState = buildGameState();
    const preparedResult = cloneAndPrepareState(
      'TamperedSlot',
      baseState,
      logger
    );
    expect(preparedResult.success).toBe(true);
    const { compressedData } = await serializer.compressPreparedState(
      preparedResult.data
    );

    const decompressed = serializer.decompress(compressedData);
    expect(decompressed.success).toBe(true);

    const truncated = decompressed.data.slice(0, -1);
    const recompressed = pako.gzip(truncated);

    const result = serializer.decompressAndDeserialize(recompressed);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DESERIALIZATION_ERROR);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('MessagePack deserialization failed:'),
      expect.anything()
    );
  });

  test('decompressAndDeserialize returns decompression errors for invalid gzip input', () => {
    const result = serializer.decompressAndDeserialize(
      new Uint8Array([1, 2, 3, 4])
    );
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DECOMPRESSION_ERROR);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Gzip decompression failed:'),
      expect.anything()
    );
  });
});
