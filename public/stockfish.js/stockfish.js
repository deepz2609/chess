// Placeholder for Stockfish WASM engine script.
//
// IMPORTANT: Download the appropriate Stockfish JavaScript engine file
// (e.g., stockfish.js or stockfish-nnue-16.js from the official Stockfish JS distribution)
// and replace the content of this file with the actual engine code.
//
// The engine script is expected to define a global function named `STOCKFISH`
// which returns a promise resolving to the engine instance.
//
// Example (conceptual, the actual code is much larger):
/*
var STOCKFISH = function(options) {
    // ... WASM initialization and engine logic ...
    return new Promise((resolve, reject) => {
        // ... on initialization complete ...
        const engineInstance = {
            postMessage: function(command) { /* send command to engine */ },
            addMessageListener: function(listener) { /* listen for engine output */ },
            // ... other methods ...
        };
        resolve(engineInstance);

        // ... or on error ...
        // reject(new Error("Initialization failed"));
    });
};
*/

console.warn(
  'This is a placeholder file for the Stockfish engine. ' +
  'Please replace it with the actual stockfish.js engine file for the AI to work.'
);

// Define a dummy STOCKFISH function to prevent immediate errors in the worker
// if this placeholder is loaded, although the engine won't function.
var STOCKFISH = STOCKFISH || function() {
    console.error("Actual Stockfish engine not loaded. Using placeholder.");
    const errorMsg = "error: Actual Stockfish engine not loaded. Replace public/stockfish.js/stockfish.js with the real engine file.";
    // Simulate the worker receiving an error message
    // This relies on the worker already being set up to listen.
    // A more robust approach might be needed depending on worker timing.
    setTimeout(() => {
         // Attempt to post error back if self is available (likely in worker context)
         if (typeof self !== 'undefined' && self.postMessage) {
            self.postMessage(errorMsg);
         }
    }, 100);

    return Promise.reject(new Error(errorMsg.replace("error: ", ""))); // Reject promise
};
