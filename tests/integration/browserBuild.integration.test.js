
/* eslint-disable jsdoc/check-tag-names */
/** @jest-environment node */

import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs';
import { TextEncoder } from 'util';
import { execFileSync } from 'child_process';

describe('Browser build', () => {
  it('bundles main entry without node built-ins', () => {
    const outfile = join(tmpdir(), 'bundle.js');
    // esbuild relies on a native TextEncoder implementation
    global.TextEncoder = TextEncoder;
    const esbuildPath = require.resolve('esbuild/bin/esbuild');
    execFileSync(esbuildPath, [
      'src/main.js',
      '--bundle',
      '--platform=browser',
      `--outfile=${outfile}`,
    ]);
    expect(fs.existsSync(outfile)).toBe(true);
    fs.unlinkSync(outfile);
  });
});
