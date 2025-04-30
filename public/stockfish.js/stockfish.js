// stockfish.js - Web Worker Script
// This script needs to be in the public folder accessible by the browser.
// It assumes stockfish.wasm and potentially stockfish.worker.js (if needed by your Stockfish build)
// are in the same directory or a known relative path.

var stockfish = null; // Holds the WASM engine instance

console.log("[Worker] Stockfish worker script started.");

// Initialize the Stockfish engine (adjust path as needed)
// Assuming Stockfish() is provided globally by the WASM loader script if separate.
// If using a single JS file (like stockfish.js from npm), it might initialize differently.
// This example assumes a structure where STOCKFISH() initializes the engine.

// Common pattern for Stockfish.js WASM initialization
if (typeof STOCKFISH === 'function') {
    STOCKFISH().then(sf => {
        console.log("[Worker] Stockfish WASM engine initialized.");
        stockfish = sf;
        stockfish.addMessageListener(handleEngineMessage);
        // Signal readiness *after* engine initialization is complete
        self.postMessage("uciok"); // Indicate UCI protocol is supported by the worker script itself
        // Do not send readyok here, wait for 'isready' command from main thread
    }).catch(error => {
        console.error("[Worker] Error initializing Stockfish WASM:", error);
        self.postMessage("error: initialization failed"); // Inform main thread
    });
} else {
    console.error("[Worker] STOCKFISH function not found. Ensure stockfish WASM loader is included.");
    self.postMessage("error: STOCKFISH not found");
}


// Listener for messages from the main thread (React component)
self.onmessage = function(event) {
    const command = event.data;
    console.log(`[Worker] Received command from main thread: ${command}`);

    if (!stockfish && command !== 'uci') {
        console.warn("[Worker] Received command before Stockfish engine was ready:", command);
        // Maybe queue commands or send an error? For now, just log.
        // Or wait for 'isready' confirmation?
        return; // Don't process if engine isn't ready (except for 'uci')
    }

    if (command === 'uci') {
        // Engine initialization handles 'uciok', main thread handles 'isready' response
        console.log("[Worker] UCI command received (already handled by init).");
        // If engine is ready, send uciok again? Usually not needed.
        if (stockfish) {
            // stockfish.postMessage('uci'); // Send to engine just in case
            // No, main thread expects uciok from the *worker script*, not engine here.
        } else {
            // Engine not ready yet, init process will send uciok
            console.log("[Worker] Engine not ready yet, uciok will be sent upon init completion.");
        }
    } else if (command === 'isready') {
        console.log("[Worker] 'isready' command received. Sending to engine.");
        if (stockfish) {
            stockfish.postMessage('isready'); // Send 'isready' to the engine
        } else {
             console.error("[Worker] Cannot send 'isready' - Stockfish engine not initialized.");
             self.postMessage("error: engine not ready for isready command");
        }
        // The engine will respond with 'readyok', which will be caught by handleEngineMessage
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
        console.warn("[Worker] Received unknown command:", command);
    }
};

// Listener for messages *from* the Stockfish engine WASM
function handleEngineMessage(message) {
    console.log(`[Worker] Received message from engine: ${message}`);
    // Forward relevant messages back to the main thread
    if (message.startsWith('bestmove') || message.includes('info depth') || message === 'readyok') {
        self.postMessage(message);
    }
    // Forward other potentially useful info? (e.g., evaluation 'info score')
    // Be selective to avoid flooding the main thread.
    // if (message.includes('info score')) {
    //     self.postMessage(message);
    // }
}

// Error handling for the worker itself
self.onerror = function(error) {
    console.error("[Worker] Worker script error:", error.message, error);
    self.postMessage(`error: worker script error: ${error.message}`);
};

console.log("[Worker] Stockfish worker script initialized and listening.");
