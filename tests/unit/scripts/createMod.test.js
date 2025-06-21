import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let tempDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lne-'));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('createMod script', () => {
  test('creates directory and manifest', async () => {
    const modId = 'testmod';
    await execFileAsync('node', ['scripts/createMod.mjs', modId], {
      env: { ...process.env, BASE_DATA_PATH: tempDir },
    });
    const modDir = path.join(tempDir, 'mods', modId);
    const manifestPath = path.join(modDir, 'mod-manifest.json');
    const stat = await fs.stat(manifestPath);
    expect(stat.isFile()).toBe(true);
    const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    expect(data.id).toBe(modId);
    expect(data.name).toBe(modId);
  });

  test('throws for blank modId', async () => {
    await expect(
      execFileAsync('node', ['scripts/createMod.mjs', '  '], {
        env: { ...process.env, BASE_DATA_PATH: tempDir },
      })
    ).rejects.toThrow();
  });
});
