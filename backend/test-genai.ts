import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  project: 'your-project-id',
  location: 'us-central1',
  vertexai: true
} as any);

async function run() {
  const chat = ai.chats.create({
    model: 'gemini-1.5-pro',
    config: {
      systemInstruction: 'You are an AI planner.',
      // Let's pass empty tools to see if that causes it
      tools: [{ functionDeclarations: [] }]
    }
  });

  try {
    console.log('Sending string with tools...');
    await chat.sendMessage("where can i stay ?");
    console.log('Success string');
  } catch (e: any) {
    console.error('Error with string:', e.message);
  }

  try {
    console.log('Sending object...');
    await chat.sendMessage({ parts: [{ text: "where can i stay ?" }] } as any);
    console.log('Success object');
  } catch (e: any) {
    console.error('Error with object:', e.message);
  }
}

run();
