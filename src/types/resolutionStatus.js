// src/types/resolutionStatus.js

export const ResolutionStatus = Object.freeze({
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    SELF: 'SELF',
    NONE: 'NONE',
    AMBIGUOUS: 'AMBIGUOUS',
    NOT_FOUND: 'NOT_FOUND',
    INVALID_TARGET_TYPE: 'INVALID_TARGET_TYPE',
    ERROR: 'ERROR'
});

export default ResolutionStatus;