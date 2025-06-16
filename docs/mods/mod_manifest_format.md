# Mod Manifest Format

Every mod requires a `mod.manifest.json` file describing its metadata and the content files it provides. The following fields are recognized:

## `id` (required)

Unique identifier for the mod. Case-insensitive for lookups and used as the namespace for its content.

## `version` (required)

Semantic version string of the mod (e.g., `"1.0.0"`).

## `name` (required)

Human-friendly display name.

## `description`

Optional short summary of what the mod does.

## `author`

Optional string naming the author or team.

## `gameVersion`

Optional [SemVer](https://semver.org/) range specifying compatible engine versions. If provided, the engine will refuse to load the mod when the running version falls outside this range or the value is not a valid range.

## `dependencies`

Optional array of objects declaring required mods. Each entry has:

- `id`: ID of the dependency mod.
- `version`: SemVer range that the dependency must satisfy.

## `conflicts`

Optional array of mod IDs that cannot be loaded alongside this mod.

## `content`

Object mapping content categories to arrays of JSON definition files. Paths are relative to the mod's root directory. Allowed categories are `actions`, `characters`, `components`, `items`, `locations`, `rules`, `macros`, `events`, and `ui`.

### Sample Manifest

```json
{
  "$schema": "http://example.com/schemas/mod.manifest.schema.json",
  "id": "ExampleMod",
  "version": "1.0.0",
  "name": "Example Mod",
  "description": "Adds sample items and characters.",
  "author": "ACME Studios",
  "gameVersion": ">=1.0.0",
  "dependencies": [{ "id": "core", "version": ">=1.0.0" }],
  "conflicts": ["OldExampleMod"],
  "content": {
    "characters": ["hero.character.json"],
    "locations": ["town.location.json"]
  }
}
```

### `ui` Category

Mods may supply user-interface resources using a `ui` content category. Typical files include:

- `icons.json` – conforms to `ui-icons.schema.json` and maps icon names to SVG markup or image paths.
- `labels.json` – conforms to `ui-labels.schema.json` and maps label keys to display text.

Example snippet:

```json
{
  "content": {
    "ui": ["icons.json", "labels.json"]
  }
}
```

The UiLoader validates these files against their schemas and merges the results across all mods. When multiple mods provide the same icon or label key, the version from the mod loaded last overrides earlier ones.

### UiAssetsLoader Storage

The `UiAssetsLoader` persists validated UI resources in the engine's data registry. Icon files are stored under the `ui_icons` key, while label files are stored under `ui_labels`. The loader chooses which schema to validate against based on the filename: include the word `"icon"` for files following `ui-icons.schema.json` and `"label"` for those following `ui-labels.schema.json`.
