# Multi-Target Resolution Robustness Specification

## Document Overview

This specification addresses production code robustness issues discovered during 100% branch coverage testing of the multi-target resolution pipeline. It documents failure patterns, establishes API contracts, and provides testing requirements to prevent future fragility.

**Analysis Scope:**
- `src/actions/pipeline/stages/MultiTargetResolutionStage.js` (664 lines)
- `src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js` (380 lines)
- `src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js`
- `src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js`

**Test Files:**
- `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.coverage.test.js`
- `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.test.js`

---

## Section 1: Context

### Module Location and Purpose

The multi-target resolution pipeline is part of the action discovery system located in `src/actions/pipeline/`. It resolves which entities an action can target based on scope definitions, handling both legacy single-target and modern multi-target formats.

### Architecture Overview

The `MultiTargetResolutionStage` follows a service-oriented design with clear separation of concerns:

| Service | Responsibility | Location |
|---------|---------------|----------|
| `MultiTargetResolutionStage` | Orchestration, iteration over candidates | `stages/MultiTargetResolutionStage.js` |
| `TargetResolutionTracingOrchestrator` | All tracing/telemetry capture | `services/implementations/TargetResolutionTracingOrchestrator.js` |
| `TargetResolutionResultBuilder` | Result assembly, backward compatibility | `services/implementations/TargetResolutionResultBuilder.js` |
| `TargetResolutionCoordinator` | Multi-target resolution with dependencies | `services/implementations/TargetResolutionCoordinator.js` |

### Data Flow

```
candidateActions[]
  → isLegacyAction() check
  → [Legacy] #resolveLegacyTarget() → buildLegacyResult()
  → [Modern] coordinateResolution() → attach metadata
  → buildFinalResult()
```

---

## Section 2: Problem

### What Failed

Coverage testing edge cases exposed fragile code that crashed when receiving unexpected inputs. Tests required workarounds (spy mocking, format adjustments) instead of the code gracefully handling edge cases.

### How It Failed

#### Issue 1: Real Service Crashes on Null Error Objects

**Location**: `TargetResolutionTracingOrchestrator.js:213-236`

```javascript
captureResolutionError(trace, actionDef, actor, error) {
  // ...
  const errorData = {
    stage: 'target_resolution',
    actorId: actor.id,
    resolutionFailed: true,
    error: error.message,          // CRASH: error could be null/undefined
    errorType: error.constructor?.name,
    scopeName: error.scopeName,
    timestamp: Date.now(),
  };
}
```

**Test Impact**: Tests throwing edge-case error objects (null, string, objects without `message`) crashed the real service instead of capturing the error data.

**Workaround Applied**: Spy mock to prevent real method execution:
```javascript
jest
  .spyOn(mockDeps.tracingOrchestrator, 'captureResolutionError')
  .mockImplementation(() => {});
```

#### Issue 2: Mock Format Mismatches

**Location**: Test mocks vs production expectations

```javascript
// Mock coordinator returns:
{ data: { actionsWithTargets: [...] } }

// But target resolver expects:
{ value: [], success: true }
```

**Test Impact**: Tests failed silently or produced unexpected behavior due to envelope format inconsistencies.

#### Issue 3: Dead Code from Defensive Programming

**Location**: `MultiTargetResolutionStage.js:422-427` (before fix)

```javascript
// Original code had unreachable branch:
const errorMessage = error?.scopeName
  ? `Scope resolution failed for '${error.scopeName}': ${error?.message || 'Unknown error'}`
  : error?.message || String(error) || 'Unknown error during target resolution';
  //                  ^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                  String(error)    DEAD CODE: String() always returns non-empty string
```

**Test Impact**: Branch coverage tools correctly reported unreachable code, requiring code removal rather than test addition.

#### Issue 4: Mixed Null-Safety Patterns

**Location**: Throughout both files

```javascript
// Inconsistent patterns found:
error.message                    // Direct access, crashes on null
error?.message                   // Optional chaining, safe
error?.message || 'Unknown'      // Coalescing, safe
```

**Test Impact**: Unpredictable behavior depending on which code path was exercised.

### Why It Failed

1. **No Explicit Null-Safety Contract**: Services don't document whether parameters can be null
2. **No Result Envelope Standard**: Each service uses different result formats
3. **Defensive Code Without Testing**: Fallback branches added without corresponding tests
4. **Integration Testing Gap**: Unit tests mocked services, missing real interaction bugs

---

## Section 3: Truth Sources

### Documentation

- `docs/architecture/target-resolution-services.md` - Service architecture
- `docs/architecture/multi-target-resolution-migration-guide.md` - Migration patterns
- `docs/architecture/diagrams/multi-target-resolution-architecture.md` - Visual diagrams

### Domain Rules

1. **Legacy actions** have `scope` property (string) or `targets` as string
2. **Modern actions** have `targets` as object with named target definitions
3. **Target resolution** may fail gracefully (empty results) or with errors (scope not found)

### External Contracts

- `PipelineResult.success()` / `PipelineResult.failure()` - Pipeline stage result contract
- `ITargetResolutionService.resolveTargets()` - Returns `{ success, value, errors }`

---

## Section 4: Desired Behavior

### Normal Cases

#### 4.1 Successful Legacy Target Resolution

```javascript
// Input
{ actionDef: { id: 'action:test', targets: 'scope:nearby_actors' }, actor: {...} }

// Expected Output
PipelineResult.success({
  data: {
    actionsWithTargets: [{ actionDef, resolvedTargets: {...} }],
    targetContexts: [{ entityId, displayName, placeholder }],
  }
})
```

#### 4.2 Successful Multi-Target Resolution

```javascript
// Input
{ actionDef: { id: 'action:test', targets: { primary: {...}, secondary: {...} } } }

// Expected Output
PipelineResult.success({
  data: {
    actionsWithTargets: [{
      actionDef,
      resolvedTargets: { primary: [...], secondary: [...] },
      targetDefinitions: { primary: {...}, secondary: {...} },
      isMultiTarget: true
    }],
  }
})
```

### Edge Cases

#### 4.3 Null/Undefined Error Objects in Tracing

**Input**: `captureResolutionError(trace, actionDef, actor, null)`

**Expected Behavior**:
- Method completes without throwing
- Captures error data with safe defaults:
  ```javascript
  {
    error: 'Unknown error',
    errorType: 'Unknown',
    scopeName: undefined,
  }
  ```

#### 4.4 String Error Objects

**Input**: `captureResolutionError(trace, actionDef, actor, 'Connection failed')`

**Expected Behavior**:
- Method completes without throwing
- Captures: `{ error: 'Connection failed', errorType: 'String' }`

#### 4.5 Missing Scope in Target Definitions

**Input**: `{ targetDefinitions: { primary: { placeholder: 'target' } } }` (no `scope`)

**Expected Behavior**:
- Falls back to `actionDef.targets` or `actionDef.scope`
- Logs warning about missing scope

#### 4.6 Empty Target Resolution

**Input**: Scope resolves to zero entities

**Expected Behavior**:
- Returns `actionsWithTargets: []`
- Does not throw error
- Logs info message

#### 4.7 Null actionContext in Legacy Resolution

**Input**: `{ actionContext: null }`

**Expected Behavior**:
- Diagnostic log shows `actionContextKeys: []`
- Resolution proceeds with empty context

### Failure Modes

#### 4.8 Scope Not Found Error

**Expected**:
- Throw error with `scopeName` property
- Error captured in tracing
- Error added to `errors` array in result

#### 4.9 Coordinator Resolution Failure

**Expected**:
- `PipelineResult.failure()` returned
- Tracing captures error data
- Stage continues processing remaining actions

### Invariants

Properties that must always hold:

1. **Null-Safe Tracing**: All `captureX` methods must never throw on null/undefined inputs
2. **Result Envelope Consistency**: All services return `{ success, data?, error? }` or `{ value, errors }`
3. **Action Iteration Isolation**: Error in one action doesn't prevent processing others
4. **Tracing Optional**: All tracing is conditional on `isActionAwareTrace`; absence of trace is valid

### API Contracts

#### TargetResolutionTracingOrchestrator

```typescript
interface ITargetResolutionTracingOrchestrator {
  // All methods must handle null/undefined inputs gracefully
  isActionAwareTrace(trace: any): boolean;

  captureLegacyDetection(trace: TraceLike, actionId: string, data: object): void;
  captureLegacyConversion(trace: TraceLike, actionId: string, data: object): void;
  captureScopeEvaluation(trace: TraceLike, actionId: string, targetKey: string, data: object): void;
  captureMultiTargetResolution(trace: TraceLike, actionId: string, data: object): void;
  captureResolutionData(trace: TraceLike, actionDef: object, actor: object, data: object, details?: object): void;

  // MUST handle: null, undefined, string, Error, object without message
  captureResolutionError(trace: TraceLike, actionDef: object, actor: object, error: any): void;

  capturePostResolutionSummary(trace: TraceLike, actor: object, ...metrics: any[]): void;
  capturePerformanceData(trace: TraceLike, actionDef: object, ...timing: any[]): Promise<void>;
  analyzeLegacyFormat(action: object): string;
}
```

#### Error Object Contract

```typescript
// Error parameter to captureResolutionError can be any of:
type ErrorInput =
  | null
  | undefined
  | string
  | Error
  | { message?: string; scopeName?: string; constructor?: { name: string } }
  | any;

// Output error data should normalize to:
interface NormalizedErrorData {
  error: string;           // Always non-empty string
  errorType: string;       // 'Unknown' if cannot determine
  scopeName?: string;      // Optional
}
```

#### Result Envelope Contract

```typescript
// Coordinator result
interface CoordinatorResult {
  success: boolean;
  data?: {
    actionsWithTargets: ActionWithTargets[];
    resolvedTargets?: Record<string, ResolvedTarget[]>;
    targetDefinitions?: Record<string, TargetDefinition>;
    targetContexts?: TargetContext[];
  };
  error?: string;
}

// Target resolver result
interface TargetResolverResult {
  success: boolean;
  value?: TargetContext[];  // Note: 'value' not 'data'
  errors?: Error[];
}
```

### What Is Allowed to Change

1. **Internal implementation details** of error normalization
2. **Private method signatures** (prefixed with `#`)
3. **Debug log content and format**
4. **Tracing payload structure** (additive changes only)
5. **Performance optimizations** that don't affect behavior

### What Must Not Change

1. **Public method signatures** on services
2. **Result envelope structure** (success, data, error keys)
3. **Null-safety guarantees** on public methods
4. **Pipeline stage interface** (executeInternal signature)

---

## Section 5: Testing Plan

### Tests to Add

#### 5.1 Null-Safety Property Tests

**File**: `tests/unit/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.null-safety.test.js`

```javascript
describe('captureResolutionError null-safety', () => {
  it.each([
    [null, 'null error'],
    [undefined, 'undefined error'],
    ['string error', 'string error'],
    [{ scopeName: 'test:scope' }, 'object without message'],
    [new Error('test'), 'standard Error'],
    [123, 'numeric error'],
    [{}, 'empty object'],
  ])('should handle %s without throwing', (errorInput, description) => {
    expect(() => {
      orchestrator.captureResolutionError(mockTrace, mockActionDef, mockActor, errorInput);
    }).not.toThrow();
  });
});
```

#### 5.2 Result Envelope Contract Tests

**File**: `tests/unit/actions/pipeline/services/ResultEnvelopeContract.test.js`

```javascript
describe('Result Envelope Contract', () => {
  it('coordinator returns { success, data } envelope', async () => {
    const result = await coordinator.coordinateResolution(context, trace);
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      expect(result).toHaveProperty('data');
    }
  });

  it('target resolver returns { success, value } envelope', async () => {
    const result = await targetResolver.resolveTargets(scope, actor, context, trace, actionId);
    expect(result).toHaveProperty('success');
    if (result.success) {
      expect(result).toHaveProperty('value');
      expect(Array.isArray(result.value)).toBe(true);
    }
  });
});
```

#### 5.3 Edge Case Regression Tests

**File**: `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.edge-cases.test.js`

```javascript
describe('MultiTargetResolutionStage edge cases', () => {
  describe('null actionContext', () => {
    it('should handle null actionContext gracefully', async () => {
      const context = createContext({ actionContext: null });
      const result = await stage.executeInternal(context);
      expect(result.success).toBeDefined();
    });
  });

  describe('empty displayName', () => {
    it('should use fallback resolver for empty string displayName', async () => {
      // Setup target context with displayName: ''
      const result = await stage.executeInternal(context);
      expect(result.data.targetContexts[0].displayName).not.toBe('');
    });
  });
});
```

### Regression Tests Required

1. **Coverage Preservation**: All branches covered in `MultiTargetResolutionStage.coverage.test.js` must remain covered
2. **Error Flow**: Tests must exercise error paths without spy mocking (after null-safety fixes)
3. **Integration**: Real service interactions should be tested in integration suite

### Property Tests Recommended

```javascript
// Fast-check property test for error normalization
import fc from 'fast-check';

describe('error normalization properties', () => {
  it('should always return non-empty error string', () => {
    fc.assert(fc.property(fc.anything(), (input) => {
      const result = normalizeError(input);
      return typeof result.error === 'string' && result.error.length > 0;
    }));
  });
});
```

### Test Organization

```
tests/
├── unit/actions/pipeline/
│   ├── stages/
│   │   ├── MultiTargetResolutionStage.test.js           # Core functionality
│   │   ├── MultiTargetResolutionStage.coverage.test.js  # Branch coverage
│   │   └── MultiTargetResolutionStage.edge-cases.test.js # Edge cases (NEW)
│   └── services/implementations/
│       ├── TargetResolutionTracingOrchestrator.test.js
│       ├── TargetResolutionTracingOrchestrator.null-safety.test.js # (NEW)
│       └── ResultEnvelopeContract.test.js                          # (NEW)
└── integration/actions/pipeline/
    └── TargetResolutionServiceInteraction.test.js                  # (NEW)
```

---

## Section 6: Recommended Code Changes

### 6.1 Fix Null-Safety in captureResolutionError

**File**: `src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js`

```javascript
captureResolutionError(trace, actionDef, actor, error) {
  if (!this.isActionAwareTrace(trace)) return;

  // Normalize error to safe values
  const errorMessage =
    typeof error === 'string' ? error :
    error?.message ?? String(error ?? 'Unknown error');

  const errorType =
    error?.constructor?.name ??
    (typeof error === 'string' ? 'String' : 'Unknown');

  const errorData = {
    stage: 'target_resolution',
    actorId: actor.id,
    resolutionFailed: true,
    error: errorMessage,
    errorType: errorType,
    scopeName: error?.scopeName,
    timestamp: Date.now(),
  };
  // ...
}
```

### 6.2 Document API Contracts in JSDoc

Add to each public method:

```javascript
/**
 * @param {any} error - Error to capture. Can be null, undefined, string, Error, or object.
 *                      Method will normalize to safe values.
 * @throws {never} This method never throws; all errors are captured internally.
 */
```

### 6.3 Add Result Type Assertions

```javascript
// In coordinator and resolver
const result = await this.#someService.resolve(...);
assert(
  typeof result?.success === 'boolean',
  'Service must return { success: boolean } envelope'
);
```

---

## Appendix: Coverage Test Workarounds Applied

The following workarounds were necessary during coverage testing and indicate code that should be made more robust:

| Line | Workaround | Root Cause |
|------|-----------|------------|
| 220 | Spy mock on `captureResolutionError` | Null-unsafe `error.message` access |
| 338 | Test with empty `targetDefinitions` | Fallback chain testing |
| 363-386 | Mock coordinator without `resolvedTargets` | Conditional property access |
| 400 | Mock without `targetDefinitions` | Metadata attachment conditional |
| 547 | Set `actionContext: null` | Optional chaining branch |
| 602 | Test with `displayName: ''` and `displayName: 123` | Type validation branches |

After implementing the recommended changes, these tests should work without spy mocking.
