/* eslint-disable jsdoc/check-tag-names */
/** @jest-environment node */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { describe, test, expect } from '@jest/globals';

const execFileAsync = promisify(execFile);

describe('validateMods script', () => {
  test('runs and exits with code 1 when mods fail validation', async () => {
    let err = null;
    try {
      await execFileAsync('node', ['scripts/validateMods.mjs'], {
        maxBuffer: 1024 * 1024,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeTruthy();
    expect(err.code).not.toBe(0);
  });
});
