# MODMANIMP-003: Build Configuration Update

**Status:** Completed
**Priority:** Phase 1 (Foundation)
**Estimated Effort:** S (2-3 hours)
**Dependencies:** None
**Completed:** 2025-12-17

---

## Objective

Add mod-manager bundle configuration to the build system. This enables the mod-manager page to be bundled alongside other standalone pages like anatomy-visualizer and character-concepts-manager.

---

## Files to Touch

### Modified Files

- `scripts/build.config.js` (ADD bundle entry and HTML file)

---

## Out of Scope

**DO NOT modify:**

- Any source files in `/src/`
- Any existing bundle configurations
- esbuild options or build modes
- Static asset directories
- Performance or validation settings
- The build script itself (`scripts/build.js`)

---

## Implementation Details

### Bundle Configuration

```javascript
// In scripts/build.config.js, add to bundles array:
{
  name: 'mod-manager',
  entry: 'src/mod-manager-main.js',
  output: 'mod-manager.js',
},
```

### HTML File Registration

```javascript
// In scripts/build.config.js, add to htmlFiles array:
'mod-manager.html',
```

### Full Diff Preview

```diff
  bundles: [
    // ... existing bundles ...
    {
      name: 'index-llm-selector',
      entry: 'src/index-llm-selector.js',
      output: 'index-llm-selector.js',
    },
+   {
+     name: 'mod-manager',
+     entry: 'src/mod-manager-main.js',
+     output: 'mod-manager.js',
+   },
  ],

  htmlFiles: [
    // ... existing files ...
    'traits-rewriter.html',
+   'mod-manager.html',
  ],
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Build configuration is valid JavaScript:**
   ```bash
   node -e "require('./scripts/build.config.js')"
   ```

2. **ESLint passes:**
   ```bash
   npx eslint scripts/build.config.js
   ```

3. **Build script recognizes new bundle:**
   ```bash
   npm run build 2>&1 | grep -q "mod-manager" && echo "Found"
   ```
   Note: Will show warning about missing entry file until MODMANIMP-006 is complete.

### Invariants That Must Remain True

1. All existing bundles continue to build correctly
2. All existing HTML files continue to be copied
3. Build configuration remains valid JavaScript module
4. No changes to esbuild options or build behavior
5. Bundle naming follows existing pattern (kebab-case)

---

## Reference Files

- Existing bundle pattern: `scripts/build.config.js` (see anatomy-visualizer, character-concepts-manager)
- Build script: `scripts/build.js`

---

## Outcome

### What Was Actually Changed

1. **Added mod-manager bundle entry** to `scripts/build.config.js`:
   - `name: 'mod-manager'`
   - `entry: 'src/mod-manager-main.js'`
   - `output: 'mod-manager.js'`

2. **Added mod-manager.html** to the `htmlFiles` array in `scripts/build.config.js`

### Deviations from Original Plan

None. The implementation matched the ticket specification exactly.

### Validation Results

- **Build config valid JavaScript:** ✅ Passes
- **ESLint:** ⚠️ Pre-existing issue with unused `path` import (not introduced by this change)
- **Configuration integrity:** ✅ All 12 bundles and 12 HTML files properly registered
- **No breaking changes:** ✅ All existing configuration preserved

### Notes

- The build will fail until MODMANIMP-006 creates `src/mod-manager-main.js`
- The build will also need `mod-manager.html` (MODMANIMP-004) to copy the HTML file
- The pre-existing ESLint error about unused `path` variable should be addressed in a separate cleanup ticket
