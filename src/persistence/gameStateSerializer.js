// src/persistence/gameStateSerializer.js

import { encode, decode } from '@msgpack/msgpack';
import pako from 'pako';
import { cloneValidatedState } from '../utils/saveStateUtils.js';
import { BaseService } from '../utils/serviceBase.js';
import { PersistenceErrorCodes } from './persistenceErrors.js';
import {
  MSG_DECOMPRESSION_FAILED,
  MSG_DESERIALIZATION_FAILED,
} from './persistenceMessages.js';
import { executePersistenceOp } from '../utils/persistenceErrorUtils.js';
import ChecksumService from './checksumService.js';

/**
 * @class GameStateSerializer
 * @augments BaseService
 * @description Utility for converting game state objects to and from a
 * MessagePack + Gzip representation. Handles checksum generation using
 * the Web Crypto API.
 */
class GameStateSerializer extends BaseService {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {ChecksumService} */
  #checksumService;

  /**
   * Creates a new GameStateSerializer.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - Logging service.
   * @param {Crypto} [dependencies.crypto] - Web Crypto implementation.
   * @param dependencies.checksumService
   */
  constructor({ logger, checksumService }) {
    super();
    this.#checksumService = checksumService;
    this.#logger = this._init('GameStateSerializer', logger, {
      checksumService: {
        value: checksumService,
        requiredMethods: ['generateChecksum'],
      },
    });
  }

  /**
   * Public wrapper for checksum generation.
   *
   * @param {any} data - Data to hash.
   * @returns {Promise<string>} Hexadecimal checksum.
   */
  async generateChecksum(data) {
    return this.#checksumService.generateChecksum(data);
  }

  /**
   * Calculates the checksum for the provided game state object.
   *
   * @param {object} gameState - The game state to encode and hash.
   * @returns {Promise<string>} Hexadecimal checksum.
   */
  async calculateGameStateChecksum(gameState) {
    const encoded = encode(gameState);
    return this.#checksumService.generateChecksum(encoded);
  }

  /**
   * Deep clones the given object and validates the presence of a gameState section.
   *
   * @param {object} gameStateObject - Original game state structure.
   * @returns {object} Cloned and validated save object.
   * @throws {PersistenceError} When cloning fails or gameState is invalid.
   * @private
   */
  #cloneForSerialization(gameStateObject) {
    const cloneResult = cloneValidatedState(gameStateObject, this.#logger);
    if (!cloneResult.success || !cloneResult.data) {
      throw cloneResult.error;
    }

    return cloneResult.data;
  }

  /**
   * Calculates and applies the checksum for the game state section of the object.
   *
   * @param {object} clonedObj - Cloned save object with a valid gameState.
   * @returns {Promise<void>} Resolves when checksum is applied.
   * @private
   */
  async #applyChecksum(clonedObj) {
    clonedObj.integrityChecks.gameStateChecksum =
      await this.calculateGameStateChecksum(clonedObj.gameState);
    this.#logger.debug(
      `Calculated gameStateChecksum: ${clonedObj.integrityChecks.gameStateChecksum}`
    );
  }

  /**
   * Encodes the object using MessagePack and compresses it with gzip.
   *
   * @param {object} obj - Object to encode and compress.
   * @returns {{compressedData: Uint8Array, finalSaveObject: object}} Encoded data and original object.
   * @private
   */
  #encodeAndCompress(obj) {
    this.#logger.debug('Serializing full game state object to MessagePack...');
    const messagePackData = encode(obj);
    this.#logger.debug(
      `MessagePack Raw Size: ${messagePackData.byteLength} bytes`
    );

    this.#logger.debug('Compressing MessagePack data with Gzip...');
    const compressedData = pako.gzip(messagePackData);
    this.#logger.debug(`Gzipped Size: ${compressedData.byteLength} bytes`);

    return { compressedData, finalSaveObject: obj };
  }

  /**
   * Calculates the game state checksum and compresses the object.
   *
   * @param {object} obj - Save object to process.
   * @returns {Promise<{compressedData: Uint8Array, finalSaveObject: object}>}
   *   Compressed data and original object.
   * @private
   */
  async #applyChecksumAndCompress(obj) {
    await this.#applyChecksum(obj);
    return this.#encodeAndCompress(obj);
  }

  /**
   * Serializes the game state to MessagePack and compresses it with Gzip.
   * Embeds a checksum of the gameState section.
   *
   * @param {object} gameStateObject - Game state object to serialize.
   * @returns {Promise<{compressedData: Uint8Array, finalSaveObject: object}>} Resulting data and mutated object.
   */
  async serializeAndCompress(gameStateObject) {
    const finalSaveObject = this.#cloneForSerialization(gameStateObject);
    return this.#applyChecksumAndCompress(finalSaveObject);
  }

  /**
   * Compresses a pre-cloned and validated save object.
   *
   * @description Compresses a pre-cloned and validated save object.
   * @param {object} saveObj - Prepared save object.
   * @returns {Promise<{compressedData: Uint8Array, finalSaveObject: object}>}
   *   Compressed data and original object.
   */
  async compressPreparedState(saveObj) {
    return this.#applyChecksumAndCompress(saveObj);
  }

  /**
   * Decompresses Gzip-compressed data.
   *
   * @param {Uint8Array} data - Compressed data.
   * @returns {import('./persistenceTypes.js').PersistenceResult<Uint8Array>} Outcome of decompression.
   */
  decompress(data) {
    const result = executePersistenceOp({
      syncOperation: () => pako.ungzip(data),
      logger: this.#logger,
      errorCode: PersistenceErrorCodes.DECOMPRESSION_ERROR,
      userMessage: MSG_DECOMPRESSION_FAILED,
      context: 'Gzip decompression failed:',
    });
    if (result.success) {
      this.#logger.debug(
        `Decompressed data size: ${result.data.byteLength} bytes`
      );
    }
    return result;
  }

  /**
   * Deserializes MessagePack data.
   *
   * @param {Uint8Array} buffer - Data to deserialize.
   * @returns {import('./persistenceTypes.js').PersistenceResult<object>} Outcome of deserialization.
   */
  deserialize(buffer) {
    const result = executePersistenceOp({
      syncOperation: () => decode(buffer),
      logger: this.#logger,
      errorCode: PersistenceErrorCodes.DESERIALIZATION_ERROR,
      userMessage: MSG_DESERIALIZATION_FAILED,
      context: 'MessagePack deserialization failed:',
    });
    if (result.success) {
      this.#logger.debug('Successfully deserialized MessagePack');
    }
    return result;
  }

  /**
   * Decompresses and deserializes a MessagePack+gzip buffer.
   *
   * @description Convenience helper that combines {@link decompress} and
   *   {@link deserialize}.
   * @param {Uint8Array} buffer - Compressed data buffer.
   * @returns {import('./persistenceTypes.js').PersistenceResult<object>} Parsed
   *   object or encountered error.
   */
  decompressAndDeserialize(buffer) {
    const decompressed = this.decompress(buffer);
    if (!decompressed.success) return decompressed;
    return this.deserialize(decompressed.data);
  }
}

export default GameStateSerializer;
