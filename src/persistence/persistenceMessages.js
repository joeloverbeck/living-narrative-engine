// src/persistence/persistenceMessages.js

/**
 * @file User-facing messages used by persistence services.
 */

export const MSG_FILE_READ_ERROR =
  'Could not access or read the selected save file. Please check file permissions or try another save.';
export const MSG_EMPTY_FILE =
  'The selected save file is empty or cannot be read. It might be corrupted or inaccessible.';
export const MSG_DECOMPRESSION_FAILED =
  'The save file appears to be corrupted (could not decompress). Please try another save.';
export const MSG_DESERIALIZATION_FAILED =
  'The save file appears to be corrupted (could not understand file content). Please try another save.';
export const MSG_INTEGRITY_CALCULATION_ERROR =
  'Could not verify the integrity of the save file due to an internal error. The file might be corrupted.';
export const MSG_CHECKSUM_MISMATCH =
  'The save file appears to be corrupted (integrity check failed). Please try another save or a backup.';
