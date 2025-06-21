# Namespaced IDs

The engine stores most game content in JSON files. Each mod uses a unique **namespace** taken from its `mod-manifest.json` so that identifiers do not collide. The general pattern is:

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

During world initialization, every entity definition is turned into a runtime entity instance, each with a unique generated UUID. When components contain references to other entity definitions (like `locationId` in the example above), these namespaced IDs are used by the engine to link to the correct entity instance.

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

When both mods load, the engine creates instances for `modA:castle` and `modB:knight`. The engine then ensures that the `locationId: "modA:castle"` in the `modB:knight`'s `core:position` component correctly refers to the instance of `modA:castle`. This linking happens automatically based on the namespaced IDs provided in the component data.

### Limitations & Best Practices

- **Avoid circular references.** Entities that ultimately refer back to themselves through component data chains may lead to issues or unexpected behaviours.
- Ensure that any referenced mod is listed as a dependency in your mod manifest so it loads before your mod.

Using namespaced IDs consistently allows the engine to keep mods isolated yet interoperable.

### Runtime IDs in memory components

Some components are designed to store the **runtime instance IDs** (UUIDs) that are generated when the world loads, rather than definition IDs. Examples include `core:perception_log`, `core:following`, and `core:leading`. These components are intended to hold direct references to other entity instances. If you pre-populate their fields with namespaced definition IDs, those values will remain as raw strings, as the engine does not automatically resolve definition IDs to instance IDs in these specific components after initial world setup. Your game logic would need to handle such cases if they arise.
