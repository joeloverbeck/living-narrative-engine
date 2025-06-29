/**
 * @file Helper for wrapping file processing steps used by BaseManifestItemLoader.
 */

/**
 * Executes the common steps of resolving, fetching and validating a content file
 * before delegating to the loader's custom processing method.
 *
 * @param {import('../baseManifestItemLoader.js').BaseManifestItemLoader} loader - Loader instance.
 * @param {string} modId - Owning mod ID.
 * @param {string} filename - Filename to process.
 * @param {string} diskFolder - Folder on disk for this content type.
 * @param {string} registryKey - Registry category key.
 * @returns {Promise<{qualifiedId:string,didOverride:boolean}>} Result info from the loader.
 */
export async function processFileWrapper(
  loader,
  modId,
  filename,
  diskFolder,
  registryKey
) {
  let resolvedPath = null;
  try {
    resolvedPath = loader._pathResolver.resolveModContentPath(
      modId,
      diskFolder,
      filename
    );
    loader._logger.debug(
      `[${modId}] Resolved path for ${filename}: ${resolvedPath}`
    );

    const data = await loader._dataFetcher.fetch(resolvedPath);
    loader._logger.debug(`[${modId}] Fetched data from ${resolvedPath}`);

    loader._validatePrimarySchema(data, filename, modId, resolvedPath);

    const result = await loader._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      data,
      registryKey
    );
    loader._logger.debug(
      `[${modId}] Successfully processed ${filename}. Result: ID=${result.qualifiedId}, Overwrite=${result.didOverride}`
    );
    return result;
  } catch (error) {
    loader._logger.error(
      `Error processing file:`,
      {
        modId,
        filename,
        path: resolvedPath ?? 'Path not resolved',
        registryKey,
        error: error?.message || String(error),
      },
      error
    );
    throw error;
  }
}

export default { processFileWrapper };
