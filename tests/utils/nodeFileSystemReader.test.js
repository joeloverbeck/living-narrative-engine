// tests/utils/NodeFileSystemReader.test.js
// --- CORRECTED FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {NodeFileSystemReader} from '../../llm-proxy-server/src/nodeFileSystemReader.js';

// Mock the 'node:fs/promises' module
// The factory function returns an object with the functions we want to mock.
// It's important that this is defined before the import statement for 'node:fs/promises'
// if you intend to destructure from it directly.
jest.mock('node:fs/promises', () => ({
    __esModule: true, // This is important for ES modules that have a default export or are mixed
    readFile: jest.fn(),
}));

// Now, import the mocked function(s) from 'node:fs/promises'.
// Due to jest.mock hoisting, 'readFile' here will be the jest.fn() defined above.
import {readFile as mockFsReadFile} from 'node:fs/promises';


describe('NodeFileSystemReader', () => {
    /** @type {NodeFileSystemReader} */
    let reader;

    beforeEach(() => {
        // Reset the imported mock function before each test
        mockFsReadFile.mockReset();
        reader = new NodeFileSystemReader();
    });

    describe('readFile method', () => {
        test('should successfully read a file and return its content', async () => {
            const filePath = '/path/to/fake/file.txt';
            const encoding = 'utf-8';
            const expectedContent = 'This is the file content.';

            mockFsReadFile.mockResolvedValue(expectedContent);

            const content = await reader.readFile(filePath, encoding);

            expect(content).toBe(expectedContent);
            expect(mockFsReadFile).toHaveBeenCalledTimes(1);
            expect(mockFsReadFile).toHaveBeenCalledWith(filePath, {encoding});
        });

        test('should propagate errors from fs.readFile (e.g., file not found)', async () => {
            const filePath = '/path/to/nonexistent/file.txt';
            const encoding = 'utf-8';
            const expectedError = new Error("ENOENT: no such file or directory, open '/path/to/nonexistent/file.txt'");
            // @ts-ignore
            expectedError.code = 'ENOENT';
            // @ts-ignore
            expectedError.errno = -2;
            // @ts-ignore
            expectedError.syscall = 'open';
            // @ts-ignore
            expectedError.path = filePath;

            mockFsReadFile.mockRejectedValue(expectedError);

            expect.assertions(4); // เพิ่มการตรวจสอบ mockFsReadFile
            try {
                await reader.readFile(filePath, encoding);
            } catch (error) {
                expect(error).toBe(expectedError);
                // @ts-ignore
                expect(error.code).toBe('ENOENT');
            }
            expect(mockFsReadFile).toHaveBeenCalledTimes(1);
            expect(mockFsReadFile).toHaveBeenCalledWith(filePath, {encoding});
        });

        test('should propagate other errors from fs.readFile (e.g., permission denied)', async () => {
            const filePath = '/path/to/protected/file.txt';
            const encoding = 'utf-16le';
            const expectedError = new Error("EACCES: permission denied, open '/path/to/protected/file.txt'");
            // @ts-ignore
            expectedError.code = 'EACCES';

            mockFsReadFile.mockRejectedValue(expectedError);

            await expect(reader.readFile(filePath, encoding)).rejects.toThrow(expectedError);
            expect(mockFsReadFile).toHaveBeenCalledTimes(1);
            expect(mockFsReadFile).toHaveBeenCalledWith(filePath, {encoding});
        });

        test('should throw an error if filePath is an empty string', async () => {
            const filePath = '';
            const encoding = 'utf-8';

            expect.assertions(3); // For error instance, message, and ensuring fs.readFile is not called
            try {
                await reader.readFile(filePath, encoding);
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                // @ts-ignore
                expect(error.message).toBe('NodeFileSystemReader.readFile: filePath must be a non-empty string.');
            }
            expect(mockFsReadFile).not.toHaveBeenCalled();
        });

        test('should throw an error if filePath is not a string (e.g. null)', async () => {
            // @ts-ignore
            const filePath = null;
            const encoding = 'utf-8';

            expect.assertions(3);
            try {
                await reader.readFile(filePath, encoding);
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                // @ts-ignore
                expect(error.message).toBe('NodeFileSystemReader.readFile: filePath must be a non-empty string.');
            }
            expect(mockFsReadFile).not.toHaveBeenCalled();
        });

        test('should call fs.readFile with the provided encoding', async () => {
            const filePath = '/path/to/some/file.txt';
            const encoding = 'ascii';
            const expectedContent = 'ASCII content';

            mockFsReadFile.mockResolvedValue(expectedContent);

            await reader.readFile(filePath, encoding);

            expect(mockFsReadFile).toHaveBeenCalledTimes(1);
            expect(mockFsReadFile).toHaveBeenCalledWith(filePath, {encoding});
        });
    });
});

// --- CORRECTED FILE END ---