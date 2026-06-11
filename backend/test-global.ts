import { GoogleGenAI } from '@google/genai';

const PROJECT_ID = 'local-sprite-498213-u2';
const LOCATION = 'global';

const ai = new GoogleGenAI({
  project: PROJECT_ID,
  location: LOCATION,
  vertexai: true
});

const MODELS = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.0-pro',
  'gemini-1.5-pro-001',
  'gemini-1.5-flash-001'
];

async function run() {
  for (const model of MODELS) {
    console.log(`Testing model: ${model} in location: ${LOCATION}`);
    try {
      const chat = ai.chats.create({ model: model });
      await chat.sendMessage({ message: 'Hello' });
      console.log(`✅ SUCCESS: ${model}`);
    } catch (e: any) {
      console.error(`❌ FAILED: ${model} - ${e.message}`);
    }
  }
}

run();
