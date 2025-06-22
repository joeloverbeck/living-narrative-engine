import {
  extractSaveName,
  getManualSavePath,
  manualSavePath,
} from '../utils/savePathUtils.js';
import { isValidSaveString } from './saveInputValidators.js';
import { validateSaveMetadataFields } from '../utils/saveMetadataUtils.js';
import { MSG_FILE_READ_ERROR, MSG_EMPTY_FILE } from './persistenceMessages.js';
import { PersistenceErrorCodes } from './persistenceErrors.js';
import { readAndDeserialize as utilReadAndDeserialize } from '../utils/saveFileReadUtils.js';
import { BaseService } from '../utils/serviceBase.js';

/**
 * @class SaveFileParser
 * @description
 *   Focuses exclusively on reading and parsing save files. It validates
 *   metadata and deserializes save contents but performs no write or delete
 *   operations itself.
 */
export default class SaveFileParser extends BaseService {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {import('../interfaces/IStorageProvider.js').IStorageProvider} */
  #storageProvider;
  /** @type {import('./gameStateSerializer.js').default} */
  #serializer;

  /**
   * Creates a new SaveFileParser instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {import('../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../interfaces/IStorageProvider.js').IStorageProvider} deps.storageProvider - Storage provider for file access.
   * @param {import('./gameStateSerializer.js').default} deps.serializer - Serializer for deserialization.
   */
  constructor({ logger, storageProvider, serializer }) {
    super();
    this.#serializer = serializer;
    this.#logger = this._init('SaveFileParser', logger, {
      storageProvider: {
        value: storageProvider,
        requiredMethods: ['readFile'],
      },
    });
    this.#storageProvider = storageProvider;
  }

  /**
   * Reads, decompresses and deserializes a save file.
   *
   * @param {string} filePath - File path to read.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<object>>}
   *   Parsed object or failure info.
   * @private
   */
  async #deserializeAndDecompress(filePath) {
    return utilReadAndDeserialize(
      this.#storageProvider,
      this.#serializer,
      this.#logger,
      filePath
    );
  }

  /**
   * Reads, decompresses and deserializes a save file.
   *
   * @param {string} filePath - File path to read.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<object>>}
   *   Parsed object or failure info.
   */
  async readAndDeserialize(filePath) {
    return this.#deserializeAndDecompress(filePath);
  }

  /**
   * Read, decompress and deserialize a save file.
   *
   * @param {string} filePath - File path of the save.
   * @returns {Promise<import('../interfaces/ISaveLoadService.js').SaveGameStructure|null>} Parsed object or null on failure.
   * @private
   */
  async #readAndDeserialize(filePath) {
    const deserializationResult =
      await this.#deserializeAndDecompress(filePath);
    if (!deserializationResult.success) {
      this.#logger.warn(
        `Failed to deserialize ${filePath}: ${deserializationResult.error}. Flagging as corrupted for listing.`
      );
      return null;
    }
    return /** @type {import('../interfaces/ISaveLoadService.js').SaveGameStructure} */ (
      deserializationResult.data
    );
  }

  /**
   * Validate and extract metadata from a save object.
   *
   * @param {import('../interfaces/ISaveLoadService.js').SaveGameStructure} saveObject - Parsed save data.
   * @param {string} fileName - Original file name.
   * @returns {import('./persistenceTypes.js').ParseSaveFileResult}
   *   Parsed metadata result.
   * @private
   */
  #extractMetadata(saveObject, fileName) {
    const validated = validateSaveMetadataFields(
      {
        identifier: manualSavePath(fileName),
        saveName: saveObject.metadata.saveName,
        timestamp: saveObject.metadata.timestamp,
        playtimeSeconds: saveObject.metadata.playtimeSeconds,
      },
      fileName,
      this.#logger
    );

    const { isCorrupted = false, ...metadata } = validated;
    return { metadata, isCorrupted };
  }

  /**
   * Helper for returning a corrupted metadata result.
   *
   * @param {string} filePath - Full path to the save file.
   * @param {string} fileName - Name of the save file.
   * @param {string} reason - Suffix appended to the derived save name.
   * @returns {import('./persistenceTypes.js').ParseSaveFileResult}
   *   Result marked as corrupted.
   * @private
   */
  #corruptedResult(filePath, fileName, reason) {
    return {
      metadata: {
        identifier: filePath,
        saveName: extractSaveName(fileName) + reason,
        timestamp: 'N/A',
        playtimeSeconds: 0,
      },
      isCorrupted: true,
    };
  }

  /**
   * Parses a manual save file and extracts metadata.
   *
   * @param {string} fileName - File name within manual saves directory.
   * @returns {Promise<import('./persistenceTypes.js').ParseSaveFileResult>} Parsed metadata result.
   */
  async parseManualSaveFile(fileName) {
    const isValidName = isValidSaveString(fileName);
    const filePath = isValidName
      ? getManualSavePath(extractSaveName(fileName))
      : manualSavePath(String(fileName));

    if (!isValidName) {
      this.#logger.error(`Invalid manual save file name: ${fileName}`);
      return this.#corruptedResult(filePath, fileName, ' (Invalid Name)');
    }

    this.#logger.debug(`Processing file: ${filePath}`);

    try {
      const saveObject = await this.#readAndDeserialize(filePath);
      if (!saveObject)
        return this.#corruptedResult(filePath, fileName, ' (Corrupted)');

      if (!saveObject.metadata || typeof saveObject.metadata !== 'object') {
        this.#logger.warn(
          `No metadata section found in ${filePath}. Flagging as corrupted for listing.`
        );
        return this.#corruptedResult(filePath, fileName, ' (No Metadata)');
      }

      return this.#extractMetadata(saveObject, fileName);
    } catch (error) {
      this.#logger.error(`Unexpected error parsing ${filePath}:`, error);
      return this.#corruptedResult(filePath, fileName, ' (Corrupted)');
    }
  }
}
