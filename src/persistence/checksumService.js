// src/persistence/checksumService.js

import { BaseService } from '../utils/serviceBase.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';

/**
 * @class ChecksumService
 * @augments BaseService
 * @description Generates SHA-256 checksums using the Web Crypto API.
 */
class ChecksumService extends BaseService {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {Crypto} */
  #crypto;

  /**
   * Create a new ChecksumService.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance.
   * @param {Crypto} [dependencies.crypto] - Web Crypto implementation.
   */
  constructor({ logger, crypto = globalThis.crypto }) {
    super();
    this.#logger = this._init('ChecksumService', logger);
    this.#crypto = crypto;
  }

  /**
   * Convert an ArrayBuffer to a hexadecimal string.
   *
   * @param {ArrayBuffer} buffer - Buffer to convert.
   * @returns {string} Hex string.
   * @private
   */
  #arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate a checksum for the provided data.
   *
   * @param {any} data - Data to hash.
   * @returns {Promise<string>} Hexadecimal checksum.
   */
  async generateChecksum(data) {
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
}

export default ChecksumService;
