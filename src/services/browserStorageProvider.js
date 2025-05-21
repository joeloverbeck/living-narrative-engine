// src/services/browserStorageProvider.js
import {IStorageProvider} from '../interfaces/IStorageProvider.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

export class BrowserStorageProvider extends IStorageProvider {
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {FileSystemDirectoryHandle | null} */
    #rootHandle = null;

    /**
     * @param {object} dependencies
     * @param {ILogger} dependencies.logger - The logging service.
     */
    constructor({logger}) {
        super();
        if (!logger) {
            const errorMsg = "BrowserStorageProvider requires a valid ILogger instance.";
            console.error(errorMsg); // Fallback console log if logger itself is missing
            throw new Error(errorMsg);
        }
        this.#logger = logger;
        this.#logger.debug('BrowserStorageProvider: Initialized. Will use File System Access API with user prompts.');
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
            if (await this.#rootHandle.queryPermission({mode: 'readwrite'}) === 'granted') {
                return this.#rootHandle;
            }
            this.#logger.info('Permission to root directory no longer granted. Requesting again...');
            if (await this.#rootHandle.requestPermission({mode: 'readwrite'}) === 'granted') {
                this.#logger.info('Permission re-granted to root directory.');
                return this.#rootHandle;
            }
            this.#logger.warn("Permission to root directory was revoked or denied after re-prompt.");
            this.#rootHandle = null; // Clear stale handle
            if (!promptIfMissing) {
                throw new Error("Root directory permission denied and no prompt allowed.");
            }
        }

        if (promptIfMissing) {
            try {
                this.#logger.info("Prompting user for root directory access (readwrite)...");
                const handle = await window.showDirectoryPicker({mode: 'readwrite'});
                if (await handle.queryPermission({mode: 'readwrite'}) !== 'granted') {
                    if (await handle.requestPermission({mode: 'readwrite'}) !== 'granted') {
                        this.#logger.error('Permission explicitly denied after selecting directory.');
                        throw new Error('Permission denied for the selected directory.');
                    }
                }
                this.#rootHandle = handle;
                this.#logger.info(`Root directory selected: ${this.#rootHandle.name}`);
                return this.#rootHandle;
            } catch (error) {
                if (error.name === 'AbortError') {
                    this.#logger.warn('User aborted root directory selection.');
                } else {
                    this.#logger.error('Error selecting root directory:', error);
                }
                throw new Error(`Failed to obtain root directory handle: ${error.message || 'User action or unexpected error during directory selection.'}`);
            }
        }
        throw new Error("Root directory handle not available and prompting is disabled.");
    }

    async #getRelativeDirectoryHandle(directoryPath, options = {create: false}) {
        const root = await this.#getRootDirectoryHandle(!!options.create);
        if (!root) {
            throw new Error("Root directory handle is not available.");
        }
        if (!directoryPath || directoryPath === '.' || directoryPath === '/') {
            return root;
        }

        const parts = directoryPath.replace(/^\/+|\/+$/g, '').split('/');
        let currentHandle = root;
        for (const part of parts) {
            if (!part) continue;
            try {
                currentHandle = await currentHandle.getDirectoryHandle(part, options);
            } catch (error) {
                this.#logger.error(`Failed to get/create directory handle for "${part}" in path "${directoryPath}":`, error);
                throw error;
            }
        }
        return currentHandle;
    }

    async #getRelativeFileHandle(filePath, options = {create: false}) {
        const root = await this.#getRootDirectoryHandle(!!options.create);
        if (!root) {
            throw new Error("Root directory handle is not available.");
        }

        const pathParts = filePath.replace(/^\/+|\/+$/g, '').split('/');
        if (pathParts.length === 0 || (pathParts.length === 1 && !pathParts[0])) {
            throw new Error(`Invalid file path provided: "${filePath}"`);
        }
        const fileName = pathParts.pop();
        if (!fileName) throw new Error(`Could not extract file name from path: "${filePath}"`);

        let directoryHandle = root;
        if (pathParts.length > 0) {
            const dirPath = pathParts.join('/');
            directoryHandle = await this.#getRelativeDirectoryHandle(dirPath, {create: !!options.create});
        }

        try {
            return await directoryHandle.getFileHandle(fileName, options);
        } catch (error) {
            this.#logger.error(`Failed to get/create file handle for "${fileName}" in directory "${directoryHandle.name}" (path: ${filePath}):`, error);
            throw error;
        }
    }

    async writeFileAtomically(filePath, data) {
        this.#logger.debug(`BrowserStorageProvider: Attempting to write file to ${filePath}`);
        try {
            const fileHandle = await this.#getRelativeFileHandle(filePath, {create: true});
            const writable = await fileHandle.createWritable({keepExistingData: false});
            await writable.write(data);
            await writable.close();
            this.#logger.info(`BrowserStorageProvider: Successfully wrote ${data.byteLength} bytes to file ${filePath}`);
            return {success: true};
        } catch (error) {
            this.#logger.error(`BrowserStorageProvider: Error writing file ${filePath}: ${error.message}`, error);
            return {success: false, error: error.message};
        }
    }

    async listFiles(directoryPath, pattern) {
        this.#logger.debug(`BrowserStorageProvider: Listing files in "${directoryPath}" with pattern "${pattern}"`);
        try {
            const dirHandle = await this.#getRelativeDirectoryHandle(directoryPath, {create: false});
            const matchingFiles = [];
            const regexPatternText = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
            const regexPattern = new RegExp(regexPatternText);

            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && regexPattern.test(entry.name)) {
                    matchingFiles.push(entry.name);
                }
            }
            this.#logger.info(`BrowserStorageProvider: Found ${matchingFiles.length} files in "${directoryPath}" matching "${pattern}".`);
            return matchingFiles;
        } catch (error) {
            if (error.name === 'NotFoundError') {
                this.#logger.warn(`BrowserStorageProvider: Directory not found for listing: "${directoryPath}". Returning empty list.`);
                return [];
            }
            if (error.message === "Root directory handle not available and prompting is disabled." ||
                error.message === "Root directory permission denied and no prompt allowed.") {
                // CHANGED TO .info() and rephrased message slightly
                this.#logger.info(`BrowserStorageProvider: Cannot list files from "${directoryPath}" because root directory is not yet selected/accessible for this read-only operation. A prompt to select the directory should occur on the first save attempt. Original error: ${error.message}`);
                return [];
            }
            this.#logger.error(`BrowserStorageProvider: Error listing files in "${directoryPath}": ${error.message}`, error);
            return [];
        }
    }

    async readFile(filePath) {
        this.#logger.debug(`BrowserStorageProvider: Reading file ${filePath}`);
        try {
            const fileHandle = await this.#getRelativeFileHandle(filePath, {create: false});
            const file = await fileHandle.getFile();
            const contents = await file.arrayBuffer();
            this.#logger.info(`BrowserStorageProvider: Successfully read file ${filePath}, size: ${contents.byteLength} bytes.`);
            return new Uint8Array(contents);
        } catch (error) {
            this.#logger.error(`BrowserStorageProvider: Error reading file ${filePath}: ${error.message}`, error);
            if (error.name === 'NotFoundError') {
                throw new Error(`File not found: ${filePath}. Original error: ${error.message}`);
            }
            if (error.message === "Root directory handle not available and prompting is disabled." ||
                error.message === "Root directory permission denied and no prompt allowed.") {
                throw new Error(`Cannot read file: Root directory not selected or accessible. Original error: ${error.message}`);
            }
            throw error;
        }
    }

    async deleteFile(filePath) {
        this.#logger.debug(`BrowserStorageProvider: Deleting file ${filePath}`);
        try {
            const pathParts = filePath.replace(/^\/+|\/+$/g, '').split('/');
            if (pathParts.length === 0 || (pathParts.length === 1 && !pathParts[0])) {
                throw new Error(`Invalid file path provided for deletion: "${filePath}"`);
            }
            const fileName = pathParts.pop();
            if (!fileName) throw new Error(`Could not extract file name for deletion from path: "${filePath}"`);

            let directoryHandle;
            if (pathParts.length > 0) {
                const dirPath = pathParts.join('/');
                directoryHandle = await this.#getRelativeDirectoryHandle(dirPath, {create: false});
            } else {
                directoryHandle = await this.#getRootDirectoryHandle(false);
            }

            await directoryHandle.removeEntry(fileName);
            this.#logger.info(`BrowserStorageProvider: Successfully deleted file ${filePath}`);
            return {success: true};
        } catch (error) {
            this.#logger.error(`BrowserStorageProvider: Error deleting file ${filePath}: ${error.message}`, error);
            if (error.name === 'NotFoundError') {
                return {
                    success: false,
                    error: `File not found for deletion: ${filePath}. Original error: ${error.message}`
                };
            }
            if (error.message === "Root directory handle not available and prompting is disabled." ||
                error.message === "Root directory permission denied and no prompt allowed.") {
                return {
                    success: false,
                    error: `Cannot delete file: Root directory not selected or accessible. Original error: ${error.message}`
                };
            }
            return {success: false, error: error.message};
        }
    }

    async fileExists(filePath) {
        this.#logger.debug(`BrowserStorageProvider: Checking if file exists: ${filePath}`);
        try {
            await this.#getRelativeFileHandle(filePath, {create: false});
            this.#logger.info(`BrowserStorageProvider: File exists: ${filePath}`);
            return true;
        } catch (error) {
            if (error.name === 'NotFoundError' || error.message.toLowerCase().includes('not found')) {
                this.#logger.info(`BrowserStorageProvider: File does not exist: ${filePath}`);
                return false;
            }
            if (error.message === "Root directory handle not available and prompting is disabled." ||
                error.message === "Root directory permission denied and no prompt allowed.") {
                this.#logger.info(`BrowserStorageProvider: Cannot check file existence for ${filePath} as root directory is not set/accessible and prompting is disabled. Assuming false.`);
                return false;
            }
            this.#logger.warn(`BrowserStorageProvider: Error checking file existence for ${filePath}, assuming false. Error: ${error.message}`, error);
            return false;
        }
    }
}