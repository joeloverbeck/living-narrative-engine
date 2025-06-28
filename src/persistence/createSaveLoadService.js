// src/persistence/createSaveLoadService.js

import GameStateSerializer from './gameStateSerializer.js';
import {
  encode as msgpackEncode,
  decode as msgpackDecode,
} from '@msgpack/msgpack';
import pako from 'pako';
import ChecksumService from './checksumService.js';
import SaveFileParser from './saveFileParser.js';
import SaveValidationService from './saveValidationService.js';
import SaveFileRepository from './saveFileRepository.js';
import SaveLoadService from './saveLoadService.js';

/**
 * @description Factory function to build a {@link SaveLoadService} instance
 *   with default dependencies.
 * @param {object} deps - Dependencies for the service.
 * @param {import('../interfaces/coreServices.js').ILogger} deps.logger - Logger implementation.
 * @param {import('../interfaces/IStorageProvider.js').IStorageProvider} deps.storageProvider - Storage provider for save files.
 * @param {Crypto} [deps.crypto] - Optional Web Crypto implementation used by the serializer.
 * @returns {SaveLoadService} Configured service instance.
 */
export function createSaveLoadService({
  logger,
  storageProvider,
  crypto = globalThis.crypto,
}) {
  const checksumService = new ChecksumService({ logger, crypto });
  const serializer = new GameStateSerializer({
    logger,
    checksumService,
    encode: msgpackEncode,
    decode: msgpackDecode,
    gzip: pako.gzip,
    ungzip: pako.ungzip,
  });
  const parser = new SaveFileParser({
    logger,
    storageProvider,
    serializer,
  });
  const validationService = new SaveValidationService({
    logger,
    gameStateSerializer: serializer,
  });
  const repository = new SaveFileRepository({
    logger,
    storageProvider,
    serializer,
    parser,
  });

  return new SaveLoadService({
    logger,
    saveFileRepository: repository,
    gameStateSerializer: serializer,
    saveValidationService: validationService,
  });
}

export default createSaveLoadService;
