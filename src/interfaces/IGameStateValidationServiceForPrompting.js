// src/interfaces/IGameStateValidationServiceForPrompting.js
// --- FILE START ---
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */

/**
 * @interface IGameStateValidationServiceForPrompting
 * @description Defines the contract for a service that validates AIGameStateDTO
 * for the purpose of prompt generation.
 */
export class IGameStateValidationServiceForPrompting {
    /**
     * Validates if the provided AIGameStateDTO contains the critical information
     * necessary for generating prompt data.
     * @param {AIGameStateDTO | null | undefined} gameStateDto - The game state DTO to validate.
     * @returns {{isValid: boolean, errorContent: string | null}} An object indicating if the state is valid
     * and an error message if not.
     * @throws {Error} If the method is not implemented.
     */
    validate(gameStateDto) { // eslint-disable-line no-unused-vars
        throw new Error("Method 'validate()' must be implemented.");
    }
}

// --- FILE END ---