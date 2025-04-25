// src/tests/core/ruleSystem.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../data/schemas/system-rule.schema.json').SystemRule} SystemRule */

// --- Mocks & Dependencies ---
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';

// --- Core Classes Under Test ---
import RuleLoader from '../../core/services/ruleLoader.js';
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
// We need a real EventBus instance for the interpreter to subscribe to
import OperationInterpreter from '../../logic/operationInterpreter.js';
import RealEventBus from '../../core/eventBus.js';


// Mock UUID generation for predictable IDs
import { v4 as uuidv4 } from 'uuid';
import OperationRegistry from '../../logic/operationRegistry';

// --- Mock UUID ---
// We need to mock the uuid library *before* it's imported by RuleLoader
const MOCK_UUID = 'mock-uuid-generated-for-rule';
jest.mock('uuid', () => ({
  v4: jest.fn(() => MOCK_UUID),
}));

// --- Sample Rules ---
const SAMPLE_RULE_WITH_ID = {
  rule_id: 'test_rule_1',
  event_type: 'TEST_EVENT_MATCH',
  condition: { '==': [1, 1] }, // Always true condition
  actions: [ { type: 'TEST_ACTION', parameters: { value: 1 } } ]
};
const SAMPLE_RULE_NO_ID = {
  // no rule_id property
  event_type: 'TEST_EVENT_MATCH', // Matches the same event
  condition: { '==': [ { 'var': 'event.payload.value' }, 42 ] }, // Condition requires payload
  actions: [ { type: 'TEST_ACTION', parameters: { value: 2 } } ]
};
const SAMPLE_RULE_OTHER_EVENT = {
  rule_id: 'test_rule_3',
  event_type: 'OTHER_EVENT',
  actions: [ { type: 'TEST_ACTION', parameters: { value: 3 } } ] // No condition
};

const RULE_FILE_1 = 'rule1_with_id.json';
const RULE_FILE_2 = 'rule2_no_id.json';
const RULE_FILE_3 = 'rule3_other.json';
const RULES_BASE_URL = 'http://test.com/data/system-rules/'; // Use a fake absolute URL

// --- Test Suite ---
describe('RULESYS-106: Rule System Integration Tests', () => {
  // --- Mocks & Instances ---
  /** @type {IPathResolver} */
  let mockPathResolver;
  /** @type {IDataFetcher} */
  let mockDataFetcher;
  /** @type {ISchemaValidator} */
  let mockSchemaValidator;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {JsonLogicEvaluationService} */
  let mockJsonLogicEvaluationService;
  /** @type {EntityManager} */
  let mockEntityManager;
  /** @type {IDataRegistry} */
  let dataRegistry; // Use real InMemoryDataRegistry
  /** @type {EventBus} */
  let eventBus; // Use real EventBus
  /** @type {RuleLoader} */
  let ruleLoader;
  /** @type {OperationInterpreter} */ // <-- ADD TYPE DEF
  let operationInterpreter;
  /** @type {SystemLogicInterpreter} */
  let interpreter;
  /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
  let operationRegistry;
  /** @type {jest.SpyInstance} */
  let processRuleSpy; // Spy on internal processing method
  /** @type {jest.SpyInstance} */
  let evaluateSpy; // Spy on jsonLogic evaluate
  /** @type {jest.SpyInstance} */ // <-- ADD SPY TYPE DEF (optional but good practice)
  let operationExecuteSpy;

  beforeEach(() => {
    // AC1: Test setup configures the DI container...
    // Reset mocks for each test
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    };

    mockPathResolver = {
      resolveContentPath: jest.fn((type, filename) => `${RULES_BASE_URL}${filename}`), // Simplified mock
    };

    // Mock DataFetcher
    mockDataFetcher = {
      fetch: jest.fn().mockImplementation(async (url) => {
        if (url === RULES_BASE_URL) {
          return {
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => [RULE_FILE_1, RULE_FILE_2, RULE_FILE_3]
          };
        }
        if (url === `${RULES_BASE_URL}${RULE_FILE_1}`) {
          return { ok: true, json: async () => ({ ...SAMPLE_RULE_WITH_ID }) };
        }
        if (url === `${RULES_BASE_URL}${RULE_FILE_2}`) {
          return { ok: true, json: async () => ({ ...SAMPLE_RULE_NO_ID }) };
        }
        if (url === `${RULES_BASE_URL}${RULE_FILE_3}`) {
          return { ok: true, json: async () => ({ ...SAMPLE_RULE_OTHER_EVENT }) };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      })
    };

    // Mock Schema Validator
    mockSchemaValidator = {
      addSchema: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      validate: jest.fn().mockImplementation((schemaId, data) => {
        return { valid: true, errors: null };
      }),
      errors: null
    };

    // Mock JsonLogic Evaluation Service
    mockJsonLogicEvaluationService = {
      evaluate: jest.fn().mockImplementation((rule, context) => {
        // Default implementation for tests - specific tests might override
        if (rule && rule['=='] && rule['=='][0] === 1 && rule['=='][1] === 1) return true; // Rule 1 default pass
        if (rule && rule['=='] && rule['=='][0]?.var === 'event.payload.value') { // Rule 2 check
          return context?.event?.payload?.value === rule['=='][1];
        }
        return false; // Default to false
      }),
      addOperation: jest.fn(),
    };
    evaluateSpy = jest.spyOn(mockJsonLogicEvaluationService, 'evaluate');

    // Mock EntityManager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    // Real instances needed for integration
    dataRegistry = new InMemoryDataRegistry();
    eventBus = new RealEventBus();

    // Instantiate RuleLoader
    ruleLoader = new RuleLoader(
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      dataRegistry,
      mockLogger
    );

    // Instantiate OperationRegistry <-- ADD THIS
    // Pass logger if its constructor accepts it (optional but good practice)
    operationRegistry = new OperationRegistry({ logger: mockLogger });

    // Instantiate OperationInterpreter (needed by SystemLogicInterpreter)
    // NOW pass BOTH logger and registry <-- MODIFY THIS LINE
    operationInterpreter = new OperationInterpreter({
      logger: mockLogger,
      registry: operationRegistry // <-- Pass the registry instance
    });
    operationExecuteSpy = jest.spyOn(operationInterpreter, 'execute');

    // Instantiate SystemLogicInterpreter (remains the same)
    interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: eventBus,
      dataRegistry: dataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
      operationInterpreter: operationInterpreter
    });

    // Spy on SystemLogicInterpreter's internal method for assertions
    // IMPORTANT: Spying on private methods (#) isn't directly possible.
    // Use a protected method (_) or make it public for testing if absolutely necessary.
    // Assuming _executeActions is accessible for spying based on previous code context.
    // If it's truly private (#), these tests need refactoring to assert on side effects
    // (like calls to operationInterpreter.execute) instead of internal methods.
    processRuleSpy = jest.spyOn(interpreter, '_executeActions');

    // Clear logs between tests
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    // Restore spies
    if (processRuleSpy) processRuleSpy.mockRestore();
    if (evaluateSpy) evaluateSpy.mockRestore();
    if (operationExecuteSpy) operationExecuteSpy.mockRestore(); // Restore operation spy too
    jest.restoreAllMocks(); // Clean up all mocks
  });

  // --- Test Cases ---

  it('AC2 & AC3: should orchestrate world loading sequence triggering RuleLoader.loadAll without unexpected errors', async () => {
    // Arrange: Setup is done in beforeEach

    // Act & Assert: Call loadAll and expect it to resolve without throwing
    await expect(ruleLoader.loadAll(RULES_BASE_URL)).resolves.toBeUndefined();

    // Assert: Check if logger indicates success (or absence of specific errors)
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RuleLoader.loadAll: Starting load process'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Discovered 3 potential rule file(s)'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RuleLoader: Load process finished. Successfully stored 3 rule(s)'));

    // Implicitly verifies AC2 (orchestration) and AC3 (no throw)
  });

  it('AC4: should store loaded rules correctly in IDataRegistry (including generated ID)', async () => {
    // Arrange: Load the rules first
    await ruleLoader.loadAll(RULES_BASE_URL);

    // Act: Retrieve rules from the registry
    const storedRules = dataRegistry.getAllSystemRules();

    // Assert: Check the stored rules
    expect(storedRules).toHaveLength(3);

    // Find rule with ID
    const rule1 = storedRules.find(r => r.rule_id === SAMPLE_RULE_WITH_ID.rule_id);
    expect(rule1).toBeDefined();
    expect(rule1).toEqual(expect.objectContaining(SAMPLE_RULE_WITH_ID)); // Check structure/content

    // Find rule that *should have* a generated ID
    // We mocked uuidv4 to return MOCK_UUID
    const rule2 = dataRegistry.get('system-rules', MOCK_UUID); // Fetch by generated ID
    expect(rule2).toBeDefined();
    expect(rule2).toEqual(expect.objectContaining(SAMPLE_RULE_NO_ID)); // Check structure/content
    expect(rule2.rule_id).toBeUndefined(); // Original rule object shouldn't have the ID added

    // Find rule 3
    const rule3 = storedRules.find(r => r.rule_id === SAMPLE_RULE_OTHER_EVENT.rule_id);
    expect(rule3).toBeDefined();
    expect(rule3).toEqual(expect.objectContaining(SAMPLE_RULE_OTHER_EVENT));

    // Verify the logger warning for the generated ID
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Rule from "${RULE_FILE_2}" is missing a valid 'rule_id'. Using generated UUID: "${MOCK_UUID}"`)
    );
  });

  it('AC5: should initialize SystemLogicInterpreter successfully after rules are loaded', async () => {
    // Arrange: Load rules first
    await ruleLoader.loadAll(RULES_BASE_URL);

    // Act & Assert: Initialize interpreter and expect no errors
    expect(() => interpreter.initialize()).not.toThrow();

    // Assert: Check initialization logs
    expect(mockLogger.info).toHaveBeenCalledWith('Loading and caching system rules by event type...');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Finished caching rules. 2 event types have associated rules.')); // TEST_EVENT_MATCH & OTHER_EVENT
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Subscribed to all events ('*') using the EventBus."));
    expect(mockLogger.info).toHaveBeenCalledWith('SystemLogicInterpreter successfully initialized and subscribed to events.');

    // Verify subscription occurred (indirectly checked by log, can also spy on eventBus.subscribe if needed)
    // expect(eventBus.subscribe).toHaveBeenCalledWith('*', expect.any(Function)); // Requires mocking the real EventBus subscribe
  });

  it('AC6 & AC7: should process a matching event and call _executeActions exactly once for a rule with a passing condition', async () => {
    // Arrange: Load rules and initialize interpreter
    await ruleLoader.loadAll(RULES_BASE_URL);
    interpreter.initialize();
    evaluateSpy.mockClear(); // Clear calls from potential IF statements if rules had them
    processRuleSpy.mockClear();

    // Mock evaluation result for SAMPLE_RULE_WITH_ID (its condition is { "==": [1, 1] })
    // Make sure only rule 1 passes for this specific test
    mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, context) => {
      if (rule && rule['=='] && rule['=='][0] === 1 && rule['=='][1] === 1) return true; // Rule 1 condition
      return false; // Rule 2 condition fails
    });

    // Define the matching event details
    const eventType = 'TEST_EVENT_MATCH';
    const eventPayload = { data: 'some_data' };
    // Define expected event structure within context for clarity in assertion
    const expectedEventInContext = { type: eventType, payload: eventPayload };

    // Act: Dispatch the event CORRECTLY
    await eventBus.dispatch(eventType, eventPayload); // Pass type and payload separately

    // Assert: Verify evaluation and processing
    // Rule 1 condition should be evaluated with the correct context
    expect(evaluateSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_WITH_ID.condition,
      expect.objectContaining({ event: expectedEventInContext })
    );

    // Rule 2 condition should also be evaluated (even if mocked to false)
    expect(evaluateSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_NO_ID.condition,
      expect.objectContaining({ event: expectedEventInContext })
    );

    // Total calls to evaluate should be 2 (one for each rule matching the event type)
    expect(evaluateSpy).toHaveBeenCalledTimes(2);


    // Verify _executeActions was called ONCE (only for Rule 1 whose condition passed)
    expect(processRuleSpy).toHaveBeenCalledTimes(1);
    expect(processRuleSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_WITH_ID.actions, // Check actions array
      expect.objectContaining({ event: expectedEventInContext }), // Check context passed to actions
      expect.stringContaining(`Rule '${SAMPLE_RULE_WITH_ID.rule_id}'`) // Scope description
    );
  });

  it('AC8: should not call _executeActions when dispatching an event that does not match any rule', async () => {
    // Arrange: Load rules and initialize interpreter
    await ruleLoader.loadAll(RULES_BASE_URL);
    interpreter.initialize();
    evaluateSpy.mockClear();
    processRuleSpy.mockClear();

    const eventType = 'NON_EXISTENT_EVENT';
    const eventPayload = {};

    // Act: Dispatch the non-matching event
    await eventBus.dispatch(eventType, eventPayload);

    // Assert: Verify that neither evaluation nor processing was called
    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(processRuleSpy).not.toHaveBeenCalled();
  });

  it('AC9: should call _executeActions once per matching rule when multiple rules match the same event', async () => {
    // Arrange: Load rules and initialize interpreter
    await ruleLoader.loadAll(RULES_BASE_URL);
    interpreter.initialize();
    evaluateSpy.mockClear();
    processRuleSpy.mockClear();

    // Mock evaluation results: Rule 1 condition passes, Rule 2 condition passes
    mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, context) => {
      if (rule && rule['=='] && rule['=='][0] === 1 && rule['=='][1] === 1) return true; // Rule 1
      if (rule && rule['=='] && rule['=='][0]?.var === 'event.payload.value') { // Rule 2
        // Check the actual payload value correctly now
        return context?.event?.payload?.value === 42;
      }
      return false;
    });

    // Define the matching event details
    const eventType = 'TEST_EVENT_MATCH';
    const eventPayload = { value: 42 }; // Payload makes Rule 2 condition pass
    const expectedEventInContext = { type: eventType, payload: eventPayload };

    // Act: Dispatch the event CORRECTLY
    await eventBus.dispatch(eventType, eventPayload); // Pass type and payload separately

    // Assert: Verify evaluation and processing
    expect(evaluateSpy).toHaveBeenCalledTimes(2); // Both rules evaluated

    // Check context passed for Rule 1 evaluation
    expect(evaluateSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_WITH_ID.condition,
      expect.objectContaining({ event: expectedEventInContext })
    );
    // Check context passed for Rule 2 evaluation
    expect(evaluateSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_NO_ID.condition,
      expect.objectContaining({ event: expectedEventInContext })
    );

    // Check _executeActions was called twice (once per passing rule)
    expect(processRuleSpy).toHaveBeenCalledTimes(2);

    // Check call arguments for rule 1
    expect(processRuleSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_WITH_ID.actions,
      expect.objectContaining({ event: expectedEventInContext }), // Check context
      expect.stringContaining(`Rule '${SAMPLE_RULE_WITH_ID.rule_id}'`)
    );
    // Check call arguments for rule 2
    expect(processRuleSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_NO_ID.actions,
      expect.objectContaining({ event: expectedEventInContext }), // Check context
      expect.stringContaining("Rule 'NO_ID'") // Uses 'NO_ID' for rules w/o rule_id
    );
  });

  it('should not call _executeActions for a matching rule if its condition evaluates to false', async () => {
    // Arrange: Load rules and initialize interpreter
    await ruleLoader.loadAll(RULES_BASE_URL);
    interpreter.initialize();
    evaluateSpy.mockClear();
    processRuleSpy.mockClear();
    mockLogger.info.mockClear(); // Clear logger calls from setup

    // Mock evaluation results: Rule 1 passes, Rule 2 FAILS
    mockJsonLogicEvaluationService.evaluate.mockImplementation((rule, context) => {
      if (rule && rule['=='] && rule['=='][0] === 1 && rule['=='][1] === 1) return true; // Rule 1 passes
      if (rule && rule['=='] && rule['=='][0]?.var === 'event.payload.value') {
        // Condition check: Will yield false for payload { value: 99 }
        return context?.event?.payload?.value === 42;
      }
      return false;
    });

    // Define the event details
    const eventType = 'TEST_EVENT_MATCH';
    const eventPayload = { value: 99 }; // Payload causes Rule 2 condition to fail
    const expectedEventInContext = { type: eventType, payload: eventPayload };

    // Act: Dispatch the event CORRECTLY
    await eventBus.dispatch(eventType, eventPayload); // Pass type and payload separately

    // Assert: Verify evaluation and processing
    expect(evaluateSpy).toHaveBeenCalledTimes(2); // Both rules evaluated

    // Check context for Rule 1 evaluation
    expect(evaluateSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_WITH_ID.condition,
      expect.objectContaining({ event: expectedEventInContext })
    );
    // Check context for Rule 2 evaluation
    expect(evaluateSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_NO_ID.condition,
      expect.objectContaining({ event: expectedEventInContext })
    );

    // Verify _executeActions was called only ONCE (for Rule 1)
    expect(processRuleSpy).toHaveBeenCalledTimes(1);
    expect(processRuleSpy).toHaveBeenCalledWith(
      SAMPLE_RULE_WITH_ID.actions,
      expect.objectContaining({ event: expectedEventInContext }), // Check context
      expect.stringContaining(`Rule '${SAMPLE_RULE_WITH_ID.rule_id}'`)
    );
    // Ensure it wasn't called for Rule 2
    expect(processRuleSpy).not.toHaveBeenCalledWith(
      SAMPLE_RULE_NO_ID.actions,
      expect.anything(), // Context doesn't matter here as it shouldn't be called
      expect.stringContaining("Rule 'NO_ID'")
    );

    // Check log message for skipped rule (using 'NO_ID')
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Rule 'NO_ID' actions skipped for event 'TEST_EVENT_MATCH' due to condition evaluating to false.")
    );
  });

});