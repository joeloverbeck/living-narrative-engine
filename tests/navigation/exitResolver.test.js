import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { resolveTargetExit } from '../../src/navigation/exitResolver.js';

/**
 * Creates a minimal logger mock with jest functions.
 *
 * @returns {{info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock}} Mock logger
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a mock validated event dispatcher.
 *
 * @returns {{dispatchValidated: jest.Mock}} Mock dispatcher
 */
function createMockBus() {
  return { dispatchValidated: jest.fn().mockResolvedValue(true) };
}

describe('navigation/exitResolver.resolveTargetExit', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let logger;
  /** @type {ReturnType<typeof createMockBus>} */
  let bus;

  beforeEach(() => {
    logger = createMockLogger();
    bus = createMockBus();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns exit for unique direction match', async () => {
    const exitData = { direction: 'north' };
    const findFn = jest.fn().mockReturnValue({
      directionMatches: [exitData],
      nameMatches: [],
    });
    const context = { validatedEventDispatcher: bus, logger };

    const result = await resolveTargetExit(context, 'north', 'go', findFn);

    expect(result).toBe(exitData);
    expect(bus.dispatchValidated).not.toHaveBeenCalled();
  });

  test('returns exit for unique name match', async () => {
    const exitData = { direction: 'east' };
    const findFn = jest.fn().mockReturnValue({
      directionMatches: [],
      nameMatches: [exitData],
    });
    const context = { validatedEventDispatcher: bus, logger };

    const result = await resolveTargetExit(context, 'east', 'go', findFn);

    expect(result).toBe(exitData);
    expect(bus.dispatchValidated).not.toHaveBeenCalled();
  });

  test('dispatches warning when multiple direction matches', async () => {
    const findFn = jest.fn().mockReturnValue({
      directionMatches: [{}, {}],
      nameMatches: [],
    });
    const context = { validatedEventDispatcher: bus, logger };

    const result = await resolveTargetExit(context, 'north', 'go', findFn);

    expect(result).toBeNull();
    expect(bus.dispatchValidated).toHaveBeenCalledWith(
      'textUI:display_message',
      expect.objectContaining({ type: 'warning' })
    );
  });

  test('dispatches warning when multiple name matches', async () => {
    const findFn = jest.fn().mockReturnValue({
      directionMatches: [],
      nameMatches: [{}, {}],
    });
    const context = { validatedEventDispatcher: bus, logger };

    const result = await resolveTargetExit(context, 'north', 'go', findFn);

    expect(result).toBeNull();
    expect(bus.dispatchValidated).toHaveBeenCalledWith(
      'textUI:display_message',
      expect.objectContaining({ type: 'warning' })
    );
  });

  test('dispatches not-found message when no matches', async () => {
    const findFn = jest
      .fn()
      .mockReturnValue({ directionMatches: [], nameMatches: [] });
    const context = { validatedEventDispatcher: bus, logger };

    const result = await resolveTargetExit(context, 'nowhere', 'go', findFn);

    expect(result).toBeNull();
    expect(bus.dispatchValidated).toHaveBeenCalledWith(
      'textUI:display_message',
      expect.objectContaining({ type: 'info' })
    );
  });

  test('logs error and returns null when dispatcher missing', async () => {
    const findFn = jest.fn();
    const context = { logger };

    const result = await resolveTargetExit(context, 'north', 'go', findFn);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  test('uses default finder to locate exit data', async () => {
    // Build minimal entity objects
    const northRoom = {
      id: 'loc:north',
      getComponentData: jest.fn().mockReturnValue({ value: 'North Room' }),
    };
    const guard = {
      id: 'npc:guard',
      getComponentData: jest.fn().mockReturnValue({ value: 'Guard' }),
    };
    const location = {
      id: 'loc:start',
      getComponentData: jest.fn((cid) => {
        if (cid === 'core:exits')
          return [
            { direction: 'north', target: northRoom.id, blocker: guard.id },
          ];
        return null;
      }),
    };
    const entityManager = {
      getEntityInstance: jest.fn((id) => {
        if (id === northRoom.id) return northRoom;
        if (id === guard.id) return guard;
        return null;
      }),
    };
    const context = {
      validatedEventDispatcher: bus,
      logger,
      currentLocation: location,
      entityManager,
    };

    const result = await resolveTargetExit(context, 'north');

    expect(result).toEqual({
      direction: 'north',
      targetLocationEntity: northRoom,
      blockerEntity: guard,
    });
  });
});
