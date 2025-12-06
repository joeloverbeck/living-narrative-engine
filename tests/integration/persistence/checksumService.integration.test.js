import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { webcrypto, createHash } from 'crypto';
import ChecksumService from '../../../src/persistence/checksumService.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';
import { encode } from '@msgpack/msgpack';

describe('ChecksumService integration', () => {
  const originalCrypto = globalThis.crypto;
  /** @type {ConsoleLogger} */
  let logger;
  /** @type {ReturnType<typeof jest.spyOn>[]} */
  let consoleSpies;

  beforeAll(() => {
    globalThis.crypto = webcrypto;
  });

  afterAll(() => {
    globalThis.crypto = originalCrypto;
  });

  beforeEach(() => {
    consoleSpies = [
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
      jest.spyOn(console, 'group').mockImplementation(() => {}),
      jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
      jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
    ];

    logger = new ConsoleLogger(LogLevel.ERROR);
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  test('compressPreparedState applies checksum using real Web Crypto pipeline', async () => {
    const checksumService = new ChecksumService({
      logger,
      crypto: webcrypto,
    });
    const serializer = new GameStateSerializer({
      logger,
      checksumService,
    });

    const saveObject = {
      gameState: {
        actors: [
          { id: 'hero-1', stats: { hp: 42, stamina: 15 } },
          { id: 'companion-1', stats: { hp: 28, stamina: 22 } },
        ],
      },
      integrityChecks: {},
    };

    const { compressedData, finalSaveObject } =
      await serializer.compressPreparedState(saveObject);

    expect(compressedData).toBeInstanceOf(Uint8Array);
    expect(compressedData.byteLength).toBeGreaterThan(0);

    const expectedChecksum = createHash('sha256')
      .update(Buffer.from(encode(saveObject.gameState)))
      .digest('hex');

    expect(finalSaveObject.integrityChecks.gameStateChecksum).toBe(
      expectedChecksum
    );
  });

  test('generateChecksum handles raw strings and objects consistently', async () => {
    const checksumService = new ChecksumService({
      logger,
      crypto: webcrypto,
    });

    const stringInput = 'player-state::v1';
    const stringChecksum = await checksumService.generateChecksum(stringInput);
    const expectedStringChecksum = createHash('sha256')
      .update(stringInput, 'utf8')
      .digest('hex');
    expect(stringChecksum).toBe(expectedStringChecksum);

    const objectInput = {
      actor: 'hero-1',
      position: { x: 4, y: 9, facing: 'north' },
      inventory: ['sword', 'talisman'],
    };
    const objectChecksum = await checksumService.generateChecksum(objectInput);
    const expectedObjectChecksum = createHash('sha256')
      .update(JSON.stringify(objectInput), 'utf8')
      .digest('hex');
    expect(objectChecksum).toBe(expectedObjectChecksum);
  });

  test('checksum failures propagate as PersistenceError through serializer', async () => {
    const failingCrypto = {
      subtle: {
        digest: async () => {
          throw new Error('digest failure');
        },
      },
    };

    const checksumService = new ChecksumService({
      logger,
      crypto: failingCrypto,
    });
    const serializer = new GameStateSerializer({
      logger,
      checksumService,
    });

    const saveObject = {
      gameState: {
        actors: [{ id: 'hero-1' }],
      },
      integrityChecks: {},
    };

    await expect(
      serializer.compressPreparedState(saveObject)
    ).rejects.toMatchObject({
      name: PersistenceError.name,
      code: PersistenceErrorCodes.CHECKSUM_GENERATION_FAILED,
    });

    const errorCalls = consoleSpies[2].mock.calls;
    expect(
      errorCalls.some(([message]) =>
        message.includes(
          'ChecksumService: Error generating checksum using Web Crypto API:'
        )
      )
    ).toBe(true);
  });
});
