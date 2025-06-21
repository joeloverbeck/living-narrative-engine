# Mod Loading

This document details aspects of how the Living Narrative Engine loads mods.

## Mod Manifests

See [Mod Manifest Format](mod_manifest_format.md) for details on every allowed field and an example manifest. The engine automatically discovers each `mod-manifest.json` within a mod's directory during startup.

## Dependency & Conflict Validation

The engine performs strict validation of dependencies and conflicts declared in mod manifests before finalizing the load
process. See the main `README.md` or `docs/modding/validation.md` (if created) for detailed rules (D1-D3, C1-C2, E1).
Failure during validation typically halts engine startup.

## Load Order & Overrides

Understanding how the engine determines the order in which mods are loaded and how conflicts between mod content are
resolved is crucial for mod development and troubleshooting.

**Core Rule: `game.json` Defines Initial Priority**

The primary mechanism controlling load order is the `mods` array within the central `game.json` configuration file.

- **Algorithm:** The engine processes the list of mod IDs in the `game.json` `mods` array sequentially. The order in
  this array establishes the **initial load priority**.
- **Example:**
  ```json
  {
    "mods": [
      "core_essentials",          # Lowest priority
      "base_adventure_mechanics", # Medium priority
      "my_custom_story_mod"       # Highest priority
    ]
  }
  ```
  In this example, `core_essentials` is loaded first conceptually, followed by `base_adventure_mechanics`, and finally
  `my_custom_story_mod`.

**Merge Policy: "Last Mod Wins"**

When multiple mods define game data (like items, entity templates, actions, etc.) using the **same ID**, the engine
needs a policy to decide which definition takes precedence.

- **Policy:** The Living Narrative Engine uses a **"Last Mod Wins"** strategy based on the load order. If two mods
  provide data with the identical ID, the data from the mod loaded **later** in the sequence will override the data from
  the mod loaded earlier.
- **Example:** If both `core_essentials` and `my_custom_story_mod` define an item with the ID `"healing_potion"`, the
  definition from `my_custom_story_mod` will be the one used by the engine, as it appears later in the `game.json`
  `mods` array.

**Important Considerations:**

- **Dependency Resolution:** While `game.json` sets the _initial_ order, the engine's dependency resolution system (
  which handles `dependencies` declared in `mod-manifest.json`) might adjust the final effective load order to ensure
  prerequisites are met. However, the general principle of later mods overriding earlier ones still applies to the
  _final_ resolved order. (Details of the exact dependency resolution algorithm are TBD/internal).
- **Data Types:** This override behaviour applies to distinct data entries identified by an ID (e.g., specific items,
  character templates). It doesn't typically involve deep merging _within_ a single JSON file's contents unless
  explicitly designed for that purpose.
- **Case-Insensitivity:** Remember that Mod IDs are treated as case-insensitive for identification and validation, but
  the override mechanism works on the resolved load order.

By understanding the `game.json` ordering and the "Last Mod Wins" policy, modders can better predict how their mods will
interact and override content from core game files or other mods.

## UI Directory Structure

Mods can include a `ui/` folder containing optional `icons.json` and `labels.json` files. These files are simple key/value objects validated against the `ui-icons.schema.json` and `ui-labels.schema.json` schemas.

Reference them in the manifest using a `ui` content category:

```json
{
  "content": {
    "ui": ["icons.json", "labels.json"]
  }
}
```

During loading, the UiLoader merges icon and label definitions from all mods. If multiple mods define the same key, the entry from the mod loaded last overrides earlier ones, following the same "last mod wins" rule used for other content.
