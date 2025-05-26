// llm-proxy-server/tests/proxyLlmConfigLoader.test.js
// --- FILE START ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Automatically mock the 'node:path' module.
// All its exports (like resolve, join, etc.) will be replaced with jest.fn().
jest.mock('node:path');

// Import the SUT (System Under Test).
// It will receive the auto-mocked version of 'node:path'.
import {loadProxyLlmConfigs} from '../src/proxyLlmConfigLoader.js';

// Import the mocked 'path' module to access its mocked functions (e.g., path.resolve).
import * as path from 'node:path';

// Import the actual 'node:path' module to call its original methods when necessary
// (e.g., for setting up mock implementations or for test setup values).
const actualPath = jest.requireActual('node:path');


const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

describe('loadProxyLlmConfigs', () => {
    const MOCK_CONFIG_FILE_PATH = 'dummy/path/to/llm-configs.json';
    let MOCK_RESOLVED_CONFIG_FILE_PATH;
    let logger;
    let mockFileSystemReader;
    let consoleSpies;

    beforeEach(() => {
        logger = createMockLogger();
        mockFileSystemReader = {readFile: jest.fn()};

        // Clear all mocks. This will reset call history for path.resolve (the mock),
        // logger methods, consoleSpies, and mockFileSystemReader.readFile.
        // It also clears any mock implementations set by mockImplementationOnce.
        jest.clearAllMocks();

        // Calculate MOCK_RESOLVED_CONFIG_FILE_PATH using the *actual* path.resolve
        // to ensure test setup is correct and not dependent on the mock's state here.
        MOCK_RESOLVED_CONFIG_FILE_PATH = actualPath.resolve(MOCK_CONFIG_FILE_PATH);

        // Set the default mock implementation for path.resolve (which is now a jest.fn()
        // due to jest.mock('node:path') at the top of the file).
        // This makes the mocked path.resolve behave like the real one for the SUT,
        // while still allowing us to track its calls.
        // Important: Ensure path.resolve is actually a mock function here.
        // If path is imported before jest.mock completes its work, this might not be the mock.
        // However, jest.mock is hoisted, so 'import * as path' should get the mock.
        if (typeof path.resolve.mockImplementation === 'function') {
            path.resolve.mockImplementation((...args) => actualPath.resolve(...args));
        } else {
            // This case should ideally not happen if jest.mock works as expected for ES modules.
            // Fallback or error if path.resolve is not a mock function as expected.
            console.error("Warning: path.resolve is not a mock function in beforeEach. Spying might not work as expected.");
        }


        consoleSpies = {
            debug: jest.spyOn(console, 'debug').mockImplementation(() => {
            }),
            info: jest.spyOn(console, 'info').mockImplementation(() => {
            }),
            warn: jest.spyOn(console, 'warn').mockImplementation(() => {
            }),
            error: jest.spyOn(console, 'error').mockImplementation(() => {
            }),
        };
    });

    afterEach(() => {
        // With jest.mock at the top level, mocks persist for the file.
        // jest.clearAllMocks() in beforeEach is the primary mechanism for resetting state between tests.
    });

    describe('Successful Configuration Loading', () => {
        test('should load and parse valid JSON configuration with a default LLM ID', async () => {
            const mockLlmConfigs = {
                defaultLlmId: 'gpt-4',
                llms: {
                    'gpt-4': {model: 'gpt-4', apiKey: 'dummy_api_key_gpt4'},
                    'claude-2': {model: 'claude-2', apiKey: 'dummy_api_key_claude2'},
                },
            };
            mockFileSystemReader.readFile.mockResolvedValue(JSON.stringify(mockLlmConfigs));

            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, mockFileSystemReader);

            expect(path.resolve).toHaveBeenCalledWith(MOCK_CONFIG_FILE_PATH);

            expect(mockFileSystemReader.readFile).toHaveBeenCalledWith(MOCK_RESOLVED_CONFIG_FILE_PATH, 'utf-8');
            expect(logger.info).toHaveBeenCalledWith(`Attempting to load LLM configurations from: ${MOCK_RESOLVED_CONFIG_FILE_PATH}`);
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully read file content from ${MOCK_RESOLVED_CONFIG_FILE_PATH}`));
            expect(logger.debug).toHaveBeenCalledWith(`Successfully parsed JSON content from ${MOCK_RESOLVED_CONFIG_FILE_PATH}.`);
            expect(logger.info).toHaveBeenCalledWith(`LLM configurations loaded and validated successfully from ${MOCK_RESOLVED_CONFIG_FILE_PATH}. Found 2 LLM configurations.`);
            expect(result).toEqual({
                error: false,
                llmConfigs: mockLlmConfigs,
            });
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should load and parse valid JSON configuration without a default LLM ID', async () => {
            const mockLlmConfigs = {
                llms: {
                    'gpt-3.5': {model: 'gpt-3.5-turbo', apiKeyVariable: 'OPENAI_API_KEY'},
                },
            };
            mockFileSystemReader.readFile.mockResolvedValue(JSON.stringify(mockLlmConfigs));
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, mockFileSystemReader);
            expect(result).toEqual({
                error: false,
                llmConfigs: mockLlmConfigs,
            });
            expect(logger.info).toHaveBeenCalledWith(`LLM configurations loaded and validated successfully from ${MOCK_RESOLVED_CONFIG_FILE_PATH}. Found 1 LLM configurations.`);
            expect(logger.error).not.toHaveBeenCalled();
        });

        test('should use fallback logger if provided logger is null', async () => {
            const mockLlmConfigs = {llms: {'test-llm': {model: 'test'}}};
            mockFileSystemReader.readFile.mockResolvedValue(JSON.stringify(mockLlmConfigs));
            await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, null, mockFileSystemReader);

            expect(consoleSpies.info).toHaveBeenCalledWith('ProxyLlmConfigLoader: ', `Attempting to load LLM configurations from: ${MOCK_RESOLVED_CONFIG_FILE_PATH}`);
            expect(consoleSpies.debug).toHaveBeenCalledWith('ProxyLlmConfigLoader: ', expect.stringContaining(`Successfully read file content from ${MOCK_RESOLVED_CONFIG_FILE_PATH}`));
            expect(consoleSpies.debug).toHaveBeenCalledWith('ProxyLlmConfigLoader: ', `Successfully parsed JSON content from ${MOCK_RESOLVED_CONFIG_FILE_PATH}.`);
            expect(consoleSpies.info).toHaveBeenCalledWith('ProxyLlmConfigLoader: ', `LLM configurations loaded and validated successfully from ${MOCK_RESOLVED_CONFIG_FILE_PATH}. Found 1 LLM configurations.`);
        });

        test('should use fallback logger if provided logger is invalid (e.g., missing methods)', async () => {
            const mockLlmConfigs = {llms: {'test-llm': {model: 'test'}}};
            mockFileSystemReader.readFile.mockResolvedValue(JSON.stringify(mockLlmConfigs));
            const invalidLogger = {
                infoCall: "not a function", debugCall: () => {
                }
            };
            await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, invalidLogger, mockFileSystemReader);

            expect(consoleSpies.warn).toHaveBeenCalledWith('ProxyLlmConfigLoader: ', 'An invalid logger instance was provided. Falling back to console logging with prefix "ProxyLlmConfigLoader".');
            expect(consoleSpies.info).toHaveBeenCalledWith('ProxyLlmConfigLoader: ', `Attempting to load LLM configurations from: ${MOCK_RESOLVED_CONFIG_FILE_PATH}`);
        });
    });

    describe('FileSystemReader Dependency Errors', () => {
        test('should use provided logger for error if fileSystemReader is null and logger is valid', async () => {
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, null);
            const expectedErrorMsgRaw = 'A valid fileSystemReader with a readFile method must be provided.';
            expect(logger.error).toHaveBeenCalledWith(expectedErrorMsgRaw, {
                dependency: 'fileSystemReader',
                pathAttempted: MOCK_CONFIG_FILE_PATH
            });
            expect(result).toEqual({
                error: true,
                message: `ProxyLlmConfigLoader: ${expectedErrorMsgRaw}`,
                stage: 'initialization_error_dependency_missing_filereader',
                pathAttempted: MOCK_CONFIG_FILE_PATH
            });
        });

        test('should use fallback logger for error if fileSystemReader is null and logger is null', async () => {
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, null, null);
            const expectedErrorMsgRaw = 'A valid fileSystemReader with a readFile method must be provided.';

            expect(consoleSpies.error).toHaveBeenCalledWith('ProxyLlmConfigLoader: ', expectedErrorMsgRaw, {
                dependency: 'fileSystemReader',
                pathAttempted: MOCK_CONFIG_FILE_PATH
            });
            expect(result).toEqual({
                error: true,
                message: `ProxyLlmConfigLoader: ${expectedErrorMsgRaw}`,
                stage: 'initialization_error_dependency_missing_filereader',
                pathAttempted: MOCK_CONFIG_FILE_PATH
            });
        });

        test('should return error if fileSystemReader.readFile is not a function and logger is valid', async () => {
            const invalidFileReader = {readFile: 'not_a_function'};
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, invalidFileReader);
            const expectedErrorMsgRaw = 'A valid fileSystemReader with a readFile method must be provided.';
            expect(logger.error).toHaveBeenCalledWith(expectedErrorMsgRaw, {
                dependency: 'fileSystemReader',
                pathAttempted: MOCK_CONFIG_FILE_PATH
            });
            expect(result).toEqual({
                error: true,
                message: `ProxyLlmConfigLoader: ${expectedErrorMsgRaw}`,
                stage: 'initialization_error_dependency_missing_filereader',
                pathAttempted: MOCK_CONFIG_FILE_PATH,
            });
        });
    });

    describe('readFile Failures', () => {
        test('should handle file not found error (ENOENT)', async () => {
            const enoentError = new Error("Custom: File not found");
            enoentError.code = 'ENOENT';
            mockFileSystemReader.readFile.mockRejectedValue(enoentError);
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, mockFileSystemReader);

            const expectedRawMessage = `LLM configuration file not found at ${MOCK_RESOLVED_CONFIG_FILE_PATH}.`;
            expect(logger.error).toHaveBeenCalledWith(
                expectedRawMessage,
                expect.objectContaining({
                    pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
                    errorStage: 'read_file_not_found',
                    originalError: {name: enoentError.name, message: enoentError.message, code: enoentError.code}
                })
            );
            expect(result).toEqual({
                error: true,
                message: `ProxyLlmConfigLoader: ${expectedRawMessage}`,
                stage: 'read_file_not_found',
                originalError: enoentError,
                pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
            });
        });

        test('should handle other file system errors from readFile (e.g., EACCES)', async () => {
            const fsError = new Error("Custom: Permission denied");
            fsError.code = 'EACCES';
            mockFileSystemReader.readFile.mockRejectedValue(fsError);
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, mockFileSystemReader);
            const expectedRawMessage = `Failed to read LLM configuration file from ${MOCK_RESOLVED_CONFIG_FILE_PATH} due to file system error (Code: ${fsError.code}): ${fsError.message}`;
            expect(logger.error).toHaveBeenCalledWith(
                expectedRawMessage,
                expect.objectContaining({
                    pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
                    errorStage: 'read_file_system_error',
                    originalError: {name: fsError.name, message: fsError.message, code: fsError.code}
                })
            );
            expect(result).toEqual({
                error: true,
                message: `ProxyLlmConfigLoader: ${expectedRawMessage}`,
                stage: 'read_file_system_error',
                originalError: fsError,
                pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
            });
        });

        test('should handle unexpected errors (without code) from readFile', async () => {
            const unexpectedError = new Error("Unexpected boom during readFile!");
            mockFileSystemReader.readFile.mockRejectedValue(unexpectedError);
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, mockFileSystemReader);
            const expectedRawMessage = `An unexpected error occurred while loading/parsing LLM configurations from ${MOCK_RESOLVED_CONFIG_FILE_PATH}: ${unexpectedError.message}`;
            expect(logger.error).toHaveBeenCalledWith(
                expectedRawMessage,
                expect.objectContaining({
                    pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
                    errorStage: 'unknown_load_parse_error',
                    originalError: {name: unexpectedError.name, message: unexpectedError.message, code: undefined}
                })
            );
            expect(result).toEqual({
                error: true,
                message: `ProxyLlmConfigLoader: ${expectedRawMessage}`,
                stage: 'unknown_load_parse_error',
                originalError: unexpectedError,
                pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
            });
        });
    });

    describe('JSON Parsing and Validation Errors', () => {
        test('should handle JSON SyntaxError when file content is invalid JSON', async () => {
            const invalidJsonContent = "{ 'badjson': true, }";
            mockFileSystemReader.readFile.mockResolvedValue(invalidJsonContent);
            const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, mockFileSystemReader);

            const expectedRawMessagePart = `Failed to parse LLM configurations from ${MOCK_RESOLVED_CONFIG_FILE_PATH} due to JSON syntax error:`;
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(expectedRawMessagePart),
                expect.objectContaining({
                    pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
                    errorStage: 'parse_json_syntax_error',
                })
            );
            expect(result.error).toBe(true);
            expect(result.message).toContain(`ProxyLlmConfigLoader: ${expectedRawMessagePart}`);
            expect(result.stage).toBe('parse_json_syntax_error');
            expect(result.originalError).toBeInstanceOf(SyntaxError);
            expect(result.pathAttempted).toBe(MOCK_RESOLVED_CONFIG_FILE_PATH);
        });

        const malformedTestCases = [
            {
                name: 'parsed content is not an object (e.g., an array)',
                content: JSON.stringify(["item1", "item2"]),
                preview: '["item1","item2"]'
            },
            {name: 'parsed content is null', content: 'null', preview: 'null'},
            {
                name: 'llms property is missing entirely',
                content: JSON.stringify({defaultLlmId: 'some-id', otherProperty: 'value'}),
                preview: '{"defaultLlmId":"some-id","otherProperty":"value"}'
            },
            {
                name: 'llms property is present but is null',
                content: JSON.stringify({llms: null}),
                preview: '{"llms":null}'
            },
            {
                name: 'llms property is not an object (e.g., a string)',
                content: JSON.stringify({llms: "this should be an object"}),
                preview: '{"llms":"this should be an object"}'
            },
        ];

        malformedTestCases.forEach(tc => {
            test(`should handle malformed configuration: ${tc.name}`, async () => {
                mockFileSystemReader.readFile.mockResolvedValue(tc.content);
                const expectedRawErrorMsg = `Configuration file from ${MOCK_RESOLVED_CONFIG_FILE_PATH} is malformed or missing 'llms' object.`;
                const result = await loadProxyLlmConfigs(MOCK_CONFIG_FILE_PATH, logger, mockFileSystemReader);

                expect(logger.error).toHaveBeenCalledWith(expectedRawErrorMsg, {
                    path: MOCK_RESOLVED_CONFIG_FILE_PATH,
                    parsedContentPreview: tc.preview.substring(0, 200),
                });
                expect(result).toEqual({
                    error: true,
                    message: `ProxyLlmConfigLoader: ${expectedRawErrorMsg}`,
                    stage: 'validation_malformed_or_missing_llms',
                    pathAttempted: MOCK_RESOLVED_CONFIG_FILE_PATH,
                });
            });
        });
    });
});
// --- FILE END ---