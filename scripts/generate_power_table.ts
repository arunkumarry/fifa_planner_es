import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

interface HostCityRaw {
  id: string;
  city_name: string;
  country: string;
  venue_name: string;
  region_cluster: string;
  airport_code: string;
}

interface TeamRaw {
  id: string;
  team_name: string;
  fifa_code: string;
  group_letter: string;
  is_placeholder: string;
}

interface StageRaw {
  id: string;
  stage_name: string;
  stage_order: string;
}

interface MatchRaw {
  id: string;
  match_number: string;
  home_team_id: string;
  away_team_id: string;
  city_id: string;
  stage_id: string;
  kickoff_at: string;
  match_label: string;
}

const STADIUM_DATA: Record<string, { capacity: number, lat: number, lon: number }> = {
  "Atlanta": { capacity: 71000, lat: 33.7554, lon: -84.4008 },
  "Boston": { capacity: 65878, lat: 42.0909, lon: -71.2643 },
  "Dallas": { capacity: 80000, lat: 32.7473, lon: -97.0945 },
  "Houston": { capacity: 72220, lat: 29.6847, lon: -95.4107 },
  "Kansas City": { capacity: 76416, lat: 39.0489, lon: -94.4839 },
  "Los Angeles": { capacity: 70240, lat: 33.9534, lon: -118.3387 },
  "Miami": { capacity: 65326, lat: 25.9580, lon: -80.2389 },
  "New York/New Jersey": { capacity: 82500, lat: 40.8128, lon: -74.0742 },
  "Philadelphia": { capacity: 69796, lat: 39.9012, lon: -75.1675 },
  "San Francisco Bay Area": { capacity: 68500, lat: 37.4032, lon: -121.9698 },
  "Seattle": { capacity: 69000, lat: 47.5952, lon: -122.3316 },
  "Toronto": { capacity: 45000, lat: 43.6332, lon: -79.4186 },
  "Vancouver": { capacity: 54500, lat: 49.2768, lon: -123.1120 },
  "Guadalajara": { capacity: 48071, lat: 20.6817, lon: -103.4628 },
  "Mexico City": { capacity: 87523, lat: 19.3029, lon: -99.1505 },
  "Monterrey": { capacity: 53500, lat: 25.6700, lon: -100.2444 }
};

const WEATHER_PROFILES: Record<string, { June: { temp: number; precip: number; cond: string }; July: { temp: number; precip: number; cond: string } }> = {
  "Atlanta": { June: { temp: 82, precip: 35, cond: "Warm and Humid" }, July: { temp: 86, precip: 45, cond: "Humid and Scattered Storms" } },
  "Boston": { June: { temp: 72, precip: 20, cond: "Sunny and Mild" }, July: { temp: 79, precip: 25, cond: "Warm and Pleasant" } },
  "Dallas": { June: { temp: 92, precip: 15, cond: "Hot and Sunny" }, July: { temp: 96, precip: 10, cond: "Extremely Hot" } },
  "Houston": { June: { temp: 89, precip: 30, cond: "Humid, Afternoon Breezes" }, July: { temp: 93, precip: 40, cond: "Humid, Scattered Storms" } },
  "Kansas City": { June: { temp: 80, precip: 25, cond: "Partly Cloudy" }, July: { temp: 85, precip: 30, cond: "Hot and Partly Cloudy" } },
  "Los Angeles": { June: { temp: 72, precip: 0, cond: "Clear and Sunny" }, July: { temp: 77, precip: 0, cond: "Clear and Warm" } },
  "Miami": { June: { temp: 86, precip: 45, cond: "Tropical Humid, Rain Risks" }, July: { temp: 88, precip: 50, cond: "Tropical Heat, Thunderstorms" } },
  "New York/New Jersey": { June: { temp: 79, precip: 25, cond: "Sunny and Warm" }, July: { temp: 84, precip: 30, cond: "Humid and Sunny" } },
  "Philadelphia": { June: { temp: 80, precip: 25, cond: "Warm, Clear Skies" }, July: { temp: 85, precip: 30, cond: "Humid and Sunny" } },
  "San Francisco Bay Area": { June: { temp: 70, precip: 5, cond: "Mild and Sunny" }, July: { temp: 73, precip: 2, cond: "Clear, Evening Fog" } },
  "Seattle": { June: { temp: 68, precip: 15, cond: "Pleasant, Partly Cloudy" }, July: { temp: 75, precip: 10, cond: "Warm and Sunny" } },
  "Toronto": { June: { temp: 73, precip: 20, cond: "Sunny and Mild" }, July: { temp: 79, precip: 25, cond: "Warm and Breezy" } },
  "Vancouver": { June: { temp: 67, precip: 20, cond: "Mild, Overcast Intervals" }, July: { temp: 72, precip: 15, cond: "Mild and Sunny" } },
  "Guadalajara": { June: { temp: 82, precip: 45, cond: "Warm, Evening Showers" }, July: { temp: 77, precip: 60, cond: "Rainy Season, Humid" } },
  "Mexico City": { June: { temp: 72, precip: 50, cond: "Mild, Cloudy and Rainy" }, July: { temp: 70, precip: 65, cond: "Rainy Season, Cool Nights" } },
  "Monterrey": { June: { temp: 91, precip: 20, cond: "Very Hot, Sunny" }, July: { temp: 93, precip: 15, cond: "Hot and Dry" } }
};

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

async function main() {
  const dataDir = path.join(__dirname, '../data');

  console.log('📖 Reading user CSV files...');
  const citiesRaw = await parseCsv<HostCityRaw>(path.join(dataDir, 'host_cities.csv'));
  const teamsRaw = await parseCsv<TeamRaw>(path.join(dataDir, 'teams.csv'));
  const stagesRaw = await parseCsv<StageRaw>(path.join(dataDir, 'tournament_stages.csv'));
  const matchesRaw = await parseCsv<MatchRaw>(path.join(dataDir, 'matches.csv'));

  if (citiesRaw.length === 0 || matchesRaw.length === 0) {
    console.error('❌ Error: CSV files are missing or empty in data/ folder.');
    process.exit(1);
  }

  const cityMap = new Map<string, HostCityRaw>();
  citiesRaw.forEach(c => cityMap.set(c.id, c));

  const teamMap = new Map<string, TeamRaw>();
  teamsRaw.forEach(t => teamMap.set(t.id, t));

  const stageMap = new Map<string, StageRaw>();
  stagesRaw.forEach(s => stageMap.set(s.id, s));

  const outputRows: string[] = [];
  const header = "match_id,date,date_int,kickoff_at,team_1,team_2,teams_combined,stage,stadium_id,stadium_name,city,stadium_capacity,stadium_location,month,month_num,day,avg_temp_f,temp_category,weather_conditions,precipitation_chance,rain_risk,match_display,venue_display,weather_display";
  outputRows.push(header);

  for (const match of matchesRaw) {
    const cityDetails = cityMap.get(match.city_id);
    const stageDetails = stageMap.get(match.stage_id);

    let team1 = "TBD";
    let team2 = "TBD";

    if (match.home_team_id) {
      team1 = teamMap.get(match.home_team_id)?.team_name || `Team ${match.home_team_id}`;
    }
    if (match.away_team_id) {
      team2 = teamMap.get(match.away_team_id)?.team_name || `Team ${match.away_team_id}`;
    }

    if (team1 === "TBD" && team2 === "TBD" && match.match_label) {
      const labelParts = match.match_label.split(" vs ");
      if (labelParts.length === 2) {
        team1 = labelParts[0];
        team2 = labelParts[1];
      } else {
        team1 = match.match_label;
      }
    }

    const mId = `M_${match.id}`;
    const kickoff_at = match.kickoff_at || '2026-06-11 00:00:00Z';
    const dateStr = kickoff_at.split(' ')[0]; // e.g. 2026-06-16
    const dateZ = `${dateStr}T00:00:00Z`;
    const date_int = parseInt(dateStr.replace(/-/g, ''), 10);
    const timeZoneStr = kickoff_at.includes(' ') ? kickoff_at.split(' ')[1] : kickoff_at;

    const teams_combined = `${team1}|${team2}`;
    const stage = stageDetails ? stageDetails.stage_name : 'Group Stage';
    
    const city_name = cityDetails ? cityDetails.city_name : 'Unknown City';
    const stadium_name = cityDetails ? cityDetails.venue_name : 'Unknown Venue';
    const sId = cityDetails ? `S_${cityDetails.id}` : 'Unknown';
    const sData = STADIUM_DATA[city_name] || { capacity: 65000, lat: 0, lon: 0 };
    const stadium_capacity = sData.capacity;
    const stadium_location = `"POINT(${sData.lon} ${sData.lat})"`;

    const [yyyy, mm, dd] = dateStr.split('-');
    const month_num = parseInt(mm, 10);
    const month = month_num === 6 ? 'June' : (month_num === 7 ? 'July' : 'Unknown');
    const day = parseInt(dd, 10);

    // Weather Simulation
    const profile = WEATHER_PROFILES[city_name] ? WEATHER_PROFILES[city_name][month as 'June' | 'July'] : { temp: 75, precip: 20, cond: "Clear" };
    // We add some deterministic variation based on match.id so it's consistent
    const idNum = parseInt(match.id, 10) || 0;
    const tempVar = (idNum % 7) - 3; // -3 to +3
    const precipVar = (idNum % 15) - 7; // -7 to +7

    const avg_temp_f = profile.temp + tempVar;
    let precipitation_chance = profile.precip + precipVar;
    if (precipitation_chance < 0) precipitation_chance = 0;
    if (precipitation_chance > 100) precipitation_chance = 100;
    const weather_conditions = profile.cond;

    const temp_category = getTempCategory(avg_temp_f);
    const rain_risk = getRainRisk(precipitation_chance);

    const match_display = `${team1} vs ${team2} - ${stage}`;
    const venue_display = `${stadium_name} ${city_name}`;
    const weather_display = `${avg_temp_f}°F ${weather_conditions} (${precipitation_chance}% rain)`;

    // Properly escape fields that might have commas (like venue_display, match_display if needed)
    const row = [
      mId, dateZ, date_int, timeZoneStr, team1, team2, teams_combined, stage,
      sId, `"${stadium_name}"`, `"${city_name}"`, stadium_capacity, stadium_location, month, month_num, day,
      avg_temp_f, temp_category, `"${weather_conditions}"`, precipitation_chance, rain_risk,
      `"${match_display}"`, `"${venue_display}"`, `"${weather_display}"`
    ];

    outputRows.push(row.join(','));
  }

  const outputPath = path.join(dataDir, 'fifa_matches_complete.csv');
  fs.writeFileSync(outputPath, outputRows.join('\n'));
  console.log(`✅ Generated power table with ${matchesRaw.length} rows at ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
