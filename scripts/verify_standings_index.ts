import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;

if (!ELASTICSEARCH_URL || !ELASTICSEARCH_API_KEY) {
  console.error("Missing ELASTICSEARCH_URL or ELASTICSEARCH_API_KEY in .env");
  process.exit(1);
}

const client = new Client({
  node: ELASTICSEARCH_URL,
  auth: {
    apiKey: ELASTICSEARCH_API_KEY
  }
});

async function run() {
  console.log("🔍 Checking index: fifa_standings...");
  
  // 1. Check mapping
  const mapping = await client.indices.getMapping({ index: 'fifa_standings' });
  console.log("Mapping:", JSON.stringify(mapping, null, 2));

  // 2. Query Group A standings (Term query - low ECU)
  console.log("\n🔍 Querying Group A standings...");
  const resGroupA = await client.search({
    index: 'fifa_standings',
    body: {
      query: {
        term: { group: 'Group A' }
      },
      sort: [{ pos: { order: 'asc' } }]
    }
  });

  console.log(`Hits: ${resGroupA.hits.hits.length}`);
  resGroupA.hits.hits.forEach((hit: any) => {
    const s = hit._source;
    console.log(`Pos ${s.pos}: ${s.team} - PTS: ${s.pts}, GP: ${s.gp}, GD: ${s.gd}`);
  });
}

run().catch(console.error);
