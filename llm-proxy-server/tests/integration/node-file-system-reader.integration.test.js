import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';

describe('NodeFileSystemReader integration with real file system', () => {
  let tempDir;
  let reader;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'node-fs-reader-'));
    reader = new NodeFileSystemReader();
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reads file contents without mocking the filesystem', async () => {
    const filePath = path.join(tempDir, 'example.txt');
    const expectedContent = 'integration file payload';
    await writeFile(filePath, expectedContent, 'utf-8');

    const content = await reader.readFile(filePath, 'utf-8');
    expect(content).toBe(expectedContent);
  });

  it('validates file paths before hitting the filesystem layer', async () => {
    await expect(reader.readFile('   ', 'utf-8')).rejects.toThrow(
      'NodeFileSystemReader.readFile: filePath must be a non-empty string.'
    );
  });

  it('surfaces errors from the underlying filesystem when files are missing', async () => {
    const missingPath = path.join(tempDir, 'missing.txt');

    await expect(reader.readFile(missingPath, 'utf-8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
