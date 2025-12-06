import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import * as dependencyUtils from '../../../src/utils/dependencyUtils.js';
import { createMockLogger } from '../../common/mockFactories.js';

/**
 * Additional coverage for formatActionCommand when dependency validation throws
 * unexpected error messages that do not match known patterns.
 */
describe('formatActionCommand dependency validation fallbacks', () => {
  let logger;
  let dispatcher;
  let entityManager;
  let displayNameFn;

  beforeEach(() => {
    logger = createMockLogger();
    dispatcher = { dispatch: jest.fn() };
    entityManager = {
      getEntityInstance: jest.fn(() => ({
        id: 'target-99',
        name: 'Target 99',
      })),
    };
    displayNameFn = jest.fn(() => 'Target 99');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('continues formatting when dependency validation throws an unknown message', () => {
    const actionDefinition = {
      id: 'mystery-action',
      template: 'inspect {target}',
      name: 'Inspect',
      description: 'Inspect a mysterious target.',
    };
    const targetContext = ActionTargetContext.forEntity('target-99');
    const customFormatter = jest
      .fn()
      .mockImplementation((command, context, deps) => {
        expect(command).toBe('inspect {target}');
        expect(context).toBe(targetContext);
        expect(deps).toMatchObject({
          actionId: actionDefinition.id,
          entityManager,
          displayNameFn,
          logger,
          debug: false,
        });
        return { ok: true, value: `inspect ${context.entityId}` };
      });

    const validateSpy = jest
      .spyOn(dependencyUtils, 'validateDependencies')
      .mockImplementation(() => {
        throw new Error('unexpected dependency failure');
      });

    const result = formatActionCommand(
      actionDefinition,
      targetContext,
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      {
        displayNameFn,
        formatterMap: {
          entity: customFormatter,
        },
      }
    );

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(customFormatter).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: 'inspect target-99' });
  });
});
