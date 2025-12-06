import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  formatEntityTarget,
  formatNoneTarget,
} from '../../../../src/actions/formatters/targetFormatters.js';
import { ENTITY as TARGET_TYPE_ENTITY } from '../../../../src/constants/actionTargetTypes.js';

/**
 * @description Additional coverage for edge cases in the target formatter helpers.
 */
describe('targetFormatters placeholder behavior', () => {
  let logger;
  let entityManager;
  let displayNameFn;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    entityManager = { getEntityInstance: jest.fn() };
    displayNameFn = jest.fn();
  });

  it('returns an error when entityId is missing', () => {
    const result = formatEntityTarget(
      'use {target}',
      { type: TARGET_TYPE_ENTITY },
      {
        actionId: 'core:use',
        entityManager,
        displayNameFn,
        logger,
        debug: false,
      }
    );

    expect(result).toEqual({
      ok: false,
      error:
        'formatActionCommand: Target context type is \'entity\' but entityId is missing for action core:use. Template: "use {target}"',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Target context type is \'entity\' but entityId is missing for action core:use. Template: "use {target}"'
    );
  });

  it('replaces custom placeholders and emits debug output when an entity is resolved', () => {
    const targetContext = {
      type: TARGET_TYPE_ENTITY,
      entityId: 'npc-42',
      placeholder: 'recipient',
    };
    const formatterDeps = {
      actionId: 'core:gift',
      entityManager,
      displayNameFn: displayNameFn.mockReturnValue('Friendly NPC'),
      logger,
      debug: true,
    };
    entityManager.getEntityInstance.mockReturnValue({ id: 'npc-42' });

    const result = formatEntityTarget(
      'give {recipient} the gem',
      targetContext,
      formatterDeps
    );

    expect(result).toEqual({ ok: true, value: 'give Friendly NPC the gem' });
    expect(displayNameFn).toHaveBeenCalledWith(
      { id: 'npc-42' },
      'npc-42',
      logger
    );
    expect(logger.debug).toHaveBeenCalledWith(
      ' -> Found entity npc-42, display name: "Friendly NPC"'
    );
  });

  it('warns but does not emit debug output when an entity is missing even in debug mode', () => {
    const targetContext = { type: TARGET_TYPE_ENTITY, entityId: 'npc-404' };
    const formatterDeps = {
      actionId: 'core:inspect',
      entityManager: {
        getEntityInstance: jest.fn(() => undefined),
      },
      displayNameFn,
      logger,
      debug: true,
    };

    const result = formatEntityTarget(
      'inspect {target}',
      targetContext,
      formatterDeps
    );

    expect(result).toEqual({ ok: true, value: 'inspect npc-404' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not find entity instance for ID npc-404')
    );
    expect(logger.debug).not.toHaveBeenCalled();
    expect(displayNameFn).not.toHaveBeenCalled();
  });

  it('logs both debug and warning messages when none-target templates contain placeholders', () => {
    const deps = { actionId: 'core:wait', logger, debug: true };

    const result = formatNoneTarget(
      'wait for {target}',
      { type: 'none' },
      deps
    );

    expect(result).toEqual({ ok: true, value: 'wait for {target}' });
    expect(logger.debug).toHaveBeenCalledWith(
      ' -> No target type, using template as is.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'formatActionCommand: Action core:wait has target_domain \'none\' but template "wait for {target}" contains placeholders.'
    );
  });
});
