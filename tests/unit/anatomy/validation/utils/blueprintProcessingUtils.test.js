import { describe, it, expect, beforeEach } from '@jest/globals';
import { ensureBlueprintProcessed } from '../../../../../src/anatomy/validation/utils/blueprintProcessingUtils.js';

describe('blueprintProcessingUtils.ensureBlueprintProcessed', () => {
  let logger;
  let dataRegistry;
  let slotGenerator;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    dataRegistry = {
      get: jest.fn(),
    };
    slotGenerator = {
      generateBlueprintSlots: jest.fn(),
    };
  });

  it('returns null when blueprint is null', async () => {
    const result = await ensureBlueprintProcessed({
      blueprint: null,
      dataRegistry,
      slotGenerator,
      logger,
    });

    expect(result).toBeNull();
    expect(dataRegistry.get).not.toHaveBeenCalled();
  });

  it('returns original blueprint when no structureTemplate is defined', async () => {
    const blueprint = { id: 'blueprint:no_template' };

    const result = await ensureBlueprintProcessed({
      blueprint,
      dataRegistry,
      slotGenerator,
      logger,
    });

    expect(result).toBe(blueprint);
    expect(dataRegistry.get).not.toHaveBeenCalled();
    expect(slotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
  });

  it('returns original blueprint when already processed', async () => {
    const blueprint = {
      id: 'blueprint:processed',
      structureTemplate: 'tpl',
      _generatedSockets: true,
    };

    const result = await ensureBlueprintProcessed({
      blueprint,
      dataRegistry,
      slotGenerator,
      logger,
    });

    expect(result).toBe(blueprint);
    expect(dataRegistry.get).not.toHaveBeenCalled();
  });

  it('warns and returns original blueprint when template is missing', async () => {
    const blueprint = { id: 'blueprint:v2', structureTemplate: 'missing:tpl' };
    dataRegistry.get.mockReturnValue(null);

    const result = await ensureBlueprintProcessed({
      blueprint,
      dataRegistry,
      slotGenerator,
      logger,
    });

    expect(result).toBe(blueprint);
    expect(logger.warn).toHaveBeenCalledWith(
      "BlueprintProcessingUtils: Structure template 'missing:tpl' not found, using raw blueprint"
    );
    expect(slotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
  });

  it('merges generated and additional slots with precedence for additionalSlots', async () => {
    const blueprint = {
      id: 'blueprint:v2',
      structureTemplate: 'tpl:dragon',
      additionalSlots: {
        leg_left: { socket: 'override_left' },
        tail: { socket: 'tail' },
      },
    };
    dataRegistry.get.mockReturnValue({ id: 'tpl:dragon' });
    slotGenerator.generateBlueprintSlots.mockReturnValue({
      leg_left: { socket: 'generated_left' },
      leg_right: { socket: 'generated_right' },
    });

    const result = await ensureBlueprintProcessed({
      blueprint,
      dataRegistry,
      slotGenerator,
      logger,
    });

    expect(result).not.toBe(blueprint);
    expect(result._generatedSockets).toBe(true);
    expect(result.slots).toEqual({
      leg_left: { socket: 'override_left' },
      leg_right: { socket: 'generated_right' },
      tail: { socket: 'tail' },
    });
    expect(slotGenerator.generateBlueprintSlots).toHaveBeenCalledWith({
      id: 'tpl:dragon',
    });
  });
});
