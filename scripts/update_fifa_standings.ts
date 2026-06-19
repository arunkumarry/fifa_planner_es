import { Client } from '@elastic/elasticsearch';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as dotenv from 'dotenv';

dotenv.config();

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

interface StandingsRecord {
  group: string;
  pos: string;
  team: string;
  pts: string;
  gp: string;
  w: string;
  l: string;
  d: string;
  gf: string;
  ga: string;
  gd: string;
}

const parseCsv = <T>(filePath: string): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

async function main() {
  const dataDir = path.join(__dirname, '../data');
  const standingsCsvFile = path.join(dataDir, 'fifa_standings.csv');

  console.log('📖 Reading the standings table...');
  const records = await parseCsv<StandingsRecord>(standingsCsvFile);

  if (records.length === 0) {
    console.error('❌ Error: No records found in standings table.');
    process.exit(1);
  }

  const indexName = 'fifa_standings';

  // 1. Re-create mapping and ingest into Elasticsearch
  if (await client.indices.exists({ index: indexName })) {
    console.log(`🗑️ Deleting existing index ${indexName}...`);
    await client.indices.delete({ index: indexName });
  }

  console.log(`🔄 Creating mapping for ${indexName} optimized for low ECU...`);
  await client.indices.create({
    index: indexName,
    body: {
      mappings: {
        properties: {
          group: { type: 'keyword' },
          pos: { type: 'integer' },
          team: { type: 'keyword' },
          pts: { type: 'integer' },
          gp: { type: 'integer' },
          w: { type: 'integer' },
          l: { type: 'integer' },
          d: { type: 'integer' },
          gf: { type: 'integer' },
          ga: { type: 'integer' },
          gd: { type: 'integer' }
        }
      }
    }
  });

  console.log(`🏆 Indexing ${records.length} standings into ${indexName}...`);
  const ops: any[] = [];
  
  for (const r of records) {
    // Generate unique ID based on group and team
    const docId = `${r.group.toLowerCase().replace(/\s+/g, '_')}_${r.team.toLowerCase().replace(/\s+/g, '_')}`;
    ops.push({ index: { _index: indexName, _id: docId } });
    ops.push({
      group: r.group,
      pos: parseInt(r.pos, 10),
      team: r.team,
      pts: parseInt(r.pts, 10),
      gp: parseInt(r.gp, 10),
      w: parseInt(r.w, 10),
      l: parseInt(r.l, 10),
      d: parseInt(r.d, 10),
      gf: parseInt(r.gf, 10),
      ga: parseInt(r.ga, 10),
      gd: parseInt(r.gd, 10)
    });
  }

  if (ops.length > 0) {
    await client.bulk({ refresh: true, operations: ops });
    console.log(`✅ Loaded ${records.length} standings records successfully into ${indexName}.`);
  }
}

main().catch(console.error);
