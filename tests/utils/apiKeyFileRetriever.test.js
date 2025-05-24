// test/utils/ApiKeyFileRetriever.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {getApiKeyFromFile} from '../../src/utils/apiKeyFileRetriever.js'; // Adjust path as needed

// Mock 'node:fs/promises'
const mockReadFile = jest.fn();
jest.mock('node:fs/promises', () => ({
    readFile: (...args) => mockReadFile(...args),
}));

// Mock 'node:path'
const mockPathJoin = jest.fn();
const mockPathBasename = jest.fn();
jest.mock('node:path', () => ({
    join: (...args) => mockPathJoin(...args),
    basename: (...args) => mockPathBasename(...args),
}));

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

describe('ApiKeyFileRetriever', () => {
    /** @type {ReturnType<typeof mockLogger>} */
    let loggerMock;
    const projectRoot = '/test/project/root';
    const validFileName = 'api_key.txt';
    const validKeyContent = '  test_api_key_12345  ';
    const trimmedValidKey = 'test_api_key_12345';
    const fullPath = `${projectRoot}/${validFileName}`; // Simplified for mock setup

    beforeEach(() => {
        jest.clearAllMocks();
        loggerMock = mockLogger();

        // Setup default mock implementations for path
        mockPathJoin.mockImplementation((...segments) => segments.join('/'));
        mockPathBasename.mockImplementation(p => p.split('/').pop() || '');

        // Default mock for readFile (successful)
        mockReadFile.mockResolvedValue(validKeyContent);
        mockPathBasename.mockReturnValue(validFileName); // Default to fileName being safe
    });

    test('AC1: should retrieve and trim an API key from a mock file successfully', async () => {
        const key = await getApiKeyFromFile(validFileName, projectRoot, loggerMock);
        expect(key).toBe(trimmedValidKey);
        expect(mockPathJoin).toHaveBeenCalledWith(projectRoot, validFileName);
        expect(mockReadFile).toHaveBeenCalledWith(fullPath, 'utf-8');
        expect(loggerMock.debug).toHaveBeenCalledWith(`ApiKeyFileRetriever: Successfully retrieved API key from '${fullPath}'. Key length: ${trimmedValidKey.length}`);
    });

    test('AC2: should trim whitespace from the retrieved key', async () => {
        mockReadFile.mockResolvedValueOnce('  \n  spaced_key  \t  ');
        const key = await getApiKeyFromFile(validFileName, projectRoot, loggerMock);
        expect(key).toBe('spaced_key');
    });

    test('AC3: should return null and log a warning if file not found (ENOENT)', async () => {
        const error = new Error("File not found");
        error.code = 'ENOENT';
        mockReadFile.mockRejectedValueOnce(error);

        const key = await getApiKeyFromFile(validFileName, projectRoot, loggerMock);
        expect(key).toBeNull();
        expect(loggerMock.warn).toHaveBeenCalledWith(`ApiKeyFileRetriever: API key file '${fullPath}' not found or not readable. Error code: ENOENT.`);
    });

    test('AC4: should return null and log a warning for an empty API key file', async () => {
        mockReadFile.mockResolvedValueOnce('    '); // Only whitespace
        const key = await getApiKeyFromFile(validFileName, projectRoot, loggerMock);
        expect(key).toBeNull();
        expect(loggerMock.warn).toHaveBeenCalledWith(`ApiKeyFileRetriever: API key file '${fullPath}' is empty or contains only whitespace.`);
    });

    test('AC4: should return null and log a warning for an API key file with only newlines', async () => {
        mockReadFile.mockResolvedValueOnce('\n\n');
        const key = await getApiKeyFromFile(validFileName, projectRoot, loggerMock);
        expect(key).toBeNull();
        expect(loggerMock.warn).toHaveBeenCalledWith(`ApiKeyFileRetriever: API key file '${fullPath}' is empty or contains only whitespace.`);
    });

    test('AC5: should log an error and return null for other file read errors (e.g., EACCES)', async () => {
        const accessError = new Error("Permission denied");
        accessError.code = 'EACCES';
        mockReadFile.mockRejectedValueOnce(accessError);

        const key = await getApiKeyFromFile(validFileName, projectRoot, loggerMock);
        expect(key).toBeNull();
        expect(loggerMock.warn).toHaveBeenCalledWith(`ApiKeyFileRetriever: API key file '${fullPath}' not found or not readable. Error code: EACCES.`);
    });

    test('AC5: should log an error and throw for unexpected file read errors', async () => {
        const unexpectedError = new Error("Unexpected disk failure");
        // No specific code like ENOENT or EACCES
        mockReadFile.mockRejectedValueOnce(unexpectedError);

        await expect(getApiKeyFromFile(validFileName, projectRoot, loggerMock)).rejects.toThrow(`Failed to read API key file '${fullPath}': ${unexpectedError.message}`);
        expect(loggerMock.error).toHaveBeenCalledWith(
            `ApiKeyFileRetriever: Unexpected error reading API key file '${fullPath}'. Error: ${unexpectedError.message}`,
            expect.objectContaining({errorCode: undefined, errorDetails: unexpectedError})
        );
    });


    test('AC6: should use path.join for correct path construction', async () => {
        await getApiKeyFromFile(validFileName, projectRoot, loggerMock);
        expect(mockPathJoin).toHaveBeenCalledWith(projectRoot, validFileName);
    });

    test('AC6: should use path.basename for security against basic path traversal', async () => {
        const traversalAttempt = '../sensitive/key.txt';
        const expectedBaseName = 'key.txt';
        mockPathBasename.mockReturnValueOnce(expectedBaseName); // Simulate basename extraction

        await getApiKeyFromFile(traversalAttempt, projectRoot, loggerMock);
        expect(mockPathBasename).toHaveBeenCalledWith(traversalAttempt);
        expect(mockPathJoin).toHaveBeenCalledWith(projectRoot, expectedBaseName); // Uses the cleaned basename
        expect(loggerMock.warn).toHaveBeenCalledWith(`ApiKeyFileRetriever: Original fileName '${traversalAttempt}' was normalized to '${expectedBaseName}' to prevent path traversal. Ensure the provided fileName is just the file's name.`);
    });

    test('should throw error if fileName is not a non-empty string', async () => {
        await expect(getApiKeyFromFile('', projectRoot, loggerMock)).rejects.toThrow("'fileName' parameter must be a non-empty string.");
        expect(loggerMock.error).toHaveBeenCalledWith("ApiKeyFileRetriever: 'fileName' parameter must be a non-empty string.", {fileName: ''});

        await expect(getApiKeyFromFile(null, projectRoot, loggerMock)).rejects.toThrow("'fileName' parameter must be a non-empty string.");
        expect(loggerMock.error).toHaveBeenCalledWith("ApiKeyFileRetriever: 'fileName' parameter must be a non-empty string.", {fileName: null});
    });

    test('should throw error if projectRootPath is not a non-empty string', async () => {
        await expect(getApiKeyFromFile(validFileName, '', loggerMock)).rejects.toThrow("'projectRootPath' parameter must be a non-empty string.");
        expect(loggerMock.error).toHaveBeenCalledWith("ApiKeyFileRetriever: 'projectRootPath' parameter must be a non-empty string.", {projectRootPath: ''});

        await expect(getApiKeyFromFile(validFileName, null, loggerMock)).rejects.toThrow("'projectRootPath' parameter must be a non-empty string.");
        expect(loggerMock.error).toHaveBeenCalledWith("ApiKeyFileRetriever: 'projectRootPath' parameter must be a non-empty string.", {projectRootPath: null});
    });

    test('should use console if a valid logger is not provided and log a warning', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        mockReadFile.mockRejectedValueOnce({code: 'ENOENT'}); // Force a loggable warning path
        await getApiKeyFromFile(validFileName, projectRoot, null); // Pass null as logger
        expect(consoleWarnSpy).toHaveBeenCalledWith("ApiKeyFileRetriever: A valid logger instance was not provided. Using console for critical messages.");
        // Check if the subsequent warning (ENOENT) also went to console.warn
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`ApiKeyFileRetriever: API key file '${fullPath}' not found or not readable.`));


        mockReadFile.mockRejectedValueOnce(new Error("Other error")); // Force a loggable error path
        await expect(getApiKeyFromFile(validFileName, projectRoot, {})).rejects.toThrow(); // Pass invalid logger
        expect(consoleWarnSpy).toHaveBeenCalledWith("ApiKeyFileRetriever: A valid logger instance was not provided. Using console for critical messages.");
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("ApiKeyFileRetriever: Unexpected error reading API key file"), expect.anything());


        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });
});

// --- FILE END ---