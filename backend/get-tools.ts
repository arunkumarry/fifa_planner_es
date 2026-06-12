import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const esUrl = process.env.ELASTICSEARCH_URL || '';
  const esApiKey = process.env.ELASTICSEARCH_API_KEY || '';
  const kbUrl = esUrl.replace('.es.', '.kb.').replace(':443', '');
  const kbMcpUrl = `${kbUrl}/api/agent_builder/mcp`;

  const proxyScriptPath = path.join(__dirname, '../node_modules/mcp-remote/dist/proxy.js');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [proxyScriptPath, kbMcpUrl, '--header', `Authorization:ApiKey ${esApiKey}`],
    env: { ...process.env, HOME: '/tmp', MCP_REMOTE_CONFIG_DIR: '/tmp' },
    stderr: 'pipe'
  } as any);

  const mcpClient = new Client(
    { name: 'fifa-backend-client', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  await mcpClient.connect(transport);

  try {
    const mRes: any = await mcpClient.callTool({ name: 'fifa_match_finder', arguments: {} });
    console.log('fifa_match_finder', mRes.content[0].text.substring(0, 500));
  } catch (e: any) { console.error(e.message); }
  
  try {
    const wRes: any = await mcpClient.callTool({ name: 'fifa_weather_forecast', arguments: {} });
    console.log('fifa_weather_forecast', wRes.content[0].text.substring(0, 500));
  } catch (e: any) { console.error(e.message); }

  try {
    const sRes: any = await mcpClient.callTool({ name: 'fifa_accommodations_finder', arguments: {} });
    console.log('fifa_accommodations_finder', sRes.content[0].text.substring(0, 500));
  } catch (e: any) { console.error(e.message); }
  
  process.exit(0);
}

run().catch(console.error);
