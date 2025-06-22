import {
  extractSaveName,
  getManualSavePath,
  manualSavePath,
} from '../utils/savePathUtils.js';
import { validateSaveMetadataFields } from '../utils/saveMetadataUtils.js';
import { MSG_FILE_READ_ERROR, MSG_EMPTY_FILE } from './persistenceMessages.js';
import { PersistenceErrorCodes } from './persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from '../utils/persistenceResultUtils.js';
import { wrapPersistenceOperation } from '../utils/persistenceErrorUtils.js';
import { BaseService } from '../utils/serviceBase.js';

/**
 * @class SaveFileParser
 * @description Reads save files from storage and extracts metadata.
 */
export default class SaveFileParser extends BaseService {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {import('../interfaces/IStorageProvider.js').IStorageProvider} */
  #storageProvider;
  /** @type {import('./gameStateSerializer.js').default} */
  #serializer;

  /**
   * @param {object} deps
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
   * Helper to wrap persistence operations with logging.
   *
   * @param {() => Promise<any>} operationFn - Operation to execute.
   * @returns {Promise<any>} Result of the wrapped operation.
   * @private
   */
  #withLogging(operationFn) {
    return wrapPersistenceOperation(this.#logger, operationFn);
  }

  /**
   * Reads a file using the configured storage provider.
   *
   * @param {string} filePath - Path to the file.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<Uint8Array>>}
   *   Result containing file bytes or failure info.
   * @private
   */
  async #readSaveFile(filePath) {
    return this.#withLogging(async () => {
      let fileContent;
      try {
        fileContent = await this.#storageProvider.readFile(filePath);
      } catch (error) {
        const userMsg = MSG_FILE_READ_ERROR;
        this.#logger.error(`Error reading file ${filePath}:`, error);
        return {
          ...createPersistenceFailure(
            PersistenceErrorCodes.FILE_READ_ERROR,
            userMsg
          ),
          userFriendlyError: userMsg,
        };
      }

      if (!fileContent || fileContent.byteLength === 0) {
        const userMsg = MSG_EMPTY_FILE;
        this.#logger.warn(`File is empty or could not be read: ${filePath}.`);
        return {
          ...createPersistenceFailure(
            PersistenceErrorCodes.EMPTY_FILE,
            userMsg
          ),
          userFriendlyError: userMsg,
        };
      }

      return createPersistenceSuccess(fileContent);
    });
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
    return this.#withLogging(async () => {
      this.#logger.debug(
        `Attempting to read and deserialize file: ${filePath}`
      );
      const readRes = await this.#readSaveFile(filePath);
      if (!readRes.success) return readRes;

      const parseRes = this.#serializer.decompressAndDeserialize(readRes.data);
      if (!parseRes.success) return parseRes;

      return createPersistenceSuccess(parseRes.data);
    });
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
    const filePath = getManualSavePath(extractSaveName(fileName));
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
