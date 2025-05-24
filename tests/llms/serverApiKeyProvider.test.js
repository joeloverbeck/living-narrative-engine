// tests/llms/serverApiKeyProvider.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {ServerApiKeyProvider} from '../../src/llms/serverApiKeyProvider.js';
import {EnvironmentContext} from '../../src/llms/environmentContext.js';

// Mock the 'node:path' module
const mockPathBasename = jest.fn(p => p.split('/').pop()); // Simplified basename
const mockPathJoin = jest.fn((...args) => args.join('/'));
jest.mock('node:path', () => ({
    basename: (...args) => mockPathBasename(...args),
    join: (...args) => mockPathJoin(...args),
}));


/**
 * @typedef {import('../../../src/llms/interfaces/ILogger.js').ILogger} ILogger
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

/**
 * @typedef {object} IFileSystemReader
 * @property {(filePath: string, encoding: string) => Promise<string | null>} readFile
 */

/**
 * @returns {jest.Mocked<IFileSystemReader>}
 */
const mockFileSystemReader = () => ({
    readFile: jest.fn(),
});

/**
 * @typedef {object} IEnvironmentVariableReader
 * @property {(varName: string) => string | null} getEnv
 */

/**
 * @returns {jest.Mocked<IEnvironmentVariableReader>}
 */
const mockEnvironmentVariableReader = () => ({
    getEnv: jest.fn(),
});

describe('ServerApiKeyProvider', () => {
    /** @type {jest.Mocked<ILogger>} */
    let logger;
    /** @type {jest.Mocked<IFileSystemReader>} */
    let fileSystemReader;
    /** @type {jest.Mocked<IEnvironmentVariableReader>} */
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
            // Check if logger methods are callable (indirect check of storage)
            expect(logger.debug).toHaveBeenCalledWith('ServerApiKeyProvider: Instance created and dependencies stored.');
        });

        test('should throw error if logger is invalid', () => {
            expect(() => new ServerApiKeyProvider({logger: null, fileSystemReader, environmentVariableReader}))
                .toThrow('ServerApiKeyProvider: Constructor requires a valid logger instance.');
        });

        test('should throw error if fileSystemReader is invalid', () => {
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader: null, environmentVariableReader}))
                .toThrow('ServerApiKeyProvider: Constructor requires a valid fileSystemReader instance with a readFile method.');
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader: {}, environmentVariableReader}))
                .toThrow('ServerApiKeyProvider: Constructor requires a valid fileSystemReader instance with a readFile method.');
        });

        test('should throw error if environmentVariableReader is invalid', () => {
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader, environmentVariableReader: null}))
                .toThrow('ServerApiKeyProvider: Constructor requires a valid environmentVariableReader instance with a getEnv method.');
            expect(() => new ServerApiKeyProvider({logger, fileSystemReader, environmentVariableReader: {}}))
                .toThrow('ServerApiKeyProvider: Constructor requires a valid environmentVariableReader instance with a getEnv method.');
        });
    });

    describe('getKey Method', () => {
        /** @type {MockLLMModelConfig} */
        let llmConfig;
        /** @type {EnvironmentContext} */
        let environmentContext;

        // Helper to create EnvironmentContext
        const createEnvContext = (isServer, projectRootPath = null, executionEnvironment = 'unknown') => {
            const mockEcLogger = mockLogger();
            // For server environment, projectRootPath is mandatory for EnvironmentContext constructor
            const contextParams = {logger: mockEcLogger, executionEnvironment};
            if (executionEnvironment === 'server') {
                contextParams.projectRootPath = projectRootPath || '/default/server/root';
            } else if (projectRootPath) { // if projectRootPath is provided for non-server, it will be ignored by EC
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
            // Default to a server environment for most tests
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
                llmConfig.apiKeyFileName = 'api_key.txt'; // To see it proceed
                environmentVariableReader.getEnv.mockReturnValue(null);
                fileSystemReader.readFile.mockResolvedValue(null); // File also not found

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(environmentVariableReader.getEnv).toHaveBeenCalledWith('MISSING_KEY');
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'MISSING_KEY' not found or not set.");
                expect(fileSystemReader.readFile).toHaveBeenCalled(); // Check that it attempted file read
            });

            test('should log and proceed to file if env var is found but empty or whitespace', async () => {
                llmConfig.apiKeyEnvVar = 'EMPTY_KEY';
                llmConfig.apiKeyFileName = 'api_key.txt'; // To see it proceed
                environmentVariableReader.getEnv.mockReturnValue('   '); // Whitespace
                fileSystemReader.readFile.mockResolvedValue(null); // File also not found

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(environmentVariableReader.getEnv).toHaveBeenCalledWith('EMPTY_KEY');
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'EMPTY_KEY' found but is empty or contains only whitespace.");
                expect(fileSystemReader.readFile).toHaveBeenCalled();
            });

            test('should log error and proceed to file if getEnv throws an error', async () => {
                llmConfig.apiKeyEnvVar = 'ERROR_KEY_ENV';
                llmConfig.apiKeyFileName = 'api_key_file.txt'; // Setup to attempt file read
                const envError = new Error("Permission denied reading env");
                environmentVariableReader.getEnv.mockImplementation(() => {
                    throw envError;
                });
                fileSystemReader.readFile.mockResolvedValueOnce('  file_key_after_env_error  ');


                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBe('file_key_after_env_error');
                expect(logger.error).toHaveBeenCalledWith(
                    "ServerApiKeyProvider.getKey (test-llm): Error while reading environment variable 'ERROR_KEY_ENV'. Error: Permission denied reading env",
                    {error: envError}
                );
                expect(fileSystemReader.readFile).toHaveBeenCalled();
            });

            test('should skip env var retrieval if apiKeyEnvVar is not specified or empty', async () => {
                llmConfig.apiKeyEnvVar = '  '; // Empty after trim
                llmConfig.apiKeyFileName = 'some_file.txt';
                fileSystemReader.readFile.mockResolvedValue('file_key_only');

                const key = await provider.getKey(llmConfig, environmentContext);
                expect(key).toBe('file_key_only');
                expect(environmentVariableReader.getEnv).not.toHaveBeenCalled();
                expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("No 'apiKeyEnvVar' specified"));
            });
        });

        describe('File Retrieval', () => {
            beforeEach(() => {
                // Ensure env var is not set for these tests, or set to fail
                llmConfig.apiKeyEnvVar = 'ENV_VAR_THAT_FAILS';
                environmentVariableReader.getEnv.mockReturnValue(null);
            });

            test('should retrieve key from file if found and non-empty', async () => {
                llmConfig.apiKeyFileName = 'keyfile.txt';
                fileSystemReader.readFile.mockResolvedValue('  file_key_456  ');
                mockPathJoin.mockReturnValue('/project/root/keyfile.txt');
                mockPathBasename.mockImplementation(p => p); // Assume simple case for this test

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBe('file_key_456');
                expect(fileSystemReader.readFile).toHaveBeenCalledWith('/project/root/keyfile.txt', 'utf-8');
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Successfully retrieved API key from file '/project/root/keyfile.txt'.");
                expect(mockPathBasename).toHaveBeenCalledWith('keyfile.txt');
                expect(mockPathJoin).toHaveBeenCalledWith('/project/root', 'keyfile.txt');
            });

            test('should return null and log error if projectRootPath is missing for file retrieval', async () => {
                llmConfig.apiKeyFileName = 'keyfile.txt';
                environmentContext = createEnvContext(true, null, 'server'); // Missing projectRootPath
                // EC constructor would throw if projectRootPath is truly null for server,
                // so we simulate getProjectRootPath() returning null/empty from a valid EC.
                jest.spyOn(environmentContext, 'getProjectRootPath').mockReturnValueOnce('');


                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    "ServerApiKeyProvider.getKey (test-llm): Cannot retrieve key from file 'keyfile.txt' because projectRootPath is missing or invalid in EnvironmentContext."
                );
                expect(fileSystemReader.readFile).not.toHaveBeenCalled();
            });

            test('should log and return null if file is not found (readFile returns null)', async () => {
                llmConfig.apiKeyFileName = 'nonexistent.txt';
                fileSystemReader.readFile.mockResolvedValue(null);
                mockPathJoin.mockReturnValue('/project/root/nonexistent.txt');


                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/nonexistent.txt' not found or could not be read (IFileSystemReader.readFile returned null).");
            });

            test('should log and return null if file is found but empty or whitespace', async () => {
                llmConfig.apiKeyFileName = 'empty.txt';
                fileSystemReader.readFile.mockResolvedValue('   '); // Whitespace
                mockPathJoin.mockReturnValue('/project/root/empty.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/empty.txt' found but is empty or contains only whitespace.");
            });

            test('should log error and return null if readFile throws an error', async () => {
                llmConfig.apiKeyFileName = 'error_file.txt';
                const fileError = new Error('Disk read error');
                fileSystemReader.readFile.mockRejectedValue(fileError);
                mockPathJoin.mockReturnValue('/project/root/error_file.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    "ServerApiKeyProvider.getKey (test-llm): Error while reading API key file '/project/root/error_file.txt'. Error: Disk read error",
                    {error: fileError}
                );
            });

            test('should skip file retrieval if apiKeyFileName is not specified or empty', async () => {
                llmConfig.apiKeyFileName = '  '; // Empty after trim
                // No env var either
                llmConfig.apiKeyEnvVar = null;


                const key = await provider.getKey(llmConfig, environmentContext);
                expect(key).toBeNull();
                expect(fileSystemReader.readFile).not.toHaveBeenCalled();
                expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("No 'apiKeyFileName' specified"));
                expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Neither 'apiKeyEnvVar' nor 'apiKeyFileName' were specified"));
            });
        });

        describe('Prioritization and Fallback', () => {
            test('should prioritize environment variable over file if env var key is found', async () => {
                llmConfig.apiKeyEnvVar = 'PRIMARY_KEY_ENV';
                llmConfig.apiKeyFileName = 'SECONDARY_KEY_FILE.txt';
                environmentVariableReader.getEnv.mockReturnValue('env_is_primary');
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
                environmentVariableReader.getEnv.mockReturnValue(null); // Env var not found
                fileSystemReader.readFile.mockResolvedValue('  file_key_as_fallback  ');
                mockPathJoin.mockReturnValue('/project/root/FALLBACK_FILE.txt');

                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBe('file_key_as_fallback');
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'MISSING_ENV_KEY' not found or not set.");
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Successfully retrieved API key from file '/project/root/FALLBACK_FILE.txt'.");
            });

            test('should return null and log if neither env var nor file yields a key (both specified but fail)', async () => {
                llmConfig.apiKeyEnvVar = 'ENV_FAILS';
                llmConfig.apiKeyFileName = 'FILE_FAILS.txt';
                environmentVariableReader.getEnv.mockReturnValue(null);
                fileSystemReader.readFile.mockResolvedValue(null);
                mockPathJoin.mockReturnValue('/project/root/FILE_FAILS.txt');


                const key = await provider.getKey(llmConfig, environmentContext);

                expect(key).toBeNull();
                expect(logger.info).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): Environment variable 'ENV_FAILS' not found or not set.");
                expect(logger.warn).toHaveBeenCalledWith("ServerApiKeyProvider.getKey (test-llm): API key file '/project/root/FILE_FAILS.txt' not found or could not be read (IFileSystemReader.readFile returned null).");
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

// --- FILE END ---