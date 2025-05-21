// tests/services/browserStorageProvider.test.js

/**
 * @jest-environment node
 */
import {describe, expect, jest, beforeEach, afterEach, test} from '@jest/globals';
import {BrowserStorageProvider} from '../../src/services/browserStorageProvider'; // Adjust path as needed

// --- Mock ILogger ---
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// --- Mock File System Access API ---
// These will be the objects our mocked handles resolve to.
// We'll store "written" data here for assertions.
let mockFileSystemState;

const mockWritableStream = {
    // CORRECTED: Changed from arrow function to regular function to correctly bind 'this'
    write: jest.fn().mockImplementation(async function (data) {
        // Now 'this' will refer to the stream object that 'write' is called on,
        // which has the 'targetPath' property.
        if (this.targetPath === undefined) {
            // This check can help debug if targetPath is still an issue
            console.error("DEBUG: mockWritableStream.write called with undefined this.targetPath. 'this' is:", this);
            throw new Error("Mock WritableStream: targetPath is undefined on 'this'.");
        }
        mockFileSystemState[this.targetPath] = new Uint8Array(data);
    }),
    close: jest.fn().mockResolvedValue(undefined),
    // We can add seek, truncate if needed for other tests
};

const mockFileHandle = {
    // name: set dynamically
    kind: 'file',
    createWritable: jest.fn().mockImplementation(async function (options) {
        // 'this' refers to the mockFileHandle instance
        // Return a new stream instance each time
        if (this.fullPath === undefined) {
            // This check can help debug if fullPath is an issue on the file handle
            console.error("DEBUG: mockFileHandle.createWritable called with undefined this.fullPath. 'this' is:", this);
            throw new Error("Mock FileHandle: fullPath is undefined on 'this' when creating writable.");
        }
        return {
            ...mockWritableStream,
            targetPath: this.fullPath, // Pass the path to the stream for storing data
            // Simulate keepExistingData: false by overwriting
        };
    }),
    getFile: jest.fn(), // For readFile tests
    // fullPath: set dynamically (custom property for mock)
};

const mockDirectoryHandle = {
    // name: set dynamically
    kind: 'directory',
    getFileHandle: jest.fn().mockImplementation(async function (name, options) {
        const fullPath = (this.fullPath !== undefined ? `${this.fullPath}/` : '') + name;
        if (mockFileSystemState[fullPath] && mockFileSystemState[fullPath].__isFileMock) {
            return {...mockFileHandle, name, fullPath};
        }
        if (options && options.create) {
            mockFileSystemState[fullPath] = {__isFileMock: true, content: new Uint8Array()}; // Mark as a mock file
            return {...mockFileHandle, name, fullPath};
        }
        const error = new Error(`Mock: File not found: ${name}`);
        error.name = 'NotFoundError';
        throw error;
    }),
    getDirectoryHandle: jest.fn().mockImplementation(async function (name, options) {
        const fullPath = (this.fullPath !== undefined ? `${this.fullPath}/` : '') + name;
        if (mockFileSystemState[fullPath] && mockFileSystemState[fullPath].__isDirectoryMock) {
            return {...mockDirectoryHandle, name, fullPath};
        }
        if (options && options.create) {
            mockFileSystemState[fullPath] = {__isDirectoryMock: true}; // Mark as a mock directory
            return {...mockDirectoryHandle, name, fullPath};
        }
        const error = new Error(`Mock: Directory not found: ${name}`);
        error.name = 'NotFoundError';
        throw error;
    }),
    removeEntry: jest.fn(), // For deleteFile tests
    values: jest.fn(),      // For listFiles tests
    queryPermission: jest.fn().mockResolvedValue('granted'),
    requestPermission: jest.fn().mockResolvedValue('granted'),
    // fullPath: set dynamically (custom property for mock)
};

// --- Global Mock Setup ---
// Store the original window.showDirectoryPicker if it exists (it won't in Node)
const originalShowDirectoryPicker = global.window ? global.window.showDirectoryPicker : undefined;

beforeEach(() => {
    jest.clearAllMocks(); // Clear all mock call counts and implementations

    mockFileSystemState = {}; // Reset our in-memory "file system" for each test

    // Mock the global function
    global.window.showDirectoryPicker = jest.fn().mockImplementation(async () => {
        mockFileSystemState['root'] = {__isDirectoryMock: true}; // Simulate root exists in our mock FS state
        return {...mockDirectoryHandle, name: 'root', fullPath: ''}; // Root dir has an empty 'fullPath' string for our logic
    });

    // Reset implementations on the template mockDirectoryHandle to defaults
    // This ensures that if a test uses a directory handle created by spreading mockDirectoryHandle,
    // its getFileHandle/getDirectoryHandle methods have these general-purpose implementations.
    mockDirectoryHandle.getFileHandle.mockImplementation(async function (name, options) {
        const parentPath = this.fullPath !== undefined ? `${this.fullPath}/` : '';
        const fullPath = parentPath + name;
        if (mockFileSystemState[fullPath] && mockFileSystemState[fullPath].__isFileMock) {
            return {...mockFileHandle, name, fullPath};
        }
        if (options && options.create) {
            mockFileSystemState[fullPath] = {__isFileMock: true, content: new Uint8Array()};
            return {...mockFileHandle, name, fullPath};
        }
        const error = new Error(`Mock (default impl): File not found: ${name} in ${this.fullPath}`);
        error.name = 'NotFoundError';
        throw error;
    });
    mockDirectoryHandle.getDirectoryHandle.mockImplementation(async function (name, options) {
        const parentPath = this.fullPath !== undefined ? `${this.fullPath}/` : '';
        const fullPath = parentPath + name;
        if (mockFileSystemState[fullPath] && mockFileSystemState[fullPath].__isDirectoryMock) {
            return {...mockDirectoryHandle, name, fullPath};
        }
        if (options && options.create) {
            mockFileSystemState[fullPath] = {__isDirectoryMock: true};
            return {...mockDirectoryHandle, name, fullPath};
        }
        const error = new Error(`Mock (default impl): Directory not found: ${name} in ${this.fullPath}`);
        error.name = 'NotFoundError';
        throw error;
    });
});

afterEach(() => {
    // Restore original window.showDirectoryPicker if it was defined
    if (global.window) {
        global.window.showDirectoryPicker = originalShowDirectoryPicker;
    }
});


describe('BrowserStorageProvider - writeFileAtomically', () => {
    let storageProvider;
    let rootDirHandleMock; // This will be the specific instance returned by showDirectoryPicker

    beforeEach(() => {
        storageProvider = new BrowserStorageProvider({logger: mockLogger});

        rootDirHandleMock = {
            name: 'testRoot',
            kind: 'directory',
            fullPath: '', // Root directory's path for our mock logic
            getFileHandle: jest.fn(),
            getDirectoryHandle: jest.fn(),
            queryPermission: jest.fn().mockResolvedValue('granted'),
            requestPermission: jest.fn().mockResolvedValue('granted'),
            removeEntry: jest.fn(),
            values: jest.fn().mockImplementation(async function* () {
            }),
        };
        global.window.showDirectoryPicker.mockResolvedValue(rootDirHandleMock);
    });

    test('should successfully write data to a new file in the root', async () => {
        const filePath = 'newFile.sav';
        const data = new Uint8Array([1, 2, 3, 4, 5]);

        const createdFileHandleMock = {
            ...mockFileHandle,
            name: 'newFile.sav',
            fullPath: 'newFile.sav'
        };
        createdFileHandleMock.createWritable = jest.fn().mockImplementation(async function (options) {
            if (this.fullPath === undefined) throw new Error("createWritable context error: fullPath missing");
            return {...mockWritableStream, targetPath: this.fullPath};
        });

        rootDirHandleMock.getFileHandle.mockResolvedValue(createdFileHandleMock);

        const result = await storageProvider.writeFileAtomically(filePath, data);

        // Debug logging removed for brevity, add back if needed
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(global.window.showDirectoryPicker).toHaveBeenCalledTimes(1);
        expect(rootDirHandleMock.getFileHandle).toHaveBeenCalledWith('newFile.sav', {create: true});
        expect(createdFileHandleMock.createWritable).toHaveBeenCalledWith({keepExistingData: false});

        const streamInstance = await createdFileHandleMock.createWritable.mock.results[0].value;
        expect(streamInstance.write).toHaveBeenCalledWith(data);
        expect(streamInstance.close).toHaveBeenCalled();

        expect(mockFileSystemState['newFile.sav']).toEqual(data);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully wrote 5 bytes to file ${filePath}`));
    });

    test('should successfully write a file, creating an intermediate directory', async () => {
        const filePath = 'saves/myGame.sav';
        const data = new Uint8Array([10, 20, 30]);

        const savesDirHandleMock = {
            ...mockDirectoryHandle,
            name: 'saves',
            fullPath: 'saves',
            getFileHandle: jest.fn(),
            queryPermission: jest.fn().mockResolvedValue('granted'), // Ensure all methods exist
            requestPermission: jest.fn().mockResolvedValue('granted'),
        };
        const gameFileHandleMock = {
            ...mockFileHandle,
            name: 'myGame.sav',
            fullPath: 'saves/myGame.sav',
            createWritable: jest.fn().mockImplementation(async function (options) {
                if (this.fullPath === undefined) throw new Error("createWritable context error: fullPath missing");
                return {...mockWritableStream, targetPath: this.fullPath};
            })
        };

        rootDirHandleMock.getDirectoryHandle.mockImplementation(async (name, options) => {
            if (name === 'saves' && options.create) {
                mockFileSystemState['saves'] = {__isDirectoryMock: true};
                savesDirHandleMock.getFileHandle.mockResolvedValue(gameFileHandleMock);
                return savesDirHandleMock;
            }
            const error = new Error(`Mock: Directory not found or unexpected in root: ${name}`);
            error.name = 'NotFoundError';
            throw error;
        });

        const result = await storageProvider.writeFileAtomically(filePath, data);

        expect(result.success).toBe(true);
        expect(rootDirHandleMock.getDirectoryHandle).toHaveBeenCalledWith('saves', {create: true});
        expect(savesDirHandleMock.getFileHandle).toHaveBeenCalledWith('myGame.sav', {create: true});
        expect(gameFileHandleMock.createWritable).toHaveBeenCalledWith({keepExistingData: false});

        const streamInstance = await gameFileHandleMock.createWritable.mock.results[0].value;
        expect(streamInstance.write).toHaveBeenCalledWith(data);
        expect(streamInstance.close).toHaveBeenCalled();
        expect(mockFileSystemState['saves/myGame.sav']).toEqual(data);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully wrote 3 bytes to file ${filePath}`));
    });

    test('should return error if underlying fileHandle.createWritable fails', async () => {
        const filePath = 'errorFile.sav';
        const data = new Uint8Array([1]);

        const erroringFileHandleMock = {
            ...mockFileHandle,
            name: 'errorFile.sav',
            fullPath: 'errorFile.sav',
            createWritable: jest.fn().mockRejectedValue(new Error('Failed to create writable')),
        };
        rootDirHandleMock.getFileHandle.mockResolvedValue(erroringFileHandleMock);

        const result = await storageProvider.writeFileAtomically(filePath, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to create writable');
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error writing file ${filePath}`),
            expect.objectContaining({message: 'Failed to create writable'})
        );
    });

    test('should return error if writable.write fails', async () => {
        const filePath = 'writeError.sav';
        const data = new Uint8Array([1]);

        const mockStreamWithError = {
            // CORRECTED: Use regular function for write
            write: jest.fn().mockImplementation(async function (d) {
                throw new Error('Disk quota exceeded');
            }),
            close: jest.fn().mockResolvedValue(undefined),
            targetPath: 'writeError.sav' // Ensure targetPath is on the object if write uses it directly
        };
        const fileHandleMock = {
            ...mockFileHandle,
            name: 'writeError.sav',
            fullPath: 'writeError.sav',
            // This createWritable returns the mockStreamWithError which itself has targetPath
            createWritable: jest.fn().mockResolvedValue(mockStreamWithError),
        };
        rootDirHandleMock.getFileHandle.mockResolvedValue(fileHandleMock);

        const result = await storageProvider.writeFileAtomically(filePath, data);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Disk quota exceeded');
        expect(mockStreamWithError.write).toHaveBeenCalledWith(data);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error writing file ${filePath}`),
            expect.objectContaining({message: 'Disk quota exceeded'})
        );
    });

    test('should correctly handle paths with leading/trailing slashes', async () => {
        const filePathWithSlashes = '/slashedDir/slashedFile.sav/';
        const normalizedPath = 'slashedDir/slashedFile.sav';
        const dirName = 'slashedDir';
        const fileName = 'slashedFile.sav';
        const data = new Uint8Array([7, 8, 9]);

        const slashedDirHandleMock = {
            ...mockDirectoryHandle,
            name: dirName,
            fullPath: dirName,
            getFileHandle: jest.fn(),
            queryPermission: jest.fn().mockResolvedValue('granted'),
            requestPermission: jest.fn().mockResolvedValue('granted'),
        };
        const slashedFileHandleMock = {
            ...mockFileHandle,
            name: fileName,
            fullPath: normalizedPath,
            createWritable: jest.fn().mockImplementation(async function (options) {
                if (this.fullPath === undefined) throw new Error("createWritable context error: fullPath missing");
                return {...mockWritableStream, targetPath: this.fullPath};
            })
        };

        rootDirHandleMock.getDirectoryHandle.mockImplementation(async (name, options) => {
            if (name === dirName && options.create) {
                mockFileSystemState[dirName] = {__isDirectoryMock: true};
                slashedDirHandleMock.getFileHandle.mockResolvedValue(slashedFileHandleMock);
                return slashedDirHandleMock;
            }
            const error = new Error(`Mock: Directory (slashed) not found or unexpected: ${name}`);
            error.name = 'NotFoundError';
            throw error;
        });

        const result = await storageProvider.writeFileAtomically(filePathWithSlashes, data);

        expect(result.success).toBe(true);
        expect(rootDirHandleMock.getDirectoryHandle).toHaveBeenCalledWith(dirName, {create: true});
        expect(slashedDirHandleMock.getFileHandle).toHaveBeenCalledWith(fileName, {create: true});
        expect(slashedFileHandleMock.createWritable).toHaveBeenCalledWith({keepExistingData: false});

        const streamInstance = await slashedFileHandleMock.createWritable.mock.results[0].value;
        expect(streamInstance.write).toHaveBeenCalledWith(data);
        expect(streamInstance.close).toHaveBeenCalled();
        expect(mockFileSystemState[normalizedPath]).toEqual(data);
    });
});