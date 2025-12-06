// llm-proxy-server/src/interfaces/IFileSystemReader.js
/**
 * @interface IFileSystemReader
 * @description Defines an interface for reading files from the file system.
 */

/**
 * @typedef {object} InterfaceMethodMetadata
 * @property {string} name - Name of the method in the interface contract.
 * @property {string} description - Summary of what the method must accomplish.
 * @property {Array<{name: string, type: string}>} params - Expected parameters.
 * @property {string} returns - Description of the return value.
 */

/**
 * @typedef {object} InterfaceMetadata
 * @property {string} name - Interface identifier.
 * @property {string} description - High-level purpose of the interface.
 * @property {InterfaceMethodMetadata[]} methods - Contracted methods.
 */

/**
 * Runtime metadata describing the IFileSystemReader contract.
 * @type {Readonly<InterfaceMetadata>}
 */
export const IFileSystemReaderMetadata = Object.freeze({
  name: 'IFileSystemReader',
  description:
    'Defines the minimal contract required for asynchronous file reads.',
  methods: [
    {
      name: 'readFile',
      description: 'Asynchronously reads the entire contents of a file.',
      params: [
        { name: 'filePath', type: 'string' },
        { name: 'encoding', type: 'string' },
      ],
      returns: 'Promise<string>',
    },
  ],
});
