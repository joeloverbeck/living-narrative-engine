// src/services/browserStorageProvider.js
import { IStorageProvider } from '../interfaces/IStorageProvider.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

export class BrowserStorageProvider extends IStorageProvider {
     * @private
  #logger;
     * @private
  #rootHandle = null;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - The logging service.
   */
  constructor({ logger }) {
    super();
    if (!logger) {
      const errorMsg =
        'BrowserStorageProvider requires a valid ILogger instance.';
      console.error(errorMsg); // Fallback console log if logger itself is missing
      throw new Error(errorMsg);
    }
    this.#logger = logger;
    this.#logger.debug(
      'BrowserStorageProvider: Initialized. Will use File System Access API with user prompts.'
    );
  }

  /**
   * Lazily initializes and returns the root directory handle.
   * Prompts the user for directory selection if the handle is not already available or permissions are lost.
   * @private
   * @param {boolean} promptIfMissing - If true, will prompt the user if handle is missing.
   * @returns {Promise<FileSystemDirectoryHandle>} The root directory handle.
   * @throws {Error} If permission is denied or handle cannot be obtained.
   */
  async #getRootDirectoryHandle(promptIfMissing = true) {
    if (this.#rootHandle) {
      // Verify permission status
      if (
        (await this.#rootHandle.queryPermission({ mode: 'readwrite' })) ===
        'granted'
      ) {
        return this.#rootHandle;
      }
      this.#logger.info(
        'Permission to root directory no longer granted. Requesting again...'
      );
      if (
        (await this.#rootHandle.requestPermission({ mode: 'readwrite' })) ===
        'granted'
      ) {
        this.#logger.info('Permission re-granted to root directory.');
        return this.#rootHandle;
      }
      this.#logger.warn(
        'Permission to root directory was revoked or denied after re-prompt.'
      );
      this.#rootHandle = null; // Clear stale handle
      // Fall through to prompt if promptIfMissing is true
    }

    if (promptIfMissing) {
      try {
        this.#logger.info(
          'Prompting user for root directory access (readwrite)...'
        );
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        // It's good practice to also request permission immediately after getting the handle,
        // as some browsers might not make it sticky or might have stricter interpretation.
        if (
          (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted'
        ) {
          if (
            (await handle.requestPermission({ mode: 'readwrite' })) !==
            'granted'
          ) {
            this.#logger.error(
              'Permission explicitly denied after selecting directory.'
            );
            throw new Error('Permission denied for the selected directory.');
          }
        }
        this.#rootHandle = handle;
        this.#logger.info(`Root directory selected: ${this.#rootHandle.name}`);
        return this.#rootHandle;
      } catch (error) {
        if (error.name === 'AbortError') {
          this.#logger.warn('User aborted root directory selection.');
          // Let the error propagate so the caller knows the operation can't proceed.
        } else {
          this.#logger.error('Error selecting root directory:', error);
        }
        throw new Error(
          `Failed to obtain root directory handle: ${error.message || 'User action or unexpected error during directory selection.'}`
        );
      }
    }
    // If promptIfMissing is false and we reach here, it means #rootHandle was null or became null, and we are not allowed to prompt.
    throw new Error(
      'Root directory handle not available and prompting is disabled.'
    );
  }

  async #getRelativeDirectoryHandle(
    directoryPath,
    options = { create: false }
  ) {
    const root = await this.#getRootDirectoryHandle(true);

    if (!root) {
      throw new Error('Root directory handle is not available.');
    }
    // Normalize internal path before splitting
    const normalizedDirectoryPath = directoryPath.replace(/^\/+|\/+$/g, '');
    if (!normalizedDirectoryPath || normalizedDirectoryPath === '.') {
      // Root or current dir effectively
      return root;
    }

    const parts = normalizedDirectoryPath.split('/');
    let currentHandle = root;
    for (const part of parts) {
      if (!part) continue; // Should not happen after replace and split on non-empty string
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part, options);
      } catch (error) {
        // Determine if 'create' was effectively false.
        // The 'options' parameter of #getRelativeDirectoryHandle itself defaults to {create: false}.
        // The options object passed to FileSystemDirectoryHandle.getDirectoryHandle() also defaults create to false.
        const isCreateTrue = options && options.create === true;

        if (error.name === 'NotFoundError' && !isCreateTrue) {
          // Log as debug if NotFoundError occurs and we were not trying to create.
          // This is an expected situation for existence checks or listing by listFiles.
          this.#logger.debug(
            `Directory part "${part}" not found in path "${normalizedDirectoryPath}" (and create was false). This is expected by some callers. Error: ${error.message}`
          );
        } else {
          // Log as error for other types of errors, or if create was true and it still failed.
          this.#logger.error(
            `Failed to get/create directory handle for "${part}" in path "${normalizedDirectoryPath}" (options.create: ${isCreateTrue}):`,
            error
          );
        }
        throw error; // Re-throw for the caller to handle.
      }
    }
    return currentHandle;
  }

  async #getRelativeFileHandle(filePath, options = { create: false }) {
    const root = await this.#getRootDirectoryHandle(true);
    if (!root) {
      throw new Error('Root directory handle is not available.');
    }

    // Normalize internal path before splitting
    const normalizedFilePath = filePath.replace(/^\/+|\/+$/g, '');
    const pathParts = normalizedFilePath.split('/');

    if (pathParts.length === 0 || (pathParts.length === 1 && !pathParts[0])) {
      throw new Error(
        `Invalid file path provided (normalized to empty or root): "${filePath}" -> "${normalizedFilePath}"`
      );
    }
    const fileName = pathParts.pop();
    if (!fileName)
      throw new Error(
        `Could not extract file name from path (normalized): "${filePath}" -> "${normalizedFilePath}"`
      );

    let directoryHandle = root;
    if (pathParts.length > 0) {
      const dirPath = pathParts.join('/');
      directoryHandle = await this.#getRelativeDirectoryHandle(dirPath, {
        create: !!options.create,
      });
    }

    try {
      return await directoryHandle.getFileHandle(fileName, options);
    } catch (error) {
      this.#logger.error(
        `Failed to get/create file handle for "${fileName}" in directory path "${pathParts.join('/')}" (original: ${filePath}):`,
        error
      );
      throw error;
    }
  }

  async writeFileAtomically(filePath, data) {
    // --- MODIFICATION START: Normalize filePath before using it to construct tempFilePath ---
    const normalizedFilePath = filePath.replace(/^\/+|\/+$/g, '');
    this.#logger.info(
      `BrowserStorageProvider: Beginning atomic write for ${normalizedFilePath}.`
    );
    const tempFilePath = `${normalizedFilePath}.tmp`;
    // --- MODIFICATION END ---

    this.#logger.debug(
      `BrowserStorageProvider: Writing to temporary file: ${tempFilePath}`
    );
    try {
      const tempFileHandle = await this.#getRelativeFileHandle(tempFilePath, {
        create: true,
      });
      const tempWritable = await tempFileHandle.createWritable({
        keepExistingData: false,
      });
      await tempWritable.write(data);
      await tempWritable.close();
      this.#logger.info(
        `BrowserStorageProvider: Successfully wrote ${data.byteLength} bytes to temporary file ${tempFilePath}.`
      );
    } catch (error) {
      this.#logger.error(
        `BrowserStorageProvider: Error writing to temporary file ${tempFilePath}: ${error.message}`,
        error
      );
      try {
        await this.deleteFile(tempFilePath);
        this.#logger.debug(
          `BrowserStorageProvider: Cleaned up temporary file ${tempFilePath} after write failure.`
        );
      } catch (cleanupError) {
        this.#logger.warn(
          `BrowserStorageProvider: Could not clean up temporary file ${tempFilePath} after write failure: ${cleanupError.message}`,
          cleanupError
        );
      }
      return {
        success: false,
        error: `Failed to write to temporary file: ${error.message}`,
      };
    }

    this.#logger.debug(
      `BrowserStorageProvider: Writing data from memory to final file: ${normalizedFilePath}`
    );
    try {
      // Use normalizedFilePath for the final write
      const finalFileHandle = await this.#getRelativeFileHandle(
        normalizedFilePath,
        { create: true }
      );
      const finalWritable = await finalFileHandle.createWritable({
        keepExistingData: false,
      });
      await finalWritable.write(data);
      await finalWritable.close();
      this.#logger.info(
        `BrowserStorageProvider: Successfully replaced/wrote final file ${normalizedFilePath}.`
      );
    } catch (error) {
      this.#logger.error(
        `BrowserStorageProvider: Error writing to final file ${normalizedFilePath} (replacing original): ${error.message}`,
        error
      );
      return {
        success: false,
        error: `Failed to replace original file with new data: ${error.message}. Temporary data saved at ${tempFilePath}.`,
      };
    }

    this.#logger.debug(
      `BrowserStorageProvider: Cleaning up temporary file ${tempFilePath}.`
    );
    try {
      await this.deleteFile(tempFilePath);
      this.#logger.info(
        `BrowserStorageProvider: Successfully cleaned up temporary file ${tempFilePath}.`
      );
    } catch (cleanupError) {
      this.#logger.warn(
        `BrowserStorageProvider: Failed to clean up temporary file ${tempFilePath} after successful write to final path: ${cleanupError.message}`,
        cleanupError
      );
    }

    this.#logger.info(
      `BrowserStorageProvider: Atomic write to ${normalizedFilePath} completed successfully.`
    );
    return { success: true };
  }

  async listFiles(directoryPath, pattern) {
    this.#logger.debug(
      `BrowserStorageProvider: Listing files in "${directoryPath}" with pattern "${pattern}"`
    );
    try {
      const dirHandle = await this.#getRelativeDirectoryHandle(directoryPath, {
        create: false,
      });
      const matchingFiles = [];
      const regexPattern = new RegExp(pattern);

      for await (const entry of dirHandle.values()) {
        if (
          entry.kind === 'file' &&
          regexPattern.test(entry.name) &&
          !entry.name.endsWith('.tmp')
        ) {
          matchingFiles.push(entry.name);
        }
      }
      this.#logger.info(
        `BrowserStorageProvider: Found ${matchingFiles.length} files in "${directoryPath}" matching "${pattern}".`
      );
      return matchingFiles;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        this.#logger.warn(
          `BrowserStorageProvider: Directory not found for listing: "${directoryPath}". Returning empty list.`
        );
        return [];
      }
      if (
        error.message &&
        error.message.startsWith('Failed to obtain root directory handle')
      ) {
        this.#logger.warn(
          `BrowserStorageProvider: Could not list files from "${directoryPath}" as root directory selection was not completed (e.g., user cancelled). Error: ${error.message}`
        );
        return [];
      }
      this.#logger.error(
        `BrowserStorageProvider: Error listing files in "${directoryPath}": ${error.message}`,
        error
      );
      return [];
    }
  }

  async readFile(filePath) {
    this.#logger.debug(`BrowserStorageProvider: Reading file ${filePath}`);
    try {
      const fileHandle = await this.#getRelativeFileHandle(filePath, {
        create: false,
      });
      const file = await fileHandle.getFile();
      const contents = await file.arrayBuffer();
      this.#logger.info(
        `BrowserStorageProvider: Successfully read file ${filePath}, size: ${contents.byteLength} bytes.`
      );
      return new Uint8Array(contents);
    } catch (error) {
      this.#logger.error(
        `BrowserStorageProvider: Error reading file ${filePath}: ${error.message}`,
        error
      );
      if (error.name === 'NotFoundError') {
        throw new Error(
          `File not found: ${filePath}. Original error: ${error.message}`
        );
      }
      if (
        error.message &&
        error.message.startsWith('Failed to obtain root directory handle')
      ) {
        throw new Error(
          `Cannot read file: Root directory selection was not completed. Original error: ${error.message}`
        );
      }
      throw error;
    }
  }

  async deleteFile(filePath) {
    this.#logger.debug(`BrowserStorageProvider: Deleting file ${filePath}`);
    try {
      // #getRelativeFileHandle which calls #getRelativeDirectoryHandle handles path normalization internally
      const fileHandle = await this.#getRelativeFileHandle(filePath, {
        create: false,
      }); // Ensure we get handle to delete

      // To delete a file, we need its parent directory handle and the file's name.
      const normalizedFilePath = filePath.replace(/^\/+|\/+$/g, '');
      const pathParts = normalizedFilePath.split('/');
      const fileName = pathParts.pop();
      if (!fileName)
        throw new Error(
          `Could not extract file name for deletion from path: "${filePath}"`
        );

      let directoryHandle;
      if (pathParts.length > 0) {
        const dirPath = pathParts.join('/');
        directoryHandle = await this.#getRelativeDirectoryHandle(dirPath, {
          create: false,
        });
      } else {
        directoryHandle = await this.#getRootDirectoryHandle(true);
      }

      await directoryHandle.removeEntry(fileName);
      this.#logger.info(
        `BrowserStorageProvider: Successfully deleted file ${normalizedFilePath}`
      );
      return { success: true };
    } catch (error) {
      this.#logger.error(
        `BrowserStorageProvider: Error deleting file ${filePath}: ${error.message}`,
        error
      );
      if (error.name === 'NotFoundError') {
        return {
          success: true,
          error: `File not found for deletion (considered success): ${filePath}. Original error: ${error.message}`,
        };
      }
      if (
        error.message &&
        error.message.startsWith('Failed to obtain root directory handle')
      ) {
        return {
          success: false,
          error: `Cannot delete file: Root directory selection was not completed. Original error: ${error.message}`,
        };
      }
      return { success: false, error: error.message };
    }
  }

  async fileExists(filePath) {
    this.#logger.debug(
      `BrowserStorageProvider: Checking if file exists: ${filePath}`
    );
    try {
      await this.#getRelativeFileHandle(filePath, { create: false });
      this.#logger.info(
        `BrowserStorageProvider: File exists: ${filePath.replace(/^\/+|\/+$/g, '')}`
      );
      return true;
    } catch (error) {
      if (
        error.name === 'NotFoundError' ||
        (error.message && error.message.toLowerCase().includes('not found'))
      ) {
        this.#logger.info(
          `BrowserStorageProvider: File does not exist: ${filePath.replace(/^\/+|\/+$/g, '')}`
        );
        return false;
      }
      if (
        error.message &&
        error.message.startsWith('Failed to obtain root directory handle')
      ) {
        this.#logger.info(
          `BrowserStorageProvider: Cannot check file existence for ${filePath.replace(/^\/+|\/+$/g, '')} as root directory selection was not completed. Assuming false. Error: ${error.message}`
        );
        return false;
      }
      this.#logger.warn(
        `BrowserStorageProvider: Error checking file existence for ${filePath.replace(/^\/+|\/+$/g, '')}, assuming false. Error: ${error.message}`,
        error
      );
      return false;
    }
  }
}
