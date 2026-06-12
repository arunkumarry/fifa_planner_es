import { Client as EsClient } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const esClient = new EsClient({
  node: process.env.ELASTICSEARCH_URL || '',
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY || ''
  }
});

const STADIUM_COORDINATES: Record<string, { lat: number, lon: number }> = {
  "S_2": { lat: 42.0909, lon: -71.2643 }, // Gillette Stadium (Boston)
};

async function handleLocalElasticSearch(name: string, args: any) {
  let lat = args?.latitude as number;
  let lon = args?.longitude as number;
  const stadiumId = args?.stadium_id as string;
  const maxDistance = (args?.max_distance_km as number) || 15;

  if (!lat || !lon) {
    if (stadiumId && STADIUM_COORDINATES[stadiumId]) {
      lat = STADIUM_COORDINATES[stadiumId].lat;
      lon = STADIUM_COORDINATES[stadiumId].lon;
    } else {
      throw new Error('Must provide latitude/longitude or a valid stadium_id.');
    }
  }

  const indexName = name === 'find_nearby_accommodations' ? 'fifa_accommodations' : 'fifa_hospitals';
  console.log(`Searching in index ${indexName} centered at lat: ${lat}, lon: ${lon} within ${maxDistance}km`);

  const response = await esClient.search({
    index: indexName,
    body: {
      query: {
        bool: {
          must: { match_all: {} },
          filter: {
            geo_distance: {
              distance: `${maxDistance}km`,
              location: { lat, lon }
            }
          }
        }
      },
      sort: [
        {
          _geo_distance: {
            location: { lat, lon },
            order: 'asc',
            unit: 'km',
            distance_type: 'plane'
          }
        }
      ]
    }
  });

  const hits = (response.hits.hits as any[]).map((hit: any) => ({
    ...hit._source,
    distance_km: parseFloat(hit.sort[0].toFixed(2))
  }));

  const key = name === 'find_nearby_accommodations' ? 'accommodations' : 'hospitals';
  return { [key]: hits };
}

async function run() {
  try {
    const accommodations = await handleLocalElasticSearch('find_nearby_accommodations', { stadium_id: 'S_2' });
    console.log('Accommodations Search Results:', JSON.stringify(accommodations, null, 2));

    const hospitals = await handleLocalElasticSearch('find_nearby_hospitals', { stadium_id: 'S_2' });
    console.log('Hospitals Search Results:', JSON.stringify(hospitals, null, 2));
  } catch (err: any) {
    console.error('Search failed:', err);
  }
}

run();
