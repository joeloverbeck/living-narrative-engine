import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { webcrypto } from 'node:crypto';

import {
  readSaveFile,
  readAndDeserialize,
  deserializeAndDecompress,
} from '../../../src/utils/saveFileReadUtils.js';
import {
  MSG_FILE_READ_ERROR,
  MSG_EMPTY_FILE,
  MSG_DECOMPRESSION_FAILED,
} from '../../../src/persistence/persistenceMessages.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

describe('saveFileReadUtils integration', () => {
  let logger;

  beforeEach(() => {
    logger = new RecordingLogger();
  });

  it('converts storage provider failures into persistence failures with user-friendly context', async () => {
    const failingError = new Error('Permission denied');
    failingError.code = 'EACCES';

    const storageProvider = {
      async readFile() {
        throw failingError;
      },
    };

    const result = await readSaveFile(
      storageProvider,
      logger,
      '/tmp/save-slot.sav'
    );

    expect(result.success).toBe(false);
    expect(result.userFriendlyError).toBe(MSG_FILE_READ_ERROR);
    expect(result.error.code).toBe(PersistenceErrorCodes.FILE_READ_ERROR);
    expect(result.error.message).toContain('EACCES');

    const [logMessage, loggedError] = logger.errorLogs.at(-1);
    expect(logMessage).toContain('Error reading file /tmp/save-slot.sav');
    expect(loggedError).toBe(failingError);
  });

  it('flags empty files as failures and emits diagnostic warnings', async () => {
    const storageProvider = {
      async readFile() {
        return new Uint8Array();
      },
    };

    const result = await readSaveFile(
      storageProvider,
      logger,
      '/tmp/empty-slot.sav'
    );

    expect(result.success).toBe(false);
    expect(result.userFriendlyError).toBe(MSG_EMPTY_FILE);
    expect(result.error.code).toBe(PersistenceErrorCodes.EMPTY_FILE);

    const [warnMessage] = logger.warnLogs.at(-1);
    expect(warnMessage).toContain(
      'File is empty or could not be read: /tmp/empty-slot.sav'
    );
  });

  it('falls back to error messages when storage provider exceptions omit codes', async () => {
    const storageProvider = {
      async readFile() {
        throw new Error('Disk detached unexpectedly');
      },
    };

    const result = await readSaveFile(
      storageProvider,
      logger,
      '/tmp/faulty-slot.sav'
    );

    expect(result.success).toBe(false);
    expect(result.error.message).toContain('Disk detached unexpectedly');
    expect(result.userFriendlyError).toBe(MSG_FILE_READ_ERROR);
  });

  it('defaults to the friendly message when no error details are provided', async () => {
    const storageProvider = {
      async readFile() {
        // Throw an object without message/code to trigger the final fallback.
        throw {};
      },
    };

    const result = await readSaveFile(
      storageProvider,
      logger,
      '/tmp/blank-slot.sav'
    );

    expect(result.success).toBe(false);
    expect(result.error.message).toBe(MSG_FILE_READ_ERROR);
    expect(result.userFriendlyError).toBe(MSG_FILE_READ_ERROR);
  });

  it('reads, decompresses, and deserializes save files using the real serializer pipeline', async () => {
    const persistenceLogger = new RecordingLogger();
    const checksumLogger = new RecordingLogger();
    const checksumService = new ChecksumService({
      logger: checksumLogger,
      crypto: webcrypto,
    });
    const serializer = new GameStateSerializer({
      logger: persistenceLogger,
      checksumService,
    });

    const sampleSaveObject = {
      gameState: {
        player: { name: 'Ara', level: 7 },
      },
      integrityChecks: {
        gameStateChecksum: '',
      },
    };

    const { compressedData, finalSaveObject } =
      await serializer.serializeAndCompress(sampleSaveObject);

    const storageProvider = {
      async readFile(requestedPath) {
        expect(requestedPath).toBe('/tmp/full-slot.sav');
        // Return a fresh copy to emulate file IO boundaries.
        return new Uint8Array(compressedData);
      },
    };

    const result = await readAndDeserialize(
      storageProvider,
      serializer,
      logger,
      '/tmp/full-slot.sav'
    );

    expect(result.success).toBe(true);
    expect(result.data.gameState.player.name).toBe('Ara');
    expect(result.data.integrityChecks.gameStateChecksum).toBe(
      finalSaveObject.integrityChecks.gameStateChecksum
    );

    const [debugMessage] = logger.debugLogs[0];
    expect(debugMessage).toContain(
      'Attempting to read and deserialize file: /tmp/full-slot.sav'
    );
  });

  it('propagates read failures without invoking serializer pipelines', async () => {
    const storageProvider = {
      async readFile() {
        return new Uint8Array();
      },
    };

    const serializer = {
      decompressAndDeserialize: jest.fn(() => ({ success: true, data: {} })),
    };

    const result = await readAndDeserialize(
      storageProvider,
      serializer,
      logger,
      '/tmp/guard-slot.sav'
    );

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.EMPTY_FILE);
    expect(serializer.decompressAndDeserialize).not.toHaveBeenCalled();
  });

  it('surfaces serializer failures when decompression is impossible', () => {
    const checksumLogger = new RecordingLogger();
    const serializerLogger = new RecordingLogger();
    const checksumService = new ChecksumService({
      logger: checksumLogger,
      crypto: webcrypto,
    });
    const serializer = new GameStateSerializer({
      logger: serializerLogger,
      checksumService,
    });

    const malformedBuffer = new Uint8Array([0x01, 0x02, 0x03]);
    const result = deserializeAndDecompress(
      serializer,
      logger,
      malformedBuffer
    );

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.DECOMPRESSION_ERROR);
    expect(result.userFriendlyError).toBe(MSG_DECOMPRESSION_FAILED);

    const [contextMessage] = serializerLogger.errorLogs.at(-1);
    expect(contextMessage).toBe(
      'GameStateSerializer: Gzip decompression failed:'
    );
  });
});
