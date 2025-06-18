// src/persistence/gameStateSerializer.js

import { encode, decode } from '@msgpack/msgpack';
import pako from 'pako';
import { cloneAndValidateSaveState } from '../utils/saveStateUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
import {
  MSG_DECOMPRESSION_FAILED,
  MSG_DESERIALIZATION_FAILED,
} from './persistenceMessages.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from '../utils/persistenceResultUtils.js';

/**
 * @class GameStateSerializer
 * @description Utility for converting game state objects to and from a
 * MessagePack + Gzip representation. Handles checksum generation using
 * the Web Crypto API.
 */
class GameStateSerializer {
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
    if (!logger) {
      throw new Error('GameStateSerializer requires a logger.');
    }
    this.#logger = logger;
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
    const cloneResult = cloneAndValidateSaveState(
      gameStateObject,
      this.#logger
    );
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
   * Decompresses Gzip-compressed data.
   *
   * @param {Uint8Array} data - Compressed data.
   * @returns {import('./persistenceTypes.js').PersistenceResult<Uint8Array>} Outcome of decompression.
   */
  decompress(data) {
    try {
      const decompressed = pako.ungzip(data);
      this.#logger.debug(
        `Decompressed data size: ${decompressed.byteLength} bytes`
      );
      return createPersistenceSuccess(decompressed);
    } catch (error) {
      const userMsg = MSG_DECOMPRESSION_FAILED;
      this.#logger.error('Gzip decompression failed:', error);
      return {
        ...createPersistenceFailure(
          PersistenceErrorCodes.DECOMPRESSION_ERROR,
          userMsg
        ),
        userFriendlyError: userMsg,
      };
    }
  }

  /**
   * Deserializes MessagePack data.
   *
   * @param {Uint8Array} buffer - Data to deserialize.
   * @returns {import('./persistenceTypes.js').PersistenceResult<object>} Outcome of deserialization.
   */
  deserialize(buffer) {
    try {
      const obj = decode(buffer);
      this.#logger.debug('Successfully deserialized MessagePack');
      return createPersistenceSuccess(obj);
    } catch (error) {
      const userMsg = MSG_DESERIALIZATION_FAILED;
      this.#logger.error('MessagePack deserialization failed:', error);
      return {
        ...createPersistenceFailure(
          PersistenceErrorCodes.DESERIALIZATION_ERROR,
          userMsg
        ),
        userFriendlyError: userMsg,
      };
    }
  }
}

export default GameStateSerializer;
