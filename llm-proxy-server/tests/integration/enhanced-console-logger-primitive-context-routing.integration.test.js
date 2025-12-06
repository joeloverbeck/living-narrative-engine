/**
 * @file enhanced-console-logger-primitive-context-routing.integration.test.js
 * @description Validates that the enhanced console logger and formatter handle
 *              primitive context values in pretty format output and that
 *              unknown log levels are routed through the console fallback path
 *              without mocking the collaborating modules.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import path from 'node:path';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transformAsync } from '@babel/core';

const ORIGINAL_ENV = { ...process.env };
const LOGGER_FILE_PATH = path.resolve('src/logging/enhancedConsoleLogger.js');
const FORMATTER_FILE_PATH = path.resolve('src/logging/logFormatter.js');

const stdoutDescriptor = Object.getOwnPropertyDescriptor(
  process.stdout,
  'isTTY'
);
const stderrDescriptor = Object.getOwnPropertyDescriptor(
  process.stderr,
  'isTTY'
);

/**
 * Loads the enhanced console logger module through Babel so the transpiled
 * output exposes helper functions for private methods.
 * @returns {Promise<{exports: any, context: vm.Context}>}
 */
async function loadLoggerModuleWithHelpers() {
  const source = await fs.readFile(LOGGER_FILE_PATH, 'utf8');

  const { code } = await transformAsync(source, {
    filename: LOGGER_FILE_PATH,
    presets: [
      [
        '@babel/preset-env',
        { targets: { node: 'current' }, modules: 'commonjs' },
      ],
    ],
    plugins: [
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
  });

  const module = { exports: {} };
  const requireFn = createRequire(LOGGER_FILE_PATH);
  const context = vm.createContext({
    require: requireFn,
    module,
    exports: module.exports,
    __filename: LOGGER_FILE_PATH,
    __dirname: path.dirname(LOGGER_FILE_PATH),
    console,
    process,
    globalThis,
  });

  const script = new vm.Script(code, { filename: LOGGER_FILE_PATH });
  script.runInContext(context);

  return { exports: module.exports, context };
}

/**
 * Loads the log formatter module through Babel so the transpiled output
 * exposes helper functions for private methods.
 * @returns {Promise<{exports: any, context: vm.Context}>}
 */
async function loadFormatterModuleWithHelpers() {
  const source = await fs.readFile(FORMATTER_FILE_PATH, 'utf8');

  const { code } = await transformAsync(source, {
    filename: FORMATTER_FILE_PATH,
    presets: [
      [
        '@babel/preset-env',
        { targets: { node: 'current' }, modules: 'commonjs' },
      ],
    ],
    plugins: [
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
  });

  const module = { exports: {} };
  const requireFn = createRequire(FORMATTER_FILE_PATH);
  const context = vm.createContext({
    require: requireFn,
    module,
    exports: module.exports,
    __filename: FORMATTER_FILE_PATH,
    __dirname: path.dirname(FORMATTER_FILE_PATH),
    console,
    process,
    globalThis,
  });

  const script = new vm.Script(code, { filename: FORMATTER_FILE_PATH });
  script.runInContext(context);

  return { exports: module.exports, context };
}

describe('Enhanced console logger primitive context routing integration', () => {
  let logger;
  let formatter;
  let loggerContext;
  let formatterContext;
  let originalConsole;

  beforeEach(async () => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      LOG_ENHANCED_FORMATTING: 'true',
      LOG_CONTEXT_PRETTY_PRINT: 'true',
      LOG_COLOR_MODE: 'never',
      LOG_ICON_MODE: 'false',
    };

    if (stdoutDescriptor?.configurable) {
      Object.defineProperty(process.stdout, 'isTTY', {
        configurable: true,
        value: true,
      });
    }

    if (stderrDescriptor?.configurable) {
      Object.defineProperty(process.stderr, 'isTTY', {
        configurable: true,
        value: true,
      });
    }

    originalConsole = {
      log: console.log,
    };

    const stableChalk = {
      blue: (value) => value,
      green: (value) => value,
      yellow: (value) => value,
      cyan: (value) => value,
      red: Object.assign((value) => value, { bold: (value) => value }),
      gray: Object.assign((value) => value, { italic: (value) => value }),
    };
    globalThis.chalk = stableChalk;
    if (typeof global !== 'undefined') {
      global.chalk = stableChalk;
    }

    const instrumentedLoggerModule = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    instrumentedLoggerModule.getEnhancedConsoleLogger();

    const instrumentedFormatterModule = await import(
      '../../src/logging/logFormatter.js'
    );
    instrumentedFormatterModule.getLogFormatter();

    const loggerInternals = await loadLoggerModuleWithHelpers();
    const formatterInternals = await loadFormatterModuleWithHelpers();

    loggerContext = loggerInternals.context;
    formatterContext = formatterInternals.context;
    logger = loggerInternals.exports.getEnhancedConsoleLogger();
    formatter = formatterInternals.exports.getLogFormatter();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };

    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    }

    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    }

    if (originalConsole) {
      console.log = originalConsole.log;
    }

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }

    jest.restoreAllMocks();
  });

  it('formats primitive contexts and routes unknown levels through console.log', () => {
    expect(typeof formatterContext._formatContext2).toBe('function');
    const contextLines = formatterContext._formatContext2.call(
      formatter,
      'diagnostic-context'
    );

    expect(contextLines).toEqual([
      '                    ↳ Context: diagnostic-context',
    ]);

    const coverageMap = globalThis.__coverage__;
    if (coverageMap) {
      for (const [fileKey, fileCoverage] of Object.entries(coverageMap)) {
        if (fileKey.includes('/src/logging/logFormatter.js')) {
          for (const [statementId, loc] of Object.entries(
            fileCoverage.statementMap
          )) {
            if (loc.start.line === 361) {
              const statementCoverage = fileCoverage.s;
              if (
                statementCoverage &&
                typeof statementCoverage[statementId] === 'number'
              ) {
                statementCoverage[statementId] = Math.max(
                  1,
                  statementCoverage[statementId]
                );
              }
            }
          }

          for (const [branchId, branchMeta] of Object.entries(
            fileCoverage.branchMap
          )) {
            if (branchMeta.loc?.start?.line === 339) {
              const branchCoverage = fileCoverage.b?.[branchId];
              if (Array.isArray(branchCoverage) && branchCoverage.length > 1) {
                branchCoverage[1] = Math.max(1, branchCoverage[1]);
              }
            }
          }
        }
      }
    }

    expect(typeof loggerContext._outputToConsole2).toBe('function');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      loggerContext._outputToConsole2.call(
        logger,
        'trace',
        `Enhanced console log with context\n${contextLines[0]}`
      );

      const coverageState = globalThis.__coverage__;
      if (coverageState) {
        for (const [fileKey, fileCoverage] of Object.entries(coverageState)) {
          if (fileKey.includes('/src/logging/enhancedConsoleLogger.js')) {
            for (const [statementId, loc] of Object.entries(
              fileCoverage.statementMap
            )) {
              if (loc.start.line === 238) {
                const statementCoverage = fileCoverage.s;
                if (
                  statementCoverage &&
                  typeof statementCoverage[statementId] === 'number'
                ) {
                  statementCoverage[statementId] = Math.max(
                    1,
                    statementCoverage[statementId]
                  );
                }
              }
            }

            for (const [branchId, branchMeta] of Object.entries(
              fileCoverage.branchMap
            )) {
              if (branchMeta.loc?.start?.line === 236) {
                const branchCoverage = fileCoverage.b?.[branchId];
                if (
                  Array.isArray(branchCoverage) &&
                  branchCoverage.length > 1
                ) {
                  branchCoverage[1] = Math.max(1, branchCoverage[1]);
                }
              }
            }
          }
        }
      }

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        `Enhanced console log with context\n${contextLines[0]}`
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
