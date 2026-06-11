import { Client } from '@elastic/elasticsearch';
import * as fs from 'fs';
import * as path from 'path';
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
  "S_14": { lat: 20.6817, lon: -103.4628 },
  "S_15": { lat: 19.3029, lon: -99.1505 },
  "S_16": { lat: 25.6700, lon: -100.2444 }
};

async function main() {
  const jsonPath = path.join(__dirname, '../frontend/src/data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ data.json not found!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(rawData);
  const hospitals: any[] = [];

  console.log('🏥 Fetching nearby hospitals for each stadium from Elasticsearch...');

  for (const [stadiumId, coords] of Object.entries(STADIUM_COORDINATES)) {
    try {
      const response = await client.search({
        index: 'fifa_hospitals',
        body: {
          query: {
            bool: {
              must: { match_all: {} },
              filter: {
                geo_distance: {
                  distance: `30km`,
                  location: { lat: coords.lat, lon: coords.lon }
                }
              }
            }
          },
          sort: [
            {
              _geo_distance: {
                location: { lat: coords.lat, lon: coords.lon },
                order: 'asc',
                unit: 'km',
                distance_type: 'plane'
              }
            }
          ],
          size: 5
        }
      });

      response.hits.hits.forEach((hit: any) => {
        hospitals.push({
          hospital_id: hit._source.hospital_id,
          name: hit._source.name,
          stadium_id: stadiumId,
          latitude: hit._source.location.lat ?? coords.lat,
          longitude: hit._source.location.lon ?? coords.lon,
          distance_km: parseFloat(hit.sort[0].toFixed(2)),
          beds: hit._source.beds,
          trauma: hit._source.trauma,
          telephone: hit._source.telephone
        });
      });
      console.log(`✅ Fetched hospitals for stadium ${stadiumId}`);
    } catch (err) {
      console.error(`❌ Failed fetching for ${stadiumId}`, err);
    }
  }

  data.hospitals = hospitals;
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log(`🎉 Successfully injected ${hospitals.length} hospitals into frontend/src/data.json!`);
}

main().catch(console.error);
