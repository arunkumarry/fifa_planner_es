import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || '',
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY || '' }
});

async function check() {
  try {
    const res1 = await esClient.search({ index: 'fifa_team_stats_predicted', size: 1 });
    console.log('fifa_team_stats_predicted:', JSON.stringify(res1.hits.hits[0]?._source, null, 2));
  } catch(e: any) { console.error('Error 1:', e.message); }

  try {
    const res2 = await esClient.search({ index: 'fifa_team_stats_history', size: 1 });
    console.log('fifa_team_stats_history:', JSON.stringify(res2.hits.hits[0]?._source, null, 2));
  } catch(e: any) { console.error('Error 2:', e.message); }
}

check().catch(console.error);
