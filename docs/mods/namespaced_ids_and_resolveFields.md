# Namespaced IDs & `resolveFields`

The engine stores most game content in JSON files. Each mod uses a unique **namespace** taken from its `mod.manifest.json` so that identifiers do not collide. The general pattern is:

```
<mod-id>:<local-id>
```

Example IDs:

- `core:player`
- `isekai:adventurers_guild`
- `weapons:laser_gun`

When a definition in one mod needs to reference content from another mod, it simply includes that other namespaced ID. For instance a character from the `isekai` mod can start in a location defined by the `core` mod:

```json
{
  "id": "isekai:hero",
  "components": {
    "core:position": { "locationId": "core:start_room" }
  }
}
```

During world initialization every entity definition is turned into a runtime instance with a generated UUID. Components that contain references to other definitions list how those references should be resolved via the **`resolveFields`** array in their component definition file.

A simplified `core:position` component definition illustrates the structure:

```json
{
  "id": "core:position",
  "resolveFields": [
    { "dataPath": "locationId", "resolutionStrategy": { "type": "direct" } }
  ]
}
```

Each entry describes a field path and a strategy. Supported strategies include:

- `direct` – a single namespaced ID is replaced with the target instance ID.
- `arrayOfDefinitionIds` – every element in the array is resolved.
- `arrayOfObjects` – resolve an ID field inside each object (e.g., `core:exits` uses `idField: "target"`).

### Example Cross‑Mod Resolution

Suppose `modA` defines a location `modA:castle` and `modB` defines a character `modB:knight` positioned inside that castle:

```json
// modB character definition
{
  "id": "modB:knight",
  "components": {
    "core:position": { "locationId": "modA:castle" }
  }
}
```

When both mods load, the engine creates instances for `modA:castle` and `modB:knight`. Pass 2 of world initialization uses the `resolveFields` specification from `core:position` to look up the instance created from `modA:castle` and swaps `"modA:castle"` with that instance's UUID. Other components such as `core:exits` perform similar resolution for each referenced target.

### Limitations & Best Practices

- **Avoid circular references.** Entities that ultimately refer back to themselves via `resolveFields` chains may never resolve or could create unexpected behaviours.
- Ensure that any referenced mod is listed as a dependency in your mod manifest so it loads before your mod.
- Only fields declared in a component's `resolveFields` array are processed. Other strings that look like IDs remain unchanged.

Using namespaced IDs consistently and declaring `resolveFields` correctly allows the engine to keep mods isolated yet interoperable.
