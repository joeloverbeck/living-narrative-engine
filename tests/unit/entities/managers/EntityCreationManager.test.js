import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityCreationManager from '../../../../src/entities/managers/EntityCreationManager.js';
import { SerializedEntityError } from '../../../../src/errors/serializedEntityError.js';
import { validateDependency } from '../../../../src/utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../../src/utils/loggerUtils.js';

jest.mock('../../../../src/utils/dependencyUtils.js', () => ({
  __esModule: true,
  validateDependency: jest.fn(),
}));

jest.mock('../../../../src/utils/loggerUtils.js', () => ({
  __esModule: true,
  ensureValidLogger: jest.fn(),
}));

/**
 * Creates a logger mock with all expected methods.
 *
 * @returns {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }}
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('EntityCreationManager', () => {
  let rawLogger;
  let sanitizedLogger;
  let lifecycleManager;

  beforeEach(() => {
    jest.clearAllMocks();

    rawLogger = createLoggerMock();
    sanitizedLogger = createLoggerMock();
    lifecycleManager = {
      createEntityInstance: jest.fn(),
      reconstructEntity: jest.fn(),
    };

    ensureValidLogger.mockReturnValue(sanitizedLogger);
  });

  const instantiateManager = () =>
    new EntityCreationManager({ lifecycleManager, logger: rawLogger });

  it('validates dependencies and normalizes the logger during construction', () => {
    instantiateManager();

    expect(validateDependency).toHaveBeenNthCalledWith(
      1,
      rawLogger,
      'ILogger',
      console,
      { requiredMethods: ['info', 'error', 'warn', 'debug'] }
    );
    expect(ensureValidLogger).toHaveBeenCalledWith(
      rawLogger,
      'EntityCreationManager'
    );
    expect(validateDependency).toHaveBeenNthCalledWith(
      2,
      lifecycleManager,
      'EntityLifecycleManager',
      sanitizedLogger,
      { requiredMethods: ['createEntityInstance', 'reconstructEntity'] }
    );
    expect(sanitizedLogger.debug).toHaveBeenCalledWith(
      'EntityCreationManager initialized.'
    );
  });

  it('delegates entity creation to the lifecycle manager', async () => {
    const manager = instantiateManager();
    const definitionId = 'hero';
    const options = { instanceId: 'hero-001', componentOverrides: { foo: {} } };
    const createdEntity = { id: 'hero-001' };
    lifecycleManager.createEntityInstance.mockResolvedValue(createdEntity);

    const result = await manager.createEntityInstance(definitionId, options);

    expect(sanitizedLogger.debug).toHaveBeenCalledWith(
      "EntityCreationManager.createEntityInstance: Creating entity with definition 'hero'"
    );
    expect(lifecycleManager.createEntityInstance).toHaveBeenCalledWith(
      definitionId,
      options
    );
    expect(result).toBe(createdEntity);
  });

  it('throws SerializedEntityError when reconstructing without an object payload', () => {
    const manager = instantiateManager();

    expect(() => manager.reconstructEntity(null)).toThrow(
      SerializedEntityError
    );
    expect(() => manager.reconstructEntity(null)).toThrow(
      'EntityCreationManager.reconstructEntity: serializedEntity must be an object.'
    );
    expect(lifecycleManager.reconstructEntity).not.toHaveBeenCalled();
    expect(sanitizedLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Reconstructing entity')
    );
  });

  it('reconstructs entities through the lifecycle manager', () => {
    const manager = instantiateManager();
    const serializedEntity = {
      instanceId: 'npc-123',
      definitionId: 'villager',
      overrides: { 'core:name': { value: 'Villager' } },
    };
    const reconstructed = { id: 'npc-123' };
    lifecycleManager.reconstructEntity.mockReturnValue(reconstructed);

    const result = manager.reconstructEntity(serializedEntity);

    expect(sanitizedLogger.debug).toHaveBeenCalledWith(
      "EntityCreationManager.reconstructEntity: Reconstructing entity with ID 'npc-123'"
    );
    expect(lifecycleManager.reconstructEntity).toHaveBeenCalledWith(
      serializedEntity
    );
    expect(result).toBe(reconstructed);
  });
});
