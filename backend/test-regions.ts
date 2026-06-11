import { GoogleGenAI } from '@google/genai';

const PROJECT_ID = 'local-sprite-498213-u2';
const REGIONS = ['us-central1', 'us-east4', 'us-west1', 'us-west4', 'europe-west1', 'europe-west4', 'asia-southeast1', 'asia-northeast1', 'global'];

async function run() {
  for (const region of REGIONS) {
    console.log(`Testing region: ${region}`);
    const ai = new GoogleGenAI({
      project: PROJECT_ID,
      location: region,
      vertexai: true
    });
    try {
      const chat = ai.chats.create({ model: 'gemini-1.5-flash' });
      await chat.sendMessage({ message: 'Hello' });
      console.log(`✅ SUCCESS in ${region}`);
      break;
    } catch (e: any) {
      console.error(`❌ FAILED in ${region}: ${e.message}`);
    }
  }
}

run();
