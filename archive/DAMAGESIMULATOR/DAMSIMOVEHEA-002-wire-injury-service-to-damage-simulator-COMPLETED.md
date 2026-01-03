# DAMSIMOVEHEA-002: Wire InjuryAggregationService to Damage Simulator

## Summary
Inject `InjuryAggregationService` into `DamageSimulatorUI` so it can call the canonical `calculateOverallHealth()` method.

## Motivation
After DAMSIMOVEHEA-001 exposes the health calculation, the damage simulator needs access to call it. This ticket adds the DI wiring without any UI changes.

## Prerequisites
- **DAMSIMOVEHEA-001** must be completed first (exposes `calculateOverallHealth()`)

## Files to Touch

| File | Changes |
|------|---------|
| `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` | Inject `InjuryAggregationService` into `DamageSimulatorUI` factory |
| `src/domUI/damage-simulator/DamageSimulatorUI.js` | Accept `injuryAggregationService` in constructor, validate it |
| `tests/unit/domUI/damage-simulator/DamageSimulatorUI.test.js` | Update constructor tests with new dependency |
| `tests/integration/damage-simulator/damageSimulatorSharedServices.integration.test.js` | Register stub `InjuryAggregationService` when resolving `DamageSimulatorUI` |
| `tests/integration/domUI/damage-simulator/anatomyRefreshAfterDamage.integration.test.js` | Provide `injuryAggregationService` when constructing `DamageSimulatorUI` |

## Out of Scope

- **NO UI rendering changes** - Health bars are added in tickets 003/004
- **NO health bar DOM creation** - Not in this ticket
- **NO CSS changes** - CSS is ticket 005
- **NO changes to InjuryAggregationService itself** - Done in ticket 001
- **NO changes to other damage simulator components** - Only DamageSimulatorUI

## Implementation Details

### 1. Update DI Registration

**File**: `src/dependencyInjection/registrations/damageSimulatorRegistrations.js`

Current (lines 35-48):
```javascript
registerWithLog(
  registrar,
  tokens.DamageSimulatorUI,
  (c) =>
    new DamageSimulatorUI({
      recipeSelectorService: c.resolve(tokens.IRecipeSelectorService),
      entityLoadingService: c.resolve(tokens.IEntityLoadingService),
      anatomyDataExtractor: c.resolve(tokens.IAnatomyDataExtractor),
      eventBus: c.resolve(tokens.IValidatedEventDispatcher),
      logger: c.resolve(tokens.ILogger),
    }),
  { lifecycle: 'singletonFactory' },
  logger
);
```

After:
```javascript
registerWithLog(
  registrar,
  tokens.DamageSimulatorUI,
  (c) =>
    new DamageSimulatorUI({
      recipeSelectorService: c.resolve(tokens.IRecipeSelectorService),
      entityLoadingService: c.resolve(tokens.IEntityLoadingService),
      anatomyDataExtractor: c.resolve(tokens.IAnatomyDataExtractor),
      injuryAggregationService: c.resolve(tokens.InjuryAggregationService),
      eventBus: c.resolve(tokens.IValidatedEventDispatcher),
      logger: c.resolve(tokens.ILogger),
    }),
  { lifecycle: 'singletonFactory' },
  logger
);
```

### 2. Update DamageSimulatorUI Constructor

**File**: `src/domUI/damage-simulator/DamageSimulatorUI.js`

Add to constructor:
```javascript
constructor({
  recipeSelectorService,
  entityLoadingService,
  anatomyDataExtractor,
  injuryAggregationService,  // NEW
  eventBus,
  logger,
}) {
  // Existing validations...

  validateDependency(injuryAggregationService, 'InjuryAggregationService', console, {
    requiredMethods: ['calculateOverallHealth'],
  });

  this.#injuryAggregationService = injuryAggregationService;
  // ... rest of constructor
}
```

Add private field:
```javascript
#injuryAggregationService;
```

### 3. Verify Token Exists

Check `src/dependencyInjection/tokens.js` for the `InjuryAggregationService` token (this repo does not use an `IInjuryAggregationService` token).

## Acceptance Criteria

### Tests That Must Pass

1. **Constructor accepts new dependency**
   ```javascript
   it('should accept injuryAggregationService dependency', () => {
     const mockService = { calculateOverallHealth: jest.fn() };
     const ui = new DamageSimulatorUI({
       ...standardMocks,
       injuryAggregationService: mockService,
     });
     expect(ui).toBeDefined();
   });
   ```

2. **Constructor validates dependency**
   ```javascript
   it('should throw if injuryAggregationService missing calculateOverallHealth', () => {
     expect(() => new DamageSimulatorUI({
       ...standardMocks,
       injuryAggregationService: {},
     })).toThrow();
   });
   ```

3. **Integration: Service resolves from container**
   - Update existing integration coverage that resolves `DamageSimulatorUI` to register a stub `InjuryAggregationService` dependency.

4. **All existing tests pass** (with updated mocks)
   - Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/DamageSimulatorUI.test.js`

### Invariants

1. **All existing functionality unchanged** - Entity loading, damage execution, analytics all work
2. **No runtime errors** - damage-simulator.html loads without errors
3. **No visual changes** - UI looks identical (health bars not added yet)

## Definition of Done

- [x] `DamageSimulatorUI` constructor accepts `injuryAggregationService`
- [x] Dependency validated with `validateDependency()`
- [x] Private field `#injuryAggregationService` stores reference
- [x] DI registration updated to inject service
- [x] All unit tests updated and passing
- [x] Manual verification: damage-simulator.html loads without errors (optional, not automated here)
- [x] Code reviewed and merged

## Outcome
- Added `InjuryAggregationService` wiring in `DamageSimulatorUI` and DI registrations.
- Updated unit and integration tests to provide the new dependency and validate its contract.
- No UI changes; no changes to `InjuryAggregationService` implementation.
