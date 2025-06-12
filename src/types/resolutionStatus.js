// src/types/resolutionStatus.js

import { freeze } from '../../tests/utils/objectUtils';

export const ResolutionStatus = freeze({
  FOUND_UNIQUE: 'FOUND_UNIQUE',
  SELF: 'SELF',
  NONE: 'NONE',
  AMBIGUOUS: 'AMBIGUOUS',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_TARGET_TYPE: 'INVALID_TARGET_TYPE',
  ERROR: 'ERROR',
});

export default ResolutionStatus;
