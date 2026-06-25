import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { runScrapeAndIndex } from '../backend/scraper';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;

if (!ELASTICSEARCH_URL || !ELASTICSEARCH_API_KEY) {
  console.error('❌ Error: ELASTICSEARCH_URL or ELASTICSEARCH_API_KEY is missing.');
  process.exit(1);
}

const client = new Client({
  node: ELASTICSEARCH_URL,
  auth: {
    apiKey: ELASTICSEARCH_API_KEY
  }
});

async function main() {
  console.log('🚀 Triggering the scraper manually...');
  const result = await runScrapeAndIndex(client);
  console.log('Result:', result);
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
