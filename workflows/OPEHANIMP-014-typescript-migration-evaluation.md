# OPEHANIMP-014: Evaluate TypeScript Migration Feasibility

**Priority**: Low
**Effort**: Medium
**Phase**: 3 (Month 3)
**Dependencies**: OPEHANIMP-011, OPEHANIMP-012, OPEHANIMP-013

## Objective

Evaluate the feasibility, costs, and benefits of migrating the operation handler system (or entire codebase) to TypeScript to gain compile-time type safety, improved IDE support, and better error detection.

## Background

TypeScript provides:
- Compile-time type checking (catch errors before runtime)
- Better IDE autocomplete and refactoring
- Interface enforcement for handlers and dependencies
- Decorator support for metadata
- Improved documentation through types

However, migration requires:
- Build process changes
- Developer training
- Tooling updates
- Gradual migration strategy

## Requirements

### 1. Research Phase

#### Benefits Analysis

**Type Safety Benefits**:

```typescript
// Current JavaScript - no compile-time checking
class DrinkFromHandler extends BaseOperationHandler {
  async execute(context) {
    // Typo in parameter name - only caught at runtime
    const itemId = context.operation.paramters.drinkableItemId;
    //                                       ^ typo
  }
}

// TypeScript - caught at compile time
interface DrinkFromParameters {
  drinkableItemId: string;
  consumptionQuantity?: number;
}

interface OperationContext<T = any> {
  operation: {
    type: string;
    parameters: T;
  };
  ruleContext: RuleContext;
}

class DrinkFromHandler extends BaseOperationHandler {
  async execute(context: OperationContext<DrinkFromParameters>): Promise<void> {
    // TypeScript error: Property 'paramters' does not exist
    const itemId = context.operation.paramters.drinkableItemId;
  }
}
```

**Interface Enforcement**:

```typescript
// Define handler interface
interface IOperationHandler<T = any> {
  execute(context: OperationContext<T>): Promise<void>;
}

// Enforce implementation
class DrinkFromHandler extends BaseOperationHandler
  implements IOperationHandler<DrinkFromParameters> {

  // TypeScript ensures this signature matches interface
  async execute(context: OperationContext<DrinkFromParameters>): Promise<void> {
    // Implementation
  }

  // TypeScript error if we forget required methods
}
```

**Decorator Support**:

```typescript
// Metadata via decorators
@Operation({
  type: 'DRINK_FROM',
  category: 'items',
})
export class DrinkFromHandler extends BaseOperationHandler {
  @Inject('IComponentMutationService')
  private componentMutationService: IComponentMutationService;

  @Inject('IEntityStateQuerier')
  private entityStateQuerier: IEntityStateQuerier;

  // Dependencies automatically injected
  async execute(context: OperationContext<DrinkFromParameters>): Promise<void> {
    // Implementation with full type safety
  }
}
```

#### Cost Analysis

**Migration Effort**:
- ~40 operation handlers to convert
- ~100+ test files to convert
- DI container needs TypeScript support
- Build configuration changes
- Documentation updates

**Ongoing Costs**:
- Type definitions maintenance
- More verbose code in some cases
- Build time increase
- Team training

**Risks**:
- Breaking changes during migration
- Incomplete type coverage
- Third-party library types
- Migration fatigue

#### Comparison Matrix

| Aspect | JavaScript | TypeScript |
|--------|-----------|------------|
| Type Safety | Runtime only | Compile-time + runtime |
| IDE Support | Good | Excellent |
| Error Detection | Runtime | Compile-time |
| Refactoring | Manual, error-prone | Automated, safe |
| Learning Curve | Low | Medium |
| Build Time | Fast | Slower |
| Code Verbosity | Concise | More verbose |
| Dependencies | Simple | Type definitions needed |
| Decorator Support | Limited | Full |
| Interface Enforcement | Manual | Automatic |

### 2. Proof of Concept

Convert 3 operation handlers to TypeScript to evaluate:

#### Files to Convert

1. **Handler**: `src/logic/operationHandlers/drinkFromHandler.ts`
2. **Types**: `src/types/operations/drinkFrom.types.ts`
3. **Tests**: `tests/unit/logic/operationHandlers/drinkFromHandler.test.ts`

#### Example TypeScript Implementation

**Types Definition**:

```typescript
// src/types/operations/drinkFrom.types.ts

export interface DrinkFromParameters {
  drinkableItemId: string;
  consumptionQuantity?: number;
}

export interface DrinkFromCompletedEvent {
  itemId: string;
  quantity: number;
  remaining: number;
  actorId: string;
}

export interface DrinkFromFailedEvent {
  itemId: string;
  reason: string;
  actorId: string;
}
```

**Handler Implementation**:

```typescript
// src/logic/operationHandlers/drinkFromHandler.ts

import { BaseOperationHandler } from './baseOperationHandler';
import { IComponentMutationService } from '../services/componentMutationService';
import { IEntityStateQuerier } from '../services/entityStateQuerier';
import { OperationContext } from '../types/operationContext';
import {
  DrinkFromParameters,
  DrinkFromCompletedEvent,
  DrinkFromFailedEvent,
} from '../types/operations/drinkFrom.types';

export class DrinkFromHandler extends BaseOperationHandler {
  constructor(
    private componentMutationService: IComponentMutationService,
    private entityStateQuerier: IEntityStateQuerier,
    logger: ILogger,
    eventBus: IEventBus
  ) {
    super(logger, eventBus);
  }

  async execute(context: OperationContext<DrinkFromParameters>): Promise<void> {
    const { parameters } = context.operation;

    try {
      // 1. Validate - TypeScript ensures correct parameter names
      if (!parameters.drinkableItemId) {
        throw new InvalidArgumentError('drinkableItemId is required');
      }

      // 2. Query state - TypeScript ensures correct method signatures
      const item = this.entityStateQuerier.getEntity(parameters.drinkableItemId);

      if (!this.entityStateQuerier.hasComponent(parameters.drinkableItemId, 'items:drinkable')) {
        throw new InvalidArgumentError('Item is not drinkable');
      }

      // 3. Calculate consumption
      const consumptionQuantity = parameters.consumptionQuantity ?? 1;

      // 4. Mutate state
      await this.componentMutationService.updateComponent(
        parameters.drinkableItemId,
        'items:quantity',
        (current: any) => ({
          ...current,
          amount: Math.max(0, current.amount - consumptionQuantity),
        })
      );

      // 5. Dispatch event - TypeScript ensures correct payload structure
      const event: DrinkFromCompletedEvent = {
        itemId: parameters.drinkableItemId,
        quantity: consumptionQuantity,
        remaining: item.amount - consumptionQuantity,
        actorId: context.ruleContext.actorId,
      };

      this.dispatchOperationEvent('DRINK_FROM_COMPLETED', event);

    } catch (error) {
      this.handleOperationError(error as Error, 'DRINK_FROM', context);
      throw error;
    }
  }
}
```

**Test Implementation**:

```typescript
// tests/unit/logic/operationHandlers/drinkFromHandler.test.ts

import { DrinkFromHandler } from '../../../src/logic/operationHandlers/drinkFromHandler';
import { DrinkFromParameters } from '../../../src/types/operations/drinkFrom.types';
import { OperationContext } from '../../../src/types/operationContext';
import { createMock } from '../../helpers/mockFactory';

describe('DrinkFromHandler', () => {
  let handler: DrinkFromHandler;
  let mockComponentMutationService: IComponentMutationService;
  let mockEntityStateQuerier: IEntityStateQuerier;

  beforeEach(() => {
    mockComponentMutationService = createMock<IComponentMutationService>([
      'updateComponent',
      'removeComponent',
    ]);

    mockEntityStateQuerier = createMock<IEntityStateQuerier>([
      'getEntity',
      'hasComponent',
    ]);

    handler = new DrinkFromHandler(
      mockComponentMutationService,
      mockEntityStateQuerier,
      createMockLogger(),
      createMockEventBus()
    );
  });

  it('should execute DRINK_FROM operation successfully', async () => {
    // Arrange - TypeScript ensures correct parameter types
    const parameters: DrinkFromParameters = {
      drinkableItemId: 'item-123',
      consumptionQuantity: 5,
    };

    const context: OperationContext<DrinkFromParameters> = {
      operation: {
        type: 'DRINK_FROM',
        parameters,
      },
      ruleContext: {
        actorId: 'actor-456',
      },
    };

    mockEntityStateQuerier.hasComponent.mockReturnValue(true);
    mockEntityStateQuerier.getEntity.mockReturnValue({ amount: 10 });

    // Act
    await handler.execute(context);

    // Assert
    expect(mockComponentMutationService.updateComponent).toHaveBeenCalled();
  });
});
```

### 3. Migration Strategy

#### Incremental Migration Approach

**Phase 1: Setup** (1 week)
- Install TypeScript and type definitions
- Configure tsconfig.json
- Set up build pipeline
- Enable allowJs for gradual migration

**Phase 2: Type Definitions** (1-2 weeks)
- Create core type definitions
- Define interfaces for all services
- Create operation parameter types
- Document type patterns

**Phase 3: Convert Core** (2-3 weeks)
- Convert base classes (BaseOperationHandler, etc.)
- Convert DI container
- Convert event bus
- Convert core utilities

**Phase 4: Convert Handlers** (3-4 weeks)
- Convert 3-5 handlers per week
- Update associated tests
- Verify functionality unchanged
- Document lessons learned

**Phase 5: Complete Migration** (2-3 weeks)
- Convert remaining handlers
- Convert all tests
- Remove JavaScript files
- Update documentation
- Set strict TypeScript mode

#### Configuration

**tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowJs": true,
    "checkJs": false,
    "incremental": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

### 4. Evaluation Criteria

**Go / No-Go Decision Factors**:

1. **Development Velocity**
   - Does TypeScript slow down development?
   - Does it catch meaningful errors?
   - Is IDE experience significantly better?

2. **Error Reduction**
   - How many errors are caught at compile time vs. before?
   - Are they errors that would have reached production?
   - What is the false positive rate?

3. **Team Readiness**
   - Does team have TypeScript experience?
   - Is there appetite for migration?
   - Can we train effectively?

4. **Cost-Benefit Ratio**
   - Estimated migration time: X weeks
   - Estimated ongoing maintenance: Y% overhead
   - Expected error reduction: Z%
   - Is the benefit worth the cost?

5. **Alternatives**
   - Can we achieve similar benefits with JSDoc?
   - Would better linting suffice?
   - Are there simpler wins available?

## Deliverables

- [ ] Research document comparing TypeScript vs. JavaScript
- [ ] Proof of concept with 3 handlers converted
- [ ] Performance benchmarks (build time, runtime)
- [ ] Migration plan with timeline and effort estimates
- [ ] Team survey on TypeScript adoption
- [ ] Cost-benefit analysis
- [ ] Final recommendation: Go / No-Go
- [ ] If Go: Detailed migration roadmap
- [ ] If No-Go: Alternative improvements

## Acceptance Criteria

- [ ] Comprehensive research completed
- [ ] POC demonstrates feasibility
- [ ] Migration plan is detailed and realistic
- [ ] Team feedback is gathered
- [ ] Cost-benefit analysis is thorough
- [ ] Clear recommendation with rationale
- [ ] Decision is made by leadership
- [ ] Path forward is documented

## Testing

### POC Validation

1. Convert 3 handlers to TypeScript
2. Run all existing tests
3. Verify no functionality changes
4. Measure build time increase
5. Evaluate developer experience
6. Identify migration challenges

### Type Safety Validation

1. Introduce intentional type errors
2. Verify TypeScript catches them
3. Compare to JavaScript (would it catch?)
4. Calculate error detection improvement

## Time Estimate

3-4 weeks (research, POC, evaluation, planning)

## Related Tickets

- OPEHANIMP-011: Single source of truth (could benefit from TypeScript)
- OPEHANIMP-012: Schema-driven generation (could generate TypeScript)
- OPEHANIMP-013: Auto-discovery (decorators enable better metadata)

## Success Metrics

- Clear Go/No-Go decision made
- If Go: Migration plan is accepted
- If No-Go: Alternative improvements identified
- Team consensus on path forward
- Decision is data-driven, not opinion-based

## Notes

This is an exploratory ticket. The goal is to make an informed decision, not necessarily to migrate. A "No-Go" decision is a valid outcome if the cost-benefit analysis doesn't support migration.

Consider:
- Is TypeScript adoption trending in the team?
- Are there new developers who prefer TypeScript?
- Would TypeScript help with onboarding?
- Are there other projects that could benefit?
- Is this the right time for this level of change?
