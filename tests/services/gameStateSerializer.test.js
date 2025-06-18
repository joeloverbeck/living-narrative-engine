/* eslint-disable jsdoc/check-tag-names */
/** @jest-environment node */
/* eslint-enable jsdoc/check-tag-names */
import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import GameStateSerializer from '../../src/persistence/gameStateSerializer.js';
import { PersistenceErrorCodes } from '../../src/persistence/persistenceErrors.js';
import * as msgpack from '@msgpack/msgpack';
import pako from 'pako';
import { webcrypto } from 'crypto';
import { createMockLogger } from '../testUtils.js';

/**
 * @typedef {import('../../src/persistence/persistenceTypes.js').PersistenceResult<any>} PersistenceResult
 */

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

describe('GameStateSerializer', () => {
  let serializer;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    serializer = new GameStateSerializer({ logger, crypto: webcrypto });
  });

  it('decompress/deserialize round-trip succeeds', () => {
    const obj = { a: 1, nested: { b: 'c' } };
    const compressed = pako.gzip(msgpack.encode(obj));

    /** @type {PersistenceResult<Uint8Array>} */
    const decResult = serializer.decompress(compressed);
    expect(decResult.success).toBe(true);

    /** @type {PersistenceResult<object>} */
    const deserResult = serializer.deserialize(decResult.data);
    expect(deserResult.success).toBe(true);
    expect(deserResult.data).toEqual(obj);
  });

  it('decompress fails on invalid gzip data', () => {
    /** @type {PersistenceResult<Uint8Array>} */
    const result = serializer.decompress(new Uint8Array([1, 2, 3]));
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DECOMPRESSION_ERROR);
  });

  it('deserialize fails on malformed MessagePack', () => {
    const malformed = pako.gzip(new Uint8Array([1, 2, 3]));
    /** @type {PersistenceResult<Uint8Array>} */
    const dec = serializer.decompress(malformed);
    expect(dec.success).toBe(true);

    /** @type {PersistenceResult<object>} */
    const desRes = serializer.deserialize(dec.data);
    expect(desRes.success).toBe(false);
    expect(desRes.error.code).toBe(PersistenceErrorCodes.DESERIALIZATION_ERROR);
  });

  it('generateChecksum returns consistent output for same input', async () => {
    const data = { foo: 'bar', num: 42 };
    const checksum1 = await serializer.generateChecksum(data);
    const checksum2 = await serializer.generateChecksum(data);

    expect(checksum1).toBe(checksum2);
    expect(typeof checksum1).toBe('string');
    expect(checksum1.length).toBeGreaterThan(0);
  });

  it('calculateGameStateChecksum encodes and hashes the game state', async () => {
    const gameState = { level: 1, score: 10 };
    const expected = await serializer.generateChecksum(
      msgpack.encode(gameState)
    );
    const actual = await serializer.calculateGameStateChecksum(gameState);
    expect(actual).toBe(expected);
  });

  it('does not mutate the original object during serialization', async () => {
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: { foo: 'bar' },
      integrityChecks: {},
    };
    const before = JSON.parse(JSON.stringify(obj));
    await serializer.serializeAndCompress(obj);
    expect(obj).toEqual(before);
  });

  it('throws PersistenceError when deep cloning fails', async () => {
    const cyc = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    cyc.self = cyc;

    await expect(serializer.serializeAndCompress(cyc)).rejects.toThrow(
      /deep clone/i
    );
  });

  it('throws PersistenceError when gameState is invalid', async () => {
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: null,
      integrityChecks: {},
    };
    await expect(serializer.serializeAndCompress(obj)).rejects.toMatchObject({
      code: PersistenceErrorCodes.INVALID_GAME_STATE,
    });
  });

  it('propagates errors from checksum calculation', async () => {
    jest
      .spyOn(serializer, 'calculateGameStateChecksum')
      .mockRejectedValue(new Error('hash failed'));
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    await expect(serializer.serializeAndCompress(obj)).rejects.toThrow(
      /hash failed/
    );
  });

  it('throws when MessagePack encode fails', async () => {
    jest.spyOn(pako, 'gzip').mockImplementation(() => new Uint8Array());
    jest.spyOn(msgpack, 'encode').mockImplementation(() => {
      throw new Error('encode boom');
    });
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    await expect(serializer.serializeAndCompress(obj)).rejects.toThrow(
      /encode boom/
    );
    pako.gzip.mockRestore();
    msgpack.encode.mockRestore();
  });

  it('throws when gzip compression fails', async () => {
    jest.spyOn(msgpack, 'encode').mockReturnValue(new Uint8Array([1, 2]));
    jest.spyOn(pako, 'gzip').mockImplementation(() => {
      throw new Error('gzip boom');
    });
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    await expect(serializer.serializeAndCompress(obj)).rejects.toThrow(
      /gzip boom/
    );
    pako.gzip.mockRestore();
    msgpack.encode.mockRestore();
  });
});
