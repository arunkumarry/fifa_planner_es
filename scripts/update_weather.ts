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

function getTempCategory(temp: number) {
  if (temp < 65) return "cool";
  if (temp < 80) return "mild";
  if (temp < 90) return "warm";
  if (temp < 100) return "hot";
  return "extreme";
}

function getRainRisk(precip: number) {
  if (precip < 30) return "low";
  if (precip <= 60) return "medium";
  return "high";
}

function getDateRange(month: string, day: number) {
  const mStr = month.substring(0, 3); // Jun, Jul
  if (day <= 10) return `${mStr} 1-10`;
  if (day <= 20) return `${mStr} 10-20`;
  return `${mStr} 20-31`;
}

async function main() {
  const dataDir = path.join(__dirname, '../data');
  const inputFile = path.join(dataDir, 'weather.csv');
  const outputFile = path.join(dataDir, 'weather_history.csv');

  console.log('📖 Reading weather data...');
  const weatherRecords = await parseCsv<any>(inputFile);

  const outputRows: string[] = [];
  const header = "city,month,month_num,day,date_range,avg_temp_f,temp_category,conditions,precipitation_chance,rain_risk,weather_display";
  outputRows.push(header);

  for (const w of weatherRecords) {
    const city = w.city;
    const month = w.month;
    const month_num = month === 'June' ? 6 : (month === 'July' ? 7 : 0);
    const day = parseInt(w.day, 10);
    const avg_temp_f = parseInt(w.avg_temp_f, 10);
    const precipitation_chance = parseInt(w.precipitation_chance, 10);
    const conditions = w.conditions;

    const date_range = getDateRange(month, day);
    const temp_category = getTempCategory(avg_temp_f);
    const rain_risk = getRainRisk(precipitation_chance);
    const weather_display = `${avg_temp_f}°F ${conditions} (${precipitation_chance}% rain)`;

    const row = [
      `"${city}"`, month, month_num, day, `"${date_range}"`, avg_temp_f, temp_category,
      `"${conditions}"`, precipitation_chance, rain_risk, `"${weather_display}"`
    ];
    outputRows.push(row.join(','));
  }

  fs.writeFileSync(outputFile, outputRows.join('\n'));
  console.log(`💾 Saved updated weather history to ${outputFile}`);

  const indexName = 'weather_history';
  if (await client.indices.exists({ index: indexName })) {
    await client.indices.delete({ index: indexName });
  }

  console.log(`🔄 Creating mapping for ${indexName}...`);
  await client.indices.create({
    index: indexName,
    body: {
      mappings: {
        properties: {
          city: { type: 'keyword' },
          month: { type: 'keyword' },
          month_num: { type: 'integer' },
          day: { type: 'integer' },
          date_range: { type: 'keyword' },
          avg_temp_f: { type: 'integer' },
          temp_category: { type: 'keyword' },
          conditions: { type: 'text' },
          precipitation_chance: { type: 'integer' },
          rain_risk: { type: 'keyword' },
          weather_display: { type: 'text' }
        }
      }
    }
  });

  console.log(`⚽ Indexing ${weatherRecords.length} records into ${indexName}...`);
  const ops: any[] = [];
  
  for (let i = 0; i < weatherRecords.length; i++) {
    const w = weatherRecords[i];
    const city = w.city;
    const month = w.month;
    const month_num = month === 'June' ? 6 : (month === 'July' ? 7 : 0);
    const day = parseInt(w.day, 10);
    const avg_temp_f = parseInt(w.avg_temp_f, 10);
    const precipitation_chance = parseInt(w.precipitation_chance, 10);
    const conditions = w.conditions;

    const date_range = getDateRange(month, day);
    const temp_category = getTempCategory(avg_temp_f);
    const rain_risk = getRainRisk(precipitation_chance);
    const weather_display = `${avg_temp_f}°F ${conditions} (${precipitation_chance}% rain)`;

    // Make a unique ID for ES mapping since there isn't one
    const docId = `W_${city.replace(/[^a-zA-Z]/g, '')}_${month_num}_${day}`;

    ops.push({ index: { _index: indexName, _id: docId } });
    ops.push({
      city, month, month_num, day, date_range, avg_temp_f,
      temp_category, conditions, precipitation_chance, rain_risk, weather_display
    });
  }

  if (ops.length > 0) {
    await client.bulk({ refresh: true, operations: ops });
    console.log(`✅ Loaded ${weatherRecords.length} records successfully into ${indexName}.`);
  }
}

main().catch(console.error);
