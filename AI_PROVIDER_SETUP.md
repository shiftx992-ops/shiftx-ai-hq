# ShiftX Agent — AI Provider Setup

ShiftX Agent is designed as a multi-provider AI command center. The public GitHub Pages site contains the UI. The live AI calls use the included server endpoint at `/api/chat` when the site is deployed on a host that supports Pages Functions (such as Cloudflare Pages).

## Supported providers

- OpenRouter — unified gateway to a large model catalog
- OpenAI
- Anthropic Claude
- Google Gemini
- xAI Grok
- Mistral
- Groq
- Local Ollama

OpenRouter can access hundreds of models through one API endpoint, and the code keeps provider credentials on the server rather than in the public browser code.

## Server secrets

Set these as server-side environment variables:

OPENROUTER_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
XAI_API_KEY
MISTRAL_API_KEY
GROQ_API_KEY
OLLAMA_BASE_URL

Do not paste API keys into `index.html`, commit them to GitHub, or put them in client-side JavaScript.

## Default model IDs

The ShiftX UI lets the CEO override the model ID. The server supplies a default when the field is empty. Model catalogs change over time, so the provider's current model list should be used when a default is not appropriate.

## Free-first strategy

Use Local Ollama for models running on your own computer, and consider OpenRouter's free-model route for testing where available. Provider usage limits and pricing vary; no provider is guaranteed to remain free.

## Deployment

The included `functions/api/chat.js` is intended for a serverless Pages Functions host. GitHub Pages serves the UI, but it does not execute that server function. To make live AI responses work on the public site, deploy the same repository to a Pages Functions-compatible host and configure the server secrets there.
