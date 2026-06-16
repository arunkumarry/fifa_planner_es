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
  const powerTableFile = path.join(dataDir, 'fifa_matches_complete.csv');
  const outputCsvFile = path.join(dataDir, 'fifa_matches.csv');

  console.log('📖 Reading the power table...');
  const records = await parseCsv<any>(powerTableFile);

  if (records.length === 0) {
    console.error('❌ Error: No records found in power table.');
    process.exit(1);
  }

  const indexName = 'fifa_matches';

  // 1. Generate the CSV file
  const outputRows: string[] = [];
  const header = "match_id,date,date_int,kickoff_at,team_1,team_2,teams_combined,stadium_id,stadium,city,stadium_location,stage,match_display,month,month_num,status,winner,score,summary";
  outputRows.push(header);

  for (const r of records) {
    // Note: The power table has stadium_name, we map it to stadium for this specific schema
    const row = [
      r.match_id, r.date, r.date_int, r.kickoff_at, r.team_1, r.team_2, r.teams_combined,
      r.stadium_id, r.stadium_name, r.city, r.stadium_location, r.stage, r.match_display, r.month, r.month_num,
      r.status || 'scheduled', r.winner || '', r.score || '', `"${(r.summary || '').replace(/"/g, '""')}"`
    ];
    outputRows.push(row.join(','));
  }

  fs.writeFileSync(outputCsvFile, outputRows.join('\n'));
  console.log(`💾 Saved subset data to ${outputCsvFile}`);

  // 2. Re-create mapping and ingest into Elasticsearch
  if (await client.indices.exists({ index: indexName })) {
    await client.indices.delete({ index: indexName });
  }

  console.log(`🔄 Creating mapping for ${indexName}...`);
  await client.indices.create({
    index: indexName,
    body: {
      mappings: {
        properties: {
          match_id: { type: 'keyword' },
          date: { type: 'date' },
          date_int: { type: 'integer' },
          kickoff_at: { type: 'keyword' },
          team_1: { type: 'keyword' },
          team_2: { type: 'keyword' },
          teams_combined: { type: 'text' },
          stadium_id: { type: 'keyword' },
          stadium: { type: 'text' },
          city: { type: 'keyword' },
          stadium_location: { type: 'geo_point' },
          stage: { type: 'keyword' },
          match_display: { type: 'text' },
          month: { type: 'keyword' },
          month_num: { type: 'integer' },
          status: { type: 'keyword' },
          winner: { type: 'keyword' },
          score: { type: 'keyword' },
          summary: { type: 'text' }
        }
      }
    }
  });

  console.log(`⚽ Indexing ${records.length} matches into ${indexName}...`);
  const ops: any[] = [];
  
  for (const r of records) {
    ops.push({ index: { _index: indexName, _id: r.match_id } });
    ops.push({
      match_id: r.match_id,
      date: r.date,
      date_int: parseInt(r.date_int, 10),
      kickoff_at: r.kickoff_at,
      team_1: r.team_1,
      team_2: r.team_2,
      teams_combined: r.teams_combined,
      stadium_id: r.stadium_id,
      stadium: r.stadium_name.replace(/"/g, ''), // remove quotes if any
      city: r.city.replace(/"/g, ''),
      stadium_location: r.stadium_location.replace(/"/g, ''),
      stage: r.stage,
      match_display: r.match_display.replace(/"/g, ''),
      month: r.month,
      month_num: parseInt(r.month_num, 10),
      status: r.status || 'scheduled',
      winner: r.winner || '',
      score: r.score || '',
      summary: r.summary || ''
    });
  }

  if (ops.length > 0) {
    await client.bulk({ refresh: true, operations: ops });
    console.log(`✅ Loaded ${records.length} records successfully into ${indexName}.`);
  }
}

main().catch(console.error);
