// public/stockfish-worker.js
// This script acts as the intermediary between the main thread and the Stockfish engine.

// Attempt to import the actual Stockfish engine script.
// Assumes the engine script is located at /stockfish.js/stockfish.js
// This engine script should define the global STOCKFISH function.
try {
    importScripts('/stockfish.js/stockfish.js'); // Adjust path if the engine file is named differently or located elsewhere
} catch (e) {
    console.error("[Worker] Failed to import stockfish.js engine script:", e);
    // Send an error message back to the main thread immediately
    self.postMessage("error: Failed to load stockfish engine script. Ensure stockfish.js is in the public/stockfish.js/ directory.");
    // Prevent further execution if the engine script failed to load
    throw new Error("Stockfish engine script import failed.");
}


var stockfish = null; // Holds the WASM engine instance

console.log("[Worker] Stockfish worker script started.");

// Now, check if the STOCKFISH function exists after importScripts
if (typeof STOCKFISH === 'function') {
    STOCKFISH().then(sf => {
        console.log("[Worker] Stockfish WASM engine initialized via STOCKFISH().");
        stockfish = sf;
        // Add the message listener *to the engine instance*
        stockfish.addMessageListener(handleEngineMessage);
        console.log("[Worker] Engine message listener added.");
        // Signal that the worker script itself is ready and supports UCI basics
        // The main thread will send 'isready' to confirm the engine is ready.
        self.postMessage("uciok");
    }).catch(error => {
        console.error("[Worker] Error initializing Stockfish WASM:", error);
        self.postMessage(`error: Stockfish engine initialization failed: ${error}`); // Inform main thread
    });
} else {
    // This block should ideally not be reached if importScripts worked and the engine script is correct.
    console.error("[Worker] STOCKFISH function not found even after importScripts. Check the engine script file.");
    self.postMessage("error: STOCKFISH function not found in engine script.");
}


// Listener for messages from the main thread (React component)
self.onmessage = function(event) {
    const command = event.data;
    console.log(`[Worker] Received command from main thread: ${command}`);

    if (!stockfish && command !== 'uci') {
        // Engine might still be initializing, especially on first load.
        // UCI command is handled implicitly by the existence of the worker and the initial 'uciok' message.
        console.warn("[Worker] Received command before Stockfish engine instance was ready:", command);
        // Don't send error immediately, initialization might still succeed.
        // Queueing could be implemented here if needed.
        if (command === 'isready') {
             console.log("[Worker] Received 'isready' while engine instance not yet assigned. Engine might still be initializing.");
             // Let initialization complete. 'readyok' will be sent by the engine itself later.
        } else {
            // For other commands, maybe send a temporary error or wait?
             self.postMessage(`error: Engine not ready yet for command: ${command}`);
        }
        return;
    }

    // Forward commands to the Stockfish engine instance via postMessage
    try {
        if (command === 'uci') {
            // The 'uciok' response comes from the worker script itself upon loading.
            // Sending 'uci' to the engine is standard practice to get engine identification.
            console.log("[Worker] Forwarding 'uci' command to engine.");
            stockfish?.postMessage(command);
            // We already sent 'uciok' when the worker loaded. The engine will respond with id/options.
        } else if (command === 'isready') {
            console.log("[Worker] Forwarding 'isready' command to engine.");
            stockfish?.postMessage(command);
            // Engine will respond with 'readyok' via handleEngineMessage
        } else if (command.startsWith('position')) {
            console.log("[Worker] Forwarding 'position' command to engine:", command);
            stockfish?.postMessage(command);
        } else if (command.startsWith('go')) {
            console.log("[Worker] Forwarding 'go' command to engine:", command);
            stockfish?.postMessage(command);
        } else if (command.startsWith('setoption')) {
            console.log("[Worker] Forwarding 'setoption' command to engine:", command);
            stockfish?.postMessage(command);
        } else if (command === 'stop') {
            console.log("[Worker] Forwarding 'stop' command to engine.");
            stockfish?.postMessage('stop');
        } else if (command === 'quit') {
            console.log("[Worker] Forwarding 'quit' command to engine.");
            stockfish?.postMessage('quit');
            // Maybe close the worker? self.close();
        } else if (command === 'ucinewgame') {
            console.log("[Worker] Forwarding 'ucinewgame' command to engine.");
            stockfish?.postMessage('ucinewgame');
        }
        else {
            console.warn("[Worker] Received unknown command from main thread:", command);
        }
    } catch (e) {
        console.error(`[Worker] Error posting command '${command}' to engine:`, e);
         self.postMessage(`error: Failed to send command '${command}' to engine.`);
    }
};

// Listener for messages *from* the Stockfish engine WASM instance
function handleEngineMessage(message) {
    // Check if message is an event object or a simple string
    const messageData = (typeof message === 'object' && message.data) ? message.data : message;
    console.log(`[Worker] Received message from engine: ${messageData}`);

    // Forward relevant messages back to the main thread
    // Critical messages: bestmove, readyok
    // Useful info: info (depth, score, pv etc.)
    // Engine identification: id name, id author, options
    if (typeof messageData === 'string') {
        if (messageData.startsWith('bestmove') || messageData.startsWith('info') || messageData === 'readyok' || messageData.startsWith('id') || messageData.startsWith('option')) {
            self.postMessage(messageData);
        } else {
            console.log(`[Worker] Ignored engine message: ${messageData}`);
        }
    } else {
         console.warn("[Worker] Received non-string message from engine:", messageData);
    }
}

// Error handling for the worker itself (e.g., script loading errors)
self.onerror = function(error) {
    console.error("[Worker] Worker script error:", error.message, error);
    self.postMessage(`error: worker script error: ${error.message}`);
};

console.log("[Worker] Stockfish worker script initialized and listening.");
