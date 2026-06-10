import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;

if (!ELASTICSEARCH_URL || !ELASTICSEARCH_API_KEY) {
  console.error("Missing ELASTICSEARCH_URL or ELASTICSEARCH_API_KEY in .env");
  process.exit(1);
}

const esClient = new Client({
  node: ELASTICSEARCH_URL,
  auth: {
    apiKey: ELASTICSEARCH_API_KEY
  }
});

function normalizeTeam(team: string | undefined): string | undefined {
  if (!team) return team;
  const t = team.trim().toLowerCase();
  
  if (t === 'usa' || t === 'united states' || t === 'us' || t === 'america' || t === 'united states of america') {
    return 'USA';
  }
  return team;
}

function getStatsTeamName(normalizedTeam: string | undefined): string | undefined {
  if (!normalizedTeam) return normalizedTeam;
  if (normalizedTeam === 'USA') return 'United States';
  if (normalizedTeam === 'IR Iran') return 'Iran';
  if (normalizedTeam === "Côte d'Ivoire") return 'Ivory Coast';
  if (normalizedTeam === 'Cabo Verde') return 'Cape Verde';
  if (normalizedTeam === 'Curaçao') return 'Cura?o';
  return normalizedTeam;
}

async function test() {
  console.log("--- TEST 1: get_match_schedule wrapper output ---");
  const response1 = await esClient.search({
    index: 'fifa_matches',
    body: {
      query: { match: { city: 'Miami' } }
    }
  });
  const hits1 = response1.hits.hits.map((hit: any) => hit._source);
  const result1 = { matches: hits1 };
  console.log("Type of result1:", typeof result1);
  console.log("Is array?", Array.isArray(result1));
  console.log("Wrapped result matches length:", result1.matches.length);
  console.log("First wrapped match:", result1.matches[0]);

  console.log("\n--- TEST 2: get_team_predicted_stats with team = 'USA' ---");
  const normalizedTeam = normalizeTeam("USA");
  const team = getStatsTeamName(normalizedTeam);
  console.log(`Input: 'USA' -> Normalized: '${normalizedTeam}' -> Stats Team Name: '${team}'`);

  const response2 = await esClient.search({
    index: 'fifa_team_stats_predicted',
    body: {
      query: {
        match: { team }
      }
    }
  });

  if (response2.hits.hits.length === 0) {
    console.log("No predictions found!");
  } else {
    const stats: any = response2.hits.hits[0]._source;
    console.log("Successfully found predicted stats for USA! Keys:", Object.keys(stats));
    console.log("Fifa Rank:", stats.fifa_rank_pre_tournament);
    console.log("Squad Avg Age:", stats.squad_avg_age);
    console.log("Squad Market Value EUR:", stats.squad_total_market_value_eur);
  }
}

test().catch(console.error);
