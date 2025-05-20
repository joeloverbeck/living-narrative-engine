/**
 * Sub-Ticket 3.A: Prototype Serialization & Deserialization of Core Save Game Data Structures
 *
 * This script demonstrates the end-to-end process of:
 * 1. Constructing a representative in-memory game state.
 * 2. Serializing it using MessagePack and compressing with Gzip.
 * 3. Decompressing and deserializing it back.
 * 4. Verifying the integrity and content of the deserialized data.
 * 5. Serializing the state to human-readable JSON for debugging.
 */

// Import necessary libraries
import {encode, decode} from '@msgpack/msgpack'; // For MessagePack serialization/deserialization
import pako from 'pako'; // For Gzip compression/decompression
import {randomUUID} from 'crypto'; // For generating UUIDs (instanceIds)
import {createHash} from 'crypto'; // For generating checksums
import assert from 'assert'; // For verification

// --- Helper Functions ---

/**
 * Generates an SHA256 checksum for the given data.
 * For objects, it first stringifies them to JSON.
 * For this prototype, if data is already Uint8Array (like MessagePack output),
 * it will be hashed directly. Otherwise, it's stringified.
 * @param {any} data - The data to hash.
 * @returns {string} The SHA256 hash as a hex string.
 */
function generateChecksum(data) {
    if (data instanceof Uint8Array) {
        return createHash('sha256').update(data).digest('hex');
    }
    const stringToHash = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash('sha256').update(stringToHash).digest('hex');
}

/**
 * Deep clones an object using JSON stringify/parse.
 * Note: This method has limitations (e.g., loses Date objects, functions, undefined).
 * For this prototype with POJOs where dates are ISO strings, it's generally sufficient.
 * @param {object} obj - The object to clone.
 * @returns {object} The cloned object.
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}


// --- 1. Construct In-Memory Sample Game State ---
console.log('--- 1. Constructing Sample In-Memory Game State ---');

const originalGameState = {
    metadata: {
        saveFormatVersion: '1.0.0',
        engineVersion: '0.1.0-alpha',
        gameTitle: 'Chronicles of Gnarl',
        timestamp: new Date().toISOString(),
        playtimeSeconds: 3661, // 1 hour, 1 minute, 1 second
        saveName: 'My Epic Adventure - Slot 1',
    },
    modManifest: {
        activeMods: [
            {modId: 'core', version: '1.0.0'},
            {
                modId: 'world_of_magic',
                version: '1.2.1',
                checksum: generateChecksum('world_of_magic_v1.2.1_content_placeholder')
            },
            {modId: 'extended_quests', version: '0.9.0-beta'},
        ],
    },
    gameState: {
        entities: [
            // Entity 1: Player Character (demonstrates changed data)
            {
                instanceId: randomUUID(),
                definitionId: 'core:player_character',
                components: {
                    'core:name': {value: 'Astra the Valiant'},
                    'core:health': {current: 85, max: 120}, // Changed from a potential default
                    'core:position': {x: 10, y: 22, areaId: 'world:highpass_village'},
                    'core:inventory': {
                        items: [
                            {
                                instanceId: randomUUID(),
                                definitionId: 'core:sword_iron',
                                components: {'core:equipped_status': {slot: 'main_hand'}}
                            },
                            {
                                instanceId: randomUUID(),
                                definitionId: 'core:potion_health',
                                components: {'core:stackable': {quantity: 3}}
                            },
                        ],
                        capacity: 10,
                    },
                    'player:experience': {current: 1250, level: 5}, // Player-specific component
                },
            },
            // Entity 2: NPC (demonstrates dynamically added component)
            {
                instanceId: randomUUID(),
                definitionId: 'core:npc_generic',
                components: {
                    'core:name': {value: 'Old Man Hemlock'},
                    'core:health': {current: 50, max: 50},
                    'core:position': {x: 15, y: 20, areaId: 'world:highpass_village'},
                    'custom:dialogue_state': { // Dynamically added/specific to this instance
                        currentTopic: 'local_rumors',
                        hasMetPlayer: true,
                    },
                    'core:tag_isFriendly': {}, // Example of a tag component (empty object)
                },
            },
            // Entity 3: Interactive Object (demonstrates missing component from a hypothetical definition)
            {
                instanceId: randomUUID(),
                definitionId: 'world:ancient_shrine',
                components: {
                    'core:name': {value: 'Weathered Shrine'},
                    'core:description': {text: 'An old shrine, covered in moss. It feels strangely cold.'},
                    'world:shrine_power': {isActive: false, lastActivated: null},
                },
            },
            // Entity 4: Item with complex nested data
            {
                instanceId: randomUUID(),
                definitionId: 'magic:grimoire_shadows',
                components: {
                    'core:name': {value: 'Grimoire of Forbidden Shadows'},
                    'core:持ち物': {isCarryable: true, weight: 2},
                    'magic:spellbook': {
                        knownSpells: [
                            {spellId: 'shadow_bolt', level: 2, runes: ['umbra', 'nox']},
                            {spellId: 'veil_of_deceit', level: 1, runes: ['umbra', 'silentium']},
                        ],
                        maxSlots: 5,
                    },
                    'custom:cursed_item_properties': {
                        curseEffect: 'drains_1_mana_per_minute',
                        isRemovable: false,
                        loreFragment: 'Forged in the abyss, its whispers beckon the unwary...'
                    }
                }
            }
        ],
        playerState: {
            currentLocationId: 'world:highpass_village',
            globalFlags: {
                'main_quest_started': true,
                'met_king_arthur': false,
                'dragon_lair_discovered': true,
            },
            uiPreferences: {
                fontSize: 14,
                textSpeed: 'normal',
            },
        },
        worldState: {
            timeOfDay: 'afternoon',
            weather: 'clear_skies',
            modifiedLocations: {
                'world:abandoned_mine_entrance': {
                    isBarricaded: false,
                    lastExplored: new Date().toISOString(),
                }
            },
            activeGlobalEvents: ['festival_of_harvest_upcoming'],
        },
        engineInternals: {
            currentTurn: 1572,
            eventQueueSnapshot: [
                {eventType: 'NPC_MOVE_SCHEDULED', npcId: 'some_npc_instance_id', targetX: 5, targetY: 10, dueTurn: 1580}
            ]
        },
    },
    integrityChecks: {
        gameStateChecksum: 'CALCULATE_LATER_OR_DURING_SERIALIZATION',
    },
};

console.log('Original Game State (root keys):', Object.keys(originalGameState));
console.log('Sample entity count:', originalGameState.gameState.entities.length);
console.log('--- Sample Game State Constructed ---\n');


// --- 2. Serialize to MessagePack and Compress with Gzip (Release Build Simulation) ---
console.log('--- 2. Serializing to MessagePack & Compressing with Gzip ---');

/**
 * Serializes the game state to MessagePack and then compresses it with Gzip.
 * Calculates and embeds the gameStateChecksum before full serialization.
 * @param {object} gameStateObject - The full game state object to process.
 * @returns {Uint8Array} The Gzipped Uint8Array.
 */
function serializeAndCompress(gameStateObject) {
    const dataToSerialize = deepClone(gameStateObject);

    const gameStateMessagePack = encode(dataToSerialize.gameState);
    dataToSerialize.integrityChecks.gameStateChecksum = generateChecksum(gameStateMessagePack);
    console.log(`Calculated gameStateChecksum: ${dataToSerialize.integrityChecks.gameStateChecksum}`);

    console.log('Serializing full game state object to MessagePack...');
    const messagePackData = encode(dataToSerialize);
    console.log(`MessagePack Raw Size: ${messagePackData.byteLength} bytes`);

    console.log('Compressing MessagePack data with Gzip...');
    const compressedData = pako.gzip(messagePackData);
    console.log(`Gzipped Size: ${compressedData.byteLength} bytes`);
    console.log(`Compression Ratio (Gzipped/MessagePack): ${(compressedData.byteLength / messagePackData.byteLength).toFixed(2)}`);
    const originalJsonStringLength = JSON.stringify(originalGameState).length;
    console.log(`Approx. Original JSON String Size: ${originalJsonStringLength} bytes`);
    console.log(`Compression Ratio (Gzipped/Original Approx. JSON): ${(compressedData.byteLength / originalJsonStringLength).toFixed(2)}`);

    return compressedData;
}

const compressedSaveData = serializeAndCompress(originalGameState);
console.log('--- MessagePack Serialization & Gzip Compression Complete ---\n');


// --- 3. Decompress Gzipped Data and Deserialize from MessagePack ---
console.log('--- 3. Decompressing Gzipped Data & Deserializing from MessagePack ---');

/**
 * Decompresses Gzipped data and then deserializes it from MessagePack.
 * @param {Uint8Array} gzippedData - The Gzipped data.
 * @returns {object} The deserialized game state object.
 */
function decompressAndDeserialize(gzippedData) {
    console.log('Decompressing Gzip data...');
    const decompressedMessagePack = pako.ungzip(gzippedData);
    console.log(`Decompressed MessagePack Size: ${decompressedMessagePack.byteLength} bytes`);

    console.log('Deserializing MessagePack data to game state object...');
    const deserializedGameState = decode(decompressedMessagePack);
    return deserializedGameState;
}

const deserializedGameState = decompressAndDeserialize(compressedSaveData);
console.log('--- Decompression & MessagePack Deserialization Complete ---\n');


// --- 4. Verify Deserialized Data ---
console.log('--- 4. Verifying Deserialized Data ---');

let verificationPassed = true;

// 4.1. Verify gameStateChecksum
const checksumFromDeserializedFile = deserializedGameState.integrityChecks.gameStateChecksum;
const deserializedGameStateMessagePack = encode(deserializedGameState.gameState);
const recalculatedChecksumForVerification = generateChecksum(deserializedGameStateMessagePack);

if (checksumFromDeserializedFile === recalculatedChecksumForVerification) {
    console.log(`GameState Checksum VERIFIED successfully: ${recalculatedChecksumForVerification}`);
} else {
    console.error(`GameState Checksum MISMATCH!`);
    console.error(`  Expected (from save file): ${checksumFromDeserializedFile}`);
    console.error(`  Calculated (from loaded gameState): ${recalculatedChecksumForVerification}`);
    verificationPassed = false;
}

// 4.2. Verify full object content
// Create a version of the original object that has the *correctly calculated* checksum for comparison.
const originalWithCorrectChecksum = deepClone(originalGameState);
const originalGameStateMessagePackForChecksum = encode(originalWithCorrectChecksum.gameState);
originalWithCorrectChecksum.integrityChecks.gameStateChecksum = generateChecksum(originalGameStateMessagePackForChecksum);

try {
    assert.deepStrictEqual(deserializedGameState, originalWithCorrectChecksum, 'Full deserialized game state does not match the original (with correct checksum).');
    console.log('Full Game State content VERIFIED successfully using deepStrictEqual.');
} catch (error) {
    console.error('Full Game State content verification FAILED:');
    console.error(error.message);
    verificationPassed = false;
}

if (verificationPassed) {
    console.log('All verifications passed! The cycle is complete and data is consistent.');
} else {
    console.error('One or more verifications FAILED.');
}
console.log('--- Verification Complete ---\n');


// --- 5. Demonstrate Serialization to Human-Readable JSON (Debug Mode) ---
console.log('--- 5. Serializing to Human-Readable JSON (Debug Mode) ---');

/**
 * Serializes the game state object to a human-readable JSON string.
 * @param {object} gameStateObject - The game state object.
 * @returns {string} The formatted JSON string.
 */
function serializeToJsonForDebug(gameStateObject) {
    const debugData = deepClone(gameStateObject);
    // It's good practice to also include the correct checksum in the debug output
    const gameStateForDebugChecksum = encode(debugData.gameState);
    debugData.integrityChecks.gameStateChecksum = generateChecksum(gameStateForDebugChecksum);

    return JSON.stringify(debugData, null, 2); // null, 2 for pretty printing
}

const jsonDebugOutput = serializeToJsonForDebug(originalGameState);
console.log('JSON Debug Output (first 1000 chars):');
console.log(jsonDebugOutput.substring(0, 1000) + (jsonDebugOutput.length > 1000 ? '\n...' : ''));
console.log(`Total JSON Debug Output Length: ${jsonDebugOutput.length} characters`);
console.log('--- JSON Serialization for Debug Complete ---\n');

// --- Prototype Script Finished ---
console.log('--- Prototype Script Finished ---');