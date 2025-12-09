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

## Deployment on Render.com

### Option 1: Using render.yaml (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repository to Render
3. Render will automatically detect the `render.yaml` file and configure the deployment
4. Set the following environment variables in Render dashboard:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `JANE_TOKEN`: Your Jane API token (if different from default)

### Option 2: Manual Setup

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: 18 or higher
4. Set environment variables:
   - `NODE_ENV`: `production`
   - `ANTHROPIC_API_KEY`: Your actual API key
   - `JANE_TOKEN`: Your Jane API token

### Environment Variables for Production

The application automatically detects production environment and serves the React client as static files. Make sure to set these environment variables in your Render dashboard:

- `ANTHROPIC_API_KEY`: Required for AI functionality
- `JANE_TOKEN`: Optional, defaults to provided token
- `NODE_ENV`: Set to `production` (usually automatic)

## API Keys

This application requires:
- **Anthropic API Key**: For AI-powered product recommendations using Claude
- **Jane API Token**: For accessing cannabis product data (default provided)

Never commit API keys to version control. Always use environment variables.