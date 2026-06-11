import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'local-sprite-498213-u2';
const LOCATION = 'us-central1'; // Test with explicit us-central1

const ai = new GoogleGenAI({
  project: PROJECT_ID,
  location: LOCATION,
  vertexai: true
});

async function testModel(modelName: string) {
  try {
    console.log(`Testing ${modelName}...`);
    const chat = ai.chats.create({ model: modelName });
    await chat.sendMessage({ message: 'Hello' });
    console.log(`✅ ${modelName} SUCCESS`);
  } catch (e: any) {
    console.error(`❌ ${modelName} FAILED: ${e.message}`);
  }
}

async function run() {
  await testModel('gemini-1.5-flash');
  await testModel('gemini-1.5-flash-001');
  await testModel('gemini-1.5-flash-002');
  await testModel('gemini-1.5-pro');
  await testModel('gemini-1.5-pro-001');
  await testModel('gemini-1.5-pro-002');
  await testModel('gemini-1.0-pro');
}

run();
