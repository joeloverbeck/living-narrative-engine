# TRAITSGEN-008: Create Build Configuration and Entry Point

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: Build System Integration
- **Priority**: High
- **Estimated Effort**: 0.5 days
- **Dependencies**: TRAITSGEN-005 (Controller), TRAITSGEN-006 (HTML Page)

## Description
Create build configuration and entry point for the traits generator page following established patterns from other character-builder pages. This ensures the traits generator integrates seamlessly with the existing build system.

## Requirements

### Entry Point Creation
- **File**: `src/traits-generator-main.js`
- **Template**: Follow `src/core-motivations-generator-main.js` pattern
- **Purpose**: Initialize traits generator page and dependency injection

### Entry Point Implementation
```javascript
/**
 * @file Traits Generator main entry point
 * @description Initializes the traits generator page with dependency injection
 */

import { container } from './dependencyInjection/container.js';
import { TraitsGeneratorController } from './traitsGenerator/controllers/TraitsGeneratorController.js';
import { ensureValidLogger } from './utils/loggerUtils.js';

/**
 * Initialize the traits generator page
 */
async function initializeTraitsGenerator() {
  try {
    const logger = ensureValidLogger();
    logger.info('Initializing Traits Generator page');

    // Resolve dependencies from container
    const dependencies = {
      logger,
      characterBuilderService: container.resolve('characterBuilderService'),
      uiStateManager: container.resolve('uiStateManager'),
      traitsDisplayEnhancer: container.resolve('traitsDisplayEnhancer'),
    };

    // Initialize controller
    const controller = new TraitsGeneratorController(dependencies);
    await controller.initialize();

    logger.info('Traits Generator page initialized successfully');

    // Set up global error handling
    window.addEventListener('unhandledrejection', (event) => {
      logger.error('Unhandled promise rejection in Traits Generator', event.reason);
    });

    window.addEventListener('error', (event) => {
      logger.error('Unhandled error in Traits Generator', event.error);
    });

  } catch (error) {
    console.error('Failed to initialize Traits Generator:', error);
    
    // Show user-friendly error message
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="initialization-error">
          <h3>Initialization Failed</h3>
          <p>The traits generator failed to load. Please refresh the page and try again.</p>
          <button onclick="window.location.reload()" class="btn btn-primary">Refresh Page</button>
        </div>
      `;
      errorContainer.hidden = false;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTraitsGenerator);
} else {
  initializeTraitsGenerator();
}

// Export for potential testing or external access
export { initializeTraitsGenerator };
```

### Build Configuration Updates

#### Package.json Script Addition
Add build script to `package.json` following existing patterns:

```json
{
  "scripts": {
    "build:traits-generator": "node scripts/build.js --entry=src/traits-generator-main.js --outfile=dist/traits-generator.js",
    "build:all-generators": "npm run build:core-motivations-generator && npm run build:cliches-generator && npm run build:thematic-direction-generator && npm run build:traits-generator"
  }
}
```

#### Build Script Configuration
Ensure `scripts/build.js` handles the new entry point correctly:

```javascript
// Verify build script includes traits-generator configuration
const buildConfigs = {
  'core-motivations-generator': {
    entry: 'src/core-motivations-generator-main.js',
    outfile: 'dist/core-motivations-generator.js'
  },
  'cliches-generator': {
    entry: 'src/cliches-generator-main.js', 
    outfile: 'dist/cliches-generator.js'
  },
  'thematic-direction-generator': {
    entry: 'src/thematic-direction-generator-main.js',
    outfile: 'dist/thematic-direction-generator.js'
  },
  'traits-generator': {
    entry: 'src/traits-generator-main.js',
    outfile: 'dist/traits-generator.js'
  }
};
```

### Dependency Injection Registration

#### Service Registration
Ensure all required services are registered in the DI container:

```javascript
// In dependency injection registration file
import { TraitsGenerator } from '../characterBuilder/services/TraitsGenerator.js';
import { TraitsDisplayEnhancer } from '../traitsGenerator/services/TraitsDisplayEnhancer.js';

// Register TraitsGenerator service
container.register('traitsGenerator', TraitsGenerator, {
  dependencies: [
    'logger',
    'llmJsonService',
    'llmStrategyFactory', 
    'llmConfigManager',
    'eventBus'
  ]
});

// Register TraitsDisplayEnhancer service
container.register('traitsDisplayEnhancer', TraitsDisplayEnhancer, {
  dependencies: ['logger']
});

// Update CharacterBuilderService to include traitsGenerator
container.updateRegistration('characterBuilderService', {
  dependencies: [
    // Existing dependencies...
    'traitsGenerator'
  ]
});
```

#### Registration Validation
Verify all dependencies are properly registered:

```javascript
// Validation function for traits generator dependencies
function validateTraitsGeneratorDependencies() {
  const requiredServices = [
    'logger',
    'characterBuilderService', 
    'uiStateManager',
    'traitsDisplayEnhancer',
    'traitsGenerator',
    'llmJsonService',
    'llmStrategyFactory',
    'llmConfigManager',
    'eventBus'
  ];

  for (const service of requiredServices) {
    if (!container.isRegistered(service)) {
      throw new Error(`Required service '${service}' is not registered`);
    }
  }
}
```

### HTML Integration

#### Script Tag Addition
Update `traits-generator.html` to include the built JavaScript:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Existing head content -->
</head>
<body>
  <!-- Existing body content -->
  
  <!-- Load traits generator bundle -->
  <script src="dist/traits-generator.js"></script>
</body>
</html>
```

#### Development vs Production Loading
Handle different loading strategies:

```html
<!-- Development mode (load individual modules) -->
<script type="module" src="src/traits-generator-main.js" data-env="development"></script>

<!-- Production mode (load built bundle) -->
<script src="dist/traits-generator.js" data-env="production"></script>

<script>
  // Load appropriate script based on environment
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.querySelector('script[data-env="production"]').remove();
  } else {
    document.querySelector('script[data-env="development"]').remove();
  }
</script>
```

### Build Process Integration

#### ESBuild Configuration
Ensure proper ESBuild configuration for traits generator:

```javascript
// ESBuild configuration for traits-generator
const traitsGeneratorConfig = {
  entryPoints: ['src/traits-generator-main.js'],
  bundle: true,
  outfile: 'dist/traits-generator.js',
  format: 'iife',
  target: 'es2020',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV === 'development',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  external: [] // Include all dependencies in bundle
};
```

#### Build Verification
Add build verification steps:

```javascript
// Verify build output
function verifyBuild(outfile) {
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(outfile)) {
    throw new Error(`Build output not found: ${outfile}`);
  }
  
  const stats = fs.statSync(outfile);
  if (stats.size === 0) {
    throw new Error(`Build output is empty: ${outfile}`);
  }
  
  console.log(`✅ Build successful: ${outfile} (${(stats.size / 1024).toFixed(2)}KB)`);
}
```

### Development Workflow Integration

#### Watch Mode Support
Add watch mode for development:

```json
{
  "scripts": {
    "dev:traits-generator": "node scripts/build.js --entry=src/traits-generator-main.js --outfile=dist/traits-generator.js --watch",
    "dev:all-generators": "concurrently \"npm run dev:core-motivations-generator\" \"npm run dev:cliches-generator\" \"npm run dev:thematic-direction-generator\" \"npm run dev:traits-generator\""
  }
}
```

#### Hot Reload Support
Integrate with existing hot reload system:

```javascript
// Hot reload configuration for traits generator
if (process.env.NODE_ENV === 'development') {
  if (module.hot) {
    module.hot.accept('./traitsGenerator/controllers/TraitsGeneratorController.js', () => {
      // Re-initialize controller on changes
      initializeTraitsGenerator();
    });
  }
}
```

## Testing Integration

### Build Testing
Add tests for build configuration:

```javascript
describe('Traits Generator Build Configuration', () => {
  it('should build successfully without errors');
  it('should include all required dependencies in bundle');
  it('should initialize without dependency injection errors');
  it('should load properly in both development and production modes');
});
```

### Entry Point Testing
Test entry point initialization:

```javascript
describe('Traits Generator Entry Point', () => {
  it('should initialize controller with correct dependencies');
  it('should handle initialization errors gracefully');
  it('should set up global error handlers');
  it('should be compatible with existing DI container');
});
```

## Acceptance Criteria

### Entry Point Requirements
- [ ] `src/traits-generator-main.js` created following established patterns
- [ ] Entry point initializes TraitsGeneratorController with proper dependencies
- [ ] Global error handling set up for unhandled errors and promise rejections
- [ ] Graceful error display if initialization fails

### Build Configuration Requirements  
- [ ] Build script added to `package.json` following naming conventions
- [ ] ESBuild configuration handles traits generator properly
- [ ] Built bundle includes all required dependencies
- [ ] Build verification confirms successful output

### Dependency Injection Requirements
- [ ] All required services registered in DI container
- [ ] Service dependencies properly configured
- [ ] Dependency validation prevents missing services
- [ ] Container integration tested and working

### HTML Integration Requirements
- [ ] `traits-generator.html` loads built JavaScript bundle
- [ ] Development vs production loading handled correctly
- [ ] Script loading does not block page rendering
- [ ] Error fallbacks work if JavaScript fails to load

### Development Workflow Requirements
- [ ] Watch mode works for development
- [ ] Hot reload integration functional (if applicable)  
- [ ] Build process integrates with existing workflow
- [ ] Development and production modes both functional

### Testing Requirements
- [ ] Build configuration tests pass
- [ ] Entry point initialization tests pass
- [ ] Dependency injection integration tests pass
- [ ] End-to-end build and load test successful

## Files Modified
- **NEW**: `src/traits-generator-main.js`
- **MODIFIED**: `package.json` (add build scripts)
- **MODIFIED**: `scripts/build.js` (add configuration)
- **MODIFIED**: Dependency injection registration files
- **MODIFIED**: `traits-generator.html` (add script loading)

## Dependencies For Next Tickets
This build configuration is required for:
- TRAITSGEN-009 (Integration Testing)
- TRAITSGEN-012 (End-to-End Testing)

## Notes
- Follow exact patterns from existing character-builder pages
- Ensure proper dependency injection registration
- Test both development and production build modes
- Verify bundle size is reasonable for web delivery
- Consider build performance and optimization opportunities