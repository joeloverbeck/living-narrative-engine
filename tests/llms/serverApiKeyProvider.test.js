// tests/llms/serverApiKeyProvider.test.js
// --- MODIFIED FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {ServerApiKeyProvider} from '../../src/llms/serverApiKeyProvider.js';
import {EnvironmentContext} from '../../src/llms/environmentContext.js';
// Import the actual interfaces to ensure mocks align if needed, though not strictly used for type in JS tests
// import { IFileSystemReader, IEnvironmentVariableReader } from '../../src/llms/interfaces/IServerUtils.js';

// Mock the 'node:path' module
const mockPathBasename = jest.fn(p => p.split('/').pop()); // Simplified basename
const mockPathJoin = jest.fn((...args) => args.join('/'));
jest.mock('node:path', () => ({
    __esModule: true,
    basename: (...args) => mockPathBasename(...args),
    join: (...args) => mockPathJoin(...args),
}));


/**
 * @typedef {import('../../src/llms/interfaces/ILogger.js').ILogger} ILogger
 */

/**
 * @typedef {object} MockLLMModelConfig
 * @property {string} [id]
 * @property {string} [apiKeyEnvVar]
 * @property {string} [apiKeyFileName]
 */

/**
 * @returns {jest.Mocked<ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// The mock functions for the readers.
// Their behavior will be defined in each test according to the new interface contracts.
const mockFileSystemReader = () => ({
    readFile: jest.fn(), // Will be mocked to throw or resolve with string
});

const mockEnvironmentVariableReader = () => ({
    getEnv: jest.fn(), // Will be mocked to return string or undefined
});

describe('ServerApiKeyProvider', () => {
    /** @type {jest.Mocked<ILogger>} */
    let logger;
    /** @type {ReturnType<typeof mockFileSystemReader>} */
    let fileSystemReader;
    /** @type {ReturnType<typeof mockEnvironmentVariableReader>} */
    let environmentVariableReader;
    /** @type {ServerApiKeyProvider} */
    let provider;

    beforeEach(() => {
        jest.clearAllMocks(); // Clears all mocks, including node:path
        logger = mockLogger();
        fileSystemReader = mockFileSystemReader();
        environmentVariableReader = mockEnvironmentVariableReader();
        provider = new ServerApiKeyProvider({
            logger,
            fileSystemReader,
            environmentVariableReader,
        });
    });

    describe('Constructor', () => {
        test('should store injected dependencies', () => {
            expect(provider).toBeInstanceOf(ServerApiKeyProvider);
            expect(logger.debug).toHaveBeenCalledWith('ServerApiKeyProvider: Instance created and dependencies stored.');
        });

        test('should throw error if logger is invalid', () => {
            expect(() => new ServerApiKeyProvider({logger: null, fileSystemReader, environmentVariableReader}))
                .toThrow('ServerApiKeyProvider: Constructor requires a valid logger instance.');
        });

        test('should throw error if fileSystemReader is invalid', () => {
            const expectedErrorMsg = 'ServerApiKeyProvider: Constructor requires a valid fileSystemReader instance that implements IFileSystemReader (must have an async readFile method).';
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader: null, environmentVariableReader}))
                .toThrow(expectedErrorMsg);
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader: {}, environmentVariableReader}))
                .toThrow(expectedErrorMsg);
        });

        test('should throw error if environmentVariableReader is invalid', () => {
            const expectedErrorMsg = 'ServerApiKeyProvider: Constructor requires a valid environmentVariableReader instance that implements IEnvironmentVariableReader (must have a getEnv method).';
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader, environmentVariableReader: null}))
                .toThrow(expectedErrorMsg);
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader, environmentVariableReader: {}}))
                .toThrow(expectedErrorMsg);
        });
    });

    describe('getKey Method', () => {
        /** @type {MockLLMModelConfig} */
        let llmConfig;
        /** @type {EnvironmentContext} */
        let environmentContext;

        const createEnvContext = (isServer, projectRootPath = null, executionEnvironment = 'unknown') => {
            const mockEcLogger = mockLogger();
            const contextParams = {logger: mockEcLogger, executionEnvironment};
            if (executionEnvironment === 'server') {
                contextParams.projectRootPath = projectRootPath || '/default/server/root';
            } else if (projectRootPath) {
                contextParams.projectRootPath = projectRootPath;
            }
            const ec = new EnvironmentContext(contextParams);
            jest.spyOn(ec, 'isServer').mockReturnValue(isServer);
            jest.spyOn(ec, 'getProjectRootPath').mockReturnValue(isServer ? (projectRootPath || '/default/server/root') : null);
            jest.spyOn(ec, 'getExecutionEnvironment').mockReturnValue(executionEnvironment);
            return ec;
        };

        beforeEach(() => {
            llmConfig = {id: 'test-llm'};
            environmentContext = createEnvContext(true, '/project/root', 'server');
        });

        test('should return null and log warning if not in server environment', async () => {
            environmentContext = createEnvContext(false, null, 'client');
            llmConfig.apiKeyEnvVar = 'TEST_API_KEY_ENV';
            const key = await provider.getKey(llmConfig, environmentContext);
            expect(key).toBeNull();
            expect(logger.warn).toHaveBeenCalledWith(
                "ServerApiKeyProvider.getKey (test-llm): Attempted to use in a non-server environment. This provider is only for server-side execution. Environment: client"
            );
            expect(environmentVariableReader.getEnv).not.toHaveBeenCalled();
            expect(fileSystemReader.readFile).not.toHaveBeenCalled();
        });

        test('should return null and log if environmentContext is invalid', async () => {
            const key = await provider.getKey(llmConfig, null);
            expect(key).toBeNull();
            expect(logger.error).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Invalid environmentContext provided.");
        });

        describe('Environment Variable Retrieval', () => {
            test('should retrieve key from environment variable if found and non-empty', async () => {
                llmConfig.apiKeyEnvVar = 'MY_API_KEY';
                environmentVariableReader.getEnv.mockReturnValue('  env_key_123  ');
                const key = await provider.getKey(llmConfig, environmentContext);
                expect(key).toBe('env_key_123');
                expect(environmentVariableReader.getEnv).toHaveBeenCalledWith('MY_API_KEY');
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Successfully retrieved API key from environment variable 'MY_API_KEY'.");
                expect(fileSystemReader.readFile).not.toHaveBeenCalled();
            });

            test('should log and proceed to file if env var is specified but not found', async () => {
                llmConfig.apiKeyEnvVar = 'MISSING_KEY';
                llmConfig.apiKeyFileName = 'api_key.txt';
                environmentVariableReader.getEnv.mockReturnValue(undefined); // Not found
                // Simulate file also not found for this test to ensure full path and null return
                const fileNotFoundError = new Error('File not found');
                // @ts-ignore
                fileNotFoundError.code = 'ENOENT';
                fileSystemReader.readFile.mockRejectedValue(fileNotFoundError);
                mockPathJoin.mockReturnValue('/project/root/api_key.txt');


                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(environmentVariableReader.getEnv).toHaveBeenCalledWith('MISSING_KEY');
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'MISSING_KEY' not found or not set.");
                expect(fileSystemReader.readFile).toHaveBeenCalledWith('/project/root/api_key.txt', 'utf-8');
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/api_key.txt' not found. Error: File not found");
            });

            test('should log and proceed to file if env var is found but empty or whitespace', async () => {
                llmConfig.apiKeyEnvVar = 'EMPTY_KEY';
                llmConfig.apiKeyFileName = 'api_key.txt';
                environmentVariableReader.getEnv.mockReturnValue('   '); // Whitespace
                const fileNotFoundError = new Error('File not found');
                // @ts-ignore
                fileNotFoundError.code = 'ENOENT';
                fileSystemReader.readFile.mockRejectedValue(fileNotFoundError); // File also not found

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(environmentVariableReader.getEnv).toHaveBeenCalledWith('EMPTY_KEY');
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'EMPTY_KEY' found but is empty or contains only whitespace.");
                expect(fileSystemReader.readFile).toHaveBeenCalled();
            });

            test('should log error (if getEnv throws) and proceed to file if getEnv throws an error', async () => {
                llmConfig.apiKeyEnvVar = 'ERROR_KEY_ENV';
                llmConfig.apiKeyFileName = 'api_key_file.txt';
                const envError = new Error("Hypothetical permission denied reading env");
                environmentVariableReader.getEnv.mockImplementation(() => {
                    throw envError; // Simulate a rare case where getEnv itself might throw
                });
                fileSystemReader.readFile.mockResolvedValueOnce('  file_key_after_env_error  ');
                mockPathJoin.mockReturnValue('/project/root/api_key_file.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBe('file_key_after_env_error');
                expect(logger.error).toHaveBeenCalledWith(
                    "ServerApiKeyProvider.getKey (test-llm): Error while reading environment variable 'ERROR_KEY_ENV'. Error: Hypothetical permission denied reading env",
                    {error: envError}
                );
                expect(fileSystemReader.readFile).toHaveBeenCalledWith('/project/root/api_key_file.txt', 'utf-8');
            });


            test('should skip env var retrieval if apiKeyEnvVar is not specified or empty', async () => {
                llmConfig.apiKeyEnvVar = '  ';
                llmConfig.apiKeyFileName = 'some_file.txt';
                fileSystemReader.readFile.mockResolvedValue('file_key_only');

                const key = await provider.getKey(llmConfig, environmentContext);
                expect(key).toBe('file_key_only');
                expect(environmentVariableReader.getEnv).not.toHaveBeenCalled();
                expect(logger.debug).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): No 'apiKeyEnvVar' specified in llmConfig or it's empty. Skipping environment variable retrieval.");
            });
        });

        describe('File Retrieval', () => {
            beforeEach(() => {
                llmConfig.apiKeyEnvVar = 'ENV_VAR_IRRELEVANT_OR_FAILED';
                // Simulate env var check happened and it was not found or was empty.
                environmentVariableReader.getEnv.mockReturnValue(undefined);
            });

            test('should retrieve key from file if found and non-empty', async () => {
                llmConfig.apiKeyFileName = 'keyfile.txt';
                fileSystemReader.readFile.mockResolvedValue('  file_key_456  ');
                mockPathJoin.mockReturnValue('/project/root/keyfile.txt');
                mockPathBasename.mockImplementation(p => p);

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBe('file_key_456');
                expect(fileSystemReader.readFile).toHaveBeenCalledWith('/project/root/keyfile.txt', 'utf-8');
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Successfully retrieved API key from file '/project/root/keyfile.txt'.");
            });

            test('should return null and log error if projectRootPath is missing for file retrieval', async () => {
                llmConfig.apiKeyFileName = 'keyfile.txt';
                const invalidEc = createEnvContext(true, '', 'server'); // Empty projectRootPath
                // Spy on the actual getProjectRootPath of this specific invalidEc instance
                jest.spyOn(invalidEc, 'getProjectRootPath').mockReturnValue('');


                const key = await provider.getKey(llmConfig, invalidEc);

                expect(key).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    "ServerApiKeyProvider.getKey (test-llm): Cannot retrieve key from file 'keyfile.txt' because projectRootPath is missing or invalid in EnvironmentContext."
                );
                expect(fileSystemReader.readFile).not.toHaveBeenCalled();
            });

            test('should log warn and return null if file is not found (readFile throws ENOENT)', async () => {
                llmConfig.apiKeyFileName = 'nonexistent.txt';
                const notFoundError = new Error("ENOENT: File not found");
                // @ts-ignore
                notFoundError.code = 'ENOENT';
                fileSystemReader.readFile.mockRejectedValue(notFoundError);
                mockPathJoin.mockReturnValue('/project/root/nonexistent.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/nonexistent.txt' not found. Error: ENOENT: File not found");
            });

            test('should log warn and return null if file is not readable (readFile throws EACCES)', async () => {
                llmConfig.apiKeyFileName = 'protected.txt';
                const accessError = new Error("EACCES: Permission denied");
                // @ts-ignore
                accessError.code = 'EACCES';
                fileSystemReader.readFile.mockRejectedValue(accessError);
                mockPathJoin.mockReturnValue('/project/root/protected.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/protected.txt' not readable due to permissions. Error: EACCES: Permission denied");
            });


            test('should log warn and return null if file is found but empty or whitespace', async () => {
                llmConfig.apiKeyFileName = 'empty.txt';
                fileSystemReader.readFile.mockResolvedValue('   '); // Whitespace
                mockPathJoin.mockReturnValue('/project/root/empty.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/empty.txt' found but is empty or contains only whitespace.");
            });

            test('should log error and return null if readFile throws an unexpected error (no code)', async () => {
                llmConfig.apiKeyFileName = 'error_file.txt';
                const fileError = new Error('Disk read error (unexpected)');
                // No .code property for this error
                fileSystemReader.readFile.mockRejectedValue(fileError);
                mockPathJoin.mockReturnValue('/project/root/error_file.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    "ServerApiKeyProvider.getKey (test-llm): Unexpected error while reading API key file '/project/root/error_file.txt'. Error: Disk read error (unexpected)",
                    {errorCode: undefined, errorDetails: fileError} // Check structure for unexpected error
                );
            });

            test('should skip file retrieval if apiKeyFileName is not specified or empty', async () => {
                llmConfig.apiKeyFileName = '  ';
                llmConfig.apiKeyEnvVar = null; // Ensure env var also not set

                const key = await provider.getKey(llmConfig, environmentContext);
                expect(key).toBeNull();
                expect(fileSystemReader.readFile).not.toHaveBeenCalled();
                expect(logger.debug).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): No 'apiKeyFileName' specified in llmConfig or it's empty. Skipping file retrieval.");
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Neither 'apiKeyEnvVar' nor 'apiKeyFileName' were specified in the LLM configuration. Unable to retrieve API key.");
            });
        });

        describe('Prioritization and Fallback', () => {
            test('should prioritize environment variable over file if env var key is found', async () => {
                llmConfig.apiKeyEnvVar = 'PRIMARY_KEY_ENV';
                llmConfig.apiKeyFileName = 'SECONDARY_KEY_FILE.txt';
                environmentVariableReader.getEnv.mockReturnValue('env_is_primary');
                // readFile mock shouldn't matter here, but setting it defensively
                fileSystemReader.readFile.mockResolvedValue('file_is_secondary');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBe('env_is_primary');
                expect(environmentVariableReader.getEnv).toHaveBeenCalledWith('PRIMARY_KEY_ENV');
                expect(fileSystemReader.readFile).not.toHaveBeenCalled();
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Successfully retrieved API key from environment variable 'PRIMARY_KEY_ENV'.");
            });

            test('should fall back to file if environment variable is specified but not found', async () => {
                llmConfig.apiKeyEnvVar = 'MISSING_ENV_KEY';
                llmConfig.apiKeyFileName = 'FALLBACK_FILE.txt';
                environmentVariableReader.getEnv.mockReturnValue(undefined); // Env var not found
                fileSystemReader.readFile.mockResolvedValue('  file_key_as_fallback  ');
                mockPathJoin.mockReturnValue('/project/root/FALLBACK_FILE.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBe('file_key_as_fallback');
                // Check the sequence of logs or individual logs
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'MISSING_ENV_KEY' not found or not set.");
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Successfully retrieved API key from file '/project/root/FALLBACK_FILE.txt'.");
            });

            test('should return null and log if neither env var nor file yields a key (both specified but fail)', async () => {
                llmConfig.apiKeyEnvVar = 'ENV_FAILS';
                llmConfig.apiKeyFileName = 'FILE_FAILS.txt';
                environmentVariableReader.getEnv.mockReturnValue(undefined); // Env var fails (not found)

                const fileNotFoundError = new Error("ENOENT: File not found during double fail test");
                // @ts-ignore
                fileNotFoundError.code = 'ENOENT';
                fileSystemReader.readFile.mockRejectedValue(fileNotFoundError); // File fails (not found)
                mockPathJoin.mockReturnValue('/project/root/FILE_FAILS.txt');


                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'ENV_FAILS' not found or not set.");
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/FILE_FAILS.txt' not found. Error: ENOENT: File not found during double fail test");
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key not found through any configured method (environment variable or file).");
            });

            test('should return null and log specific warning if neither apiKeyEnvVar nor apiKeyFileName are specified', async () => {
                llmConfig = {id: 'no-spec-llm'}; // No key specifiers

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith(
                    "ServerApiKeyProvider.getKey (no-spec-llm): Neither 'apiKeyEnvVar' nor 'apiKeyFileName' were specified in the LLM configuration. Unable to retrieve API key."
                );
            });
        });
    });
});

// --- MODIFIED FILE END ---