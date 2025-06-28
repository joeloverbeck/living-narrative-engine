/* eslint-disable jsdoc/check-tag-names */
/** @jest-environment node */
/* eslint-enable jsdoc/check-tag-names */
import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { webcrypto } from 'crypto';
import pako from 'pako';
import * as msgpack from '@msgpack/msgpack';
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

describe('GameStateSerializer persistence tests', () => {
  let serializer;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    const checksumService = new ChecksumService({ logger, crypto: webcrypto });
    serializer = new GameStateSerializer({
      logger,
      checksumService,
      encode: (...a) => msgpack.encode(...a),
      decode: (...a) => msgpack.decode(...a),
      gzip: (...a) => pako.gzip(...a),
      ungzip: (...a) => pako.ungzip(...a),
    });
  });

  it('round trips via compressPreparedState/decompress/deserialize', async () => {
    const obj = {
      metadata: { title: 'Test' },
      modManifest: {},
      gameState: { foo: 'bar' },
      integrityChecks: {},
    };

    const { compressedData, finalSaveObject } =
      await serializer.compressPreparedState(obj);
    const dec = serializer.decompress(compressedData);
    expect(dec.success).toBe(true);
    const des = serializer.deserialize(dec.data);
    expect(des.success).toBe(true);
    expect(des.data).toEqual(finalSaveObject);
  });

  it('decompress fails on invalid gzip data', () => {
    const result = serializer.decompress(new Uint8Array([1, 2, 3]));
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DECOMPRESSION_ERROR);
  });

  it('deserialize fails on malformed MessagePack', () => {
    const malformed = pako.gzip(new Uint8Array([1, 2, 3]));
    const dec = serializer.decompress(malformed);
    expect(dec.success).toBe(true);
    const des = serializer.deserialize(dec.data);
    expect(des.success).toBe(false);
    expect(des.error.code).toBe(PersistenceErrorCodes.DESERIALIZATION_ERROR);
  });

  it('decompressAndDeserialize succeeds for valid input', async () => {
    const obj = {
      metadata: { title: 'Test' },
      modManifest: {},
      gameState: { foo: 'bar' },
      integrityChecks: {},
    };
    const { compressedData, finalSaveObject } =
      await serializer.serializeAndCompress(obj);
    const res = serializer.decompressAndDeserialize(compressedData);
    expect(res.success).toBe(true);
    expect(res.data).toEqual(finalSaveObject);
  });

  it('decompressAndDeserialize propagates decompression errors', () => {
    const res = serializer.decompressAndDeserialize(new Uint8Array([1, 2, 3]));
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(PersistenceErrorCodes.DECOMPRESSION_ERROR);
  });

  it('decompressAndDeserialize propagates deserialization errors', () => {
    const malformed = pako.gzip(new Uint8Array([1, 2, 3]));
    const res = serializer.decompressAndDeserialize(malformed);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(PersistenceErrorCodes.DESERIALIZATION_ERROR);
  });

  it('generateChecksum is consistent for identical input', async () => {
    const data = { hello: 'world' };
    const first = await serializer.generateChecksum(data);
    const second = await serializer.generateChecksum(data);
    expect(first).toBe(second);
  });
});
