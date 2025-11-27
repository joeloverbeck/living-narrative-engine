# PERPARHEAANDNARTHR-011: Mod Manifest Update

**Status:** Ready
**Priority:** High (Phase 4)
**Estimated Effort:** 0.25 days
**Dependencies:**
- PERPARHEAANDNARTHR-001 (Part Health Component)
- PERPARHEAANDNARTHR-002 (Health Thresholds Lookup)
- PERPARHEAANDNARTHR-009 (Part Health Changed Event)
- PERPARHEAANDNARTHR-010 (Part State Changed Event)

---

## Objective

Update the anatomy mod manifest to include references to the new component, lookup file, and events created in this epic.

---

## Files to Touch

### New Files
- None

### Modified Files
- `data/mods/anatomy/mod-manifest.json`

---

## Out of Scope

**DO NOT modify:**
- Any component files (already created)
- Any event files (already created)
- Any lookup files (already created)
- Any handler source code
- Any DI registration files
- Any schema files
- Any test files
- Any other mod manifests

---

## Implementation Details

### Manifest Updates

In `data/mods/anatomy/mod-manifest.json`, add the following entries:

#### 1. Add Component Reference

In the `content.components` array, add (maintain alphabetical order):
```json
"part_health.component.json"
```

#### 2. Add Lookups Section

If `content.lookups` section doesn't exist, add it. Then add:
```json
"lookups": [
  "part_health_thresholds.json"
]
```

#### 3. Add Event References

In the `content.events` array, add (maintain alphabetical order):
```json
"part_health_changed.event.json",
"part_state_changed.event.json"
```

### Expected Final State (relevant sections)

```json
{
  "content": {
    "components": [
      "blueprintSlot.component.json",
      "body.component.json",
      "can_grab.component.json",
      "joint.component.json",
      "part.component.json",
      "part_health.component.json",
      "requires_grabbing.component.json",
      "sockets.component.json"
    ],
    "lookups": [
      "part_health_thresholds.json"
    ],
    "events": [
      "anatomy_generated.event.json",
      "interaction_click.event.json",
      "interaction_pan.event.json",
      "interaction_panend.event.json",
      "interaction_panstart.event.json",
      "interaction_zoom.event.json",
      "limb_detached.event.json",
      "part_health_changed.event.json",
      "part_state_changed.event.json",
      "visualizer_state_changed.event.json"
    ]
  }
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **JSON validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/mod-manifest.json'))"
   ```

2. **Schema validation:**
   - `npm run validate` passes without errors

3. **File existence verification:**
   - All referenced files in manifest actually exist
   - No 404 errors during mod loading

4. **Full test suite:**
   - `npm run test:ci` passes

### Invariants That Must Remain True

1. All existing manifest entries remain unchanged
2. Alphabetical order maintained in arrays
3. All referenced files exist in the correct paths
4. No duplicate entries in any array
5. Manifest validates against `mod-manifest.schema.json`

---

## Verification Steps

```bash
# 1. Verify manifest is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/mod-manifest.json'))"

# 2. Verify all referenced files exist
node -e "
  const fs = require('fs');
  const manifest = JSON.parse(fs.readFileSync('data/mods/anatomy/mod-manifest.json'));
  const base = 'data/mods/anatomy';

  // Check components
  manifest.content.components.forEach(f => {
    const path = base + '/components/' + f;
    console.log('Component:', path, fs.existsSync(path) ? '✓' : '✗ MISSING');
  });

  // Check events
  manifest.content.events.forEach(f => {
    const path = base + '/events/' + f;
    console.log('Event:', path, fs.existsSync(path) ? '✓' : '✗ MISSING');
  });

  // Check lookups
  if (manifest.content.lookups) {
    manifest.content.lookups.forEach(f => {
      const path = base + '/lookups/' + f;
      console.log('Lookup:', path, fs.existsSync(path) ? '✓' : '✗ MISSING');
    });
  }
"

# 3. Run full validation
npm run validate

# 4. Run test suite
npm run test:ci
```

---

## Reference Files

- Current manifest: `data/mods/anatomy/mod-manifest.json`
- Manifest schema: `data/schemas/mod-manifest.schema.json`
- Similar manifest: `data/mods/metabolism/mod-manifest.json` (has lookups section)
