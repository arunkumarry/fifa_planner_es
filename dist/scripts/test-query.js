"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const elasticsearch_1 = require("@elastic/elasticsearch");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.join(__dirname, '../.env') });
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;
if (!ELASTICSEARCH_URL || !ELASTICSEARCH_API_KEY) {
    console.error("Missing ELASTICSEARCH_URL or ELASTICSEARCH_API_KEY in .env");
    process.exit(1);
}
const client = new elasticsearch_1.Client({
    node: ELASTICSEARCH_URL,
    auth: {
        apiKey: ELASTICSEARCH_API_KEY
    }
});
// Helper: Normalize team names to match database (case-insensitive search)
function normalizeTeam(team) {
    if (!team)
        return team;
    const t = team.trim().toLowerCase();
    if (t === 'usa' || t === 'united states' || t === 'us' || t === 'america' || t === 'united states of america') {
        return 'USA';
    }
    if (t === 'iran' || t === 'ir iran') {
        return 'IR Iran';
    }
    if (t === 'cote d\'ivoire' || t === 'cote divoire' || t === 'ivory coast' || t === 'côte d\'ivoire') {
        return "Côte d'Ivoire";
    }
    if (t === 'curacao' || t === 'curaçao') {
        return 'Curaçao';
    }
    if (t === 'cape verde' || t === 'cabo verde') {
        return 'Cabo Verde';
    }
    if (t === 'south korea' || t === 'korea' || t === 'rep of korea' || t === 'republic of korea') {
        return 'South Korea';
    }
    if (t === 'south africa') {
        return 'South Africa';
    }
    if (t === 'saudi arabia' || t === 'saudi') {
        return 'Saudi Arabia';
    }
    if (t === 'new zealand') {
        return 'New Zealand';
    }
    const teams = [
        "Mexico", "South Africa", "South Korea", "Canada", "Qatar", "Switzerland",
        "Brazil", "Morocco", "Haiti", "Scotland", "USA", "Paraguay", "Australia",
        "Germany", "Curaçao", "Côte d'Ivoire", "Ecuador", "Netherlands", "Japan",
        "Tunisia", "Belgium", "Egypt", "IR Iran", "New Zealand", "Spain", "Cabo Verde",
        "Saudi Arabia", "Uruguay", "France", "Senegal", "Norway", "Argentina",
        "Algeria", "Austria", "Jordan", "Portugal", "Uzbekistan", "Colombia",
        "England", "Croatia", "Ghana", "Panama"
    ];
    const found = teams.find(item => item.toLowerCase() === t);
    if (found)
        return found;
    return team.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
// Helper: Normalize city names to match database (case-insensitive search)
function normalizeCity(city) {
    if (!city)
        return city;
    const c = city.trim().toLowerCase();
    if (c === 'new york' || c === 'new jersey' || c === 'ny' || c === 'nj' || c === 'ny/nj' || c === 'new york new jersey' || c === 'new york/new jersey') {
        return 'New York/New Jersey';
    }
    if (c === 'san francisco' || c === 'sf' || c === 'bay area' || c === 'san francisco bay area') {
        return 'San Francisco Bay Area';
    }
    if (c === 'la' || c === 'los angeles') {
        return 'Los Angeles';
    }
    if (c === 'kc' || c === 'kansas city') {
        return 'Kansas City';
    }
    if (c === 'mexico city' || c === 'cdmx') {
        return 'Mexico City';
    }
    const cities = [
        "Atlanta", "Boston", "Dallas", "Houston", "Kansas City",
        "Los Angeles", "Miami", "New York/New Jersey", "Philadelphia",
        "San Francisco Bay Area", "Seattle", "Toronto", "Vancouver",
        "Guadalajara", "Mexico City", "Monterrey"
    ];
    const found = cities.find(item => item.toLowerCase() === c);
    if (found)
        return found;
    return city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
async function runTest() {
    console.log("--- TEST 1: Retrieve all matches (match_all) ---");
    const resAll = await client.search({
        index: 'fifa_matches_complete',
        body: {
            query: { match_all: {} },
            size: 5
        }
    });
    console.log(`Total hits: ${resAll.hits.total ? (typeof resAll.hits.total === 'number' ? resAll.hits.total : resAll.hits.total.value) : 0}`);
    console.log("Sample hits:", JSON.stringify(resAll.hits.hits.map(h => h._source), null, 2));
    console.log("\n--- TEST 2: Query by city = 'Miami' using match query ---");
    const normalizedCityVal = normalizeCity("Miami");
    console.log(`Normalized City: ${normalizedCityVal}`);
    const resMiamiMatch = await client.search({
        index: 'fifa_matches_complete',
        body: {
            query: {
                bool: {
                    must: [
                        { match: { city: normalizedCityVal } }
                    ]
                }
            }
        }
    });
    console.log(`Miami match query hits: ${resMiamiMatch.hits.hits.length}`);
    if (resMiamiMatch.hits.hits.length > 0) {
        console.log("Sample Miami hit:", JSON.stringify(resMiamiMatch.hits.hits[0]._source, null, 2));
    }
    console.log("\n--- TEST 3: Query by city = 'Miami' using term query ---");
    const resMiamiTerm = await client.search({
        index: 'fifa_matches_complete',
        body: {
            query: {
                bool: {
                    must: [
                        { term: { city: normalizedCityVal } }
                    ]
                }
            }
        }
    });
    console.log(`Miami term query hits: ${resMiamiTerm.hits.hits.length}`);
    console.log("\n--- TEST 4: Query by team 'USA' using terms query ---");
    const normalizedTeamVal = normalizeTeam("USA") || "USA";
    const resTeamTerms = await client.search({
        index: 'fifa_matches_complete',
        body: {
            query: {
                bool: {
                    must: [
                        {
                            bool: {
                                should: [
                                    { terms: { team_1: [normalizedTeamVal] } },
                                    { terms: { team_2: [normalizedTeamVal] } }
                                ]
                            }
                        }
                    ]
                }
            }
        }
    });
    console.log(`USA terms query hits: ${resTeamTerms.hits.hits.length}`);
}
runTest().catch(console.error);
