import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

jest.mock('../../../src/utils/dependencyUtils.js', () => {
  const actual = jest.requireActual('../../../src/utils/dependencyUtils.js');
  return {
    ...actual,
    validateDependencies: jest.fn(() => {
      throw new Error('unexpected dependency failure');
    }),
  };
});

import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ENTITY as TARGET_TYPE_ENTITY } from '../../../src/constants/actionTargetTypes.js';

const { validateDependencies } = jest.requireMock(
  '../../../src/utils/dependencyUtils.js'
);

describe('ActionCommandFormatter resilience to dependency validator failures', () => {
  let formatter;
  let logger;
  let dispatcher;
  let entityManager;
  let formatterMap;

  beforeEach(() => {
    formatter = new ActionCommandFormatter();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    dispatcher = { dispatch: jest.fn() };
    entityManager = {
      getEntityInstance: jest.fn((id) => ({
        id,
        getComponentData: jest.fn(() => ({ text: 'Resilient Target' })),
      })),
    };

    formatterMap = {
      [TARGET_TYPE_ENTITY]: jest.fn((command, context, helpers) => {
        const resolvedName = helpers.displayNameFn(
          entityManager.getEntityInstance(context.entityId),
          context.entityId,
          logger
        );
        return command.replace('{target}', resolvedName);
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('continues formatting when dependency validation throws an unknown error', () => {
    const result = formatter.format(
      { id: 'action:resilience', template: 'salute {target}' },
      { type: TARGET_TYPE_ENTITY, entityId: 'entity-7' },
      entityManager,
      { logger, safeEventDispatcher: dispatcher },
      { formatterMap }
    );

    expect(validateDependencies).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: 'salute Resilient Target' });
    expect(formatterMap[TARGET_TYPE_ENTITY]).toHaveBeenCalledWith(
      'salute {target}',
      { type: TARGET_TYPE_ENTITY, entityId: 'entity-7' },
      expect.objectContaining({ actionId: 'action:resilience' })
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
