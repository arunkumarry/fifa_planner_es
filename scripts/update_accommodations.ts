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

function getPriceTier(price: number) {
  if (price < 100) return 'budget';
  if (price < 150) return 'mid';
  return 'luxury';
}

function getRatingTier(rating: number) {
  if (rating >= 4.5) return 'excellent';
  if (rating >= 3.5) return 'good';
  return 'fair';
}

async function main() {
  const dataDir = path.join(__dirname, '../data');
  const accommFile = path.join(dataDir, 'accommodations.csv');
  const citiesFile = path.join(dataDir, 'host_cities.csv');
  const outputFile = path.join(dataDir, 'fifa_accommodations.csv');

  console.log('📖 Reading data...');
  const accomm = await parseCsv<any>(accommFile);
  const cities = await parseCsv<any>(citiesFile);

  const cityMap = new Map<string, string>();
  for (const c of cities) {
    cityMap.set('S_' + c.id, c.city_name);
  }

  const outputRows: string[] = [];
  const header = "hotel_id,name,stadium_id,city,price_per_night,price_tier,rating,rating_tier,location,hotel_display,value_score";
  outputRows.push(header);

  for (const a of accomm) {
    const hotel_id = a.hotel_id;
    const name = a.name;
    const stadium_id = a.stadium_id;
    const city = cityMap.get(stadium_id) || 'Unknown';
    const price_per_night = parseFloat(a.price_per_night);
    const rating = parseFloat(a.rating);
    const price_tier = getPriceTier(price_per_night);
    const rating_tier = getRatingTier(rating);
    const location = `POINT(${a.longitude} ${a.latitude})`;
    const hotel_display = `${name} (${rating}★) - $${price_per_night}/night`;
    const value_score = ((rating / price_per_night) * 100).toFixed(1);

    const row = [
      hotel_id, `"${name}"`, stadium_id, `"${city}"`, price_per_night, price_tier,
      rating, rating_tier, `"${location}"`, `"${hotel_display}"`, value_score
    ];
    outputRows.push(row.join(','));
  }

  fs.writeFileSync(outputFile, outputRows.join('\n'));
  console.log(`💾 Saved updated accommodations to ${outputFile}`);

  const indexName = 'fifa_accommodations';
  if (await client.indices.exists({ index: indexName })) {
    await client.indices.delete({ index: indexName });
  }

  console.log(`🔄 Creating mapping for ${indexName}...`);
  await client.indices.create({
    index: indexName,
    body: {
      mappings: {
        properties: {
          hotel_id: { type: 'keyword' },
          name: { type: 'text' },
          stadium_id: { type: 'keyword' },
          city: { type: 'keyword' },
          price_per_night: { type: 'float' },
          price_tier: { type: 'keyword' },
          rating: { type: 'float' },
          rating_tier: { type: 'keyword' },
          location: { type: 'geo_point' },
          hotel_display: { type: 'text' },
          value_score: { type: 'float' }
        }
      }
    }
  });

  console.log(`⚽ Indexing ${accomm.length} accommodations into ${indexName}...`);
  const ops: any[] = [];
  
  for (const a of accomm) {
    const hotel_id = a.hotel_id;
    const name = a.name;
    const stadium_id = a.stadium_id;
    const city = cityMap.get(stadium_id) || 'Unknown';
    const price_per_night = parseFloat(a.price_per_night);
    const rating = parseFloat(a.rating);
    const price_tier = getPriceTier(price_per_night);
    const rating_tier = getRatingTier(rating);
    const location = `POINT(${a.longitude} ${a.latitude})`;
    const hotel_display = `${name} (${rating}★) - $${price_per_night}/night`;
    const value_score = parseFloat(((rating / price_per_night) * 100).toFixed(1));

    ops.push({ index: { _index: indexName, _id: hotel_id } });
    ops.push({
      hotel_id, name, stadium_id, city, price_per_night, price_tier,
      rating, rating_tier, location, hotel_display, value_score
    });
  }

  if (ops.length > 0) {
    await client.bulk({ refresh: true, operations: ops });
    console.log(`✅ Loaded ${accomm.length} records successfully into ${indexName}.`);
  }
}

main().catch(console.error);
