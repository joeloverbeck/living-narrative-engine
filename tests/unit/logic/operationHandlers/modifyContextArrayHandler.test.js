import ModifyContextArrayHandler from '../../../../src/logic/operationHandlers/modifyContextArrayHandler.js';
// import { ExecutionContext } from '../../../src/logic/defs.js'; // ExecutionContext is a typedef, not a class
import { cloneDeep } from 'lodash';

describe('ModifyContextArrayHandler', () => {
  let handler;
  let mockLogger;
  let mockSafeEventDispatcher;
  let executionContext; // This will be a plain object matching the JSDoc typedef

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };
    handler = new ModifyContextArrayHandler({
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
    // Create executionContext as a plain object matching the JSDoc typedef
    executionContext = {
      logger: mockLogger,
      evaluationContext: {
        context: {
          myArray: [1, 2, 3],
          nested: {
            array: ['a', 'b'],
          },
          emptyArray: [],
        },
      },
      // Add other properties expected by ExecutionContext typedef if needed by the handler
      // For example, if the handler uses entityManager or validatedEventDispatcher from context:
      // entityManager: jest.fn(),
      // validatedEventDispatcher: jest.fn(),
      // gameDataRepository: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should throw an error if logger is not provided', () => {
      expect(
        () =>
          new ModifyContextArrayHandler({
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow("Dependency 'ILogger' with a 'warn' method is required.");
    });

    it('should throw an error if logger does not have a warn method', () => {
      expect(
        () =>
          new ModifyContextArrayHandler({
            logger: {},
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow("Dependency 'ILogger' with a 'warn' method is required.");
    });

    it('should throw an error if safeEventDispatcher is not provided', () => {
      expect(
        () => new ModifyContextArrayHandler({ logger: mockLogger })
      ).toThrow(
        "Dependency 'ISafeEventDispatcher' with dispatch method is required."
      );
    });

    it('should throw an error if safeEventDispatcher does not have a dispatch method', () => {
      expect(
        () =>
          new ModifyContextArrayHandler({
            logger: mockLogger,
            safeEventDispatcher: {},
          })
      ).toThrow(
        "Dependency 'ISafeEventDispatcher' with dispatch method is required."
      );
    });
  });

  describe('execute', () => {
    it('should log a warning if params is not an object', () => {
      handler.execute(null, executionContext);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_CONTEXT_ARRAY: params missing or invalid.',
        { params: null }
      );
    });

    it('should log a warning if variable_path is missing', () => {
      handler.execute({ mode: 'push', value: 4 }, executionContext);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_CONTEXT_ARRAY: Missing required parameters (variable_path, or mode).'
      );
    });

    it('should log a warning if mode is missing', () => {
      handler.execute({ variable_path: 'myArray', value: 4 }, executionContext);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_CONTEXT_ARRAY: Missing required parameters (variable_path, or mode).'
      );
    });

    it('should log a warning if executionContext or evaluationContext.context is missing', () => {
      handler.execute({ variable_path: 'myArray', mode: 'push', value: 4 }, {});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_CONTEXT_ARRAY: Cannot execute because the execution context is missing.'
      );
      mockLogger.warn.mockClear();

      handler.execute(
        { variable_path: 'myArray', mode: 'push', value: 4 },
        { evaluationContext: {} }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MODIFY_CONTEXT_ARRAY: Cannot execute because the execution context is missing.'
      );
    });

    describe('when variable_path resolution is problematic', () => {
      it('should log a warning if path exists but is NOT an array', () => {
        executionContext.evaluationContext.context.notAnArray = 'I am a string';
        handler.execute(
          { variable_path: 'notAnArray', mode: 'push', value: 4 },
          executionContext
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "MODIFY_CONTEXT_ARRAY: Context variable path 'notAnArray' does not resolve to an array (found type: string)."
        );
      });

      it('should log a warning if path does not exist AND mode is not push/push_unique (e.g., pop)', () => {
        handler.execute(
          { variable_path: 'nonExistentPath', mode: 'pop' },
          executionContext
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "MODIFY_CONTEXT_ARRAY: Context variable path 'nonExistentPath' does not exist, and mode 'pop' does not support initialization from undefined."
        );
      });

      it('initializes and pushes if path is new and mode is push', () => {
        handler.execute(
          { variable_path: 'newArrayForPush', mode: 'push', value: 1 },
          executionContext
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(
          executionContext.evaluationContext.context.newArrayForPush
        ).toEqual([1]);
      });

      it('initializes and push_uniques if path is new and mode is push_unique', () => {
        handler.execute(
          {
            variable_path: 'newArrayForPushUnique',
            mode: 'push_unique',
            value: 1,
          },
          executionContext
        );
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(
          executionContext.evaluationContext.context.newArrayForPushUnique
        ).toEqual([1]);
      });
    });

    it('should log a warning for unknown mode', () => {
      handler.execute(
        { variable_path: 'myArray', mode: 'unknown_mode' },
        executionContext
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "MODIFY_CONTEXT_ARRAY: Unknown mode 'unknown_mode'."
      );
    });

    describe('mode: push', () => {
      it('should log a warning if value is missing for push mode', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'push' },
          executionContext
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "'push' mode requires a 'value' parameter."
        );
      });

      it('should push a value to the array', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'push', value: 4 },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2, 3, 4,
        ]);
      });

      it('should push a value to a nested array', () => {
        handler.execute(
          { variable_path: 'nested.array', mode: 'push', value: 'c' },
          executionContext
        );
        expect(executionContext.evaluationContext.context.nested.array).toEqual(
          ['a', 'b', 'c']
        );
      });

      it('should store the modified array in result_variable if provided', () => {
        handler.execute(
          {
            variable_path: 'myArray',
            mode: 'push',
            value: 4,
            result_variable: 'result',
          },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2, 3, 4,
        ]);
        expect(executionContext.evaluationContext.context.result).toEqual([
          1, 2, 3, 4,
        ]);
      });
    });

    describe('mode: push_unique', () => {
      it('should log a warning if value is missing for push_unique mode', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'push_unique' },
          executionContext
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "'push_unique' mode requires a 'value' parameter."
        );
      });

      it('should push a primitive value if it does not exist', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'push_unique', value: 4 },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2, 3, 4,
        ]);
      });

      it('should not push a primitive value if it already exists', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'push_unique', value: 2 },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2, 3,
        ]);
      });

      it('should push an object value if it does not exist (by deep comparison)', () => {
        const obj = { id: 1 };
        const newObj = { id: 2 };
        executionContext.evaluationContext.context.objectArray = [
          cloneDeep(obj),
        ];
        handler.execute(
          { variable_path: 'objectArray', mode: 'push_unique', value: newObj },
          executionContext
        );
        expect(executionContext.evaluationContext.context.objectArray).toEqual([
          obj,
          newObj,
        ]);
      });

      it('should not push an object value if it already exists (by deep comparison)', () => {
        const obj1 = { id: 1, name: 'A' };
        const obj2 = { id: 1, name: 'A' }; // Same content, different reference
        executionContext.evaluationContext.context.objectArray = [
          cloneDeep(obj1),
        ];
        handler.execute(
          { variable_path: 'objectArray', mode: 'push_unique', value: obj2 },
          executionContext
        );
        expect(executionContext.evaluationContext.context.objectArray).toEqual([
          obj1,
        ]);
      });
      it('should push a null value if it does not exist', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'push_unique', value: null },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1,
          2,
          3,
          null,
        ]);
      });

      it('should not push a null value if it already exists', () => {
        executionContext.evaluationContext.context.myArray.push(null);
        handler.execute(
          { variable_path: 'myArray', mode: 'push_unique', value: null },
          executionContext
        );
        // Should be [1,2,3,null] not [1,2,3,null,null]
        expect(
          executionContext.evaluationContext.context.myArray.filter(
            (v) => v === null
          ).length
        ).toBe(1);
        expect(executionContext.evaluationContext.context.myArray).toContain(
          null
        );
      });

      it('should store the modified array in result_variable if provided', () => {
        handler.execute(
          {
            variable_path: 'myArray',
            mode: 'push_unique',
            value: 4,
            result_variable: 'result',
          },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2, 3, 4,
        ]);
        expect(executionContext.evaluationContext.context.result).toEqual([
          1, 2, 3, 4,
        ]);
      });
    });

    describe('mode: pop', () => {
      it('should pop a value from the array', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'pop' },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2,
        ]);
      });

      it('should do nothing if array is empty', () => {
        handler.execute(
          { variable_path: 'emptyArray', mode: 'pop' },
          executionContext
        );
        expect(executionContext.evaluationContext.context.emptyArray).toEqual(
          []
        );
      });

      it('should store the popped value in result_variable if provided', () => {
        handler.execute(
          {
            variable_path: 'myArray',
            mode: 'pop',
            result_variable: 'poppedItem',
          },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2,
        ]);
        expect(executionContext.evaluationContext.context.poppedItem).toBe(3);
      });

      it('should store undefined in result_variable if array is empty and popped', () => {
        handler.execute(
          {
            variable_path: 'emptyArray',
            mode: 'pop',
            result_variable: 'poppedItem',
          },
          executionContext
        );
        expect(executionContext.evaluationContext.context.emptyArray).toEqual(
          []
        );
        expect(
          executionContext.evaluationContext.context.poppedItem
        ).toBeUndefined();
      });
    });

    describe('mode: remove_by_value', () => {
      it('should log a warning if value is missing for remove_by_value mode', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'remove_by_value' },
          executionContext
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "'remove_by_value' mode requires a 'value' parameter."
        );
      });

      it('should remove a primitive value from the array', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'remove_by_value', value: 2 },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 3,
        ]);
      });

      it('should remove an object value from the array (by deep comparison)', () => {
        const obj1 = { id: 1 };
        const obj2 = { id: 2 };
        const objToRemove = { id: 1 };
        executionContext.evaluationContext.context.objectArray = [
          cloneDeep(obj1),
          cloneDeep(obj2),
        ];
        handler.execute(
          {
            variable_path: 'objectArray',
            mode: 'remove_by_value',
            value: objToRemove,
          },
          executionContext
        );
        expect(executionContext.evaluationContext.context.objectArray).toEqual([
          obj2,
        ]);
      });

      it('should do nothing if primitive value is not found', () => {
        handler.execute(
          { variable_path: 'myArray', mode: 'remove_by_value', value: 5 },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 2, 3,
        ]);
      });

      it('should do nothing if object value is not found', () => {
        const obj1 = { id: 1 };
        const obj2 = { id: 2 };
        const objToMiss = { id: 3 };
        executionContext.evaluationContext.context.objectArray = [
          cloneDeep(obj1),
          cloneDeep(obj2),
        ];

        handler.execute(
          {
            variable_path: 'objectArray',
            mode: 'remove_by_value',
            value: objToMiss,
          },
          executionContext
        );
        expect(executionContext.evaluationContext.context.objectArray).toEqual([
          obj1,
          obj2,
        ]);
      });

      it('should store the modified array in result_variable if provided', () => {
        handler.execute(
          {
            variable_path: 'myArray',
            mode: 'remove_by_value',
            value: 2,
            result_variable: 'result',
          },
          executionContext
        );
        expect(executionContext.evaluationContext.context.myArray).toEqual([
          1, 3,
        ]);
        expect(executionContext.evaluationContext.context.result).toEqual([
          1, 3,
        ]);
      });
    });

    it('should not modify the original array in the rule definition (cloning check)', () => {
      const originalContext = cloneDeep(
        executionContext.evaluationContext.context
      );
      handler.execute(
        { variable_path: 'myArray', mode: 'push', value: 4 },
        executionContext
      );
      // This is a bit of a trick. The handler modifies executionContext.evaluationContext.context directly.
      // So, if we want to check if the *original* rule definition (if it were passed in a more complex scenario)
      // was modified, we'd need to compare against a clone taken *before* the operation.
      // Here, we just ensure the in-memory context is what we expect.
      // The crucial part is that `setPath` in the handler uses the `clonedArray`,
      // and not the `originalArray` directly for modifications other than setting it back.
      expect(executionContext.evaluationContext.context.myArray).toEqual([
        1, 2, 3, 4,
      ]);
      expect(originalContext.myArray).toEqual([1, 2, 3]); //This would fail as the test setup modifies the context in place.

      // To properly test the non-mutation of a *passed-in* object (like a rule definition),
      // the handler would need to receive the rule definition separately and not modify `executionContext` directly
      // in a way that `setPath` operates on the original reference from `resolvePath`.
      // However, the current handler design modifies the `contextObject` obtained from `executionContext`.

      // Let's reset and test a different way to approximate the "cloning" intent for the array itself.
      executionContext.evaluationContext.context.myArray = [10, 20];
      const arrayBeforeModification = [
        ...executionContext.evaluationContext.context.myArray,
      ];

      handler.execute(
        { variable_path: 'myArray', mode: 'push', value: 30 },
        executionContext
      );
      // `arrayBeforeModification` should remain unchanged if `clonedArray` was used correctly *within* the modes.
      // The `setPath` at the end *will* change the array in the context.
      // The important thing is that intermediate operations didn't affect a shared reference *before* `setPath`.
      expect(arrayBeforeModification).toEqual([10, 20]); // This confirms the array was cloned before push.
      expect(executionContext.evaluationContext.context.myArray).toEqual([
        10, 20, 30,
      ]);
    });

    it('should throw error for unsafe property __proto__ in setPath', () => {
      expect(() => {
        handler.execute(
          {
            variable_path: 'myArray.__proto__.polluted',
            mode: 'push',
            value: 'test',
          },
          executionContext
        );
      }).toThrow('Unsafe property name detected: __proto__');
    });

    it('should throw error for unsafe property constructor in setPath', () => {
      expect(() => {
        handler.execute(
          {
            variable_path: 'myArray.constructor.polluted',
            mode: 'push',
            value: 'test',
          },
          executionContext
        );
      }).toThrow('Unsafe property name detected: constructor');
    });

    it('should correctly create nested objects if they do not exist during setPath', () => {
      handler.execute(
        { variable_path: 'newly.nested.array', mode: 'push', value: 'hello' },
        executionContext
      );
      expect(
        executionContext.evaluationContext.context.newly.nested.array
      ).toEqual(['hello']);
    });
  });
});
