import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a new UUID v4 string.
 *
 * @returns {string} The generated identifier.
 */
export default function UuidGenerator() {
  return uuidv4();
}
