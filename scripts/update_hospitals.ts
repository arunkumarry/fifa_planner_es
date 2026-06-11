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
  auth: { apiKey: ELASTICSEARCH_API_KEY }
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
  const inputFile = path.join(dataDir, 'hospitals.csv');

  console.log('📖 Reading hospitals data...');
  const hospitals = await parseCsv<any>(inputFile);

  const indexName = 'fifa_hospitals';
  if (await client.indices.exists({ index: indexName })) {
    await client.indices.delete({ index: indexName });
  }

  console.log(`🔄 Creating mapping for ${indexName}...`);
  await client.indices.create({
    index: indexName,
    body: {
      mappings: {
        properties: {
          hospital_id: { type: 'keyword' },
          name: { type: 'text' },
          address: { type: 'text' },
          city: { type: 'keyword' },
          state: { type: 'keyword' },
          telephone: { type: 'keyword' },
          type: { type: 'keyword' },
          status: { type: 'keyword' },
          beds: { type: 'integer' },
          trauma: { type: 'keyword' },
          location: { type: 'geo_point' }
        }
      }
    }
  });

  console.log(`⚽ Indexing ${hospitals.length} hospitals into ${indexName}...`);
  const ops: any[] = [];
  
  for (const h of hospitals) {
    const hospital_id = h.ID;
    const name = h.NAME;
    const address = h.ADDRESS;
    const city = h.CITY;
    const state = h.STATE;
    const telephone = h.TELEPHONE;
    const type = h.TYPE;
    const status = h.STATUS;
    const beds = parseInt(h.BEDS, 10);
    const trauma = h.TRAUMA;
    
    // Ensure we handle invalid/missing coordinates
    const lat = parseFloat(h.LATITUDE);
    const lon = parseFloat(h.LONGITUDE);
    
    if (isNaN(lat) || isNaN(lon) || !hospital_id) {
        continue;
    }

    const location = `POINT(${lon} ${lat})`;

    ops.push({ index: { _index: indexName, _id: hospital_id } });
    ops.push({
      hospital_id, name, address, city, state, telephone, type, status,
      beds: isNaN(beds) ? 0 : beds,
      trauma, location
    });
  }

  if (ops.length > 0) {
    // Process in batches since 8000 might be slightly large for a single bulk request depending on settings
    const batchSize = 1000;
    for (let i = 0; i < ops.length; i += batchSize * 2) {
      const batch = ops.slice(i, i + batchSize * 2);
      await client.bulk({ refresh: true, operations: batch });
    }
    console.log(`✅ Loaded ${ops.length / 2} records successfully into ${indexName}.`);
  }
}

main().catch(console.error);
