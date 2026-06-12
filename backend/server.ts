import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client as EsClient } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY;
// Initialize the new unified Gen AI SDK with standard Gemini API Key in Developer API mode
const ai = new GoogleGenAI({
  apiKey: API_KEY,
  vertexai: false,
} as any);

const esClient = new EsClient({
  node: process.env.ELASTICSEARCH_URL || '',
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY || ''
  }
});

const STADIUM_COORDINATES: Record<string, { lat: number, lon: number }> = {
  "S_1": { lat: 33.7554, lon: -84.4008 },
  "S_2": { lat: 42.0909, lon: -71.2643 },
  "S_3": { lat: 32.7473, lon: -97.0945 },
  "S_4": { lat: 29.6847, lon: -95.4107 },
  "S_5": { lat: 39.0489, lon: -94.4839 },
  "S_6": { lat: 33.9534, lon: -118.3387 },
  "S_7": { lat: 25.9580, lon: -80.2389 },
  "S_8": { lat: 40.8128, lon: -74.0742 },
  "S_9": { lat: 39.9012, lon: -75.1675 },
  "S_10": { lat: 37.4032, lon: -121.9698 },
  "S_11": { lat: 47.5952, lon: -122.3316 },
  "S_12": { lat: 43.6332, lon: -79.4186 },
  "S_13": { lat: 49.2768, lon: -123.1120 },
};

async function handleLocalElasticSearch(name: string, args: any) {
  let lat = args?.latitude as number;
  let lon = args?.longitude as number;
  const stadiumId = args?.stadium_id as string;
  const maxDistance = (args?.max_distance_km as number) || 15;

  if (!lat || !lon) {
    if (stadiumId && STADIUM_COORDINATES[stadiumId]) {
      lat = STADIUM_COORDINATES[stadiumId].lat;
      lon = STADIUM_COORDINATES[stadiumId].lon;
    } else {
      throw new Error('Must provide latitude/longitude or a valid stadium_id.');
    }
  }

  const indexName = name === 'find_nearby_accommodations' ? 'fifa_accommodations' : 'fifa_hospitals';

  const response = await esClient.search({
    index: indexName,
    body: {
      query: {
        bool: {
          must: { match_all: {} },
          filter: {
            geo_distance: {
              distance: `${maxDistance}km`,
              location: { lat, lon }
            }
          }
        }
      },
      sort: [
        {
          _geo_distance: {
            location: { lat, lon },
            order: 'asc',
            unit: 'km',
            distance_type: 'plane'
          }
        }
      ]
    }
  });

  const hits = (response.hits.hits as any[]).map((hit: any) => ({
    ...hit._source,
    distance_km: parseFloat(hit.sort[0].toFixed(2))
  }));

  const key = name === 'find_nearby_accommodations' ? 'accommodations' : 'hospitals';
  return [{ type: 'text', text: JSON.stringify({ [key]: hits }, null, 2) }];
}

let mcpClient: Client | null = null;
let vertexTools: any[] = [];

async function initializeMcpClient() {
  console.log('🔄 Initializing MCP Client to connect to remote Elastic Agent Builder...');
  
  const esUrl = process.env.ELASTICSEARCH_URL || '';
  const esApiKey = process.env.ELASTICSEARCH_API_KEY || '';
  
  // Convert Elasticsearch URL (e.g. .es.us-central1.gcp.elastic.cloud:443) to Kibana URL (.kb.us-central1.gcp.elastic.cloud)
  const kbUrl = esUrl.replace('.es.', '.kb.').replace(':443', '');
  const kbMcpUrl = `${kbUrl}/api/agent_builder/mcp`;
  
  console.log(`📡 Connecting to Kibana MCP Endpoint: ${kbMcpUrl}`);

  const transport = new StdioClientTransport({
    command: 'npx',
    args: [
      '--no-install',
      'mcp-remote',
      kbMcpUrl,
      '--header',
      `Authorization:ApiKey ${esApiKey}`
    ],
    env: {
      PATH: process.env.PATH || ''
    },
    stderr: 'pipe'
  } as any);

  mcpClient = new Client(
    { name: 'fifa-backend-client', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  await mcpClient.connect(transport);

  // Redact custom header authorization API keys from mcp-remote output logs
  const childProcess = (transport as any)._process;
  if (childProcess && childProcess.stderr) {
    childProcess.stderr.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      const lines = data.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const masked = line.replace(/ApiKey\s+[A-Za-z0-9+/=]+/g, 'ApiKey [REDACTED]');
        console.log(`[mcp-remote] ${masked}`);
      }
    });
  }

  console.log('✅ Connected to Elastic Agent Builder MCP Server.');

  const result = await mcpClient.listTools();

  const mapType = (type: string): string => {
    switch (type?.toLowerCase()) {
      case 'string': return 'STRING';
      case 'number': return 'NUMBER';
      case 'integer': return 'INTEGER';
      case 'boolean': return 'BOOLEAN';
      case 'array': return 'ARRAY';
      case 'object': return 'OBJECT';
      default: return 'STRING';
    }
  };

  const mapProperty = (prop: any): any => {
    // If there is anyOf, resolve to the first defined schema type
    if (prop.anyOf && Array.isArray(prop.anyOf)) {
      const withType = prop.anyOf.find((item: any) => item.type);
      if (withType) {
        return mapProperty({ ...prop, ...withType, anyOf: undefined });
      }
    }

    const mappedProp: any = {
      type: mapType(prop.type || 'string'),
      description: prop.description
    };

    if (prop.type === 'array') {
      if (prop.items) {
        mappedProp.items = mapProperty(prop.items);
      } else {
        mappedProp.items = { type: 'STRING' };
      }
    } else if (prop.type === 'object' && prop.properties) {
      const nestedProps: Record<string, any> = {};
      for (const [k, v] of Object.entries(prop.properties)) {
        nestedProps[k] = mapProperty(v);
      }
      mappedProp.properties = nestedProps;
      if (prop.required) {
        mappedProp.required = prop.required;
      }
    }

    if (prop.enum) {
      mappedProp.enum = prop.enum;
    }

    return mappedProp;
  };

  const functionDeclarations: any[] = result.tools
    .filter(tool => tool.name !== 'fifa_accommodations_finder' && tool.name !== 'fifa_quick_hotel_lookup')
    .map(tool => {
      const properties: Record<string, any> = {};
      if (tool.inputSchema?.properties) {
        for (const [key, propValue] of Object.entries(tool.inputSchema.properties as any)) {
          properties[key] = mapProperty(propValue);
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'OBJECT',
          properties: properties,
          required: tool.inputSchema?.required as string[] || []
        }
      };
    });

  const localToolsDeclarations = [
    {
      name: 'find_nearby_accommodations',
      description: 'Find accommodations (hotels, B&Bs) near a specific stadium using geo-distance search, sorted by proximity.',
      parameters: {
        type: 'OBJECT',
        properties: {
          latitude: {
            type: 'NUMBER',
            description: 'Latitude of the stadium'
          },
          longitude: {
            type: 'NUMBER',
            description: 'Longitude of the stadium'
          },
          stadium_id: {
            type: 'STRING',
            description: 'Optional stadium ID to fallback to database location lookup'
          },
          max_distance_km: {
            type: 'NUMBER',
            description: 'Max radius to search (defaults to 15km)'
          }
        },
        required: []
      }
    },
    {
      name: 'find_nearby_hospitals',
      description: 'Find hospitals near a specific location using geo-distance search, sorted by proximity.',
      parameters: {
        type: 'OBJECT',
        properties: {
          latitude: {
            type: 'NUMBER',
            description: 'Latitude of the stadium'
          },
          longitude: {
            type: 'NUMBER',
            description: 'Longitude of the stadium'
          },
          stadium_id: {
            type: 'STRING',
            description: 'Optional stadium ID to fallback to database location lookup'
          },
          max_distance_km: {
            type: 'NUMBER',
            description: 'Max radius to search (defaults to 15km)'
          }
        },
        required: []
      }
    }
  ];

  functionDeclarations.push(...localToolsDeclarations);

  vertexTools = [{ functionDeclarations }];
  console.log(`✅ Mapped ${functionDeclarations.length} tools to Gen AI SDK.`);
}

app.post('/api/chat', async (req, res) => {
  if (!mcpClient) {
    return res.status(500).json({ error: 'MCP client not initialized' });
  }

  const apiLogs: { type: 'tool-call' | 'tool-return' | 'error'; message: string }[] = [];

  try {
    const { message, context } = req.body;

    const systemInstructionContent = `You are a helpful, conversational AI planner and assistant for the FIFA 2026 World Cup.
You have access to MCP tools to look up stadiums, matches, hotels, and weather.
The user is currently looking at: ${JSON.stringify(context, null, 2)}

Instructions:
1. Provide friendly, natural language responses.
2. DO NOT output, print, or repeat any raw JSON structures of tool results (such as function call responses, API logs, or tool returns) in your chat bubble. Use the tool results to answer the user's questions in a clean, conversational, markdown format.`;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstructionContent,
        tools: vertexTools
      }
    });

    console.log(`🗣️ User: ${message}`);

    let result = await chat.sendMessage({ message: message || 'Hello' });

    let functionCalls = result.functionCalls;

    while (functionCalls && functionCalls.length > 0) {
      const responseParts: any[] = [];

      for (const functionCall of functionCalls) {
        const callMsg = `Gemini requested tool call: ${functionCall.name}(${JSON.stringify(functionCall.args)})`;
        console.log(`🛠️ ${callMsg}`);
        apiLogs.push({ type: 'tool-call', message: callMsg });

        let mcpResult;
        try {
          if (functionCall.name === 'find_nearby_accommodations' || functionCall.name === 'find_nearby_hospitals') {
            mcpResult = await handleLocalElasticSearch(functionCall.name, functionCall.args);
          } else {
            const response = await mcpClient.callTool({
              name: functionCall.name as string,
              arguments: functionCall.args as any
            });
            mcpResult = response.content;
          }
        } catch (err: any) {
          mcpResult = [{ type: 'text', text: `Error calling tool: ${err.message}` }];
          apiLogs.push({ type: 'error', message: `Error executing tool ${functionCall.name}: ${err.message}` });
        }

        const returnMsg = `Tool ${functionCall.name} returned content`;
        console.log(`✅ ${returnMsg}:`, mcpResult);
        
        let logText = JSON.stringify(mcpResult);
        if (logText.length > 150) {
          logText = logText.substring(0, 150) + '...';
        }
        apiLogs.push({ type: 'tool-return', message: `${returnMsg}: ${logText}` });

        // Clean up the output data format for Gemini
        let outputData: any = mcpResult;
        if (Array.isArray(mcpResult) && mcpResult.length === 1 && mcpResult[0].type === 'text') {
          try {
            outputData = JSON.parse(mcpResult[0].text);
          } catch {
            outputData = mcpResult[0].text;
          }
        }

        const fResponse: any = {
          name: functionCall.name as string,
          response: { output: outputData }
        };
        if (functionCall.id) {
          fResponse.id = functionCall.id;
        }
        responseParts.push({
          functionResponse: fResponse
        });
      }

      result = await chat.sendMessage({
        message: responseParts
      } as any);

      functionCalls = result.functionCalls;
    }

    let reply = (result.text as string) || 'No response from model.';

    // Clean up any leading JSON block representing the function response that the model might have echoed
    reply = reply.trim();
    if (reply.startsWith('{')) {
      let braceCount = 0;
      let insideString = false;
      let escapeNext = false;
      let jsonEndIndex = -1;

      for (let i = 0; i < reply.length; i++) {
        const char = reply[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          insideString = !insideString;
          continue;
        }
        if (!insideString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i;
              break;
            }
          }
        }
      }

      if (jsonEndIndex !== -1) {
        const stripped = reply.substring(jsonEndIndex + 1).trim();
        if (stripped.length > 0) {
          reply = stripped;
        }
      }
    }

    console.log(`🤖 Agent: ${reply}`);

    res.json({ reply, logs: apiLogs });

  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message, logs: apiLogs });
  }
});

// Serve static files from frontend/dist
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get('*all', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`🚀 Backend server listening on port ${PORT}`);
  try {
    await initializeMcpClient();
  } catch (e) {
    console.error('Failed to initialize MCP client', e);
  }
});
