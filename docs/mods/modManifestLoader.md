# Mod Manifest Loader (modManifestLoader.js)

This service is responsible for locating, fetching, validating, and storing mod manifest files (mod-manifest.json). It plays a crucial role in the mod loading sequence by providing the metadata needed for dependency resolution and content loading.

## Sequence Diagram

The following diagram illustrates the typical interaction flow when loading mod manifests (Mermaid Syntax):

sequenceDiagram
participant Caller as Calling Service (e.g., ModsLoader)
participant Resolver as IPathResolver
participant Fetcher as IDataFetcher
participant Validator as ISchemaValidator
participant Registry as IDataRegistry
participant Loader as ModManifestLoader

Caller->>Loader: loadRequestedManifests(['ModA', 'ModB'])
activate Loader

%% Parallel Fetching (Conceptual)
par Fetch ModA
Loader->>Resolver: resolveModManifestPath('ModA')
activate Resolver
Resolver-->>Loader: '/path/to/mods/ModA/mod-manifest.json'
deactivate Resolver
Loader->>Fetcher: fetch('/path/to/mods/ModA/mod-manifest.json')
activate Fetcher
Fetcher-->>Loader: Raw JSON Content (ModA)
deactivate Fetcher
and Fetch ModB
Loader->>Resolver: resolveModManifestPath('ModB')
activate Resolver
Resolver-->>Loader: '/path/to/mods/ModB/mod-manifest.json'
deactivate Resolver
Loader->>Fetcher: fetch('/path/to/mods/ModB/mod-manifest.json')
activate Fetcher
Fetcher-->>Loader: Raw JSON Content (ModB)
deactivate Fetcher
end

%% Sequential Validation & Storage
Loader->>Validator: getValidator('mod-manifest schema ID')
activate Validator
Validator-->>Loader: validationFunction
deactivate Validator

opt Validate ModA Manifest
Loader->>Validator: validationFunction(Raw JSON Content ModA)
activate Validator
Validator-->>Loader: {isValid: true}
deactivate Validator
alt Manifest ID matches Requested ID 'ModA'
Loader->>Registry: store('mod_manifests', 'ModA', ValidatedDataModA)
activate Registry
Registry-->>Loader: void
deactivate Registry
else ID Mismatch Error
Loader-->>Caller: throw Error(ID_MISMATCH)
end
else Validation Error
Loader-->>Caller: throw Error(VALIDATION_FAIL)
end

opt Validate ModB Manifest
Loader->>Validator: validationFunction(Raw JSON Content ModB)
activate Validator
Validator-->>Loader: {isValid: true}
deactivate Validator
alt Manifest ID matches Requested ID 'ModB'
Loader->>Registry: store('mod_manifests', 'ModB', ValidatedDataModB)
activate Registry
Registry-->>Loader: void
deactivate Registry
else ID Mismatch Error
Loader-->>Caller: throw Error(ID_MISMATCH)
end
else Validation Error
Loader-->>Caller: throw Error(VALIDATION_FAIL)
end

Loader-->>Caller: Map<string, object> { 'ModA': ManifestA, 'ModB': ManifestB }
deactivate Loader
_Diagram Notes:_

- Fetching (fetch) happens in parallel for efficiency.
- Validation and registry storage occur sequentially based on the requested order.
- The diagram shows the happy path; errors during fetch, validation, or ID checks will halt the process and throw an error.

## Usage

Inject ModManifestLoader using your dependency injection container and call loadRequestedManifests with an array of mod IDs you want to load (typically obtained from game.json).

```javascript
// Example within an async function (e.g., inside ModsLoader)
async function loadMods(container, requestedModIds) {
  try {
    const modManifestLoader = container.resolve(tokens.ModManifestLoader); // Assuming DI tokens
    const loadedManifests =
      await modManifestLoader.loadRequestedManifests(requestedModIds);

    console.log(`Successfully loaded ${loadedManifests.size} mod manifests:`, [
      ...loadedManifests.keys(),
    ]);
    // Proceed with dependency resolution and content loading using loadedManifests...
  } catch (error) {
    console.error('Failed to load mod manifests:', error);
    // Halt game loading or provide feedback to the user
  }
}

// Example call:
// await loadMods(myContainer, ['BaseGame', 'CoolWeapons', 'CoreComponents']);
```

## Possible Errors

The loadRequestedManifests method can throw errors under various conditions. It's crucial to wrap the call in a try...catch block.

| Error Code (Constant)         | Error Type       | Cause                                                                                          | How to Handle / Prevent                                                                                                                                   |
| :---------------------------- | :--------------- | :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INVALID_REQUEST_ARRAY         | TypeError        | The requestedModIds parameter passed was not an array.                                         | Ensure the input is always an array (e.g., derived correctly from game.json).                                                                             |
| INVALID_REQUEST_ID            | TypeError        | An element within the requestedModIds array was not a non-empty string.                        | Validate the mod IDs in game.json before passing them. Ensure they are strings.                                                                           |
| DUPLICATE_REQUEST_ID          | Error            | The same mod ID appears multiple times in the requestedModIds array.                           | Ensure the mod list in game.json contains unique IDs. Validate the list after loading it.                                                                 |
| NO_VALIDATOR                  | Error            | The schema validator function for mod manifests could not be retrieved.                        | Ensure the mod-manifest.schema.json is correctly configured in StaticConfiguration and that SchemaLoader ran successfully beforehand.                     |
| FETCH_FAIL                    | (Logged Warning) | Failed to fetch a specific manifest file (network error, file not found).                      | Check file paths, network connectivity, and web server configuration. The loader logs a warning and skips the mod, but won't throw _unless_ no mods load. |
| VALIDATION_FAIL               | Error            | A fetched manifest file failed validation against mod-manifest.schema.json.                    | Correct the invalid mod-manifest.json file according to the schema requirements and logged error details.                                                 |
| MISSING_MANIFEST_ID           | Error            | A validated manifest file is missing the required top-level "id" property or it's empty.       | Ensure the mod-manifest.json file includes a valid, non-empty "id" string property.                                                                       |
| ID_MISMATCH                   | Error            | The "id" property inside a manifest file does not match the requested mod ID (directory name). | Ensure the "id" field within mod-manifest.json exactly matches the mod's directory name used in game.json.                                                |
| REGISTRY_STORE_FAIL           | Error            | An error occurred while trying to store a validated manifest in the data registry.             | Check the IDataRegistry implementation for issues (e.g., memory limits, incorrect method implementation).                                                 |
| _(Generic Fetch/Parse Error)_ | Error            | Low-level error during fetch (e.g., malformed JSON in the manifest file).                      | Check the manifest file for valid JSON syntax. Check network logs for fetch issues.                                                                       |

**General Handling:**

- Always use try...catch around loadRequestedManifests.
- Log the caught error for debugging.
- In case of an error, halt the game loading process and inform the user that loading failed due to mod configuration or file issues. Provide details from the error message if possible.
