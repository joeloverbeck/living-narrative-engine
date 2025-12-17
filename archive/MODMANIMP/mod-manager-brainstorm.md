# Mod Manager - Brainstorming Document

> **Date**: December 2025
> **Status**: Archived (Implementation Complete)
> **Purpose**: Design a modern Mod Manager page for the Living Narrative Engine
> **Archived**: December 2025

---

## 📋 Executive Summary

This document explores the design and implementation of a **Mod Manager** page that will replace manual `game.json` editing with a visual, responsive interface for managing mods and selecting worlds.

---

## 🎯 Core Requirements

### Explicit Requirements (from user request)

1. **Button in index.html** - Add "Mod Manager" button to "Game Operations" section
2. **List Available Mods** - Display all mods from `data/mods/*`
3. **Show Active Status** - Indicate which mods are currently active in `game.json`
4. **Dependency Visualization** - Show mods that are auto-activated as dependencies
5. **Interactive Activation** - Click to toggle mod activation with live dependency updates
6. **World Selection** - List available worlds from active mods' `/worlds/` directories
7. **Pre-selection** - Load current `game.json` world as pre-selected
8. **Save to game.json** - Persist changes back to `game.json`

### Implicit Requirements (discovered during analysis)

1. **Dependency Resolution** - Use existing Kahn's algorithm for topological sorting
2. **Version Compatibility** - Display SemVer requirements and compatibility status
3. **Conflict Detection** - Show mod conflicts as defined in manifests
4. **Core Mod Handling** - `core` mod is always required (auto-injected)
5. **Case-Insensitive Matching** - Follow existing mod ID normalization

---

## 🏗️ Technical Architecture Analysis

### Current System Flow

```
game.json (manual edit)
    ↓
GameConfigLoader (fetches game.json)
    ↓
ModManifestProcessor (loads manifests, resolves deps)
    ↓
modLoadOrderResolver (Kahn's topological sort)
    ↓
Content loading phases
    ↓
WorldLoader (discovers *.world.json files)
```

### Proposed Flow with Mod Manager

```
Mod Manager Page
    ↓
ModDiscoveryService (NEW - scans all data/mods/*)
    ↓
ModGraphBuilder (NEW - builds visual dependency graph)
    ↓
User interaction (toggle mods, select world)
    ↓
ModConfigurationWriter (NEW - saves to game.json)
    ↓
(Existing flow unchanged)
```

### Key Components to Reuse

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| `modLoadOrderResolver.js` | `src/modding/` | Direct import for dependency calculation |
| `ModManifestLoader.js` | `src/modding/` | Load all manifests for UI display |
| `ModDependencyValidator.js` | `src/modding/` | Validate user selections |
| `WorldLoader.js` | `src/loaders/` | World discovery logic |
| Button styling | `css/index-redesign.css` | `nav-button--game` class |

---

## 💡 Design Options

### Option A: Single-Page Application (SPA) Style

**Approach**: Create `mod-manager.html` as a standalone page with its own entry point.

**Pros**:
- Clean separation from game logic
- Can load independently of game engine
- Faster initial load (no bundle.js required)

**Cons**:
- Separate build process needed
- Duplicate utility code

**Implementation**:
```
/mod-manager.html
/src/mod-manager-main.js (entry point)
/dist/mod-manager.js (bundled)
```

### Option B: Modal/Overlay in index.html

**Approach**: Add a modal that slides in when clicking the button.

**Pros**:
- No page navigation
- Reuses existing styles
- Feels more integrated

**Cons**:
- Increases index.html complexity
- May clash with existing CSS

**Implementation**:
```html
<div id="mod-manager-modal" class="modal">
  <!-- Dynamic content -->
</div>
```

### Option C: Tab System in Game Setup Flow

**Approach**: Create a multi-step wizard: Mods → World → Start Game.

**Pros**:
- Guided user experience
- Natural progression
- Could replace current "Start New Game" button

**Cons**:
- Major UX change
- More complex implementation

### ✅ **Recommended**: Option A (SPA Style)

Rationale:
- Follows existing pattern (character-builder, anatomy-visualizer are separate pages)
- Clean separation of concerns
- Easy to test independently
- Can be enhanced later without affecting core game

---

## 🎨 UI/UX Design Exploration

### Layout Concept

```
┌────────────────────────────────────────────────────────────────┐
│  [← Back to Menu]              Mod Manager               [Save] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────┐  ┌────────────────────────┐ │
│  │  📦 Available Mods           │  │  🌍 Available Worlds   │ │
│  │                              │  │                        │ │
│  │  ┌────────────────────────┐  │  │  ○ dredgers:dredgers   │ │
│  │  │ ✓ core (locked)        │  │  │  ○ fantasy:main       │ │
│  │  │   Always required      │  │  │  ● test:sandbox       │ │
│  │  └────────────────────────┘  │  │                        │ │
│  │                              │  │  (Worlds from active   │ │
│  │  ┌────────────────────────┐  │  │   mods only)          │ │
│  │  │ ✓ positioning          │  │  │                        │ │
│  │  │   ↳ deps: core         │  │  └────────────────────────┘ │
│  │  │   v1.0.0               │  │                              │
│  │  └────────────────────────┘  │  ┌────────────────────────┐ │
│  │                              │  │  📊 Load Summary       │ │
│  │  ┌────────────────────────┐  │  │                        │ │
│  │  │ ✓ clothing (auto)      │  │  │  Active: 45 mods      │ │
│  │  │   Required by: combat  │  │  │  Explicit: 12         │ │
│  │  │   ↳ deps: core, anat.  │  │  │  Dependencies: 33     │ │
│  │  └────────────────────────┘  │  │  Conflicts: 0         │ │
│  │                              │  │                        │ │
│  │  ┌────────────────────────┐  │  │  World: dredgers      │ │
│  │  │ ☐ combat               │  │  └────────────────────────┘ │
│  │  │   Optional             │  │                              │
│  │  │   ↳ deps: positioning  │  │                              │
│  │  └────────────────────────┘  │                              │
│  │                              │                              │
│  └──────────────────────────────┘                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Mod Card States

1. **Active (Explicit)** - User selected, checkbox checked, normal color
2. **Active (Dependency)** - Auto-selected, checkbox checked + "auto" badge, muted color
3. **Active (Core)** - Always on, checkbox disabled, locked icon
4. **Inactive** - Not selected, checkbox unchecked
5. **Incompatible** - Cannot activate, grayed out, conflict icon
6. **Version Mismatch** - Warning icon, tooltip with details

### Responsive Behavior

- **Desktop (>1024px)**: Two-column layout (mods | worlds + summary)
- **Tablet (768-1024px)**: Stacked layout, collapsible sections
- **Mobile (<768px)**: Single column, accordion-style sections

### Color Coding Suggestion

| State | Color | Meaning |
|-------|-------|---------|
| Green border | `#28a745` | Explicitly activated |
| Blue border | `#007bff` | Active as dependency |
| Gray border | `#6c757d` | Inactive |
| Red border | `#dc3545` | Conflict/incompatible |
| Yellow badge | `#ffc107` | Version warning |

### Animation Ideas

1. **On mod activation**: Cascade animation showing dependencies lighting up
2. **On mod deactivation**: Ripple effect showing which mods become inactive
3. **Conflict detection**: Shake animation on conflicting mods
4. **Save success**: Brief flash/pulse on save button

---

## 🔄 Interaction Flows

### Flow 1: Initial Page Load

```
1. Fetch game.json → Get current mods[] and startWorld
2. Scan data/mods/* → Get all available mod directories
3. Fetch all mod-manifest.json files in parallel
4. Build dependency graph using modLoadOrderResolver
5. Mark mods as:
   - Explicit (in game.json)
   - Dependency (required by explicit mods)
   - Inactive (not loaded)
6. Scan worlds from active mods' /worlds/ directories
7. Pre-select startWorld from game.json
8. Display UI
```

### Flow 2: Activate a Mod

```
User clicks inactive mod "combat"
    ↓
Calculate new dependency set:
    - combat requires: positioning, core
    - positioning requires: core
    - Total new deps: [positioning] (core already active)
    ↓
Check for conflicts:
    - If combat.conflicts includes any active mod → show warning
    ↓
Update UI immediately:
    - Mark "combat" as Explicit Active
    - Mark "positioning" as Dependency Active (if not already)
    - Show animation cascade
    ↓
Recalculate available worlds:
    - Include worlds from combat/worlds/
    ↓
Update summary panel
```

### Flow 3: Deactivate a Mod

```
User clicks active mod "combat"
    ↓
Check dependents:
    - Which other explicit mods require "combat"?
    - If any → show warning, require confirmation
    ↓
Calculate mods to deactivate:
    - Remove "combat"
    - Check each dependency: is it still needed by another explicit mod?
    - If not needed → mark for deactivation
    ↓
Update UI:
    - Show deactivation cascade animation
    - Update states
    ↓
Recalculate available worlds:
    - Remove worlds from deactivated mods
    - If selected world removed → prompt user to select new world
    ↓
Update summary panel
```

### Flow 4: Save Configuration

```
User clicks "Save"
    ↓
Build new game.json:
    {
      "mods": [/* explicit mods only, not dependencies */],
      "startWorld": "selected:world"
    }
    ↓
Validate:
    - At least one mod selected?
    - Valid world selected?
    - No unresolved conflicts?
    ↓
Write to game.json:
    - Method A: localStorage + export button (browser-only)
    - Method B: Server endpoint (requires backend)
    - Method C: Service Worker + File System API (modern browsers)
    ↓
Show success feedback
```

---

## ⚠️ Technical Challenges & Solutions

### Challenge 1: Writing to game.json from Browser

**Problem**: Browsers cannot write to local files directly.

**Solutions**:

| Solution | Pros | Cons |
|----------|------|------|
| **A. Download button** | Simple, no server needed | Manual file replacement |
| **B. Local backend endpoint** | Seamless save | Requires server changes |
| **C. File System Access API** | Modern, seamless | Limited browser support |
| **D. Electron wrapper** | Full file access | Heavy, new deployment |

**Recommendation**: Start with **Option B** (backend endpoint) since the llm-proxy-server already exists and can host a simple `/save-config` endpoint.

### Challenge 2: Discovering All Mods

**Problem**: Need to list all mods without game.json specifying them.

**Solution**: Create a manifest file or API endpoint that lists available mods.

**Options**:
1. **Static manifest**: `data/mods/manifest-index.json` with mod list (requires manual update)
2. **Build-time generation**: NPM script generates manifest from directory scan
3. **Server endpoint**: `/api/mods` returns directory listing

**Recommendation**: **Option 2** - Add `npm run update-mod-index` that generates `data/mods/index.json`

### Challenge 3: Dependency Graph Performance

**Problem**: Large mod sets (64+ mods) may cause UI lag during graph recalculation.

**Solution**:
- Use Web Workers for graph calculation
- Debounce UI updates
- Cache intermediate results
- Use incremental updates instead of full recalculation

### Challenge 4: World Discovery

**Problem**: Need to discover worlds from multiple mods dynamically.

**Solution**: Reuse `WorldLoader` logic or create a lightweight version that only returns world metadata.

---

## 🚀 Additional Features to Consider

### Must-Have Enhancements

1. **Search/Filter** - Filter mods by name, category, or tag
2. **Category Grouping** - Group mods by type (core, gameplay, content, etc.)
3. **Dependency Tree View** - Expandable tree showing full dependency chain
4. **Validation Feedback** - Real-time validation of mod combination
5. **Load Order Preview** - Show final load order before saving

### Nice-to-Have Features

1. **Mod Presets** - Save/load mod configurations as named presets
2. **Mod Details Panel** - Show description, author, version on hover/click
3. **Version History** - Track changes to game.json over time
4. **Import/Export** - Share mod configurations as JSON files
5. **Conflict Resolution Wizard** - Guide users through resolving conflicts
6. **Mod Categories** - Organize mods by gameplay systems
7. **Quick Actions** - "Enable All", "Disable All", "Reset to Default"
8. **Keyboard Navigation** - Full keyboard support for accessibility
9. **Undo/Redo** - Undo recent changes before saving
10. **Diff View** - Show changes from current game.json before saving

### Advanced Features (Future)

1. **Mod Update Checker** - Check for mod version updates
2. **Mod Download/Install** - Download mods from repository
3. **Load Order Optimization** - Suggest optimal load order
4. **Compatibility Matrix** - Visual matrix of mod compatibility
5. **Performance Metrics** - Estimated load time based on mod selection
6. **Profile System** - Multiple game.json profiles for different playthroughs

---

## 📁 Proposed File Structure

```
/mod-manager.html                    # Entry HTML
/src/mod-manager-main.js             # Entry JavaScript
/src/modManager/                     # Module directory
├── controllers/
│   └── ModManagerController.js      # Main orchestrator
├── services/
│   ├── ModDiscoveryService.js       # Scans available mods
│   ├── ModGraphService.js           # Builds/updates dependency graph
│   ├── WorldDiscoveryService.js     # Finds available worlds
│   └── ConfigPersistenceService.js  # Saves to game.json
├── models/
│   ├── ModViewModel.js              # Mod display model
│   └── WorldViewModel.js            # World display model
├── views/
│   ├── ModListView.js               # Renders mod list
│   ├── WorldListView.js             # Renders world list
│   ├── SummaryPanelView.js          # Renders summary
│   └── ModCardComponent.js          # Individual mod card
├── events/
│   └── modManagerEvents.js          # Event constants
└── utils/
    └── graphAnimations.js           # Animation utilities

/css/mod-manager.css                 # Dedicated styles
/dist/mod-manager.js                 # Bundled output
```

---

## 🔨 Implementation Phases

### Phase 1: Foundation (MVP)

- [x] Create `mod-manager.html` with basic structure
- [x] Add button to index.html "Game Operations" section
- [x] Implement `ModDiscoveryService` to list all mods
- [x] Display simple mod list with active/inactive states
- [x] Implement basic world selection dropdown
- [x] Add "Download Config" button for game.json export

### Phase 2: Dependency Visualization

- [x] Integrate `modLoadOrderResolver` for dependency calculation
- [x] Add dependency badges to mod cards
- [x] Implement cascade animation for activation/deactivation
- [x] Add "Required by" information for dependency mods
- [x] Show conflict warnings

### Phase 3: Polish & UX

- [x] Add search/filter functionality
- [x] Implement responsive layout
- [x] Add keyboard navigation
- [x] Create smooth animations
- [ ] Add undo/redo support (deferred to future)

### Phase 4: Persistence & Integration

- [x] Add backend endpoint for saving game.json
- [ ] Implement preset system (deferred to future)
- [ ] Add import/export functionality (deferred to future)
- [x] Integration testing with full game flow

---

## ✅ Success Criteria

1. **Functional**: Users can activate/deactivate mods and select worlds
2. **Visual**: Dependency relationships are clearly visible
3. **Responsive**: UI updates immediately reflect changes
4. **Reliable**: Changes persist correctly to game.json
5. **Accessible**: Keyboard navigable, screen reader friendly
6. **Performant**: Handles 64+ mods without noticeable lag

---

## 🔗 Related Documentation

- `docs/modding/` - Mod development guides
- `src/loaders/` - Existing loader implementations
- `src/modding/` - Dependency resolution code
- `CLAUDE.md` - Project conventions and patterns

---

## 📝 Open Questions (Resolved)

1. **Persistence Strategy**: Backend endpoint (POST /api/game-save) ✓
2. **Mod Index**: Server endpoint (GET /api/mods) ✓
3. **UI Framework**: Pure JS (like existing) ✓
4. **Animation Library**: CSS-only ✓
5. **Category System**: Deferred to future enhancement
6. **Default State**: Handled gracefully with empty mod list
7. **Error Recovery**: Graceful degradation with error messages

---

## Archive Note

This brainstorming document has been archived upon completion of the Mod Manager implementation. All 23 tickets in the MODMANIMP series have been completed. See `archive/MODMANIMP/MODMANIMP-000-overview.md` for the full ticket inventory and status.

---

*This document served as the starting point for the Mod Manager implementation and is now archived for historical reference.*
