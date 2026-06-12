import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: API_KEY,
  vertexai: false,
} as any);

async function run() {
  const tools = [
    {
      functionDeclarations: [
        {
          name: 'get_current_weather',
          description: 'Get the current weather for a city',
          parameters: {
            type: 'OBJECT',
            properties: {
              city: {
                type: 'STRING',
                description: 'The city to get weather for'
              }
            },
            required: ['city']
          }
        }
      ]
    }
  ];

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: 'You are a weather assistant. Use tools if needed.',
      tools: tools as any
    }
  });

  console.log('--- Step 1: Send user message ---');
  let result = await chat.sendMessage({ message: 'What is the weather in Boston?' });
  console.log('Result 1 functionCalls:', JSON.stringify(result.functionCalls, null, 2));
  console.log('Result 1 text:', result.text);

  let functionCalls = result.functionCalls;
  if (functionCalls && functionCalls.length > 0) {
    const responseParts: any[] = [];
    for (const functionCall of functionCalls) {
      console.log(`Executing function: ${functionCall.name}`);
      const fResponse: any = {
        name: functionCall.name,
        response: { output: { weather: 'Sunny, 72 degrees' } }
      };
      if (functionCall.id) {
        fResponse.id = functionCall.id;
      }
      responseParts.push({
        functionResponse: fResponse
      });
    }

    console.log('--- Step 2: Send function responses ---');
    console.log('Sending parts:', JSON.stringify(responseParts, null, 2));
    result = await chat.sendMessage({
      message: responseParts
    } as any);

    console.log('Result 2 functionCalls:', JSON.stringify(result.functionCalls, null, 2));
    console.log('Result 2 text:', result.text);
  }
}

run().catch(console.error);
