// src/persistence/gameStateSerializer.js

import { encode, decode } from '@msgpack/msgpack';
import pako from 'pako';
import { safeDeepClone } from '../utils/objectUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from './persistenceResultUtils.js';

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
   * Executes a synchronous function and converts thrown errors into
   * standardized persistence results.
   *
   * @template T
   * @param {() => T} fn - Function to execute within the try/catch.
   * @param {string} errorCode - Code from {@link PersistenceErrorCodes}.
   * @param {string} userMsg - User friendly message for failures.
   * @returns {import('./persistenceTypes.js').PersistenceResult<T>} Result of the operation.
   * @private
   */
  #tryOperation(fn, errorCode, userMsg) {
    try {
      const data = fn();
      return createPersistenceSuccess(data);
    } catch (error) {
      this.#logger.error(`${errorCode} operation failed:`, error);
      return {
        ...createPersistenceFailure(errorCode, userMsg),
        userFriendlyError: userMsg,
      };
    }
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
   * Serializes the game state to MessagePack and compresses it with Gzip.
   * Embeds a checksum of the gameState section.
   *
   * @param {object} gameStateObject - Game state object to serialize.
   * @returns {Promise<{compressedData: Uint8Array, finalSaveObject: object}>} Resulting data and mutated object.
   */
  async serializeAndCompress(gameStateObject) {
    const cloneResult = safeDeepClone(gameStateObject, this.#logger);
    if (!cloneResult.success || !cloneResult.data) {
      throw cloneResult.error;
    }
    const finalSaveObject = cloneResult.data;

    if (
      !finalSaveObject.gameState ||
      typeof finalSaveObject.gameState !== 'object'
    ) {
      this.#logger.error(
        'Invalid or missing gameState property in save object for checksum calculation.'
      );
      throw new PersistenceError(
        PersistenceErrorCodes.INVALID_GAME_STATE,
        'Invalid gameState for checksum calculation.'
      );
    }

    finalSaveObject.integrityChecks.gameStateChecksum =
      await this.calculateGameStateChecksum(finalSaveObject.gameState);
    this.#logger.debug(
      `Calculated gameStateChecksum: ${finalSaveObject.integrityChecks.gameStateChecksum}`
    );

    this.#logger.debug('Serializing full game state object to MessagePack...');
    const messagePackData = encode(finalSaveObject);
    this.#logger.debug(
      `MessagePack Raw Size: ${messagePackData.byteLength} bytes`
    );

    this.#logger.debug('Compressing MessagePack data with Gzip...');
    const compressedData = pako.gzip(messagePackData);
    this.#logger.debug(`Gzipped Size: ${compressedData.byteLength} bytes`);

    return { compressedData, finalSaveObject };
  }

  /**
   * Decompresses Gzip-compressed data.
   *
   * @param {Uint8Array} data - Compressed data.
   * @returns {import('./persistenceTypes.js').PersistenceResult<Uint8Array>} Outcome of decompression.
   */
  decompress(data) {
    const userMsg =
      'The save file appears to be corrupted (could not decompress). Please try another save.';
    return this.#tryOperation(
      () => {
        const decompressed = pako.ungzip(data);
        this.#logger.debug(
          `Decompressed data size: ${decompressed.byteLength} bytes`
        );
        return decompressed;
      },
      PersistenceErrorCodes.DECOMPRESSION_ERROR,
      userMsg
    );
  }

  /**
   * Deserializes MessagePack data.
   *
   * @param {Uint8Array} buffer - Data to deserialize.
   * @returns {import('./persistenceTypes.js').PersistenceResult<object>} Outcome of deserialization.
   */
  deserialize(buffer) {
    const userMsg =
      'The save file appears to be corrupted (could not understand file content). Please try another save.';
    return this.#tryOperation(
      () => {
        const obj = decode(buffer);
        this.#logger.debug('Successfully deserialized MessagePack');
        return obj;
      },
      PersistenceErrorCodes.DESERIALIZATION_ERROR,
      userMsg
    );
  }
}

export default GameStateSerializer;
