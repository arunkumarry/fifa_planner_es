import { Client } from '@elastic/elasticsearch';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as dotenv from 'dotenv';

dotenv.config();

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;

if (!ELASTICSEARCH_URL || ELASTICSEARCH_URL.includes('your-serverless-elasticsearch-url')) {
  console.error('❌ Error: ELASTICSEARCH_URL is not set in your .env file.');
  console.error('Please configure your Elasticsearch Serverless URL and API Key in:');
  console.error('  /Users/arunkumar/work/fifa-planner/.env');
  process.exit(1);
}

if (!ELASTICSEARCH_API_KEY || ELASTICSEARCH_API_KEY.includes('your-elasticsearch-api-key')) {
  console.error('❌ Error: ELASTICSEARCH_API_KEY is not set in your .env file.');
  console.error('Please configure your API Key in:');
  console.error('  /Users/arunkumar/work/fifa-planner/.env');
  process.exit(1);
}

const client = new Client({
  node: ELASTICSEARCH_URL,
  auth: {
    apiKey: ELASTICSEARCH_API_KEY
  }
});

// Hardcoded official stadium coordinates, capacities, and ticket info
const STADIUM_DATA: Record<string, { lat: number; lon: number; capacity: number; ticketInfo: string }> = {
  "Atlanta": { lat: 33.7553, lon: -84.4006, capacity: 71000, ticketInfo: "Official tickets at fifa.com/tickets. VIP at mercedesbenzstadium.com." },
  "Boston": { lat: 42.0909, lon: -71.2643, capacity: 65878, ticketInfo: "Official tickets at fifa.com/tickets. Gillette Stadium travel packages available." },
  "Dallas": { lat: 32.7473, lon: -97.0945, capacity: 80000, ticketInfo: "Official tickets at fifa.com/tickets. Suites booking at attstadium.com." },
  "Houston": { lat: 29.6847, lon: -95.4107, capacity: 72220, ticketInfo: "Official tickets at fifa.com/tickets. General sale starts late 2025." },
  "Kansas City": { lat: 39.0489, lon: -94.4839, capacity: 76416, ticketInfo: "Official tickets at fifa.com/tickets. Central region tickets start $130." },
  "Los Angeles": { lat: 33.9534, lon: -118.3387, capacity: 70240, ticketInfo: "Official tickets at fifa.com/tickets. Standard seats range $120-$400." },
  "Miami": { lat: 25.9580, lon: -80.2389, capacity: 65326, ticketInfo: "Official tickets at fifa.com/tickets. Hospitality deals at hardrockstadium.com." },
  "New York/New Jersey": { lat: 40.8135, lon: -74.0744, capacity: 82500, ticketInfo: "Official tickets at fifa.com/tickets. MetLife Stadium group tickets from $150." },
  "Philadelphia": { lat: 39.9008, lon: -75.1674, capacity: 69796, ticketInfo: "Official tickets at fifa.com/tickets. Eastern cluster pricing applies." },
  "San Francisco Bay Area": { lat: 37.4033, lon: -121.9698, capacity: 68500, ticketInfo: "Official tickets at fifa.com/tickets. Levi's Stadium travel deals." },
  "Seattle": { lat: 47.5952, lon: -122.3316, capacity: 69000, ticketInfo: "Official tickets at fifa.com/tickets. Northwest sales start late 2025." },
  "Toronto": { lat: 43.6328, lon: -79.4186, capacity: 45000, ticketInfo: "Official tickets at fifa.com/tickets. BMO Field tickets starting $110 CAD." },
  "Vancouver": { lat: 49.2767, lon: -123.1120, capacity: 54500, ticketInfo: "Official tickets at fifa.com/tickets. Canadian region tickets from $110." },
  "Guadalajara": { lat: 20.6819, lon: -103.4627, capacity: 48071, ticketInfo: "Official tickets at fifa.com/tickets. Estadio Akron stadium ticket center." },
  "Mexico City": { lat: 19.3029, lon: -99.1505, capacity: 87523, ticketInfo: "Official tickets at fifa.com/tickets. Estadio Azteca history packages." },
  "Monterrey": { lat: 25.6692, lon: -100.2443, capacity: 53500, ticketInfo: "Official tickets at fifa.com/tickets. Estadio BBVA host city services." }
};

// Weather profiles for simulation
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

// CSV Parser Helper
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

async function createIndices() {
  console.log('🔄 Setting up Elasticsearch Indexes...');

  // 1. Matches Index
  if (await client.indices.exists({ index: 'fifa_matches' })) {
    await client.indices.delete({ index: 'fifa_matches' });
  }
  await client.indices.create({
    index: 'fifa_matches',
    body: {
      mappings: {
        properties: {
          match_id: { type: 'keyword' },
          match_number: { type: 'integer' },
          team_1: { type: 'keyword' },
          team_2: { type: 'keyword' },
          date: { type: 'date', format: 'yyyy-MM-dd' },
          kickoff_at: { type: 'text' },
          stadium_id: { type: 'keyword' },
          stadium: { type: 'text' },
          city: { type: 'keyword' },
          stage: { type: 'keyword' },
          match_label: { type: 'text' }
        }
      }
    }
  });

  // 2. Stadiums Index
  if (await client.indices.exists({ index: 'fifa_stadiums' })) {
    await client.indices.delete({ index: 'fifa_stadiums' });
  }
  await client.indices.create({
    index: 'fifa_stadiums',
    body: {
      mappings: {
        properties: {
          stadium_id: { type: 'keyword' },
          name: { type: 'text' },
          city: { type: 'keyword' },
          capacity: { type: 'integer' },
          ticket_booking_info: { type: 'text' },
          location: { type: 'geo_point' }
        }
      }
    }
  });

  // 3. Accommodations Index
  if (await client.indices.exists({ index: 'fifa_accommodations' })) {
    await client.indices.delete({ index: 'fifa_accommodations' });
  }
  await client.indices.create({
    index: 'fifa_accommodations',
    body: {
      mappings: {
        properties: {
          hotel_id: { type: 'keyword' },
          name: { type: 'text' },
          stadium_id: { type: 'keyword' },
          location: { type: 'geo_point' },
          price_per_night: { type: 'float' },
          rating: { type: 'float' }
        }
      }
    }
  });

  // 4. Weather Index
  if (await client.indices.exists({ index: 'weather_history' })) {
    await client.indices.delete({ index: 'weather_history' });
  }
  await client.indices.create({
    index: 'weather_history',
    body: {
      mappings: {
        properties: {
          city: { type: 'keyword' },
          month: { type: 'keyword' },
          day: { type: 'integer' },
          avg_temp_f: { type: 'integer' },
          precipitation_chance: { type: 'integer' },
          conditions: { type: 'text' }
        }
      }
    }
  });

  // 5. Team Stats History Index
  if (await client.indices.exists({ index: 'fifa_team_stats_history' })) {
    await client.indices.delete({ index: 'fifa_team_stats_history' });
  }
  await client.indices.create({
    index: 'fifa_team_stats_history',
    body: {
      mappings: {
        properties: {
          version: { type: 'integer' },
          team: { type: 'keyword' },
          continent: { type: 'keyword' },
          is_host: { type: 'integer' },
          goals_scored_last_4y: { type: 'integer' },
          goals_received_last_4y: { type: 'integer' },
          wins_last_4y: { type: 'integer' },
          losses_last_4y: { type: 'integer' },
          draws_last_4y: { type: 'integer' },
          world_cup_titles_before: { type: 'integer' },
          squad_total_market_value_eur: { type: 'double' },
          fifa_rank_pre_tournament: { type: 'integer' },
          fifa_points_pre_tournament: { type: 'float' },
          squad_avg_age: { type: 'float' },
          world_cup_participations_before: { type: 'integer' },
          groups_passed_before: { type: 'integer' },
          round16_before: { type: 'integer' },
          quarterfinals_before: { type: 'integer' },
          semifinals_before: { type: 'integer' },
          finals_before: { type: 'integer' },
          winner: { type: 'integer' },
          finalist: { type: 'integer' },
          semi_finalist: { type: 'integer' },
          quarter_finalist: { type: 'integer' }
        }
      }
    }
  });

  // 6. Team Stats Predicted Index
  if (await client.indices.exists({ index: 'fifa_team_stats_predicted' })) {
    await client.indices.delete({ index: 'fifa_team_stats_predicted' });
  }
  await client.indices.create({
    index: 'fifa_team_stats_predicted',
    body: {
      mappings: {
        properties: {
          version: { type: 'integer' },
          team: { type: 'keyword' },
          continent: { type: 'keyword' },
          is_host: { type: 'integer' },
          goals_scored_last_4y: { type: 'integer' },
          goals_received_last_4y: { type: 'integer' },
          wins_last_4y: { type: 'integer' },
          losses_last_4y: { type: 'integer' },
          draws_last_4y: { type: 'integer' },
          world_cup_titles_before: { type: 'integer' },
          squad_total_market_value_eur: { type: 'double' },
          fifa_rank_pre_tournament: { type: 'integer' },
          fifa_points_pre_tournament: { type: 'float' },
          squad_avg_age: { type: 'float' },
          world_cup_participations_before: { type: 'integer' },
          groups_passed_before: { type: 'integer' },
          round16_before: { type: 'integer' },
          quarterfinals_before: { type: 'integer' },
          semifinals_before: { type: 'integer' },
          finals_before: { type: 'integer' },
          winner: { type: 'integer' },
          finalist: { type: 'integer' },
          semi_finalist: { type: 'integer' },
          quarter_finalist: { type: 'integer' }
        }
      }
    }
  });

  console.log('✅ Indices recreated successfully.');
}

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

interface TeamStatsRaw {
  version: string;
  team: string;
  continent: string;
  is_host: string;
  goals_scored_last_4y: string;
  goals_received_last_4y: string;
  wins_last_4y: string;
  losses_last_4y: string;
  draws_last_4y: string;
  world_cup_titles_before: string;
  squad_total_market_value_eur: string;
  fifa_rank_pre_tournament: string;
  fifa_points_pre_tournament: string;
  squad_avg_age: string;
  world_cup_participations_before: string;
  groups_passed_before: string;
  round16_before: string;
  quarterfinals_before: string;
  semifinals_before: string;
  finals_before: string;
  winner: string;
  finalist: string;
  semi_finalist: string;
  quarter_finalist: string;
}

interface AccomodationGen {
  hotel_id: string;
  name: string;
  stadium_id: string;
  latitude: number;
  longitude: number;
  price_per_night: number;
  rating: number;
}

interface WeatherGen {
  city: string;
  month: string;
  day: number;
  avg_temp_f: number;
  precipitation_chance: number;
  conditions: string;
}

async function main() {
  const dataDir = path.join(__dirname, '../data');

  try {
    console.log('📖 Reading user CSV files...');
    const citiesRaw = await parseCsv<HostCityRaw>(path.join(dataDir, 'host_cities.csv'));
    const teamsRaw = await parseCsv<TeamRaw>(path.join(dataDir, 'teams.csv'));
    const stagesRaw = await parseCsv<StageRaw>(path.join(dataDir, 'tournament_stages.csv'));
    const matchesRaw = await parseCsv<MatchRaw>(path.join(dataDir, 'matches.csv'));
    const previousStatsRaw = await parseCsv<TeamStatsRaw>(path.join(dataDir, 'previous_fifa_stats.csv'));
    const predictedStatsRaw = await parseCsv<TeamStatsRaw>(path.join(dataDir, 'predicted_fifa_stats.csv'));

    if (citiesRaw.length === 0 || matchesRaw.length === 0) {
      console.error('❌ Error: CSV files are missing or empty in data/ folder.');
      process.exit(1);
    }

    // Maps for lookup
    const cityMap = new Map<string, HostCityRaw>();
    citiesRaw.forEach(c => cityMap.set(c.id, c));

    const teamMap = new Map<string, TeamRaw>();
    teamsRaw.forEach(t => teamMap.set(t.id, t));

    const stageMap = new Map<string, StageRaw>();
    stagesRaw.forEach(s => stageMap.set(s.id, s));

    // Recreate index mappings
    await createIndices();

    // 1. Index Venues / Stadiums
    console.log('🏟️  Processing Stadiums...');
    const stadiumsOps: any[] = [];
    const jsonStadiums: Record<string, any> = {};
    const generatedAccommodations: AccomodationGen[] = [];
    const generatedWeather: WeatherGen[] = [];

    let hotelCounter = 1;

    for (const city of citiesRaw) {
      const matchCityName = city.city_name;
      const stadiumDetails = STADIUM_DATA[matchCityName] || {
        lat: 38.0, 
        lon: -97.0, 
        capacity: 65000, 
        ticketInfo: "Official tickets at fifa.com/tickets."
      };

      const sId = `S_${city.id}`;

      // Add stadium bulk operation
      stadiumsOps.push({ index: { _index: 'fifa_stadiums', _id: sId } });
      const stadiumObj = {
        stadium_id: sId,
        name: city.venue_name,
        city: matchCityName,
        capacity: stadiumDetails.capacity,
        ticket_booking_info: stadiumDetails.ticketInfo,
        location: {
          lat: stadiumDetails.lat,
          lon: stadiumDetails.lon
        }
      };
      stadiumsOps.push(stadiumObj);
      
      // Keep for frontend JSON
      jsonStadiums[sId] = {
        stadium_id: sId,
        name: city.venue_name,
        city: matchCityName,
        capacity: stadiumDetails.capacity,
        ticket_booking_info: stadiumDetails.ticketInfo,
        latitude: stadiumDetails.lat,
        longitude: stadiumDetails.lon
      };

      // Generate 3 nearby hotels for each stadium
      const hotelBrands = ["Grand Plaza", "City Center Suites", "Airport Express", "Boutique Airbnb", "Garden Inn"];
      for (let i = 0; i < 3; i++) {
        const latOffset = (Math.random() - 0.5) * 0.04;
        const lonOffset = (Math.random() - 0.5) * 0.04;
        const rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));
        const price = Math.round(80 + Math.random() * 250);
        const name = `${city.city_name} ${hotelBrands[(hotelCounter + i) % hotelBrands.length]}`;

        generatedAccommodations.push({
          hotel_id: `H_${hotelCounter}`,
          name,
          stadium_id: sId,
          latitude: parseFloat((stadiumDetails.lat + latOffset).toFixed(6)),
          longitude: parseFloat((stadiumDetails.lon + lonOffset).toFixed(6)),
          price_per_night: price,
          rating
        });
        hotelCounter++;
      }

      // Generate Weather Profile Records (simulate historical aggregate records for June & July days)
      const weatherProfile = WEATHER_PROFILES[matchCityName] || {
        June: { temp: 75, precip: 20, cond: "Clear and Pleasant" },
        July: { temp: 80, precip: 25, cond: "Sunny and Warm" }
      };

      for (const month of ["June", "July"] as const) {
        const profile = weatherProfile[month];
        for (const day of [10, 15, 20, 25]) {
          const tempVar = Math.round((Math.random() - 0.5) * 6);
          const precipVar = Math.round((Math.random() - 0.5) * 10);
          generatedWeather.push({
            city: matchCityName,
            month,
            day,
            avg_temp_f: profile.temp + tempVar,
            precipitation_chance: Math.max(0, Math.min(100, profile.precip + precipVar)),
            conditions: profile.cond
          });
        }
      }
    }

    if (stadiumsOps.length > 0) {
      await client.bulk({ refresh: true, operations: stadiumsOps });
      console.log(`✅ Loaded ${citiesRaw.length} enriched stadiums to Elasticsearch.`);
    }

    // 2. Index Dynamic Accommodations
    console.log('🏨 Generating and indexing Accommodations...');
    const accommodationsOps = generatedAccommodations.flatMap((h) => [
      { index: { _index: 'fifa_accommodations', _id: h.hotel_id } },
      {
        hotel_id: h.hotel_id,
        name: h.name,
        stadium_id: h.stadium_id,
        location: {
          lat: h.latitude,
          lon: h.longitude
        },
        price_per_night: h.price_per_night,
        rating: h.rating
      }
    ]);
    if (accommodationsOps.length > 0) {
      await client.bulk({ refresh: true, operations: accommodationsOps });
      console.log(`✅ Generated and loaded ${generatedAccommodations.length} local hotels near venues.`);
      
      // Write accommodations to CSV file
      const headers = "hotel_id,name,stadium_id,latitude,longitude,price_per_night,rating\n";
      const rows = generatedAccommodations.map(h => 
        `"${h.hotel_id}","${h.name}","${h.stadium_id}",${h.latitude},${h.longitude},${h.price_per_night},${h.rating}`
      ).join("\n");
      fs.writeFileSync(path.join(dataDir, 'accommodations.csv'), headers + rows);
      console.log('💾 Wrote accommodations to data/accommodations.csv');
    }

    // 3. Index Dynamic Weather History
    console.log('🌦️  Generating and indexing Weather aggregates...');
    const weatherOps = generatedWeather.flatMap((w, idx) => [
      { index: { _index: 'weather_history', _id: `W_${idx}` } },
      {
        city: w.city,
        month: w.month,
        day: w.day,
        avg_temp_f: w.avg_temp_f,
        precipitation_chance: w.precipitation_chance,
        conditions: w.conditions
      }
    ]);
    if (weatherOps.length > 0) {
      await client.bulk({ refresh: true, operations: weatherOps });
      console.log(`✅ Generated and loaded ${generatedWeather.length} weather aggregates.`);

      const headers = "city,month,day,avg_temp_f,precipitation_chance,conditions\n";
      const rows = generatedWeather.map(w => 
        `"${w.city}","${w.month}",${w.day},${w.avg_temp_f},${w.precipitation_chance},"${w.conditions}"`
      ).join("\n");
      fs.writeFileSync(path.join(dataDir, 'weather.csv'), headers + rows);
      console.log('💾 Wrote weather history to data/weather.csv');
    }

    // 4. Index Match Schedules (Resolving references)
    console.log('⚽ Processing Matches...');
    const matchesOps: any[] = [];
    const jsonMatches: any[] = [];

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

      const matchDateStr = match.kickoff_at ? match.kickoff_at.split(' ')[0] : '2026-06-11';
      const city_name = cityDetails ? cityDetails.city_name : 'Unknown City';
      const venue_name = cityDetails ? cityDetails.venue_name : 'Unknown Venue';
      const sId = cityDetails ? `S_${cityDetails.id}` : 'Unknown';
      const mId = `M_${match.id}`;

      matchesOps.push({ index: { _index: 'fifa_matches', _id: mId } });
      const matchDoc = {
        match_id: mId,
        match_number: parseInt(match.match_number, 10) || parseInt(match.id, 10),
        team_1: team1,
        team_2: team2,
        date: matchDateStr,
        kickoff_at: match.kickoff_at,
        stadium_id: sId,
        stadium: venue_name,
        city: city_name,
        stage: stageDetails ? stageDetails.stage_name : 'Group Stage',
        match_label: match.match_label
      };
      matchesOps.push(matchDoc);

      jsonMatches.push({
        match_id: mId,
        team_1: team1,
        team_2: team2,
        date: matchDateStr,
        stadium_id: sId,
        city: city_name
      });
    }

    if (matchesOps.length > 0) {
      await client.bulk({ refresh: true, operations: matchesOps });
      console.log(`✅ Loaded ${matchesRaw.length} match fixtures successfully.`);
    }

    // Helper to format stats document
    const mapStatsDoc = (r: TeamStatsRaw) => ({
      version: parseInt(r.version, 10) || 2026,
      team: r.team,
      continent: r.continent,
      is_host: parseInt(r.is_host, 10) || 0,
      goals_scored_last_4y: parseInt(r.goals_scored_last_4y, 10) || 0,
      goals_received_last_4y: parseInt(r.goals_received_last_4y, 10) || 0,
      wins_last_4y: parseInt(r.wins_last_4y, 10) || 0,
      losses_last_4y: parseInt(r.losses_last_4y, 10) || 0,
      draws_last_4y: parseInt(r.draws_last_4y, 10) || 0,
      world_cup_titles_before: parseInt(r.world_cup_titles_before, 10) || 0,
      squad_total_market_value_eur: parseFloat(r.squad_total_market_value_eur) || 0,
      fifa_rank_pre_tournament: parseInt(r.fifa_rank_pre_tournament, 10) || 0,
      fifa_points_pre_tournament: parseFloat(r.fifa_points_pre_tournament) || 0,
      squad_avg_age: parseFloat(r.squad_avg_age) || 0,
      world_cup_participations_before: parseInt(r.world_cup_participations_before, 10) || 0,
      groups_passed_before: parseInt(r.groups_passed_before, 10) || 0,
      round16_before: parseInt(r.round16_before, 10) || 0,
      quarterfinals_before: parseInt(r.quarterfinals_before, 10) || 0,
      semifinals_before: parseInt(r.semifinals_before, 10) || 0,
      finals_before: parseInt(r.finals_before, 10) || 0,
      winner: parseInt(r.winner, 10) || 0,
      finalist: parseInt(r.finalist, 10) || 0,
      semi_finalist: parseInt(r.semi_finalist, 10) || 0,
      quarter_finalist: parseInt(r.quarter_finalist, 10) || 0
    });

    // 5. Index Team Stats History
    console.log('📈 Indexing Team Stats History...');
    const historyOps = previousStatsRaw.flatMap((r, idx) => [
      { index: { _index: 'fifa_team_stats_history', _id: `H_STATS_${idx}` } },
      mapStatsDoc(r)
    ]);
    if (historyOps.length > 0) {
      await client.bulk({ refresh: true, operations: historyOps });
      console.log(`✅ Loaded ${previousStatsRaw.length} historical team stats records.`);
    }

    // 6. Index Predicted Team Stats
    console.log('🔮 Indexing Predicted Team Stats...');
    const predictedOps = predictedStatsRaw.flatMap((r, idx) => [
      { index: { _index: 'fifa_team_stats_predicted', _id: `P_STATS_${idx}` } },
      mapStatsDoc(r)
    ]);
    const jsonStats: Record<string, any> = {};
    predictedStatsRaw.forEach((r) => {
      // Map names like "United States" to "USA" for frontend lookup matches
      const teamKey = r.team === "United States" ? "USA" : r.team;
      jsonStats[teamKey] = mapStatsDoc(r);
    });

    if (predictedOps.length > 0) {
      await client.bulk({ refresh: true, operations: predictedOps });
      console.log(`✅ Loaded ${predictedStatsRaw.length} predicted team stats records.`);
    }

    // 7. Structure weather history object for frontend
    const jsonWeather: Record<string, Record<string, any>> = {};
    for (const w of generatedWeather) {
      if (!jsonWeather[w.city]) {
        jsonWeather[w.city] = {};
      }
      if (!jsonWeather[w.city][w.month]) {
        jsonWeather[w.city][w.month] = {
          city: w.city,
          month: w.month,
          avg_temp_f: w.avg_temp_f,
          precipitation_chance: w.precipitation_chance,
          conditions: w.conditions
        };
      }
    }

    // Write database export directly into React frontend
    const frontendSrcDir = path.join(__dirname, '../frontend/src');
    if (fs.existsSync(frontendSrcDir)) {
      const dataExport = {
        matches: jsonMatches,
        stadiums: jsonStadiums,
        accommodations: generatedAccommodations,
        weather: jsonWeather,
        teamStats: jsonStats
      };
      fs.writeFileSync(
        path.join(frontendSrcDir, 'data.json'),
        JSON.stringify(dataExport, null, 2)
      );
      console.log('💾 Compiled and saved real database source file to frontend/src/data.json!');
    } else {
      console.warn('⚠️ Warning: frontend/src directory not found. Skipping data.json copy.');
    }

    console.log('🎉 Ingestion of actual FIFA 2026 datasets completed successfully!');

  } catch (error) {
    console.error('💥 Critical Ingestion Error:', error);
    process.exit(1);
  }
}

main();
