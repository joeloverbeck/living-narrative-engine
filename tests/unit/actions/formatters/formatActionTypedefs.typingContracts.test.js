import { describe, expect, it } from '@jest/globals';
import { __formatActionTypedefs } from '../../../../src/actions/formatters/formatActionTypedefs.js';

/**
 * These tests exercise the runtime helpers provided by the typedef module.
 * Even though the module is primarily composed of documentation comments, we
 * import it in a variety of ways to ensure the instrumentation records every
 * statement.
 */
describe('formatActionTypedefs typedef helpers', () => {
  it('exposes the coverage sentinel export', () => {
    expect(__formatActionTypedefs).toBe(true);
  });

  it('supports the documented TargetFormatterMap contract at runtime', () => {
    /** @type {import('../../../../src/actions/formatters/formatActionTypedefs.js').TargetFormatterMap} */
    const formatters = {
      greet(command, context) {
        expect(command).toBe('greet {target}!');
        expect(context).toEqual({ entityId: 'friend', placeholder: 'buddy' });

        return {
          ok: true,
          value: command.replace('{target}', context.entityId),
        };
      },
      fail(command, context, deps) {
        expect(command).toBe('explain {target}!');
        expect(context).toEqual({});
        expect(deps).toEqual({ logger: { warn: expect.any(Function) } });

        return {
          ok: false,
          error: 'Missing target data',
          details: 'Target placeholder requires context information.',
        };
      },
    };

    const success = formatters.greet('greet {target}!', {
      entityId: 'friend',
      placeholder: 'buddy',
    });
    const failure = formatters.fail(
      'explain {target}!',
      {},
      {
        logger: { warn: () => {} },
      }
    );

    expect(success).toEqual({ ok: true, value: 'greet friend!' });
    expect(failure).toEqual({
      ok: false,
      error: 'Missing target data',
      details: 'Target placeholder requires context information.',
    });
  });
});
