/* eslint-disable jsdoc/check-tag-names */
/** @jest-environment node */
/* eslint-enable jsdoc/check-tag-names */
import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import GameStateSerializer from '../../src/persistence/gameStateSerializer.js';
import { PersistenceErrorCodes } from '../../src/persistence/persistenceErrors.js';
import { encode } from '@msgpack/msgpack';
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
    const compressed = pako.gzip(encode(obj));

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
});
