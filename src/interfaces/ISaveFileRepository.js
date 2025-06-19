// src/interfaces/ISaveFileRepository.js

/**
 * @interface ISaveFileRepository
 * @description Contract for services that manage manual save files on disk.
 */
export class ISaveFileRepository {
  /**
   * Ensures the manual save directory exists if required by the storage provider.
   *
   * @returns {Promise<import('../persistence/persistenceTypes.js').PersistenceResult<null>>}
   *   Result of the directory creation operation.
   */
  async ensureSaveDirectory() {
    throw new Error('Method ensureSaveDirectory() must be implemented.');
  }

  /**
   * Writes a save file to the specified path.
   *
   * @param {string} filePath - Full path for the save file.
   * @param {Uint8Array} data - Serialized and compressed save data.
   * @returns {Promise<import('../persistence/persistenceTypes.js').PersistenceResult<null>>}
   *   Result of the write operation.
   */
  async writeSaveFile(filePath, data) {
    throw new Error('Method writeSaveFile() must be implemented.');
  }

  /**
   * Lists manual save files available in the save directory.
   *
   * @returns {Promise<import('../persistence/persistenceTypes.js').PersistenceResult<string[]>>}
   *   Array of file names wrapped in a PersistenceResult.
   */
  async listManualSaveFiles() {
    throw new Error('Method listManualSaveFiles() must be implemented.');
  }

  /**
   * Parses metadata from a manual save file.
   *
   * @param {string} fileName - File name within the manual save directory.
   * @returns {Promise<import('../persistence/persistenceTypes.js').ParseSaveFileResult>} Parsed metadata result.
   */
  async parseManualSaveMetadata(fileName) {
    throw new Error('Method parseManualSaveMetadata() must be implemented.');
  }

  /**
   * Reads and deserializes a manual save file from disk.
   *
   * @param {string} filePath - Full path to the save file.
   * @returns {Promise<import('../persistence/persistenceTypes.js').PersistenceResult<object>>} Deserialized save data.
   */
  async readSaveFile(filePath) {
    throw new Error('Method readSaveFile() must be implemented.');
  }

  /**
   * Deletes a manual save file.
   *
   * @param {string} filePath - Full path to the save file.
   * @returns {Promise<import('../persistence/persistenceTypes.js').PersistenceResult<null>>} Result of deletion.
   */
  async deleteSaveFile(filePath) {
    throw new Error('Method deleteSaveFile() must be implemented.');
  }
}

export default ISaveFileRepository;
