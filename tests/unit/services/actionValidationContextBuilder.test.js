/* eslint-disable jsdoc/check-tag-names */
/** @jest-environment node */
/* eslint-enable jsdoc/check-tag-names */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

// NOTE: locationUtils is no longer a dependency of the context builder,
// so its mock can be removed.
// jest.mock('../../../src/utils/locationUtils.js', () => ({
//   getExitByDirection: jest.fn(),
// }));

jest.mock('../../../src/logic/componentAccessor.js', () => ({
  createComponentAccessor: jest.fn((entityId, entityManager) => {
    // Return a simple mock proxy for testing purposes
    return new Proxy(
      {},
      {
        get: (target, prop) => {
          return entityManager.getComponentData(entityId, prop);
        },
      }
    );
  }),
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
};

const createMockEntity = (id) => ({ id });

describe('ActionValidationContextBuilder', () => {
  let builder;

  const sampleActionDefinition = { id: 'action:test', name: 'Test Action' };
  const actorId = 'actor:1';
  const actorComponents = {
    [POSITION_COMPONENT_ID]: { locationId: 'loc:current' },
    Stats: { health: 10 },
    Location: { zone: 'start' },
  };
  const mockActor = createMockEntity(actorId);

  beforeEach(() => {
    jest.clearAllMocks();
    builder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  // (Constructor tests remain the same and should pass)
  it('should throw an error if EntityManager dependency is invalid', () => {
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: null,
          logger: mockLogger,
        })
    ).toThrow(
      'Missing required dependency: ActionValidationContextBuilder: entityManager.'
    );
    const incompleteEntityManager = { getEntityInstance: jest.fn() };
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: incompleteEntityManager,
          logger: mockLogger,
        })
    ).toThrow(
      "Invalid or missing method 'getComponentData' on dependency 'ActionValidationContextBuilder: entityManager'."
    );
  });

  it('should throw if ILogger dependency is invalid', () => {
    const validEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: validEntityManager,
          logger: null,
        })
    ).toThrow('Missing required dependency: logger.');
  });

  it('should successfully create an instance with valid dependencies', () => {
    expect(
      () =>
        new ActionValidationContextBuilder({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).not.toThrow();
  });

  describe('buildContext', () => {
    describe("Scenario 1: Target Type 'entity', Entity Found", () => {
      const targetId = 'target:A';
      const targetComponents = {
        Inventory: { items: ['key'] },
        State: { locked: false },
      };
      const mockTargetEntity = createMockEntity(targetId);
      const targetContext = ActionTargetContext.forEntity(targetId);

      beforeEach(() => {
        mockEntityManager.getEntityInstance.mockImplementation((id) =>
          id === targetId ? mockTargetEntity : null
        );
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (id === actorId) return actorComponents[componentId];
            if (id === targetId) return targetComponents[componentId];
            return undefined;
          }
        );
      });

      it('should build the context correctly (without target - handled by Scope DSL)', () => {
        const context = builder.buildContext(
          sampleActionDefinition,
          mockActor,
          targetContext
        );

        expect(context).toBeDefined();
        expect(context.actor.id).toBe(actorId);
        // Test that components is a proxy-like object
        expect(context.actor.components).toBeInstanceOf(Object);
        // Test that the proxy works by accessing a component through it
        expect(context.actor.components.Stats).toEqual({ health: 10 });

        // Target context removed - target filtering handled by Scope DSL
        expect(context.target).toBeUndefined();

        expect(context.action).toEqual({ id: sampleActionDefinition.id });

        expect(createComponentAccessor).toHaveBeenCalledWith(
          actorId,
          mockEntityManager,
          expect.objectContaining({
            debug: expect.any(Function),
            info: expect.any(Function),
            warn: expect.any(Function),
            error: expect.any(Function),
          })
        );
        // Target context no longer built for prerequisites
        expect(createComponentAccessor).toHaveBeenCalledTimes(1);
      });

      it('should handle target entity with no components gracefully (target context removed)', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (id === actorId) return actorComponents[componentId];
            if (id === targetId) return undefined; // Target has no components
          }
        );

        const context = builder.buildContext(
          sampleActionDefinition,
          mockActor,
          targetContext
        );

        // Target context removed - target filtering handled by Scope DSL
        expect(context.target).toBeUndefined();
      });

      it('should handle actor with no components gracefully', () => {
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (id === actorId) return undefined; // Actor has no components
            if (id === targetId) return targetComponents[componentId];
          }
        );

        const context = builder.buildContext(
          sampleActionDefinition,
          mockActor,
          targetContext
        );

        expect(context.actor.id).toBe(actorId);
        expect(context.actor.components).toBeInstanceOf(Object);
        expect(context.actor.components.any).toBeUndefined();
      });
    });

    describe("Scenario 2: Target Type 'entity', Entity Not Found", () => {
      const missingTargetId = 'target:missing';
      const targetContext = ActionTargetContext.forEntity(missingTargetId);

      beforeEach(() => {
        mockEntityManager.getEntityInstance.mockReturnValue(null);
      });

      it('should build the context without target (no warning since target context removed)', () => {
        const context = builder.buildContext(
          sampleActionDefinition,
          mockActor,
          targetContext
        );

        // Target context removed - target filtering handled by Scope DSL
        expect(context.target).toBeUndefined();
        // Warning no longer logged since target context is not built
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    // FIX: Remove the entire obsolete 'direction' scenario
    // describe("Scenario 3: Target Type 'direction'", () => { ... });

    describe("Scenario 4: Target Type 'none'", () => {
      const targetContext = ActionTargetContext.noTarget();

      it('should build the context correctly for no target (target context always undefined)', () => {
        const context = builder.buildContext(
          sampleActionDefinition,
          mockActor,
          targetContext
        );
        // Target context removed - target filtering handled by Scope DSL
        expect(context.target).toBeUndefined();
      });
    });

    describe('Scenario 5: Invalid Inputs', () => {
      it('should throw Error and log error for null actionDefinition', () => {
        const action = () =>
          builder.buildContext(null, mockActor, ActionTargetContext.noTarget());
        expect(action).toThrow(
          'ActionValidationContextBuilder.buildContext: invalid actionDefinition'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actionDefinition provided'),
          { actionDefinition: null }
        );
      });

      it('should throw Error and log error for actionDefinition without id', () => {
        const invalidActionDef = { name: 'Action without ID' };
        const action = () =>
          builder.buildContext(
            invalidActionDef,
            mockActor,
            ActionTargetContext.noTarget()
          );
        expect(action).toThrow(
          'ActionValidationContextBuilder.buildContext: invalid actionDefinition'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actionDefinition provided'),
          { actionDefinition: invalidActionDef }
        );
      });

      it('should throw Error and log error for null actor', () => {
        const action = () =>
          builder.buildContext(
            sampleActionDefinition,
            null,
            ActionTargetContext.noTarget()
          );
        expect(action).toThrow(
          'ActionValidationContextBuilder.buildContext: invalid actor entity'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actor entity provided'),
          { actor: null }
        );
      });

      it('should throw Error and log error for actor without id', () => {
        const invalidActor = {}; // No id
        const action = () =>
          builder.buildContext(
            sampleActionDefinition,
            invalidActor,
            ActionTargetContext.noTarget()
          );
        expect(action).toThrow(
          'ActionValidationContextBuilder.buildContext: invalid actor entity'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actor entity provided'),
          { actor: invalidActor }
        );
      });

      it('should throw Error and log error for null targetContext', () => {
        const action = () =>
          builder.buildContext(sampleActionDefinition, mockActor, null);
        expect(action).toThrow(
          'ActionValidationContextBuilder.buildContext: invalid ActionTargetContext'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid targetContext provided'),
          { targetContext: null }
        );
      });

      it('should throw Error and log error for targetContext without type', () => {
        const invalidTargetContext = { entityId: 'some-id' };
        const action = () =>
          builder.buildContext(
            sampleActionDefinition,
            mockActor,
            invalidTargetContext
          );
        expect(action).toThrow(
          'ActionValidationContextBuilder.buildContext: invalid ActionTargetContext'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid targetContext provided'),
          { targetContext: invalidTargetContext }
        );
      });

      it('should prioritize actionDefinition validation when all inputs are missing', () => {
        const action = () => builder.buildContext(null, null, null);
        expect(action).toThrow(
          'ActionValidationContextBuilder.buildContext: invalid actionDefinition'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid actionDefinition provided'),
          { actionDefinition: null }
        );
      });
    });
  });
});
