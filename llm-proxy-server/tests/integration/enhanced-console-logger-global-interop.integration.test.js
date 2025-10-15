/**
 * @file enhanced-console-logger-global-interop.integration.test.js
 * @description Verifies that the enhanced console logger discovers Chalk via the
 *              legacy `global` reference when `globalThis` does not expose it.
 *              The test spins up a real Node process to exercise the module in a
 *              fault-injection scenario without mocking internal collaborators.
 */

import { describe, expect, it } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('Enhanced console logger global Chalk interoperability', () => {
  it('uses Chalk provided on the legacy global scope when globalThis lacks it', async () => {
    const script = `
      import path from 'node:path';

      const chalkCalls = {
        blue: [],
        green: [],
        yellow: [],
        red: [],
        redBold: [],
        cyan: [],
        gray: [],
        grayItalic: [],
      };

      const fakeChalk = {
        blue: (text) => { chalkCalls.blue.push(text); return 'blue:' + text; },
        green: (text) => { chalkCalls.green.push(text); return 'green:' + text; },
        yellow: (text) => { chalkCalls.yellow.push(text); return 'yellow:' + text; },
        red: Object.assign(
          (text) => { chalkCalls.red.push(text); return 'red:' + text; },
          { bold: (text) => { chalkCalls.redBold.push(text); return 'bold-red:' + text; } }
        ),
        cyan: (text) => { chalkCalls.cyan.push(text); return 'cyan:' + text; },
        gray: Object.assign(
          (text) => { chalkCalls.gray.push(text); return 'gray:' + text; },
          { italic: (text) => { chalkCalls.grayItalic.push(text); return 'italic-gray:' + text; } }
        ),
      };

      global.chalk = fakeChalk;
      global.globalThis = undefined;

      process.stdout.isTTY = true;
      process.stderr.isTTY = true;

      const infoCalls = [];
      const debugCalls = [];
      const warnCalls = [];

      const originalInfo = console.info;
      const originalDebug = console.debug;
      const originalWarn = console.warn;

      console.info = (...args) => { infoCalls.push(args); };
      console.debug = (...args) => { debugCalls.push(args); };
      console.warn = (...args) => { warnCalls.push(args); };

      const modulePath = 'file://' + path.resolve('./src/logging/enhancedConsoleLogger.js');
      const { getEnhancedConsoleLogger } = await import(modulePath);
      const logger = getEnhancedConsoleLogger();

      logger.info('Tracing global chalk path', { service: 'rate-limit' });
      logger.debug('Colour palette engaged');

      const result = {
        infoOutput: String(infoCalls.at(-1)?.[0] ?? ''),
        debugOutput: String(debugCalls.at(-1)?.[0] ?? ''),
        warnCount: warnCalls.length,
        warnMessages: warnCalls.map((entry) => String(entry[0] ?? '')),
        colorCalls: chalkCalls,
      };

      console.info = originalInfo;
      console.debug = originalDebug;
      console.warn = originalWarn;

      process.stdout.write(JSON.stringify(result));
    `;

    const { stdout } = await execFileAsync(
      'node',
      ['--input-type=module', '-e', script],
      {
        env: {
          ...process.env,
          NODE_ENV: 'development',
          LOG_ENHANCED_FORMATTING: 'true',
          LOG_COLOR_MODE: 'always',
          LOG_CONTEXT_PRETTY_PRINT: 'true',
        },
      }
    );

    const payload = JSON.parse(stdout);

    expect(payload.warnCount).toBe(0);
    expect(payload.colorCalls.blue[0]).toBe('test');
    expect(payload.colorCalls.green.length).toBeGreaterThanOrEqual(1);
    expect(payload.colorCalls.cyan.length).toBeGreaterThanOrEqual(1);
    expect(payload.infoOutput).toContain('green:');
    expect(payload.debugOutput).toContain('cyan:');
  });
});
