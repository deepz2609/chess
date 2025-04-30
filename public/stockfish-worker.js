// public/stockfish-worker.js
// This script acts as the intermediary between the main thread and the Stockfish engine.

// IMPORTANT: Ensure the main Stockfish engine file (e.g., stockfish.js or stockfish-nnue-16.js)
// is placed inside the /public/stockfish.js/ directory of your project.
const enginePath = '/stockfish.js/stockfish.js'; // Adjust this path if your engine file is named differently.

var stockfish = null; // Holds the WASM engine instance
var engineInitializationPromise = null; // To track initialization status

console.log("[Worker] Stockfish worker script started.");

// Attempt to import the actual Stockfish engine script.
try {
    console.log(`[Worker] Attempting to import engine script from: ${enginePath}`);
    // The STOCKFISH function is expected to be defined globally by the imported script.
    importScripts(enginePath);
    console.log("[Worker] Engine script potentially imported.");

    // Now, check if the STOCKFISH function exists after importScripts
    if (typeof STOCKFISH === 'function') {
        console.log("[Worker] STOCKFISH function found. Initializing engine...");
        // Store the promise to handle commands received before initialization completes.
        engineInitializationPromise = STOCKFISH().then(sf => {
            console.log("[Worker] Stockfish WASM engine initialized via STOCKFISH().");
            stockfish = sf;
            // Add the message listener *to the engine instance*
            stockfish.addMessageListener(handleEngineMessage);
            console.log("[Worker] Engine message listener added.");
            // Signal that the worker script itself is ready and supports UCI basics
            // The main thread will send 'isready' to confirm the engine is ready.
            self.postMessage("uciok"); // Let main thread know worker script is loaded
            console.log("[Worker] Sent 'uciok' to main thread.");
            return sf; // Resolve the promise with the engine instance
        }).catch(error => {
            console.error("[Worker] Error initializing Stockfish WASM:", error);
            self.postMessage(`error: Stockfish engine initialization failed: ${error}. Check browser console for details.`); // Inform main thread
            throw error; // Re-throw to reject the promise
        });
    } else {
        // This block is reached if importScripts succeeded but STOCKFISH was not defined.
        console.error(`[Worker] STOCKFISH function not found after importing ${enginePath}. Check the engine script file.`);
        self.postMessage(`error: STOCKFISH function not found in engine script (${enginePath}). Ensure the correct engine file is present and defines STOCKFISH.`);
        // Set promise to rejected state
        engineInitializationPromise = Promise.reject(new Error("STOCKFISH function not found."));
    }

} catch (e) {
    // This block is reached if importScripts itself fails (e.g., 404 Not Found).
    console.error(`[Worker] Failed to import engine script from ${enginePath}:`, e);
    self.postMessage(`error: Failed to load stockfish engine script from ${enginePath}. Ensure the file exists in the /public/stockfish.js/ directory and the path is correct.`);
    // Set promise to rejected state
    engineInitializationPromise = Promise.reject(e);
}


// Listener for messages from the main thread (React component)
self.onmessage = async function(event) {
    const command = event.data;
    console.log(`[Worker] Received command from main thread: ${command}`);

    // Wait for engine initialization if it's not complete yet.
    if (!stockfish && engineInitializationPromise) {
        try {
            console.log("[Worker] Engine not ready, waiting for initialization promise...");
            await engineInitializationPromise;
            console.log("[Worker] Engine initialization promise resolved. Proceeding with command.");
            // If initialization succeeded, stockfish should now be set.
             if (!stockfish) {
                console.error("[Worker] Engine promise resolved, but stockfish instance is still null. This shouldn't happen.");
                 self.postMessage(`error: Engine initialization inconsistent state after command: ${command}`);
                return;
            }
        } catch (initError) {
            console.error("[Worker] Engine initialization failed, cannot process command:", command, initError);
            // The error message should have already been sent during initialization failure.
            // self.postMessage(`error: Engine failed to initialize, cannot process command: ${command}`);
            return; // Stop processing if engine failed to initialize
        }
    } else if (!stockfish && !engineInitializationPromise) {
        // This case might occur if initialization failed very early or wasn't triggered.
        console.error("[Worker] Engine instance not available and initialization promise doesn't exist. Cannot process command:", command);
         self.postMessage(`error: Engine not available or initialization failed for command: ${command}`);
        return;
    }

    // Forward commands to the Stockfish engine instance via postMessage
    try {
        if (command === 'uci') {
            // The 'uciok' response comes from the worker script itself upon loading.
            // Sending 'uci' to the engine is standard practice to get engine identification.
            console.log("[Worker] Forwarding 'uci' command to engine.");
            stockfish.postMessage(command);
            // We already sent 'uciok' when the worker loaded. The engine will respond with id/options via handleEngineMessage.
        } else if (command === 'isready') {
            console.log("[Worker] Forwarding 'isready' command to engine.");
            stockfish.postMessage(command);
            // Engine will respond with 'readyok' via handleEngineMessage
        } else if (command.startsWith('position')) {
            console.log("[Worker] Forwarding 'position' command to engine:", command);
            stockfish.postMessage(command);
        } else if (command.startsWith('go')) {
            console.log("[Worker] Forwarding 'go' command to engine:", command);
            stockfish.postMessage(command);
        } else if (command.startsWith('setoption')) {
            console.log("[Worker] Forwarding 'setoption' command to engine:", command);
            stockfish.postMessage(command);
        } else if (command === 'stop') {
            console.log("[Worker] Forwarding 'stop' command to engine.");
            stockfish.postMessage('stop');
        } else if (command === 'quit') {
            console.log("[Worker] Forwarding 'quit' command to engine.");
            stockfish.postMessage('quit');
            // Maybe close the worker? self.close();
        } else if (command === 'ucinewgame') {
            console.log("[Worker] Forwarding 'ucinewgame' command to engine.");
            stockfish.postMessage('ucinewgame');
        }
        else {
            console.warn("[Worker] Received unknown command from main thread:", command);
             self.postMessage(`info: Unknown command received by worker: ${command}`); // Send info back
        }
    } catch (e) {
        console.error(`[Worker] Error posting command '${command}' to engine:`, e);
         self.postMessage(`error: Failed to send command '${command}' to engine. Check engine state.`);
    }
};

// Listener for messages *from* the Stockfish engine WASM instance
function handleEngineMessage(message) {
    // Check if message is an event object or a simple string
    const messageData = (typeof message === 'object' && message.data) ? message.data : message;
    // console.log(`[Worker] Raw message from engine:`, message); // Log raw message for deeper debug if needed
    // console.log(`[Worker] Received message data from engine: ${messageData}`); // Log processed message data

    // Forward relevant messages back to the main thread
    if (typeof messageData === 'string') {
        // Critical messages: bestmove, readyok
        // Useful info: info (depth, score, pv etc.), id name, id author, option
        if (messageData.startsWith('bestmove') ||
            messageData.startsWith('info') ||
            messageData === 'readyok' ||
            messageData.startsWith('id name') || // Engine name
            messageData.startsWith('id author') || // Engine author
            messageData.startsWith('option name') // Engine options
            // Add other specific 'id' or 'option' types if needed
            ) {
             // console.log(`[Worker] Forwarding relevant message to main thread: ${messageData}`); // Less noisy log
             self.postMessage(messageData);
        } else if (messageData === 'uciok') {
             // Engine sends its own 'uciok' after 'uci' command. Worker already sent one on load.
             console.log(`[Worker] Received 'uciok' from engine (expected after 'uci' command).`);
             // We don't need to forward this specific one usually.
        }
        else {
            // Log other messages for debugging but don't necessarily forward them
             console.log(`[Worker] Ignored engine message: ${messageData}`);
        }
    } else {
         console.warn("[Worker] Received non-string message from engine:", messageData);
    }
}

// Error handling for the worker itself (e.g., script loading errors outside the initial try/catch)
self.onerror = function(error) {
    console.error("[Worker] Uncaught Worker script error:", error.message, error);
    // Avoid sending redundant messages if initialization already failed.
    if (engineInitializationPromise && !stockfish) {
         // Initialization likely failed, message already sent.
         console.log("[Worker] Uncaught error occurred after initialization failure.");
    } else {
         self.postMessage(`error: Uncaught worker script error: ${error.message}`);
    }
};

console.log("[Worker] Stockfish worker script initialized and listening for messages.");
