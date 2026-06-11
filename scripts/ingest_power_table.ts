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
  const csvFile = path.join(dataDir, 'fifa_matches_complete.csv');

  console.log('📖 Reading fifa_matches_complete.csv...');
  const records = await parseCsv<any>(csvFile);

  if (records.length === 0) {
    console.error('❌ Error: No records found in CSV.');
    process.exit(1);
  }

  const indexName = 'fifa_matches_complete';

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
          stage: { type: 'keyword' },
          stadium_id: { type: 'keyword' },
          stadium_name: { type: 'text' },
          city: { type: 'keyword' },
          stadium_capacity: { type: 'integer' },
          month: { type: 'keyword' },
          month_num: { type: 'integer' },
          day: { type: 'integer' },
          avg_temp_f: { type: 'integer' },
          temp_category: { type: 'keyword' },
          weather_conditions: { type: 'text' },
          precipitation_chance: { type: 'integer' },
          rain_risk: { type: 'keyword' },
          match_display: { type: 'text' },
          venue_display: { type: 'text' },
          weather_display: { type: 'text' }
        }
      }
    }
  });

  console.log(`⚽ Indexing ${records.length} matches...`);
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
      stage: r.stage,
      stadium_id: r.stadium_id,
      stadium_name: r.stadium_name,
      city: r.city,
      stadium_capacity: parseInt(r.stadium_capacity, 10),
      month: r.month,
      month_num: parseInt(r.month_num, 10),
      day: parseInt(r.day, 10),
      avg_temp_f: parseInt(r.avg_temp_f, 10),
      temp_category: r.temp_category,
      weather_conditions: r.weather_conditions,
      precipitation_chance: parseInt(r.precipitation_chance, 10),
      rain_risk: r.rain_risk,
      match_display: r.match_display,
      venue_display: r.venue_display,
      weather_display: r.weather_display
    });
  }

  if (ops.length > 0) {
    await client.bulk({ refresh: true, operations: ops });
    console.log(`✅ Loaded ${records.length} records successfully into ${indexName}.`);
  }

}

main().catch(console.error);
