// src/tests/logic/operationHandlers/queryComponentHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js'; // Adjust path

// --- JSDoc Imports ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../src/logic/defs.js').ExecutionContext} ExecutionContext */

// --- Mocks ---
const mockEntityManager = {
  getComponentData: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Mock Execution Context ---
const mockActorId = 'actor-entity-1';
const mockTargetId = 'target-entity-2';
const mockSpecificId = 'specific-entity-3';

/** @type {ExecutionContext} */
const baseMockContext = {
  event: { type: 'UNIT_TEST_EVENT', payload: {} },
  actor: { id: mockActorId, name: 'Test Actor' },
  target: { id: mockTargetId, type: 'Test Target' },
  logger: mockLogger, // Default logger for context (REFERENCE to the mock object)
  evaluationContext: {
    actor: { id: mockActorId, name: 'Test Actor' },
    target: { id: mockTargetId, type: 'Test Target' },
    context: {},
  },
};

// Helper to create context variations - REVISED to avoid stripping logger functions
const getMockContext = (overrides = {}) => {
  // --- FIX: Avoid JSON.parse(JSON.stringify) for objects with functions ---
  // Perform a structured merge instead.
  // We need to be careful about deep cloning nested objects if necessary,
  // but the logger itself should be handled by reference or shallow copy.

  const base = baseMockContext; // Use the original object as the base

  // Create the merged object, starting with a shallow copy of the base
  const merged = {
    ...base,
    // Deep merge evaluationContext manually or using a safe clone method
    evaluationContext: {
      ...(base.evaluationContext), // Shallow copy base eval context properties
      context: { // Ensure context object is also copied/merged
        ...(base.evaluationContext?.context || {}),
      }
    },
    // Apply overrides - this will overwrite top-level properties like 'event', 'actor', 'target', 'logger' if provided
    ...overrides,
  };

  // If overrides included evaluationContext, merge it deeply again to be safe
  if (overrides.evaluationContext) {
    merged.evaluationContext = {
      ...(base.evaluationContext), // Start from base again
      ...(overrides.evaluationContext), // Apply overrides
      context: { // Ensure context within overridden evaluationContext is merged correctly
        ...(base.evaluationContext?.context || {}),
        ...(overrides.evaluationContext.context || {}),
      },
    };
  }

  // Ensure the logger is correctly assigned: use override if present, else use base's logger
  merged.logger = overrides.logger || base.logger;


  return merged;
};


// --- Test Suite ---
describe('QueryComponentHandler', () => {
  /** @type {QueryComponentHandler} */
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset EM mock behavior for each test
    mockEntityManager.getComponentData.mockReset();
    handler = new QueryComponentHandler({ entityManager: mockEntityManager, logger: mockLogger });
  });

  // --- Constructor Tests ---
  test('constructor should throw if EntityManager is missing or invalid', () => {
    expect(() => new QueryComponentHandler({ logger: mockLogger })).toThrow(/EntityManager/);
    expect(() => new QueryComponentHandler({ entityManager: {}, logger: mockLogger })).toThrow(/getComponentData/);
    expect(() => new QueryComponentHandler({ entityManager: { getComponentData: 'not-a-func' }, logger: mockLogger })).toThrow(/getComponentData/);
  });

  test('constructor should throw if ILogger is missing or invalid', () => {
    expect(() => new QueryComponentHandler({ entityManager: mockEntityManager })).toThrow(/ILogger/);
    expect(() => new QueryComponentHandler({ entityManager: mockEntityManager, logger: {} })).toThrow(/ILogger/);
    expect(() => new QueryComponentHandler({ entityManager: mockEntityManager, logger: { error: 'not-a-func' } })).toThrow(/ILogger/);
  });

  test('constructor should initialize successfully with valid dependencies', () => {
    expect(() => new QueryComponentHandler({ entityManager: mockEntityManager, logger: mockLogger })).not.toThrow();
  });

  // --- Entity Resolution Tests ---
  test('execute should correctly resolve entity_ref: "actor"', () => {
    const params = { entity_ref: 'actor', component_type: 'core:health', result_variable: 'actorHealth' };
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue({ hp: 100 }); // Simulate data found
    handler.execute(params, context);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockActorId, 'core:health');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('execute should correctly resolve entity_ref: "target"', () => {
    const params = { entity_ref: 'target', component_type: 'core:position', result_variable: 'targetPos' };
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue({ x: 1, y: 2 });
    handler.execute(params, context);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockTargetId, 'core:position');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('execute should correctly resolve entity_ref: { entityId: "..." }', () => {
    const params = { entity_ref: { entityId: mockSpecificId }, component_type: 'game:inventory', result_variable: 'invData' };
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue({ items: [] });
    handler.execute(params, context);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockSpecificId, 'game:inventory');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('execute should correctly resolve entity_ref: { entityId: " with_spaces " }', () => {
    const idWithSpaces = '  id_with_spaces  ';
    const trimmedId = 'id_with_spaces';
    const params = { entity_ref: { entityId: idWithSpaces }, component_type: 'game:inventory', result_variable: 'invData' };
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue({ items: [] });
    handler.execute(params, context);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(trimmedId, 'game:inventory');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });


  test('execute should interpret non-keyword string entity_ref as direct ID', () => {
    const params = { entity_ref: mockSpecificId, component_type: 'core:tag', result_variable: 'tags' };
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue(['enemy']);
    handler.execute(params, context);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockSpecificId, 'core:tag');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('execute should interpret non-keyword string entity_ref with spaces as trimmed direct ID', () => {
    const idWithSpaces = '  direct_id_with_spaces  ';
    const trimmedId = 'direct_id_with_spaces';
    const params = { entity_ref: idWithSpaces, component_type: 'core:tag', result_variable: 'tags' };
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue(['enemy']);
    handler.execute(params, context);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(trimmedId, 'core:tag');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('execute should log error and return if entity_ref: "actor" cannot be resolved', () => {
    const params = { entity_ref: 'actor', component_type: 'core:health', result_variable: 'health' };
    const context = getMockContext({ evaluationContext: { actor: null } }); // Actor missing
    handler.execute(params, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Cannot resolve 'actor'"), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(context.evaluationContext.context).not.toHaveProperty('health'); // Ensure result wasn't stored
  });

  test('execute should log error and return if entity_ref: "target" cannot be resolved', () => {
    const params = { entity_ref: 'target', component_type: 'core:health', result_variable: 'health' };
    const context = getMockContext({ evaluationContext: { target: { id: null } } }); // Target ID missing
    handler.execute(params, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Cannot resolve 'target'"), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(context.evaluationContext.context).not.toHaveProperty('health');
  });

  test('execute should log error and return if entity_ref object is invalid (missing entityId)', () => {
    const params = { entity_ref: { id: 'wrong_prop' }, component_type: 'core:health', result_variable: 'health' };
    const context = getMockContext();
    handler.execute(params, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid entity_ref parameter'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(context.evaluationContext.context).not.toHaveProperty('health');
  });

  test('execute should log error and return if entity_ref object has empty entityId', () => {
    const params = { entity_ref: { entityId: '  ' }, component_type: 'core:health', result_variable: 'health' };
    const context = getMockContext();
    handler.execute(params, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('entityId property is empty or whitespace'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(context.evaluationContext.context).not.toHaveProperty('health');
  });

  test('execute should log error and return if entity_ref string is empty or whitespace', () => {
    const params = { entity_ref: '  ', component_type: 'core:health', result_variable: 'health' };
    const context = getMockContext();
    handler.execute(params, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid empty string provided for entity_ref'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(context.evaluationContext.context).not.toHaveProperty('health');
  });

  // --- Parameter Validation Tests ---
  test('execute should log error and return if params is null or not object', () => {
    const context = getMockContext();
    handler.execute(null, context);
    expect(mockLogger.error).toHaveBeenCalledWith('QueryComponentHandler: Missing or invalid parameters object.', { params: null });
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    mockLogger.error.mockClear();

    handler.execute('invalid', context);
    expect(mockLogger.error).toHaveBeenCalledWith('QueryComponentHandler: Missing or invalid parameters object.', { params: 'invalid' });
  });

  test('execute should log error and return if component_type is missing or invalid', () => {
    const context = getMockContext();
    handler.execute({ entity_ref: 'actor', result_variable: 'res' }, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"component_type" parameter'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    mockLogger.error.mockClear();

    handler.execute({ entity_ref: 'actor', component_type: '  ', result_variable: 'res' }, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"component_type" parameter'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    expect(context.evaluationContext.context).not.toHaveProperty('res');
  });

  test('execute should log error and return if result_variable is missing or invalid', () => {
    const context = getMockContext();
    handler.execute({ entity_ref: 'actor', component_type: 'core:test' }, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"result_variable" parameter'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    mockLogger.error.mockClear();

    handler.execute({ entity_ref: 'actor', component_type: 'core:test', result_variable: '   ' }, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('"result_variable" parameter'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
  });

  test('execute should log error and return if evaluationContext.context is missing', () => {
    const params = { entity_ref: 'actor', component_type: 'core:health', result_variable: 'health' };
    const context = getMockContext();
    // Manually remove context for this test
    delete context.evaluationContext.context;

    handler.execute(params, context);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('evaluationContext.context is missing'), expect.anything());
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled(); // Should bail before calling EM
  });

  // --- Core Logic / EntityManager Call Tests ---
  test('execute should call entityManager.getComponentData and store object result', () => {
    const params = { entity_ref: 'actor', component_type: 'ns:comp', result_variable: 'compData' };
    const mockResult = { key: 'value', num: 123 };
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue(mockResult);

    handler.execute(params, context);

    expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockActorId, 'ns:comp');
    expect(context.evaluationContext.context['compData']).toEqual(mockResult); // Check value stored
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to query component'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried component "ns:comp" from entity "${mockActorId}". Result stored in "compData": ${JSON.stringify(mockResult)}`));
  });

  test('execute should call entityManager.getComponentData and store null result', () => {
    const params = { entity_ref: 'actor', component_type: 'ns:optionalComp', result_variable: 'maybeComp' };
    const mockResult = null; // Component exists but data is explicitly null
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue(mockResult);

    handler.execute(params, context);

    expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockActorId, 'ns:optionalComp');
    expect(context.evaluationContext.context['maybeComp']).toBeNull(); // Check value stored
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to query component'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully queried component "ns:optionalComp" from entity "${mockActorId}". Result stored in "maybeComp": null`));
  });

  test('execute should call entityManager.getComponentData and store undefined result (component not found)', () => {
    const params = { entity_ref: 'target', component_type: 'ns:nonexistent', result_variable: 'notFoundComp' };
    const mockResult = undefined; // Simulate component not found
    const context = getMockContext();
    mockEntityManager.getComponentData.mockReturnValue(mockResult);

    handler.execute(params, context);

    expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockTargetId, 'ns:nonexistent');
    expect(context.evaluationContext.context['notFoundComp']).toBeUndefined(); // Check value stored
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to query component'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Component "ns:nonexistent" not found on entity "${mockTargetId}". Stored 'undefined' in "notFoundComp".`));
  });


  test('execute should trim component_type and result_variable', () => {
    const params = { entity_ref: 'actor', component_type: '  padded:comp  ', result_variable: '  paddedVar  ' };
    const mockResult = { data: true };
    const context = getMockContext(); // Uses the logger from baseMockContext by default
    const trimmedCompType = 'padded:comp'; // For clarity in assertions
    const trimmedResultVar = 'paddedVar'; // For clarity in assertions

    mockEntityManager.getComponentData.mockReturnValue(mockResult);

    handler.execute(params, context);

    // --- Assertions ---
    expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
    expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(mockActorId, trimmedCompType); // Check EM call with trimmed type
    expect(context.evaluationContext.context[trimmedResultVar]).toEqual(mockResult); // Check context storage with trimmed variable name
    expect(context.logger.error).not.toHaveBeenCalled(); // Check context logger for errors

    // --- FIX: Correct the log message checks ---
    // Check the "Attempting" log message (includes the context variable)
    expect(context.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Storing result in context variable "${trimmedResultVar}"`)
    );

    // Check the "Successfully queried" log message (includes the stored variable and result)
    expect(context.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Result stored in "${trimmedResultVar}": ${JSON.stringify(mockResult)}`)
    );

    // Optionally, check the full messages for higher precision if desired:
    expect(context.logger.debug).toHaveBeenCalledWith(
      `QueryComponentHandler: Attempting to query component "${trimmedCompType}" from entity "${mockActorId}". Storing result in context variable "${trimmedResultVar}".`
    );
    expect(context.logger.debug).toHaveBeenCalledWith(
      `QueryComponentHandler: Successfully queried component "${trimmedCompType}" from entity "${mockActorId}". Result stored in "${trimmedResultVar}": ${JSON.stringify(mockResult)}`
    );
  });


  // --- Error Handling Tests ---
  test('execute should catch and log errors from entityManager.getComponentData', () => {
    const error = new Error('Internal EM Error during getComponentData');
    mockEntityManager.getComponentData.mockImplementationOnce(() => { throw error; });
    const params = { entity_ref: 'actor', component_type: 'ns:problematic', result_variable: 'problem' };
    const context = getMockContext();

    // Execute should not throw
    expect(() => handler.execute(params, context)).not.toThrow();

    expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error during EntityManager.getComponentData'),
      expect.objectContaining({ error: error.message })
    );
    // Ensure undefined was stored in the context variable on error
    expect(context.evaluationContext.context['problem']).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Stored 'undefined' in \"problem\" due to EntityManager error."));
  });

  // --- Context Logger Usage ---
  test('execute uses logger from execution context if available', () => {
    const specificLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const context = getMockContext({ logger: specificLogger });
    // Trigger an error condition (e.g., invalid params)
    handler.execute({ entity_ref: 'actor' /* missing other params */ }, context);

    expect(specificLogger.error).toHaveBeenCalled(); // Should be called on the context's logger
    expect(mockLogger.error).not.toHaveBeenCalled(); // Should NOT be called on the handler's default logger

    // Trigger a success condition
    specificLogger.debug.mockClear(); // Clear previous calls if any
    const params = { entity_ref: 'actor', component_type: 'core:test', result_variable: 'res' };
    mockEntityManager.getComponentData.mockReturnValue({ ok: true });
    handler.execute(params, context);
    expect(specificLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully queried component'));
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});