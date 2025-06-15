import { execFileSync } from 'child_process';

const ESBUILD_PATH = './node_modules/.bin/esbuild';

describe('Browser build', () => {
  it('bundles main entry without node built-ins', () => {
    execFileSync(ESBUILD_PATH, [
      'src/main.js',
      '--bundle',
      '--platform=browser',
      '--outfile=/tmp/out.js',
    ]);
  });
});
