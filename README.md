# Daisyflowers

A chatbot application that helps users find cannabis products using AI-powered recommendations.

## Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Environment Variables

1. Copy the `.env` file and add your API keys:
   ```bash
   cp .env .env.local
   ```

2. Edit `.env.local` and add your actual API keys:
   ```
   ANTHROPIC_API_KEY=your_actual_anthropic_api_key_here
   JANE_TOKEN=your_jane_api_token_if_different
   ```

### Installation

1. Install server dependencies:
   ```bash
   npm install
   ```

2. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

### Running the Application

1. Start the server:
   ```bash
   npm start
   ```

2. In a new terminal, start the client:
   ```bash
   cd client
   npm run dev
   ```

The server will run on `http://localhost:3001` and the client on `http://localhost:5173`.

## API Keys

This application requires:
- **Anthropic API Key**: For AI-powered product recommendations using Claude
- **Jane API Token**: For accessing cannabis product data (default provided)

Never commit API keys to version control. Always use environment variables.