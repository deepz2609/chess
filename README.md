# ChessMate - AI Chess Game

This is a Next.js web application built with Firebase Studio that allows users to play chess against an AI opponent powered by Google's Gemini model.

## Features

*   User authentication (Email/Password & Google Sign-In) via Firebase Auth.
*   Chessboard interface using `react-chessboard`.
*   Game logic managed by `chess.js`.
*   AI opponent using Google Gemini via Genkit.
    *   The AI analyzes the board state (FEN) and selects the best move from the list of valid moves.
    *   Move validation ensures the AI selects a legal move.
*   Basic dashboard, profile, and settings pages.
*   Styling with Tailwind CSS and ShadCN UI components.
*   Protected routes for authenticated users.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Set up Environment Variables:**
    Create a `.env.local` file in the root directory and add your Firebase project configuration and Google Generative AI API key:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_FIREBASE_MEASUREMENT_ID

    # Get your Gemini API key from Google AI Studio
    GOOGLE_GENAI_API_KEY=YOUR_GEMINI_API_KEY
    ```
3.  **Run Genkit Dev Server (for AI flow development/testing):**
    ```bash
    npm run genkit:dev
    ```
    Or for watching changes:
    ```bash
    npm run genkit:watch
    ```
4.  **Run Next.js Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

## Core Components

*   **`src/app/(app)/play/page.tsx`**: Contains the main game logic and chessboard UI.
*   **`src/ai/flows/find-best-chess-move.ts`**: The Genkit flow that interacts with the Gemini model to determine the AI's move.
*   **`src/lib/firebase.ts`**: Firebase initialization.
*   **`src/context/auth-context.tsx`**: Handles user authentication state.
*   **`src/components/ui/`**: Reusable UI components based on ShadCN.
*   **`src/components/layout/`**: Application layout components (Header, Sidebar).

This project provides the complete codebase for the ChessMate web application as described.
