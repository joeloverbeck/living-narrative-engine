# DAMAGESIMULATOR-005: Create Entry Point and Build Configuration

## Status: COMPLETED

## Summary
Create the JavaScript entry point for the damage simulator and configure esbuild for bundling. This establishes the initialization flow and DI container setup.

## Dependencies
- DAMAGESIMULATOR-004 must be completed (HTML structure exists) ✅
- DAMAGESIMULATOR-001, 002, 003 should be completed (shared services available) ✅

## Files Touched

### Created
- `src/damage-simulator.js` - Entry point (mirrors anatomy-visualizer.js)
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - DI registrations
- `tests/unit/damage-simulator.test.js` - Entry point tests
- `tests/unit/dependencyInjection/registrations/damageSimulatorRegistrations.test.js` - Registration tests

### Modified
- `damage-simulator.html` - Added script tag for bundled JS
- `scripts/build.config.js` - Added damage-simulator bundle and HTML to centralized config

### NOT Created (Ticket Assumption Corrections)
- ~~`esbuild.damage-simulator.config.js`~~ - Project uses centralized `scripts/build.config.js`
- ~~package.json build script~~ - Not needed, `npm run build` handles all bundles

### Reference (Read Only)
- `src/anatomy-visualizer.js` - Pattern followed
- `src/dependencyInjection/registrations/visualizerRegistrations.js` - DI pattern followed
- `tests/unit/anatomy-visualizer.test.js` - Test pattern followed

## Assumption Corrections Made

### 1. Build Configuration Pattern - MAJOR
| Original Ticket | Actual Implementation |
|-----------------|----------------------|
| Create `esbuild.damage-simulator.config.js` | Used centralized `scripts/build.config.js` |
| Add script `"build:damage-simulator"` to package.json | Not needed - `npm run build` builds all bundles |

### 2. Entry Point Pattern
| Original Ticket | Actual Implementation |
|-----------------|----------------------|
| Manual DI container setup with `createContainer()` | Use `CommonBootstrapper` with `postInitHook` |
| Manual DOM ready wait with Promise | Use `shouldAutoInitializeDom()` utility |
| Direct `console.error` for failures | Use `bootstrapper.displayFatalStartupError()` |

### 3. DI Registration Import Pattern
| Original Ticket | Actual Implementation |
|-----------------|----------------------|
| `import tokens from '../tokens/tokens-core.js'` | `import { tokens } from '../tokens.js'` (barrel export) |

## Out of Scope
- DO NOT implement UI components yet (separate tickets) ✅
- DO NOT implement damage execution logic ✅
- DO NOT modify existing visualizer code ✅
- DO NOT implement any actual simulator features ✅

## Acceptance Criteria - All Met

### Entry Point Requirements
1. ✅ Initialize DI container with required services
2. ✅ Wait for DOM ready (using `shouldAutoInitializeDom()`)
3. ✅ Initialize shared services (RecipeSelectorService, EntityLoadingService, AnatomyDataExtractor)
4. ✅ Stub out DamageSimulatorUI initialization (placeholder)
5. ✅ Handle initialization errors gracefully (via `displayFatalStartupError`)

### Build Configuration Requirements
1. ✅ Build config matches existing patterns (centralized config)
2. ✅ Output to `dist/damage-simulator.js`
3. ✅ Bundle all dependencies
4. ✅ Source maps enabled for development

### Tests That Must Pass
1. ✅ **Build Verification**
   - `npm run build` succeeds (builds all bundles including damage-simulator)
   - Output file exists at `dist/damage-simulator.js` (11.6MB)
   - No build errors or warnings

2. ✅ **Runtime Verification**
   - Page loads without JavaScript errors
   - Console shows "[DamageSimulator] Initialized with services: {...}"
   - DI container resolves all registered services

3. ✅ **Unit Tests**
   - 7 new tests added (3 entry point, 4 registrations)
   - All tests pass

### Invariants - All Preserved
1. ✅ Build process follows existing centralized build patterns
2. ✅ DI registration follows existing patterns
3. ✅ No modifications to shared services' behavior
4. ✅ Entry point doesn't block on missing UI components

## Definition of Done - All Complete
- [x] Entry point created following existing CommonBootstrapper patterns
- [x] DI registrations file created
- [x] Build config updated (centralized `scripts/build.config.js`)
- [x] `npm run build` produces `dist/damage-simulator.js`
- [x] HTML includes script tag for bundled JS
- [x] Page loads without errors
- [x] Console confirms initialization
- [x] ESLint passes
- [x] Unit tests added and passing (7 tests)

## Outcome

### What Changed vs Original Plan
The implementation discovered that the project uses a centralized build configuration pattern (`scripts/build.config.js`) rather than individual esbuild config files per bundle. This is a cleaner approach that:
1. Reduces file proliferation
2. Ensures consistent build settings across all bundles
3. Simplifies adding new bundles (just add to arrays in one file)

The entry point also follows the `CommonBootstrapper` pattern established by `anatomy-visualizer.js`, which provides:
1. Consistent initialization flow
2. Built-in error handling via `displayFatalStartupError`
3. `postInitHook` pattern for service resolution
4. `shouldAutoInitializeDom()` for DOM-ready detection

### Files Created
| File | Purpose |
|------|---------|
| `src/damage-simulator.js` | Entry point with CommonBootstrapper pattern |
| `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` | DI component registrations (placeholder) |
| `tests/unit/damage-simulator.test.js` | Entry point tests (3 test cases) |
| `tests/unit/dependencyInjection/registrations/damageSimulatorRegistrations.test.js` | Registration tests (4 test cases) |

### Files Modified
| File | Change |
|------|--------|
| `scripts/build.config.js` | Added damage-simulator bundle + HTML |
| `damage-simulator.html` | Added script tag |

### Test Coverage
- 7 unit tests added
- All tests pass
- Follows existing test patterns from anatomy-visualizer.test.js
