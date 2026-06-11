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
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const elasticsearch_1 = require("@elastic/elasticsearch");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ELASTICSEARCH_URL = process.env.ELLASTICSEARCH_URL || process.env.ELASTICSEARCH_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;
// Check if credentials are set (fallback to log warnings if running standalone)
const isConfigured = ELASTICSEARCH_URL && ELASTICSEARCH_API_KEY &&
    !ELASTICSEARCH_URL.includes('your-serverless-elasticsearch-url') &&
    !ELASTICSEARCH_API_KEY.includes('your-elasticsearch-api-key');
let esClient = null;
if (isConfigured) {
    esClient = new elasticsearch_1.Client({
        node: ELASTICSEARCH_URL,
        auth: {
            apiKey: ELASTICSEARCH_API_KEY || ''
        }
    });
}
else {
    console.warn('⚠️ Warning: Elasticsearch credentials not configured. MCP tools will return mock data.');
}
const STADIUM_COORDINATES = {
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
const server = new index_js_1.Server({
    name: 'fifa-match-day-planner-mcp',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {}
    }
});
// Register Tool List
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'get_match_schedule',
                description: 'Search for FIFA 2026 World Cup matches by teams playing or city.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        teams: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Optional list of team names (e.g. ["Argentina", "France"])'
                        },
                        city: {
                            type: 'string',
                            description: 'Optional city name (e.g. "Miami", "Los Angeles")'
                        }
                    }
                }
            },
            {
                name: 'get_stadium_and_tickets',
                description: 'Get details about a stadium capacity, location coordinates, and ticket booking info.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        stadium_name: {
                            type: 'string',
                            description: 'Name of the stadium (e.g. "SoFi Stadium")'
                        },
                        stadium_id: {
                            type: 'string',
                            description: 'Optional stadium ID (e.g. "S1")'
                        }
                    },
                    required: ['stadium_name']
                }
            },
            {
                name: 'find_nearby_accommodations',
                description: 'Find accommodations (hotels, B&Bs) near a specific stadium using geo-distance search, sorted by proximity.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        latitude: {
                            type: 'number',
                            description: 'Latitude of the stadium'
                        },
                        longitude: {
                            type: 'number',
                            description: 'Longitude of the stadium'
                        },
                        stadium_id: {
                            type: 'string',
                            description: 'Optional stadium ID to fallback to database location lookup'
                        },
                        max_distance_km: {
                            type: 'number',
                            description: 'Max radius to search (defaults to 15km)',
                            default: 15
                        }
                    },
                    required: []
                }
            },
            {
                name: 'find_nearby_hospitals',
                description: 'Find hospitals near a specific location using geo-distance search, sorted by proximity.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        latitude: {
                            type: 'number',
                            description: 'Latitude'
                        },
                        longitude: {
                            type: 'number',
                            description: 'Longitude'
                        },
                        stadium_id: {
                            type: 'string',
                            description: 'Optional stadium ID to auto-resolve coordinates'
                        },
                        max_distance_km: {
                            type: 'number',
                            description: 'Max radius to search (defaults to 15km)',
                            default: 15
                        }
                    },
                    required: []
                }
            },
            {
                name: 'predict_weather_conditions',
                description: 'Aggregate historical weather data for a city and month using ES|QL query to predict match day weather.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        city: {
                            type: 'string',
                            description: 'City of the match (e.g. "Miami")'
                        },
                        month: {
                            type: 'string',
                            description: 'Month of the match (e.g. "June", "July")'
                        }
                    },
                    required: ['city', 'month']
                }
            },
            {
                name: 'calculate_hotel_eta',
                description: 'Calculate walking and driving distance and ETA between a hotel and a stadium.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        hotel_lat: { type: 'number' },
                        hotel_lon: { type: 'number' },
                        stadium_lat: { type: 'number' },
                        stadium_lon: { type: 'number' }
                    },
                    required: ['hotel_lat', 'hotel_lon', 'stadium_lat', 'stadium_lon']
                }
            },
            {
                name: 'get_team_historical_stats',
                description: 'Get historical FIFA World Cup statistics for a specific team (goals, wins, titles, etc. from 2002-2022).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        team: {
                            type: 'string',
                            description: 'Name of the country/team (e.g. "Argentina", "Brazil")'
                        },
                        year: {
                            type: 'number',
                            description: 'Optional specific tournament year (e.g. 2002, 2006, 2010, 2014, 2018, 2022)'
                        }
                    },
                    required: ['team']
                }
            },
            {
                name: 'get_team_predicted_stats',
                description: 'Get predicted FIFA World Cup 2026 statistics for a team (rank, market value, squad age, goals scored, etc.).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        team: {
                            type: 'string',
                            description: 'Name of the country/team (e.g. "USA", "France", "Germany")'
                        }
                    },
                    required: ['team']
                }
            }
        ]
    };
});
// Helper: Normalize team names to match database (case-insensitive search)
function normalizeTeam(team) {
    if (!team)
        return team;
    const t = team.trim().toLowerCase();
    // Custom mappings for common alternatives
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
    // Fallback to title case
    return team.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
// Helper: Get team name used in historical and predicted stats databases
function getStatsTeamName(normalizedTeam) {
    if (!normalizedTeam)
        return normalizedTeam;
    if (normalizedTeam === 'USA')
        return 'United States';
    if (normalizedTeam === 'IR Iran')
        return 'Iran';
    if (normalizedTeam === "Côte d'Ivoire")
        return 'Ivory Coast';
    if (normalizedTeam === 'Cabo Verde')
        return 'Cape Verde';
    if (normalizedTeam === 'Curaçao')
        return 'Cura?o';
    return normalizedTeam;
}
// Helper: Normalize city names to match database (case-insensitive search)
function normalizeCity(city) {
    if (!city)
        return city;
    const c = city.trim().toLowerCase();
    // Custom mappings for common alternatives
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
    // Fallback to title case
    return city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
// Helper: Normalize month names to match database
function normalizeMonth(month) {
    if (!month)
        return month;
    const m = month.trim().toLowerCase();
    if (m === 'june' || m === 'jun')
        return 'June';
    if (m === 'july' || m === 'jul')
        return 'July';
    // Fallback to title case
    return month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
}
// Helper: Haversine distance formula (in km)
function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}
// Register Tool Execution Handler
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        // ----------------------------------------------------
        // Tool: get_match_schedule
        // ----------------------------------------------------
        if (name === 'get_match_schedule') {
            const rawTeams = args?.teams || [];
            const teams = rawTeams.map(t => normalizeTeam(t) || t);
            const city = normalizeCity(args?.city);
            if (!esClient) {
                // Fallback Mock Data
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                matches: [
                                    { match_id: 'M2', team_1: 'Argentina', team_2: 'France', date: '2026-06-15', stadium_id: 'S2', city: 'Miami' },
                                    { match_id: 'M7', team_1: 'Argentina', team_2: 'Brazil', date: '2026-07-02', stadium_id: 'S2', city: 'Miami' }
                                ]
                            }, null, 2)
                        }
                    ]
                };
            }
            const must = [];
            if (teams && teams.length > 0) {
                must.push({
                    bool: {
                        should: [
                            { terms: { team_1: teams } },
                            { terms: { team_2: teams } }
                        ]
                    }
                });
            }
            if (city) {
                must.push({ match: { city: city } });
            }
            const response = await esClient.search({
                index: 'fifa_matches_complete',
                body: {
                    query: must.length > 0 ? { bool: { must } } : { match_all: {} }
                }
            });
            const hits = response.hits.hits.map((hit) => hit._source);
            return {
                content: [{ type: 'text', text: JSON.stringify({ matches: hits }, null, 2) }]
            };
        }
        // ----------------------------------------------------
        // Tool: get_stadium_and_tickets
        // ----------------------------------------------------
        if (name === 'get_stadium_and_tickets') {
            const stadiumName = args?.stadium_name;
            if (!esClient) {
                // Fallback Mock Data
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                stadium_id: 'S2',
                                name: 'Hard Rock Stadium',
                                city: 'Miami',
                                capacity: 65326,
                                ticket_booking_info: 'Official ticket booking via fifa.com/tickets. VIP and hospitality packages available at hardrockstadium.com.',
                                location: { lat: 25.958, lon: -80.2389 }
                            })
                        }
                    ]
                };
            }
            const response = await esClient.search({
                index: 'fifa_stadiums',
                body: {
                    query: {
                        match: { name: stadiumName }
                    }
                }
            });
            if (response.hits.hits.length === 0) {
                return {
                    content: [{ type: 'text', text: `Stadium '${stadiumName}' not found.` }],
                    isError: true
                };
            }
            const stadium = response.hits.hits[0]._source;
            return {
                content: [{ type: 'text', text: JSON.stringify(stadium, null, 2) }]
            };
        }
        // ----------------------------------------------------
        // Tool: find_nearby_accommodations
        // ----------------------------------------------------
        if (name === 'find_nearby_accommodations') {
            let lat = args?.latitude;
            let lon = args?.longitude;
            const stadiumId = args?.stadium_id;
            const maxDistance = args?.max_distance_km || 15;
            if (!lat || !lon) {
                if (stadiumId && STADIUM_COORDINATES[stadiumId]) {
                    lat = STADIUM_COORDINATES[stadiumId].lat;
                    lon = STADIUM_COORDINATES[stadiumId].lon;
                }
                else {
                    return { content: [{ type: 'text', text: 'Error: Must provide latitude/longitude or a valid stadium_id.' }], isError: true };
                }
            }
            if (!esClient) {
                // Fallback Mock Data
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                accommodations: [
                                    { hotel_id: 'H4', name: 'Stadium Hotel Miami', price_per_night: 180, rating: 4.2, location: { lat: 25.9745, lon: -80.2223 }, distance_km: 2.4 },
                                    { hotel_id: 'H5', name: 'Stadium View Villa B&B', price_per_night: 120, rating: 3.9, location: { lat: 25.9502, lon: -80.2451 }, distance_km: 1.0 },
                                    { hotel_id: 'H6', name: 'Seminole Hard Rock Hotel', price_per_night: 350, rating: 4.8, location: { lat: 26.0409, lon: -80.2104 }, distance_km: 9.6 }
                                ]
                            }, null, 2)
                        }
                    ]
                };
            }
            const response = await esClient.search({
                index: 'fifa_accommodations',
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
            const hotels = response.hits.hits.map((hit) => ({
                ...hit._source,
                distance_km: parseFloat(hit.sort[0].toFixed(2))
            }));
            return {
                content: [{ type: 'text', text: JSON.stringify({ accommodations: hotels }, null, 2) }]
            };
        }
        // ----------------------------------------------------
        // Tool: find_nearby_hospitals
        // ----------------------------------------------------
        if (name === 'find_nearby_hospitals') {
            let lat = args?.latitude;
            let lon = args?.longitude;
            const stadiumId = args?.stadium_id;
            const maxDistance = args?.max_distance_km || 15;
            if (!lat || !lon) {
                if (stadiumId && STADIUM_COORDINATES[stadiumId]) {
                    lat = STADIUM_COORDINATES[stadiumId].lat;
                    lon = STADIUM_COORDINATES[stadiumId].lon;
                }
                else {
                    return { content: [{ type: 'text', text: 'Error: Must provide latitude/longitude or a valid stadium_id.' }], isError: true };
                }
            }
            if (!esClient) {
                return {
                    content: [{ type: 'text', text: 'Error: Elasticsearch client not initialized.' }],
                    isError: true
                };
            }
            const response = await esClient.search({
                index: 'fifa_hospitals',
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
            const hospitals = response.hits.hits.map((hit) => ({
                ...hit._source,
                distance_km: parseFloat(hit.sort[0].toFixed(2))
            }));
            return {
                content: [{ type: 'text', text: JSON.stringify({ hospitals }, null, 2) }]
            };
        }
        // ----------------------------------------------------
        // Tool: predict_weather_conditions
        // ----------------------------------------------------
        if (name === 'predict_weather_conditions') {
            const city = normalizeCity(args?.city) || args?.city;
            const month = normalizeMonth(args?.month) || args?.month;
            if (!esClient) {
                // Fallback Mock Data
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                weather_predictions: [
                                    { conditions: 'Humid and Rainy', avg_temp: 86, avg_precipitation: 40 },
                                    { conditions: 'Humid and Thunderstorms', avg_temp: 88, avg_precipitation: 50 }
                                ]
                            }, null, 2)
                        }
                    ]
                };
            }
            // Execute ES|QL Query to aggregate weather averages by condition
            const esqlQuery = `
        FROM weather_history
        | WHERE city == "${city}" AND month == "${month}"
        | STATS avg_temp = ROUND(AVG(avg_temp_f)), avg_precip = ROUND(AVG(precipitation_chance)) BY conditions
        | LIMIT 10
      `;
            try {
                const response = await esClient.esql.query({
                    body: { query: esqlQuery }
                });
                // Format ES|QL Response columns & values
                const columns = response.columns?.map((c) => c.name) || [];
                const rows = response.values || [];
                const results = rows.map((row) => {
                    const item = {};
                    columns.forEach((colName, idx) => {
                        item[colName] = row[idx];
                    });
                    return item;
                });
                return {
                    content: [{ type: 'text', text: JSON.stringify({ weather_predictions: results }, null, 2) }]
                };
            }
            catch (err) {
                console.error('ES|QL Error, falling back to standard search:', err.message);
                // Fallback if ES|QL fails on older elastic installations
                const response = await esClient.search({
                    index: 'weather_history',
                    body: {
                        query: {
                            bool: {
                                must: [
                                    { match: { city } },
                                    { match: { month } }
                                ]
                            }
                        }
                    }
                });
                const hits = response.hits.hits.map((hit) => hit._source);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ weather_predictions: hits }, null, 2) }]
                };
            }
        }
        // ----------------------------------------------------
        // Tool: calculate_hotel_eta
        // ----------------------------------------------------
        if (name === 'calculate_hotel_eta') {
            const hLat = args?.hotel_lat;
            const hLon = args?.hotel_lon;
            const sLat = args?.stadium_lat;
            const sLon = args?.stadium_lon;
            const distanceKm = getDistanceKm(hLat, hLon, sLat, sLon);
            // Walking ETA: avg speed of 5 km/h
            const walkingMin = Math.round((distanceKm / 5) * 60);
            // Driving ETA: avg speed of 40 km/h in city traffic, + buffer
            const drivingMin = Math.round((distanceKm / 40) * 60) + 5;
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            distance_km: parseFloat(distanceKm.toFixed(2)),
                            driving_eta_minutes: drivingMin,
                            walking_eta_minutes: walkingMin
                        })
                    }
                ]
            };
        }
        // ----------------------------------------------------
        // Tool: get_team_historical_stats
        // ----------------------------------------------------
        if (name === 'get_team_historical_stats') {
            const normalizedTeam = normalizeTeam(args?.team) || args?.team;
            const team = getStatsTeamName(normalizedTeam) || normalizedTeam;
            const year = args?.year;
            if (!esClient) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                historical_stats: [
                                    { version: 2022, team, wins_last_4y: 33, losses_last_4y: 4, goals_scored_last_4y: 98, world_cup_titles_before: 2 }
                                ]
                            }, null, 2)
                        }
                    ]
                };
            }
            const must = [{ match: { team } }];
            if (year) {
                must.push({ term: { version: year } });
            }
            const response = await esClient.search({
                index: 'fifa_team_stats_history',
                body: {
                    query: { bool: { must } },
                    sort: [{ version: 'desc' }]
                }
            });
            const hits = response.hits.hits.map((hit) => hit._source);
            return {
                content: [{ type: 'text', text: JSON.stringify({ historical_stats: hits }, null, 2) }]
            };
        }
        // ----------------------------------------------------
        // Tool: get_team_predicted_stats
        // ----------------------------------------------------
        if (name === 'get_team_predicted_stats') {
            const normalizedTeam = normalizeTeam(args?.team) || args?.team;
            const team = getStatsTeamName(normalizedTeam) || normalizedTeam;
            if (!esClient) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                version: 2026,
                                team,
                                fifa_rank_pre_tournament: 5,
                                squad_total_market_value_eur: 800000000,
                                squad_avg_age: 26.5
                            })
                        }
                    ]
                };
            }
            const response = await esClient.search({
                index: 'fifa_team_stats_predicted',
                body: {
                    query: {
                        match: { team }
                    }
                }
            });
            if (response.hits.hits.length === 0) {
                return {
                    content: [{ type: 'text', text: `No predictions found for team '${team}'.` }],
                    isError: true
                };
            }
            const stats = response.hits.hits[0]._source;
            return {
                content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }]
            };
        }
        return {
            content: [{ type: 'text', text: `Tool '${name}' not implemented.` }],
            isError: true
        };
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `Error executing tool: ${error.message}` }],
            isError: true
        };
    }
});
// Run MCP Server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 FIFA 2026 Match Day MCP Server running on STDIO');
}
main().catch((error) => {
    console.error('💥 Fatal error starting MCP Server:', error);
    process.exit(1);
});
