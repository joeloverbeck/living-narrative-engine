# JSOLOGCUSOPEREF-010: Add TypeScript Declaration Types

**Priority**: 🔵 Low
**Estimated Effort**: 4 hours
**Phase**: 4 - Polish
**Status**: ❌ Not Viable

---

## Summary

The operator files use JSDoc types but lack TypeScript declaration files. Adding `.d.ts` files will improve IDE support, catch type errors earlier, and document the expected interfaces for operators.

---

## Reason for Cancellation

This ticket was cancelled because it is incompatible with the project's established architecture:

1. **Architectural Mismatch**: The Living Narrative Engine is a pure JavaScript (ES6+) project that intentionally uses JSDoc annotations for type hints. There are no `.ts` or `.d.ts` files anywhere in `src/`.

2. **Maintenance Burden**: Adding `.d.ts` declaration files would create a maintenance burden where types must be manually kept in sync with JavaScript implementations. This is error-prone and contradicts the project's design philosophy.

3. **Minimal Benefit**: JSDoc annotations already provide IDE support (hover types, autocomplete, type checking via `checkJs: true` in tsconfig.json). Adding separate declaration files provides negligible additional benefit.

4. **No Precedent**: This would be the first `.d.ts` file in the project, breaking consistency with the established "JS + JSDoc" pattern used throughout the codebase.

---

## Outcome

**Decision**: Ticket closed as "Not Viable"
**Date**: 2025-12-17
**Rationale**: The proposed changes conflict with the project's JavaScript-only architecture. The existing JSDoc + TypeScript type-checking (`checkJs: true`) approach already provides the type safety and IDE support that this ticket aimed to achieve.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/types.d.ts` | Create - type declarations |
| `src/logic/operators/types.d.ts` | Create - operator-specific types |

---

## Out of Scope

**DO NOT modify:**
- Any `.js` files (only create `.d.ts` files)
- Project TypeScript configuration (unless necessary for declarations)
- Test files
- Any files outside `src/logic/`

---

## Implementation Details

### Step 1: Create Main Logic Types

```typescript
// src/logic/types.d.ts

/**
 * Result from an operator evaluation.
 * Currently all operators return boolean, but this allows future flexibility.
 */
export interface OperatorResult {
  value: boolean;
  error?: string;
}

/**
 * Evaluation context passed to operators.
 * Contains entity references and event data.
 */
export interface OperatorContext {
  /** Actor entity ID or reference */
  actor?: string | EntityReference;
  /** Target entity ID or reference */
  target?: string | EntityReference;
  /** Secondary target entity ID or reference */
  secondaryTarget?: string | EntityReference;
  /** Current game event being processed */
  event?: GameEvent;
  /** Internal path tracking (set by operators) */
  _currentPath?: string;
  /** Operator-specific metadata namespaces */
  _bodyPartOperatorMeta?: OperatorMeta;
  _furnitureOperatorMeta?: OperatorMeta;
  _lightingOperatorMeta?: OperatorMeta;
}

interface OperatorMeta {
  currentPath?: string;
  [key: string]: unknown;
}

interface EntityReference {
  id: string;
  [key: string]: unknown;
}

interface GameEvent {
  type: string;
  payload?: Record<string, unknown>;
}
```

### Step 2: Create Operator Types

```typescript
// src/logic/operators/types.d.ts

import { ILogger } from '../../interfaces/coreServices';
import { IEntityManager } from '../../entities/interfaces';
import { OperatorContext } from '../types';

/**
 * Base dependencies required by most operators.
 */
export interface BaseOperatorDependencies {
  logger: ILogger;
  entityManager: IEntityManager;
}

/**
 * Dependencies for body part operators.
 */
export interface BodyPartOperatorDependencies extends BaseOperatorDependencies {
  bodyGraphService: IBodyGraphService;
}

/**
 * Dependencies for lighting operators.
 */
export interface LightingOperatorDependencies extends BaseOperatorDependencies {
  lightingStateService?: ILightingStateService;
}

/**
 * Interface that all operators must implement.
 */
export interface IOperator {
  /**
   * Evaluates the operator with given parameters and context.
   * @param params - Operator parameters (varies by operator)
   * @param context - Evaluation context
   * @returns Evaluation result (typically boolean)
   */
  evaluate(params: unknown[], context: OperatorContext): boolean;
}

/**
 * Interface for operators that have clearable caches.
 */
export interface ICacheableOperator extends IOperator {
  clearCache(): void;
}

/**
 * Type guard for cacheable operators.
 */
export function isCacheableOperator(op: IOperator): op is ICacheableOperator;
```

### Step 3: Verify TypeScript Configuration

Ensure `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "./types",
    "allowJs": true,
    "checkJs": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"]
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run typecheck
npm run build
```

### Specific Test Assertions

1. **Type checking passes**: No TypeScript errors from new declaration files
2. **IDE support**: Hover over operator methods shows type information
3. **JSDoc compatibility**: Existing JSDoc types don't conflict with new declarations

### Invariants That Must Remain True

1. **No runtime changes**: Only type declarations, no JavaScript changes
2. **Backward compatible**: Existing code continues to work
3. **Build succeeds**: Both development and production builds work

---

## Verification Commands

```bash
# Type check
npm run typecheck

# Build to verify bundling still works
npm run build

# Verify declarations are generated (if declarationDir is set)
ls -la types/logic/
```

---

## Notes

- TypeScript declarations are optional in this project but improve developer experience
- Consider whether to generate `.d.ts` files automatically or maintain them manually
- The existing JSDoc types provide some type information - declarations formalize them
- Start with the most commonly used types and expand as needed
