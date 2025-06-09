import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import ResolutionStatus from '../../src/types/resolutionStatus.js';

const createMocks = () => {
  const logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const commandParser = { parse: jest.fn() };
  const targetResolutionService = { resolveActionTarget: jest.fn() };
  const validatedEventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(true),
  };
  const safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
  const worldContext = { getLocationOfEntity: jest.fn() };
  const entityManager = { getEntityInstance: jest.fn() };
  const gameDataRepository = { getActionDefinition: jest.fn() };

  const processor = new CommandProcessor({
    commandParser,
    targetResolutionService,
    logger,
    validatedEventDispatcher,
    safeEventDispatcher,
    worldContext,
    entityManager,
    gameDataRepository,
  });

  return {
    processor,
    logger,
    commandParser,
    targetResolutionService,
    validatedEventDispatcher,
    safeEventDispatcher,
    worldContext,
    entityManager,
    gameDataRepository,
  };
};

describe('CommandProcessor.processCommand', () => {
  /** @type {ReturnType<typeof createMocks>} */
  let mocks;

  beforeEach(() => {
    mocks = createMocks();
    jest.clearAllMocks();
  });

  test('returns failure when actor is invalid', async () => {
    const result = await mocks.processor.processCommand(null, 'look');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal error: Invalid actor.');
    expect(result.internalError).toBe('Invalid or missing actor provided.');
  });

  test('returns failure when command parser reports error', async () => {
    const actor = { id: 'actor1' };
    mocks.commandParser.parse.mockReturnValue({ error: 'bad command' });
    const result = await mocks.processor.processCommand(actor, 'bad command');
    expect(mocks.safeEventDispatcher.dispatch).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toBe('bad command');
    expect(result.internalError).toBe('Parsing Error: bad command');
    expect(result.originalInput).toBe('bad command');
  });

  test('processes command successfully', async () => {
    const actor = { id: 'actor1' };
    mocks.commandParser.parse.mockReturnValue({ actionId: 'core:look' });
    mocks.gameDataRepository.getActionDefinition.mockReturnValue({
      id: 'core:look',
      target_domain: 'none',
    });
    mocks.worldContext.getLocationOfEntity.mockReturnValue({ id: 'loc1' });
    mocks.targetResolutionService.resolveActionTarget.mockResolvedValue({
      status: ResolutionStatus.NONE,
      targetType: 'none',
      targetId: null,
    });
    const result = await mocks.processor.processCommand(actor, 'look');
    expect(result).toEqual({
      success: true,
      turnEnded: false,
      originalInput: 'look',
      actionResult: { actionId: 'core:look' },
    });
    expect(mocks.safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      'core:attempt_action',
      expect.any(Object)
    );
  });
});
