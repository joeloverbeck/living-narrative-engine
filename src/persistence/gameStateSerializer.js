// src/persistence/gameStateSerializer.js

import { encode, decode } from '@msgpack/msgpack';
import pako from 'pako';
import { cloneValidatedState } from '../utils/saveStateUtils.js';
import { BaseService } from '../utils/serviceBase.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
import {
  MSG_DECOMPRESSION_FAILED,
  MSG_DESERIALIZATION_FAILED,
} from './persistenceMessages.js';
import { wrapSyncPersistenceOperation } from '../utils/persistenceErrorUtils.js';

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

  /** @type {Crypto} */
  #crypto;

  /**
   * Creates a new GameStateSerializer.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - Logging service.
   * @param {Crypto} [dependencies.crypto] - Web Crypto implementation.
   */
  constructor({ logger, crypto = globalThis.crypto }) {
    super();
    this.#logger = this._init('GameStateSerializer', logger);
    this.#crypto = crypto;
  }

  /**
   * Converts an ArrayBuffer to a hexadecimal string.
   *
   * @param {ArrayBuffer} buffer - The buffer to convert.
   * @returns {string} Hexadecimal representation.
   * @private
   */
  #arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates an SHA256 checksum for the given data using Web Crypto API.
   *
   * @param {any} data - Data to hash.
   * @returns {Promise<string>} Hexadecimal checksum.
   * @private
   */
  async #generateChecksum(data) {
    let dataToHash;
    if (data instanceof Uint8Array) {
      dataToHash = data;
    } else {
      const stringToHash =
        typeof data === 'string' ? data : JSON.stringify(data);
      dataToHash = new TextEncoder().encode(stringToHash);
    }

    try {
      const hashBuffer = await this.#crypto.subtle.digest(
        'SHA-256',
        dataToHash
      );
      return this.#arrayBufferToHex(hashBuffer);
    } catch (error) {
      this.#logger.error(
        'Error generating checksum using Web Crypto API:',
        error
      );
      throw new PersistenceError(
        PersistenceErrorCodes.CHECKSUM_GENERATION_FAILED,
        `Checksum generation failed: ${error.message}`
      );
    }
  }

  /**
   * Public wrapper for checksum generation.
   *
   * @param {any} data - Data to hash.
   * @returns {Promise<string>} Hexadecimal checksum.
   */
  async generateChecksum(data) {
    return this.#generateChecksum(data);
  }

  /**
   * Calculates the checksum for the provided game state object.
   *
   * @param {object} gameState - The game state to encode and hash.
   * @returns {Promise<string>} Hexadecimal checksum.
   */
  async calculateGameStateChecksum(gameState) {
    const encoded = encode(gameState);
    return this.#generateChecksum(encoded);
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
   * Serializes the game state to MessagePack and compresses it with Gzip.
   * Embeds a checksum of the gameState section.
   *
   * @param {object} gameStateObject - Game state object to serialize.
   * @returns {Promise<{compressedData: Uint8Array, finalSaveObject: object}>} Resulting data and mutated object.
   */
  async serializeAndCompress(gameStateObject) {
    const finalSaveObject = this.#cloneForSerialization(gameStateObject);
    await this.#applyChecksum(finalSaveObject);
    return this.#encodeAndCompress(finalSaveObject);
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
    await this.#applyChecksum(saveObj);
    return this.#encodeAndCompress(saveObj);
  }

  /**
   * Decompresses Gzip-compressed data.
   *
   * @param {Uint8Array} data - Compressed data.
   * @returns {import('./persistenceTypes.js').PersistenceResult<Uint8Array>} Outcome of decompression.
   */
  decompress(data) {
    const result = wrapSyncPersistenceOperation(
      this.#logger,
      () => pako.ungzip(data),
      PersistenceErrorCodes.DECOMPRESSION_ERROR,
      MSG_DECOMPRESSION_FAILED,
      'Gzip decompression failed:'
    );
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
    const result = wrapSyncPersistenceOperation(
      this.#logger,
      () => decode(buffer),
      PersistenceErrorCodes.DESERIALIZATION_ERROR,
      MSG_DESERIALIZATION_FAILED,
      'MessagePack deserialization failed:'
    );
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
