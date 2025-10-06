/**
 * @file Unit tests for the runtime helpers exported alongside the format action typedefs.
 * @see src/actions/formatters/formatActionTypedefs.js
 */

import { describe, expect, it } from '@jest/globals';
import {
  __formatActionTypedefs,
} from '../../../../src/actions/formatters/formatActionTypedefs.js';
import * as formatActionTypedefsModule from '../../../../src/actions/formatters/formatActionTypedefs.js';

const MODULE_RELATIVE_PATH = '../../../../src/actions/formatters/formatActionTypedefs.js';
const MODULE_SUFFIX = 'src/actions/formatters/formatActionTypedefs.js';

describe('formatActionTypedefs module', () => {
  it('exposes the coverage sentinel as a stable boolean export', () => {
    expect(typeof __formatActionTypedefs).toBe('boolean');
    expect(__formatActionTypedefs).toBe(true);

    const descriptor = Object.getOwnPropertyDescriptor(
      formatActionTypedefsModule,
      '__formatActionTypedefs',
    );

    expect(descriptor).toMatchObject({
      enumerable: true,
      value: true,
    });
  });

  it('only exposes the sentinel export on the module namespace object', () => {
    expect(Object.keys(formatActionTypedefsModule)).toEqual([
      '__formatActionTypedefs',
    ]);
  });

  it('supports dynamic import and resolves with the sentinel export intact', async () => {
    const moduleNamespace = await import(MODULE_RELATIVE_PATH);

    expect(moduleNamespace).toMatchObject({ __formatActionTypedefs: true });
    expect(Object.keys(moduleNamespace)).toEqual(['__formatActionTypedefs']);
  });

  it('registers statement coverage for the sentinel export', () => {
    const coverageEntries = Object.entries(globalThis.__coverage__ ?? {});
    const [coverageKey, fileCoverage] = coverageEntries.find(([key]) =>
      key.endsWith(MODULE_SUFFIX),
    ) ?? [undefined, undefined];

    expect(coverageKey).toBeDefined();
    expect(fileCoverage).toBeDefined();
    expect(Object.keys(fileCoverage.statementMap)).toEqual(['0']);
    expect(fileCoverage.statementMap['0']).toEqual(
      expect.objectContaining({
        start: expect.objectContaining({ line: 43 }),
      }),
    );
    expect(fileCoverage.s['0']).toBeGreaterThan(0);
  });

  it('supports the documented FormatActionCommandResult shapes through the TargetFormatterMap type', () => {
    /** @type {import('../../../../src/actions/formatters/formatActionTypedefs.js').TargetFormatterMap} */
    const formatters = {
      success(command, context, deps) {
        expect(context).toEqual({ entityId: 'npc-1', placeholder: 'friend' });
        expect(deps).toEqual({ logger: 'mock' });

        return {
          ok: true,
          value: command.replace('{target}', context.entityId),
        };
      },
      failure(command, context, deps) {
        expect(command).toBe('command {target}');
        expect(context).toEqual({});
        expect(deps).toEqual({ logger: 'mock' });

        return {
          ok: false,
          error: 'Missing entityId in context',
          details: 'Formatter requires context.entityId to build the command string.',
        };
      },
    };

    const successResult = formatters.success(
      'greet {target}',
      { entityId: 'npc-1', placeholder: 'friend' },
      { logger: 'mock' },
    );
    const failureResult = formatters.failure('command {target}', {}, { logger: 'mock' });

    expect(successResult).toEqual({ ok: true, value: 'greet npc-1' });
    expect(failureResult).toEqual({
      ok: false,
      error: 'Missing entityId in context',
      details: 'Formatter requires context.entityId to build the command string.',
    });
  });
});
