import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  formatEntityTarget,
  formatNoneTarget,
} from '../../../../src/actions/formatters/targetFormatters.js';

/**
 * @description Edge-case coverage for the target formatter helpers.
 */
describe('targetFormatters edge cases', () => {
  let logger;
  let entityManager;
  let displayNameFn;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    entityManager = {
      getEntityInstance: jest.fn(),
    };
    displayNameFn = jest.fn();
  });

  it('leaves the template unchanged when a custom placeholder is not present', () => {
    entityManager.getEntityInstance.mockReturnValue({ id: 'npc-7' });
    displayNameFn.mockReturnValue('Helpful Ally');

    const result = formatEntityTarget(
      'deliver {target}',
      {
        entityId: 'npc-7',
        placeholder: 'recipient',
      },
      {
        actionId: 'core:deliver',
        entityManager,
        displayNameFn,
        logger,
        debug: true,
      }
    );

    expect(result).toEqual({ ok: true, value: 'deliver {target}' });
    expect(logger.debug).toHaveBeenCalledWith(
      ' -> Found entity npc-7, display name: "Helpful Ally"'
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('still warns about stray placeholders for none targets when debug logging is disabled', () => {
    const result = formatNoneTarget(
      'wait for {target}',
      {},
      {
        actionId: 'core:wait',
        logger,
        debug: false,
      }
    );

    expect(result).toEqual({ ok: true, value: 'wait for {target}' });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Action core:wait has target_domain \'none\' but template "wait for {target}" contains placeholders.'
    );
  });
});
