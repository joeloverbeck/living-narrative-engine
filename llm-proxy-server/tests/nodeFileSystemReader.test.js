import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { NodeFileSystemReader } from '../src/nodeFileSystemReader.js';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Utility to create temporary directories for file-based tests.
 * @returns {Promise<string>} path to the created directory
 */
const makeTempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'nfsr-'));

describe('NodeFileSystemReader', () => {
  let reader;
  let tempDir;
  let tempFile;

  beforeEach(async () => {
    reader = new NodeFileSystemReader();
    tempDir = await makeTempDir();
    tempFile = path.join(tempDir, 'sample.txt');
    await fs.writeFile(tempFile, 'hello', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('readFile returns file contents', async () => {
    const contents = await reader.readFile(tempFile, 'utf-8');
    expect(contents).toBe('hello');
  });

  test('readFile throws for invalid path input', async () => {
    await expect(reader.readFile('', 'utf-8')).rejects.toThrow(
      'NodeFileSystemReader.readFile: filePath must be a non-empty string.'
    );
    await expect(reader.readFile(123, 'utf-8')).rejects.toThrow(
      'NodeFileSystemReader.readFile: filePath must be a non-empty string.'
    );
  });

  test('readFile propagates filesystem errors', async () => {
    const badPath = path.join(tempDir, 'missing.txt');
    await expect(reader.readFile(badPath, 'utf-8')).rejects.toThrow();
  });
});
