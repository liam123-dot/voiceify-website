// lib/ragie/client.ts
import { Ragie } from 'ragie';

// Initialize Ragie client with API key from environment
const apiKey = process.env.RAGIE_API_KEY;

if (!apiKey) {
  throw new Error('RAGIE_API_KEY environment variable is not set');
}

const ragie = new Ragie({
  auth: apiKey,
});

export default ragie;

