# COMMODMIG-010: Cleanup Core and Integration

## Overview
Final cleanup phase: remove migrated files from core mod, update game configuration to include the companionship mod, and verify complete integration with the movement mod and overall system.

## Prerequisites
- COMMODMIG-001 through COMMODMIG-009 (all migrations and updates complete)
- All tests passing from COMMODMIG-009

## Acceptance Criteria
1. ✅ All migrated files removed from core mod
2. ✅ Core mod manifest no longer references companionship content
3. ✅ game.json includes companionship mod
4. ✅ Companionship mod loads successfully
5. ✅ Cross-mod integration with movement mod works
6. ✅ Following/dismissing works in gameplay
7. ✅ Auto-movement of followers functions correctly
8. ✅ No console errors during gameplay
9. ✅ Documentation updated

## Implementation Steps

### Step 1: Final Verification of Migrated Files
Before deletion, verify all files are successfully migrated:

```bash
# Verify companionship mod has all required files
echo "=== Companionship Mod Structure ==="
ls -la data/mods/companionship/
ls data/mods/companionship/actions/
ls data/mods/companionship/components/
ls data/mods/companionship/conditions/
ls data/mods/companionship/rules/
ls data/mods/companionship/scopes/
ls data/mods/companionship/macros/

# Count files (should be 17 JSON files total)
find data/mods/companionship -name "*.json" -o -name "*.scope" | wc -l
```

### Step 2: Remove Files from Core Mod
Delete all migrated files from core (if not already done):

```bash
# Components (2 files)
rm -f data/mods/core/components/following.component.json
rm -f data/mods/core/components/leading.component.json

# Actions (3 files)
rm -f data/mods/core/actions/follow.action.json
rm -f data/mods/core/actions/stop_following.action.json
rm -f data/mods/core/actions/dismiss.action.json

# Conditions (5 files)
rm -f data/mods/core/conditions/event-is-action-follow.condition.json
rm -f data/mods/core/conditions/event-is-action-stop-following.condition.json
rm -f data/mods/core/conditions/event-is-action-dismiss.condition.json
rm -f data/mods/core/conditions/entity-is-following-actor.condition.json
rm -f data/mods/core/conditions/actor-is-following.condition.json

# Rules (4 files)
rm -f data/mods/core/rules/follow.rule.json
rm -f data/mods/core/rules/stop_following.rule.json
rm -f data/mods/core/rules/dismiss.rule.json
rm -f data/mods/core/rules/follow_auto_move.rule.json

# Scopes (2 files)
rm -f data/mods/core/scopes/followers.scope
rm -f data/mods/core/scopes/potential_leaders.scope

# Macros (1 file)
rm -f data/mods/core/macros/autoMoveFollower.macro.json
```

### Step 3: Clean Core Mod Manifest
Edit `data/mods/core/mod-manifest.json` to ensure all companionship references are removed:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "core",
  "version": "1.0.0",
  "name": "Core Game Mechanics",
  "description": "Fundamental game engine mechanics",
  "author": "Living Narrative Engine Team",
  "dependencies": [],
  "loadOrder": 10,
  "components": [
    // Ensure these are removed:
    // - "core:following"
    // - "core:leading"
    // Keep only actual core components
  ],
  "actions": [
    // Ensure these are removed:
    // - "core:follow"
    // - "core:stop_following"
    // - "core:dismiss"
    // Keep only actual core actions
  ],
  "conditions": [
    // Ensure these are removed:
    // - "core:event-is-action-follow"
    // - "core:event-is-action-stop-following"
    // - "core:event-is-action-dismiss"
    // - "core:entity-is-following-actor"
    // - "core:actor-is-following"
    // Keep only actual core conditions
  ],
  "rules": [
    // Ensure these are removed:
    // - "core:follow"
    // - "core:stop_following"
    // - "core:dismiss"
    // - "core:follow_auto_move"
    // Keep only actual core rules
  ],
  "scopes": [
    // Ensure these are removed:
    // - "core:followers"
    // - "core:potential_leaders"
    // Keep only actual core scopes
  ],
  "macros": [
    // Ensure these are removed:
    // - "core:autoMoveFollower"
    // Keep only actual core macros
  ]
}
```

### Step 4: Update game.json
Edit `data/game.json` to include the companionship mod:

```json
{
  "title": "Living Narrative Engine Game",
  "version": "1.0.0",
  "mods": [
    "core",
    "movement",
    "companionship",  // Add this line
    // ... other mods
  ],
  "startingLocation": "tavern",
  // ... rest of game configuration
}
```

### Step 5: Verify Mod Loading Order
Ensure mods load in correct order based on dependencies:
1. core (loadOrder: 10)
2. movement (loadOrder: 15)
3. companionship (loadOrder: 20)

### Step 6: Test Mod Loading
Run the application and verify mod loads correctly:

```bash
# Start the development server
npm run dev

# Check console for mod loading messages
# Should see:
# - Loading mod: core
# - Loading mod: movement
# - Loading mod: companionship
```

### Step 7: Integration Testing

#### Test Following Actions
1. Launch the game in browser
2. Verify follow action appears with Deep Teal color (#00695c)
3. Test following an NPC
4. Verify companionship:following component is created
5. Test stop following action
6. Test dismiss action on a follower

#### Test Auto-Movement
1. Have an NPC follow the player
2. Move to a different location
3. Verify the follower moves automatically
4. Check that `core:entity_moved` event triggers companionship rule

#### Test Cross-Mod Integration
1. Verify movement mod events trigger companionship rules
2. Test that disabling companionship mod doesn't break core/movement
3. Verify no errors when companionship mod is excluded from game.json

### Step 8: Update Documentation

#### Update README.md
Add section about the companionship mod:

```markdown
## Optional Mods

### Companionship System
The companionship mod provides following and leading mechanics:
- **Follow/Dismiss Actions**: NPCs can follow the player or each other
- **Auto-Movement**: Followers automatically move with their leaders
- **Deep Teal Theme**: Visual distinction from core mechanics

To enable companionship features, include `"companionship"` in your `game.json` mods list.

Dependencies: `core`, `movement`
```

#### Update CLAUDE.md
Add companionship mod to the mod structure section:

```markdown
### Mod Structure
- `core/`: Fundamental engine mechanics
- `movement/`: Movement and navigation system
- `companionship/`: Following and leading mechanics (optional)
  - Deep Teal color scheme (#00695c)
  - Depends on core and movement mods
```

### Step 9: Final Validation Checklist

Run through this checklist to ensure complete migration:

- [ ] Companionship mod directory exists with all subdirectories
- [ ] 17 files migrated (2 components, 3 actions, 5 conditions, 4 rules, 2 scopes, 1 macro)
- [ ] All namespaces updated to `companionship:`
- [ ] Deep Teal color scheme applied to actions
- [ ] Core mod cleaned of all companionship content
- [ ] JavaScript files updated with new component IDs
- [ ] Operation schemas updated with companionship references
- [ ] All tests updated and passing
- [ ] game.json includes companionship mod
- [ ] Mod loads without errors
- [ ] Following/dismissing works in game
- [ ] Auto-movement functions correctly
- [ ] Documentation updated

### Step 10: Performance Verification

```bash
# Run performance tests
npm run test:performance -- --grep "action"

# Check bundle size hasn't increased significantly
npm run build
ls -lh dist/bundle.js

# Verify no memory leaks with follower management
# (Manual testing: create/remove many followers)
```

## Testing Requirements

### Smoke Tests
1. Game launches without errors
2. All mods load in correct order
3. No console errors during gameplay

### Functional Tests
1. Follow action creates relationship
2. Stop following breaks relationship
3. Dismiss removes follower
4. Followers auto-move with leaders
5. Multiple followers work correctly
6. Circular following prevented

### Integration Tests
1. Works with save/load system
2. Compatible with other mods
3. Can be disabled without breaking game

## Notes
- Keep a backup of the repository before final deletion
- Test with existing save games to ensure compatibility
- The migration is complete - no legacy support needed
- Consider creating a migration guide for other mods

## Dependencies
- Blocks: None (this is the final step)
- Blocked by: COMMODMIG-001 through COMMODMIG-009

## Estimated Effort
- 1-2 hours

## Risk Assessment
- **Medium Risk**: Final integration may reveal hidden dependencies
- **Save Game Impact**: Existing saves with followers may need handling
- **Mitigation**: Thorough testing, git for rollback if needed

## Success Metrics
- ✅ Core mod contains no companionship content
- ✅ Companionship mod fully functional as separate module
- ✅ Game works with companionship enabled
- ✅ Game works with companionship disabled
- ✅ No regression in core functionality
- ✅ Performance unchanged or improved
- ✅ All tests pass
- ✅ Zero console errors

## Post-Migration Considerations

### Future Enhancements
With companionship as a separate mod, consider:
- Group following mechanics
- Follow distance settings
- Formation following patterns
- Follower AI behaviors
- Companion inventory management

### Architectural Benefits Achieved
- ✅ Cleaner separation of concerns
- ✅ Optional gameplay mechanics
- ✅ Easier maintenance and updates
- ✅ Better mod organization
- ✅ Sets precedent for future modularization