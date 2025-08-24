# SPEPATGEN-004: Configure Build System Entry Point

## Ticket Overview

- **Epic**: Speech Patterns Generator Implementation
- **Phase**: 1 - Foundation Setup
- **Type**: Build/Infrastructure
- **Priority**: High
- **Estimated Effort**: 0.5 days
- **Dependencies**: SPEPATGEN-001 (HTML Page Structure), SPEPATGEN-003 (Navigation Integration)

## Description

Configure the build system (esbuild) to include the Speech Patterns Generator entry point, enabling the JavaScript bundle generation and proper module resolution for the new page. This includes creating the main entry file and updating build configuration.

## Requirements

### Entry Point File Creation

Create the main JavaScript entry file that will be bundled by the build system.

#### File: `src/speech-patterns-generator-main.js`

```javascript
/**
 * @file Entry point for Speech Patterns Generator
 * @description Bootstrap the speech patterns generator page
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { SpeechPatternsGeneratorController } from './characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { SpeechPatternsDisplayEnhancer } from './characterBuilder/services/SpeechPatternsDisplayEnhancer.js';

/**
 * Initialize the speech patterns generator page
 */
async function initializeSpeechPatternsGenerator() {
  try {
    const bootstrap = new CharacterBuilderBootstrap();

    const config = {
      pageName: 'Speech Patterns Generator',
      controllerClass: SpeechPatternsGeneratorController,
      includeModLoading: false, // No mod data needed

      // Page-specific services
      services: {
        speechPatternsDisplayEnhancer: SpeechPatternsDisplayEnhancer,
      },

      // Custom schemas for validation
      customSchemas: ['/data/schemas/speech-patterns-response.schema.json'],

      // Error display configuration
      errorDisplay: {
        elementId: 'character-input-error',
        displayDuration: 8000,
        dismissible: true,
      },
    };

    const result = await bootstrap.bootstrap(config);

    // Page successfully initialized
    console.log(
      `Speech Patterns Generator initialized in ${result.bootstrapTime.toFixed(2)}ms`
    );
  } catch (error) {
    console.error('Failed to initialize Speech Patterns Generator:', error);

    // Show user-friendly error
    document.body.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--error-color, #d32f2f);">
                <h1>⚠️ Initialization Failed</h1>
                <p>The Speech Patterns Generator could not be started.</p>
                <p>Please refresh the page or <a href="index.html">return to the main menu</a>.</p>
                <details style="margin-top: 1rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                    <summary>Technical Details</summary>
                    <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto;">${error.message}</pre>
                </details>
            </div>
        `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeSpeechPatternsGenerator
  );
} else {
  initializeSpeechPatternsGenerator();
}
```

### Build Configuration Updates

#### Locate and Update Build Configuration

**File to Modify**: Find the current build configuration file (likely `build.js`, `esbuild.config.js`, or similar)

#### esbuild Entry Point Addition

Add the new entry point to the existing esbuild configuration:

```javascript
// In the existing build configuration file
const buildConfig = {
  entryPoints: [
    // ... existing entry points
    'src/main.js',
    'src/core-motivations-generator-main.js',
    'src/traits-generator-main.js',

    // ADD NEW ENTRY POINT
    'src/speech-patterns-generator-main.js',
  ],
  outdir: 'dist/',
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV === 'development',
  // ... other existing configuration options
};
```

#### Output File Configuration

Ensure the build system generates the expected output file:

**Expected Output**: `dist/speech-patterns-generator.js`

This matches the script reference in the HTML page:

```html
<script type="module" src="speech-patterns-generator.js"></script>
```

### Package.json Script Integration

#### Update Build Scripts

Ensure the new entry point is included in existing build scripts:

```json
{
  "scripts": {
    "build": "node build.js",
    "build:dev": "node build.js --dev",
    "build:watch": "node build.js --watch",
    "start": "npm run build && npm run serve",
    "start:all": "concurrently \"npm run dev\" \"npm run proxy:dev\""
  }
}
```

#### Development Server Support

Ensure development server serves the new bundle:

```javascript
// In development server configuration (if applicable)
const servePaths = [
  'dist/',
  'css/',
  'data/',
  // Ensure static files are served correctly
];
```

### Bundle Optimization Configuration

#### Module Resolution Settings

Configure proper module resolution for the new entry point:

```javascript
// In build configuration
const buildConfig = {
  // ... existing configuration

  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      // Ensure proper path resolution for character builder modules
      '@characterBuilder': path.resolve(__dirname, 'src/characterBuilder'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },

  // External dependencies (if needed)
  external: [],

  // Module format
  format: 'esm',
  target: 'es2020',
};
```

#### Code Splitting Configuration (Optional)

Consider code splitting for better performance:

```javascript
// Advanced build configuration (optional)
const buildConfig = {
  entryPoints: {
    'speech-patterns-generator': 'src/speech-patterns-generator-main.js',
    // ... other entry points
  },

  splitting: true, // Enable code splitting
  chunkNames: 'chunks/[name]-[hash]',

  // ... rest of configuration
};
```

## Technical Specifications

### Entry Point Structure

The entry point follows the established pattern used by other character builder pages:

1. **Bootstrap Integration**: Uses existing `CharacterBuilderBootstrap`
2. **Service Configuration**: Declares page-specific services
3. **Schema Loading**: Includes custom validation schemas
4. **Error Handling**: Provides graceful failure handling

### Build System Integration

1. **Module Resolution**: Ensure proper ES module handling
2. **Dependency Bundling**: Bundle all required dependencies
3. **Source Maps**: Generate source maps for development
4. **Minification**: Minify for production builds

### Development Workflow

1. **Watch Mode**: Support for development with file watching
2. **Hot Reload**: If implemented, ensure new entry point is included
3. **Error Reporting**: Clear build error reporting for new entry point

## Implementation Steps

### Step 1: Create Entry Point

1. Create `src/speech-patterns-generator-main.js` with the content above
2. Verify imports will resolve correctly (controllers/services will be created in later tickets)

### Step 2: Update Build Configuration

1. Locate existing build configuration file
2. Add new entry point to entryPoints array
3. Test build configuration syntax

### Step 3: Test Build Process

1. Run build command to verify configuration
2. Check that `dist/speech-patterns-generator.js` is generated
3. Verify bundle contains expected modules

### Step 4: Update Package Scripts

1. Ensure all build scripts include new entry point
2. Test development and production builds
3. Verify file watching includes new files

## Acceptance Criteria

### Build Configuration Requirements

- [ ] New entry point added to esbuild configuration
- [ ] Build process generates `dist/speech-patterns-generator.js` successfully
- [ ] Bundle includes proper module dependencies
- [ ] Source maps generated in development mode

### Entry Point Requirements

- [ ] Entry point file created with proper bootstrap integration
- [ ] Graceful error handling implemented
- [ ] DOM ready state handling works correctly
- [ ] Console logging provides useful feedback

### Development Workflow Requirements

- [ ] `npm run build` includes new entry point
- [ ] `npm run build:dev` generates development bundle
- [ ] File watching (if implemented) includes new files
- [ ] Build errors for new entry point are clear and helpful

### Integration Requirements

- [ ] Bundle loads correctly in HTML page
- [ ] Module imports resolve without errors
- [ ] Bootstrap process initiates properly
- [ ] Error page displays when components are missing

### Performance Requirements

- [ ] Bundle size is reasonable for page complexity
- [ ] Build time impact is minimal
- [ ] Code splitting (if enabled) works correctly
- [ ] Bundle optimization settings applied

## Testing Checklist

### Build System Testing

- [ ] Clean build generates all expected files
- [ ] Development build includes source maps
- [ ] Production build includes minification
- [ ] Watch mode detects changes to entry point

### Entry Point Testing

- [ ] HTML page loads bundle without errors
- [ ] Bootstrap initialization attempts (even with missing components)
- [ ] Error handling displays user-friendly messages
- [ ] Console output provides useful information

### Integration Testing

- [ ] Bundle works with existing character builder infrastructure
- [ ] Module resolution finds existing services and utilities
- [ ] Error states are handled gracefully
- [ ] Build process doesn't affect other entry points

## Files Modified

- **NEW**: `src/speech-patterns-generator-main.js`
- **MODIFIED**: Build configuration file (e.g., `build.js`, `esbuild.config.js`)
- **POTENTIALLY MODIFIED**: `package.json` (if script updates needed)

## Dependencies For Next Tickets

This build configuration is required for:

- SPEPATGEN-005 (Controller Implementation) - controller will be imported by entry point
- SPEPATGEN-006 (Display Service) - service will be imported by entry point
- All subsequent development work - provides essential build foundation

## Notes

- Entry point imports controllers/services that don't exist yet - this is expected
- Build system should handle missing imports gracefully during development
- Consider using dynamic imports if components are optional
- Test build performance impact - new entry point shouldn't significantly slow builds
- Ensure build configuration changes don't break existing entry points
- Document any new build commands or processes for the development team
