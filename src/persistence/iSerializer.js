// src/persistence/iSerializer.js

/**
 * @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure
 * @typedef {import('./persistenceTypes.js').PersistenceResult} PersistenceResult
 */

/**
 * @interface ISerializer
 * @description Defines the contract for a serialization strategy, responsible
 * for converting a SaveGameStructure object to and from a Uint8Array buffer.
 */
export class ISerializer {
  /**
   * Serializes the complete game state object into a byte array.
   * This includes calculating and embedding the final checksum.
   *
   * @param {SaveGameStructure} _gameStateObject - The game state object to serialize.
   * @returns {Promise<PersistenceResult>} A result object containing the serialized data as a Uint8Array.
   * @async
   */
  async serialize(_gameStateObject) {
    throw new Error('ISerializer.serialize must be implemented');
  }

  /**
   * Deserializes a byte array back into a game state object.
   *
   * @param {Uint8Array} _data - The byte array to deserialize.
   * @returns {Promise<PersistenceResult>} A result object containing the deserialized SaveGameStructure.
   * @async
   */
  async deserialize(_data) {
    throw new Error('ISerializer.deserialize must be implemented');
  }

  /**
   * Gets the file extension associated with this serialization format (including the dot).
   *
   * @returns {string} File extension including the leading dot.
   */
  get fileExtension() {
    throw new Error('ISerializer.fileExtension getter must be implemented');
  }
}

export default ISerializer;
