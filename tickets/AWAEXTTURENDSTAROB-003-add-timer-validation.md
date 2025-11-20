# AWAEXTTURENDSTAROB-003: Add Timer Function Validation

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-003
- **Phase:** 1 - Minimal Change
- **Priority:** High
- **Estimated Effort:** 1 hour
- **Dependencies:** AWAEXTTURENDSTAROB-002 (recommended, but can run parallel)

## Objective

Add validation to ensure `setTimeoutFn` and `clearTimeoutFn` are callable functions. This prevents cryptic runtime errors when the state attempts to schedule or clear timeouts, providing immediate feedback if invalid timer functions are provided.

## Files to Modify

### Production Code
- `src/turns/states/awaitingExternalTurnEndState.js`
  - Constructor (add validation after timeout validation)

## Changes Required

### 1. Add Timer Function Validation in Constructor
```javascript
// UPDATE constructor after timeout validation (~line 102):
constructor({
  context,
  logger,
  eventBus,
  endTurn,
  timeoutMs,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  // ... existing validation ...

  // Resolve and store timeout configuration
  this.#configuredTimeout = timeoutMs ?? this.#resolveDefaultTimeout();

  // Validate timeout is positive finite number
  if (!Number.isFinite(this.#configuredTimeout) || this.#configuredTimeout <= 0) {
    throw new InvalidArgumentError(
      `timeoutMs must be a positive finite number, got: ${this.#configuredTimeout} (type: ${typeof this.#configuredTimeout})`
    );
  }

  // ADD: Validate timer functions are callable
  if (typeof setTimeoutFn !== 'function') {
    throw new InvalidArgumentError(
      `setTimeoutFn must be a function, got: ${typeof setTimeoutFn}`
    );
  }

  if (typeof clearTimeoutFn !== 'function') {
    throw new InvalidArgumentError(
      `clearTimeoutFn must be a function, got: ${typeof clearTimeoutFn}`
    );
  }

  // ... rest of constructor (store timer functions) ...
}
```

## Out of Scope

### Must NOT Change
- Functional validation (verify they actually work as timers)
- Default assignment logic (already using `??` operators correctly)
- Timer function implementation or wrapping
- Test files (separate tickets)
- Mock timer validation in tests
- Environment provider validation (Phase 2)

### Must NOT Add
- Validation of timer function signatures (arity, parameter types)
- Validation that timers actually fire correctly
- Warnings for non-standard timer functions
- Automatic fallback to different timer functions

## Acceptance Criteria

### AC1: Reject Non-Function setTimeoutFn
```javascript
// GIVEN: Constructor called with { setTimeoutFn: "not-a-function" }
// WHEN: State instantiated
// THEN:
//   ✓ Throws InvalidArgumentError
//   ✓ Error message: "setTimeoutFn must be a function, got: string"
//   ✓ State not created
//   ✓ No resources allocated

// GIVEN: Constructor called with { setTimeoutFn: null }
// THEN:
//   ✓ Throws InvalidArgumentError
//   ✓ Error message: "setTimeoutFn must be a function, got: object"

// GIVEN: Constructor called with { setTimeoutFn: 123 }
// THEN:
//   ✓ Throws InvalidArgumentError
//   ✓ Error message: "setTimeoutFn must be a function, got: number"
```

### AC2: Reject Non-Function clearTimeoutFn
```javascript
// GIVEN: Constructor called with { clearTimeoutFn: null }
// WHEN: State instantiated
// THEN:
//   ✓ Throws InvalidArgumentError
//   ✓ Error message: "clearTimeoutFn must be a function, got: object"
//   ✓ State not created

// GIVEN: Constructor called with { clearTimeoutFn: {} }
// THEN:
//   ✓ Throws InvalidArgumentError
//   ✓ Error message: "clearTimeoutFn must be a function, got: object"

// GIVEN: Constructor called with { clearTimeoutFn: false }
// THEN:
//   ✓ Throws InvalidArgumentError
//   ✓ Error message: "clearTimeoutFn must be a function, got: boolean"
```

### AC3: Accept Valid Function References
```javascript
// GIVEN: Constructor called with { setTimeoutFn: setTimeout, clearTimeoutFn: clearTimeout }
// WHEN: State instantiated
// THEN:
//   ✓ No error thrown
//   ✓ State created successfully
//   ✓ Timer functions stored correctly

// GIVEN: Constructor called with custom timer functions:
const mockSetTimeout = (fn, ms) => 123;
const mockClearTimeout = (id) => {};
// { setTimeoutFn: mockSetTimeout, clearTimeoutFn: mockClearTimeout }
// THEN:
//   ✓ No error thrown
//   ✓ Functions accepted (type check only, not functional validation)
```

### AC4: Accept Arrow Functions and Bound Functions
```javascript
// GIVEN: Constructor called with arrow functions:
// { setTimeoutFn: (fn, ms) => {}, clearTimeoutFn: (id) => {} }
// WHEN: State instantiated
// THEN:
//   ✓ No error thrown
//   ✓ Arrow functions accepted

// GIVEN: Constructor called with bound functions:
// { setTimeoutFn: setTimeout.bind(null), clearTimeoutFn: clearTimeout.bind(null) }
// THEN:
//   ✓ No error thrown
//   ✓ Bound functions accepted
```

### AC5: Default Values Work Correctly
```javascript
// GIVEN: Constructor called without setTimeoutFn or clearTimeoutFn
// WHEN: State instantiated with defaults
// THEN:
//   ✓ No error thrown
//   ✓ Default setTimeout used
//   ✓ Default clearTimeout used
//   ✓ No validation errors
```

### AC6: Validation Happens Before State Setup
```javascript
// GIVEN: Constructor called with invalid timer function
// WHEN: Validation fails
// THEN:
//   ✓ Error thrown before event subscription
//   ✓ Error thrown before timeout initialization
//   ✓ No resources allocated (fail fast)
//   ✓ No cleanup needed
```

### AC7: Both Validations Can Fail Independently
```javascript
// GIVEN: Constructor called with { setTimeoutFn: null, clearTimeoutFn: clearTimeout }
// WHEN: State instantiated
// THEN:
//   ✓ Throws InvalidArgumentError for setTimeoutFn
//   ✓ Error about setTimeoutFn, not clearTimeoutFn

// GIVEN: Constructor called with { setTimeoutFn: setTimeout, clearTimeoutFn: null }
// THEN:
//   ✓ Throws InvalidArgumentError for clearTimeoutFn
//   ✓ Error about clearTimeoutFn only
```

### AC8: Existing Tests Still Pass
```javascript
// GIVEN: All existing unit and integration tests
// WHEN: npm run test:unit && npm run test:integration
// THEN:
//   ✓ All tests pass
//   ✓ Tests using valid timer functions unaffected
//   ✓ Tests using mock timers still work
```

## Invariants

### Configuration Guarantees (Must Enforce)
1. **Timer Functions Always Callable**: Both timer functions are functions (enforced)
2. **Fail Fast**: Invalid timer functions throw at construction
3. **Clear Messages**: Error messages specify which timer function is invalid
4. **Type Safety**: typeof check ensures callability

### State Lifecycle Invariants (Must Maintain)
1. **No Partial Construction**: Invalid config prevents state creation
2. **Resource Safety**: No resources allocated if validation fails
3. **Immediate Feedback**: Errors thrown synchronously from constructor

### API Contract Preservation (Must Maintain)
1. **Constructor Signature**: Unchanged (validation is internal)
2. **Error Types**: Uses project-standard `InvalidArgumentError`
3. **Default Behavior**: Default timer functions still work
4. **Backward Compatibility**: Valid inputs behave identically

## Testing Commands

### After Implementation
```bash
# Lint modified file
npx eslint src/turns/states/awaitingExternalTurnEndState.js

# Type check
npm run typecheck

# Run unit tests
npm run test:unit -- awaitingExternalTurnEndState

# Run integration tests
npm run test:integration -- awaitingExternalTurnEndState

# Full test suite
npm run test:ci
```

### Manual Verification
```bash
# In Node.js REPL or test file:
# const state = new AwaitingExternalTurnEndState({
#   setTimeoutFn: "invalid",
#   ...
# });
# Should throw: InvalidArgumentError: setTimeoutFn must be a function, got: string
```

## Implementation Notes

### Error Message Format
- **Pattern**: `${paramName} must be a function, got: ${typeof value}`
- **Examples**:
  - `setTimeoutFn must be a function, got: string`
  - `clearTimeoutFn must be a function, got: object`
  - `clearTimeoutFn must be a function, got: number`

### Validation Order
1. Timeout value validation (Ticket 002)
2. setTimeoutFn validation (this ticket)
3. clearTimeoutFn validation (this ticket)
4. Rest of constructor logic

### Type Check Only
- Only validates `typeof fn === 'function'`
- Does NOT validate:
  - Function signature (parameters, return type)
  - Function behavior (whether it actually sets timeouts)
  - Function side effects
  - Timing accuracy

## Definition of Done

- [ ] Validation for `setTimeoutFn` added
- [ ] Validation for `clearTimeoutFn` added
- [ ] Both use `typeof` check for function type
- [ ] Error messages specify parameter name and received type
- [ ] All 8 acceptance criteria verified
- [ ] All invariants maintained
- [ ] ESLint passes
- [ ] TypeScript passes
- [ ] All existing tests pass
- [ ] No new test files created (covered by existing tests or Ticket 005)
- [ ] Code review completed
- [ ] Diff manually reviewed (<15 lines changed)
