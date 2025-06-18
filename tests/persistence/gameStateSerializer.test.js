/* eslint-disable jsdoc/check-tag-names */
/** @jest-environment node */
/* eslint-enable jsdoc/check-tag-names */
import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import GameStateSerializer from '../../src/persistence/gameStateSerializer.js';
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

describe('GameStateSerializer persistence tests', () => {
  let serializer;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    serializer = new GameStateSerializer({ logger, crypto: webcrypto });
  });

  it('round trips via serializeAndCompress/decompress/deserialize', async () => {
    const obj = {
      metadata: { title: 'Test' },
      modManifest: {},
      gameState: { foo: 'bar' },
      integrityChecks: {},
    };

    const { compressedData, finalSaveObject } =
      await serializer.serializeAndCompress(obj);
    const dec = serializer.decompress(compressedData);
    expect(dec.success).toBe(true);
    const des = serializer.deserialize(dec.data);
    expect(des.success).toBe(true);
    expect(des.data).toEqual(finalSaveObject);
  });

  it('generateChecksum is consistent for identical input', async () => {
    const data = { hello: 'world' };
    const first = await serializer.generateChecksum(data);
    const second = await serializer.generateChecksum(data);
    expect(first).toBe(second);
  });
});
