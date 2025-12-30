# DAMAGESIMULATOR-005: Create Entry Point and Build Configuration

## Summary
Create the JavaScript entry point for the damage simulator and configure esbuild for bundling. This establishes the initialization flow and DI container setup.

## Dependencies
- DAMAGESIMULATOR-004 must be completed (HTML structure exists)
- DAMAGESIMULATOR-001, 002, 003 should be completed (shared services available)

## Files to Touch

### Create
- `src/damage-simulator.js` - Entry point (mirrors anatomy-visualizer.js)
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - DI registrations
- `esbuild.damage-simulator.config.js` - Build configuration

### Modify
- `damage-simulator.html` - Add script tag for bundled JS
- `package.json` - Add build script for damage-simulator

### Reference (Read Only)
- `src/anatomy-visualizer.js` - Pattern to follow
- `esbuild.anatomy-visualizer.config.js` - Build config pattern
- `src/dependencyInjection/registrations/visualizerRegistrations.js` - DI pattern

## Out of Scope
- DO NOT implement UI components yet (separate tickets)
- DO NOT implement damage execution logic
- DO NOT modify existing visualizer code
- DO NOT implement any actual simulator features

## Acceptance Criteria

### Entry Point Requirements
1. Initialize DI container with required services
2. Wait for DOM ready
3. Initialize shared services (RecipeSelectorService, EntityLoadingService, AnatomyDataExtractor)
4. Stub out DamageSimulatorUI initialization (placeholder)
5. Handle initialization errors gracefully

### Build Configuration Requirements
1. esbuild config matches anatomy-visualizer pattern
2. Output to `dist/damage-simulator.js`
3. Bundle all dependencies
4. Source maps enabled for development

### Tests That Must Pass
1. **Build Verification**
   - `npm run build:damage-simulator` succeeds
   - Output file exists at `dist/damage-simulator.js`
   - No build errors or warnings

2. **Runtime Verification**
   - Page loads without JavaScript errors
   - Console shows "Damage Simulator initialized" or similar
   - DI container resolves all registered services

3. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Build process follows existing esbuild patterns
2. DI registration follows existing patterns
3. No modifications to shared services' behavior
4. Entry point doesn't block on missing UI components

## Implementation Notes

### Entry Point Template
```javascript
// src/damage-simulator.js
import { createContainer } from './dependencyInjection/container.js';
import { registerDamageSimulatorServices } from './dependencyInjection/registrations/damageSimulatorRegistrations.js';
import tokens from './dependencyInjection/tokens/tokens-core.js';

async function initialize() {
  const container = createContainer();

  // Register core services (reuse existing registrations)
  // ... existing registration imports ...

  // Register damage simulator specific services
  registerDamageSimulatorServices(container);

  // Wait for DOM
  await new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });

  // Get shared services
  const recipeSelectorService = container.resolve(tokens.RecipeSelectorService);
  const entityLoadingService = container.resolve(tokens.EntityLoadingService);

  // Initialize UI (placeholder - actual implementation in later ticket)
  console.log('[DamageSimulator] Initialized with services:', {
    recipeSelectorService: !!recipeSelectorService,
    entityLoadingService: !!entityLoadingService
  });

  // TODO: Initialize DamageSimulatorUI in DAMAGESIMULATOR-007
}

initialize().catch(err => {
  console.error('[DamageSimulator] Initialization failed:', err);
});
```

### DI Registrations Template
```javascript
// src/dependencyInjection/registrations/damageSimulatorRegistrations.js
import tokens from '../tokens/tokens-core.js';

export function registerDamageSimulatorServices(container) {
  // Shared services should already be registered via visualizerRegistrations
  // This file is for damage-simulator-specific services

  // Placeholder for future registrations:
  // - DamageSimulatorUI
  // - HierarchicalAnatomyRenderer
  // - DamageCapabilityComposer
  // - DamageExecutionService
  // - DamageAnalyticsPanel
}
```

### Package.json Script
```json
{
  "scripts": {
    "build:damage-simulator": "node esbuild.damage-simulator.config.js"
  }
}
```

## Definition of Done
- [ ] Entry point created following existing patterns
- [ ] DI registrations file created
- [ ] esbuild config created
- [ ] Build script added to package.json
- [ ] `npm run build:damage-simulator` produces output
- [ ] HTML includes script tag for bundled JS
- [ ] Page loads without errors
- [ ] Console confirms initialization
- [ ] ESLint passes: `npx eslint src/damage-simulator.js src/dependencyInjection/registrations/damageSimulatorRegistrations.js`
