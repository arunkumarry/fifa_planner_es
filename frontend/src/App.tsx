import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Calendar, 
  Star, 
  CloudSun, 
  Clock, 
  Compass, 
  Send, 
  Terminal, 
  Ticket, 
  Building, 
  Bot, 
  User, 
  Navigation,
  Wind,
  Gauge
} from 'lucide-react';
import './App.css';

// Datasets defined locally for frontend reactivity (synchronized with the ES indexes)
interface Match {
  match_id: string;
  team_1: string;
  team_2: string;
  date: string;
  stadium_id: string;
  city: string;
}

interface Stadium {
  stadium_id: string;
  name: string;
  city: string;
  capacity: number;
  ticket_booking_info: string;
  latitude: number;
  longitude: number;
}

interface Accommodation {
  hotel_id: string;
  name: string;
  stadium_id: string;
  latitude: number;
  longitude: number;
  price_per_night: number;
  rating: number;
  distance_km?: number;
  driving_eta?: number;
  walking_eta?: number;
}

interface Weather {
  city: string;
  month: string;
  avg_temp_f: number;
  precipitation_chance: number;
  conditions: string;
}

import DATA_SOURCE from './data.json';
const MATCHES: Match[] = DATA_SOURCE.matches || [];
const STADIUMS: Record<string, Stadium> = DATA_SOURCE.stadiums || {};
const ACCOMMODATIONS: Accommodation[] = DATA_SOURCE.accommodations || [];
const WEATHER_HISTORY: Record<string, Record<string, Weather>> = (DATA_SOURCE.weather || {}) as any;

// Helper: Coordinate distance calculation (Haversine in km)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface Message {
  sender: 'user' | 'agent' | 'system';
  text: string;
}

interface ConsoleLog {
  timestamp: string;
  type: 'info' | 'tool-call' | 'tool-return' | 'error';
  text: string;
}

export default function App() {
  const [selectedMatchId, setSelectedMatchId] = useState<string>('M_2'); // Argentina vs France, Miami
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { sender: 'agent', text: 'Hello! I am your FIFA 2026 Match Day AI Planner, connected via MCP to your Elasticsearch Serverless workspace. Which match day can I help you plan?' }
  ]);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState<boolean>(true);
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const consoleLogsRef = useRef<HTMLDivElement>(null);

  // Active match data computed from selected ID
  const activeMatch = MATCHES.find(m => m.match_id === selectedMatchId) || MATCHES[0] || {
    match_id: 'default',
    team_1: 'TBD',
    team_2: 'TBD',
    date: '2026-06-11',
    stadium_id: 'default',
    city: 'Unknown City'
  };
  const activeStadium = STADIUMS[activeMatch.stadium_id] || {
    stadium_id: 'default',
    name: 'TBD Stadium',
    city: activeMatch.city || 'TBD City',
    capacity: 65000,
    ticket_booking_info: 'Official ticketing details at fifa.com/tickets.',
    latitude: 33.9534,
    longitude: -118.3387
  };
  const activeMonth = activeMatch.date && activeMatch.date.split('-')[1] === '06' ? 'June' : 'July';
  const activeWeather = (WEATHER_HISTORY[activeMatch.city] && WEATHER_HISTORY[activeMatch.city][activeMonth]) || {
    city: activeMatch.city,
    month: activeMonth,
    avg_temp_f: 80,
    precipitation_chance: 20,
    conditions: 'Partly Cloudy'
  };

  // Look up stats for teams in the matchup
  const team1Stats = (DATA_SOURCE as any).teamStats?.[activeMatch.team_1];
  const team2Stats = (DATA_SOURCE as any).teamStats?.[activeMatch.team_2];

  // Nearby accommodations calculated relative to current stadium coordinates
  const activeAccommodations = ACCOMMODATIONS
    .filter(acc => acc.stadium_id === activeMatch.stadium_id)
    .map(acc => {
      const distance = getDistanceKm(acc.latitude, acc.longitude, activeStadium.latitude, activeStadium.longitude);
      return {
        ...acc,
        distance_km: parseFloat(distance.toFixed(2)),
        driving_eta: Math.round((distance / 40) * 60) + 5,
        walking_eta: Math.round((distance / 5) * 60)
      };
    })
    .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));

  // Auto scroll elements
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (consoleLogsRef.current) {
      consoleLogsRef.current.scrollTo({
        top: consoleLogsRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [consoleLogs]);

  // Initial developer logging sequence when loading
  useEffect(() => {
    addConsoleLog('info', 'Google Cloud Agent Builder: Initializing Gemini 3.5 Session...');
    addConsoleLog('info', 'Google Cloud Agent Builder: Connecting to Elastic MCP Server at endpoint: mcp://elastic-serverless.local/v1/tools');
    addConsoleLog('tool-call', 'MCP: ListToolsRequestSchema dispatched.');
    addConsoleLog('tool-return', 'MCP: Registered 5 tools successfully: get_match_schedule, get_stadium_and_tickets, find_nearby_accommodations, predict_weather_conditions, calculate_hotel_eta.');
    triggerMatchPlanLogs(selectedMatchId);
  }, []);

  const addConsoleLog = (type: 'info' | 'tool-call' | 'tool-return' | 'error', text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev, { timestamp, type, text }]);
  };

  const triggerMatchPlanLogs = (matchId: string) => {
    const match = MATCHES.find(m => m.match_id === matchId) || MATCHES[0];
    if (!match) return;
    const stadium = STADIUMS[match.stadium_id] || {
      stadium_id: 'default',
      name: 'TBD Stadium',
      city: match.city,
      capacity: 65000,
      ticket_booking_info: 'Official tickets at fifa.com/tickets.',
      latitude: 33.9534,
      longitude: -118.3387
    };
    const month = match.date && match.date.split('-')[1] === '06' ? 'June' : 'July';

    addConsoleLog('info', `GC Agent Loop: Triggering match-day planner update for Match ID: ${matchId} (${match.team_1} vs ${match.team_2})`);
    
    // Simulating MCP tool chain
    setTimeout(() => {
      addConsoleLog('tool-call', `MCP Call: get_match_schedule(teams: ["${match.team_1}", "${match.team_2}"], city: "${match.city}")`);
    }, 400);
    setTimeout(() => {
      addConsoleLog('tool-return', `MCP Response: 1 match found in fifa_matches index. Date: ${match.date}, Stadium ID: ${match.stadium_id}`);
    }, 800);
    
    setTimeout(() => {
      addConsoleLog('tool-call', `MCP Call: get_stadium_and_tickets(stadium_name: "${stadium.name}")`);
    }, 1200);
    setTimeout(() => {
      addConsoleLog('tool-return', `MCP Response: Found stadium in fifa_stadiums. Capacity: ${stadium.capacity}, Coordinates: (${stadium.latitude}, ${stadium.longitude})`);
    }, 1600);

    setTimeout(() => {
      addConsoleLog('tool-call', `MCP Call: find_nearby_accommodations(latitude: ${stadium.latitude}, longitude: ${stadium.longitude})`);
    }, 2000);
    setTimeout(() => {
      addConsoleLog('tool-return', `MCP Response: ES geo_distance query returned 3 hotels within 15km index matching stadium_id: ${match.stadium_id}`);
    }, 2400);

    setTimeout(() => {
      addConsoleLog('tool-call', `MCP Call: predict_weather_conditions(city: "${match.city}", month: "${month}")`);
    }, 2800);
    setTimeout(() => {
      addConsoleLog('tool-return', `MCP Response: ES|QL execution complete. Query: [FROM weather_history WHERE city='${match.city}' AND month='${month}' STATS...] returns avg temp: ${WEATHER_HISTORY[match.city]?.[month]?.avg_temp_f || 80}°F, rain probability: ${WEATHER_HISTORY[match.city]?.[month]?.precipitation_chance || 20}%`);
    }, 3200);
  };

  const handleMatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedMatchId(id);
    triggerMatchPlanLogs(id);
    
    const targetMatch = MATCHES.find(m => m.match_id === id) || MATCHES[0];
    if (!targetMatch) return;
    const targetStadiumName = (STADIUMS[targetMatch.stadium_id] && STADIUMS[targetMatch.stadium_id].name) || 'TBD Venue';
    setChatMessages(prev => [
      ...prev,
      { sender: 'system', text: `Switched dashboard view to ${targetMatch.team_1} vs ${targetMatch.team_2} in ${targetMatch.city}` },
      { sender: 'agent', text: `I've updated the planning dashboard for the ${targetMatch.team_1} vs ${targetMatch.team_2} match at ${targetStadiumName} on ${targetMatch.date}. Let me know if you want accommodation recommendations under a budget, travel ETAs, or ticketing assistance!` }
    ]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const query = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: query }]);
    setChatInput('');

    // Trigger Agent processing log
    addConsoleLog('info', `GC Agent Loop: Received user query: "${query}"`);
    
    // Simulate Agent processing using tools
    setTimeout(() => {
      processAgentResponse(query);
    }, 1000);
  };

  const processAgentResponse = (query: string) => {
    const normalizedQuery = query.toLowerCase();
    let responseText = "";
    
    if (normalizedQuery.includes('hotel') || normalizedQuery.includes('accommodation') || normalizedQuery.includes('stay') || normalizedQuery.includes('sleep')) {
      addConsoleLog('tool-call', `MCP Call: find_nearby_accommodations(latitude: ${activeStadium.latitude}, longitude: ${activeStadium.longitude}, max_distance_km: 15)`);
      
      setTimeout(() => {
        const cheapest = [...activeAccommodations].sort((a,b) => a.price_per_night - b.price_per_night)[0];
        const closest = activeAccommodations[0];
        
        addConsoleLog('tool-return', `MCP Response: Found ${activeAccommodations.length} hotels in proximity. Cheapest: ${cheapest.name} ($${cheapest.price_per_night}), Closest: ${closest.name} (${closest.distance_km}km)`);
        
        responseText = `Based on the accommodations data near ${activeStadium.name} in ${activeMatch.city}, here are your options:
        
1. **Closest Lodging**: **${closest.name}** is only **${closest.distance_km} km** away from the stadium. 
   - 🚗 Driving ETA: **${closest.driving_eta} minutes**
   - 🚶 Walking ETA: **${closest.walking_eta} minutes**
   - 💵 Nightly Rate: **$${closest.price_per_night}**
   - ⭐ Rating: **${closest.rating}/5.0**

2. **Cheapest Lodging**: **${cheapest.name}** is priced at **$${cheapest.price_per_night} per night**, located **${cheapest.distance_km} km** from the stadium (🚗 **${cheapest.driving_eta} mins** ETA).

Would you like me to map out routes or calculate ETAs for another specific hotel?`;
        
        setChatMessages(prev => [...prev, { sender: 'agent', text: responseText }]);
      }, 800);

    } else if (normalizedQuery.includes('weather') || normalizedQuery.includes('rain') || normalizedQuery.includes('forecast') || normalizedQuery.includes('temperature') || normalizedQuery.includes('temp')) {
      addConsoleLog('tool-call', `MCP Call: predict_weather_conditions(city: "${activeMatch.city}", month: "${activeMonth}")`);
      
      setTimeout(() => {
        addConsoleLog('tool-return', `MCP Response: Weather predicted using historical logs. Conditions: ${activeWeather.conditions}, Temp: ${activeWeather.avg_temp_f}°F, Precipitation: ${activeWeather.precipitation_chance}%`);
        
        responseText = `Analyzing historical climate records for ${activeMatch.city} in ${activeMonth}:
- **Average Temperature**: **${activeWeather.avg_temp_f}°F**
- **Chance of Rain**: **${activeWeather.precipitation_chance}%**
- **Typical Conditions**: **${activeWeather.conditions}**

*Match Day Recommendation*: ${activeWeather.precipitation_chance > 30 ? "We recommend bringing a light raincoat/umbrella as afternoon showers are typical during this period." : "Skies are historically clear and dry, perfect weather for a match! Keep hydrated as temperatures can peak."}

Does this help with your travel packing list?`;
        
        setChatMessages(prev => [...prev, { sender: 'agent', text: responseText }]);
      }, 800);

    } else if (normalizedQuery.includes('win') || normalizedQuery.includes('winner') || normalizedQuery.includes('chance') || normalizedQuery.includes('probability') || normalizedQuery.includes('predict') || normalizedQuery.includes('compare') || normalizedQuery.includes('matchup') || normalizedQuery.includes('versus') || normalizedQuery.includes('vs')) {
      addConsoleLog('tool-call', `MCP Call: get_team_predicted_stats(team: "${activeMatch.team_1}")`);
      addConsoleLog('tool-call', `MCP Call: get_team_predicted_stats(team: "${activeMatch.team_2}")`);
      
      setTimeout(() => {
        addConsoleLog('tool-return', `MCP Response: Retrieved 2026 predictions for ${activeMatch.team_1} and ${activeMatch.team_2} successfully.`);
        
        const r1 = team1Stats?.fifa_rank_pre_tournament || 50;
        const r2 = team2Stats?.fifa_rank_pre_tournament || 50;
        const v1 = team1Stats?.squad_total_market_value_eur || 0;
        const v2 = team2Stats?.squad_total_market_value_eur || 0;
        
        let weight1 = 0;
        let weight2 = 0;
        
        if (r1 < r2) weight1 += (r2 - r1) * 0.8;
        else weight2 += (r1 - r2) * 0.8;
        
        if (v1 > v2) weight1 += ((v1 - v2) / 10000000) * 0.15;
        else weight2 += ((v2 - v1) / 10000000) * 0.15;
        
        weight1 += (team1Stats?.world_cup_titles_before || 0) * 5;
        weight2 += (team2Stats?.world_cup_titles_before || 0) * 5;
        
        const baseProb1 = 50 + (weight1 - weight2);
        const prob1 = Math.max(15, Math.min(85, Math.round(baseProb1)));
        const prob2 = 100 - prob1;
        
        const predictedWinner = prob1 > prob2 ? activeMatch.team_1 : activeMatch.team_2;
        const margin = Math.abs(prob1 - prob2);
        const confidence = margin > 20 ? 'Strong Favorite' : margin > 5 ? 'Slight Advantage' : 'Very Even Matchup';
        
        responseText = `Based on the latest pre-tournament FIFA stats and predicted squads, here is the analytical matchup comparison for **${activeMatch.team_1} vs ${activeMatch.team_2}**:
        
- **FIFA Ranking**: **${activeMatch.team_1}** is ranked **#${r1}**, while **${activeMatch.team_2}** is ranked **#${r2}**.
- **Squad Market Value**: 
  - **${activeMatch.team_1}**: €${(v1 / 1000000).toFixed(0)}M
  - **${activeMatch.team_2}**: €${(v2 / 1000000).toFixed(0)}M
- **Historical Titles**: ${activeMatch.team_1} has **${team1Stats?.world_cup_titles_before || 0} titles**, compared to ${activeMatch.team_2}'s **${team2Stats?.world_cup_titles_before || 0} titles**.
- **Recent Goals (Last 4 Years)**: ${activeMatch.team_1} scored **${team1Stats?.goals_scored_last_4y || 0} goals**, compared to ${activeMatch.team_2}'s **${team2Stats?.goals_scored_last_4y || 0} goals**.

🏆 **Calculated Win Probability**:
- **${activeMatch.team_1}**: **${prob1}%**
- **${activeMatch.team_2}**: **${prob2}%**

*Verdict*: **${predictedWinner}** holds a **${confidence}** due to their statistical advantages. However, on match day, anything is possible!

Would you like historical stats from previous World Cups (e.g. 2022) to see their recent head-to-head forms?`;
        
        setChatMessages(prev => [...prev, { sender: 'agent', text: responseText }]);
      }, 800);

    } else if (normalizedQuery.includes('ticket') || normalizedQuery.includes('seats') || normalizedQuery.includes('booking') || normalizedQuery.includes('capacity') || normalizedQuery.includes('book')) {
      addConsoleLog('tool-call', `MCP Call: get_stadium_and_tickets(stadium_name: "${activeStadium.name}")`);
      
      setTimeout(() => {
        addConsoleLog('tool-return', `MCP Response: Stadium details retrieved. Capacity: ${activeStadium.capacity}, Booking info: ${activeStadium.ticket_booking_info}`);
        
        responseText = `Here is the ticketing and seating report for **${activeStadium.name}** in ${activeMatch.city}:
- **Total Seating Capacity**: **${activeStadium.capacity.toLocaleString()} seats**
- **How to Book**: ${activeStadium.ticket_booking_info}

*Pro Tip*: Tickets are sold on a lottery-first basis directly via FIFA. I can trigger a workflow to send you the ticketing link directly if you'd like!`;
        
        setChatMessages(prev => [...prev, { sender: 'agent', text: responseText }]);
      }, 800);

    } else {
      setTimeout(() => {
        responseText = `I can help you plan your Match Day for **${activeMatch.team_1} vs ${activeMatch.team_2}** at ${activeStadium.name}! 

You can ask me questions like:
- *"Where should I stay? Find hotels near the stadium."*
- *"What will the weather be like?"*
- *"How do I book tickets and how many seats are there?"*
- *"What is the travel distance and drive time from Westin Los Angeles Airport?"*`;
        
        setChatMessages(prev => [...prev, { sender: 'agent', text: responseText }]);
      }, 500);
    }
  };

  return (
    <div className="app-container">
      {/* LEFT: AI Chat Agent with Live Developer Console */}
      <aside className="chat-sidebar">
        <div className="chat-header">
          <Bot size={28} className="glow-text" />
          <div>
            <h2>GC AI Assistant</h2>
            <span className="status-indicator">
              <span className="status-dot"></span>
              Connected to Elastic MCP
            </span>
          </div>
        </div>

        <div ref={chatMessagesRef} className="chat-messages">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`message-bubble ${msg.sender}`}>
              {msg.sender === 'agent' && <div className="message-sender-agent"><Bot size={12}/> FIFA Agent</div>}
              {msg.sender === 'user' && <div className="message-sender-user"><User size={12}/> Fan</div>}
              <div className="message-text">{msg.text}</div>
            </div>
          ))}
        </div>

        {/* Live Developer Console visual */}
        {showConsole && (
          <div className="console-container">
            <div className="console-header-bar">
              <span className="console-title-text">
                <Terminal size={14} /> LIVE AGENT LOGS (MCP/ES)
              </span>
              <button 
                onClick={() => setShowConsole(false)} 
                className="console-hide-btn"
              >
                Hide
              </button>
            </div>
            <div ref={consoleLogsRef} className="console-logs-viewport">
              {consoleLogs.map((log, i) => {
                let color = '#a1a1aa';
                if (log.type === 'tool-call') color = '#eab308';
                if (log.type === 'tool-return') color = '#22c55e';
                if (log.type === 'error') color = '#ef4444';
                return (
                  <div key={i} className="console-log-row">
                    <span className="console-log-time">[{log.timestamp}]</span>
                    <span style={{ color }}>{log.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!showConsole && (
          <button 
            onClick={() => setShowConsole(true)} 
            className="console-show-btn"
          >
            <Terminal size={12} /> Show Live Agent Logs
          </button>
        )}

        <form onSubmit={handleSendMessage} className="chat-input-area">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask about accommodations, weather, seats..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button type="submit" className="send-btn">
            <Send size={18} />
          </button>
        </form>
      </aside>

      {/* RIGHT: Live Match Day Planning Dashboard */}
      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="glow-text" style={{ fontSize: '1.8rem', fontWeight: 900 }}>MATCH DAY DESK</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>FIFA World Cup 2026 Fan Service Agent Dashboard</p>
          </div>
          <div>
            <div className="selector-label">Active Match Day</div>
            <select 
              value={selectedMatchId} 
              onChange={handleMatchChange}
              className="match-select"
            >
              {MATCHES.map((m) => (
                <option key={m.match_id} value={m.match_id}>
                  {m.team_1} vs {m.team_2} ({m.city})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="widgets-grid">
          {/* BANNER: Match overview */}
          <div className="glass-card match-banner-card">
            <div className="match-vs-display">
              <div className="team-block">
                <div className="team-name">{activeMatch.team_1}</div>
              </div>
              <div className="vs-badge">VS</div>
              <div className="team-block">
                <div className="team-name">{activeMatch.team_2}</div>
              </div>
            </div>
            <div className="match-meta-info">
              <div className="meta-item city-time">
                <MapPin size={18} color="var(--color-primary)" /> {activeMatch.city}
              </div>
              <div className="meta-item">
                <Calendar size={16} /> {activeMatch.date}
              </div>
              <div className="meta-item">
                <Compass size={16} /> Stadium: {activeStadium.name}
              </div>
            </div>
          </div>

          {/* WIDGET: Team Head-to-Head matchup stats */}
          {(team1Stats || team2Stats) && (
            <div className="glass-card matchup-widget">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '8px' }}>
                <Gauge size={20} color="var(--color-primary)" /> Team Matchup Analytics
              </h3>
              <div className="matchup-metrics-container">
                <div className="matchup-row" style={{ background: 'none', border: 'none', padding: '0 12px 4px 12px' }}>
                  <div className="matchup-team-name glow-text" style={{ textAlign: 'right', marginBottom: 0 }}>{activeMatch.team_1}</div>
                  <div className="matchup-label" style={{ fontWeight: 800, color: '#fff' }}>VS</div>
                  <div className="matchup-team-name glow-text" style={{ textAlign: 'left', marginBottom: 0 }}>{activeMatch.team_2}</div>
                </div>

                <div className="matchup-row">
                  <div className="matchup-val-left">{team1Stats?.fifa_rank_pre_tournament || 'TBD'}</div>
                  <div className="matchup-label">FIFA Rank</div>
                  <div className="matchup-val-right">{team2Stats?.fifa_rank_pre_tournament || 'TBD'}</div>
                </div>

                <div className="matchup-row">
                  <div className="matchup-val-left">
                    {team1Stats?.squad_total_market_value_eur 
                      ? `€${(team1Stats.squad_total_market_value_eur / 1000000).toFixed(0)}M` 
                      : 'TBD'}
                  </div>
                  <div className="matchup-label">Squad Value</div>
                  <div className="matchup-val-right">
                    {team2Stats?.squad_total_market_value_eur 
                      ? `€${(team2Stats.squad_total_market_value_eur / 1000000).toFixed(0)}M` 
                      : 'TBD'}
                  </div>
                </div>

                <div className="matchup-row">
                  <div className="matchup-val-left">{team1Stats?.squad_avg_age ? `${team1Stats.squad_avg_age}y` : 'TBD'}</div>
                  <div className="matchup-label">Avg Age</div>
                  <div className="matchup-val-right">{team2Stats?.squad_avg_age ? `${team2Stats.squad_avg_age}y` : 'TBD'}</div>
                </div>

                <div className="matchup-row">
                  <div className="matchup-val-left">{team1Stats?.goals_scored_last_4y || '0'}</div>
                  <div className="matchup-label">Goals (Last 4y)</div>
                  <div className="matchup-val-right">{team2Stats?.goals_scored_last_4y || '0'}</div>
                </div>

                <div className="matchup-row">
                  <div className="matchup-val-left">{team1Stats?.world_cup_titles_before || '0'}</div>
                  <div className="matchup-label">World Cup Titles</div>
                  <div className="matchup-val-right">{team2Stats?.world_cup_titles_before || '0'}</div>
                </div>
              </div>
            </div>
          )}

          {/* WIDGET: Stadium and seating tickets */}
          <div className="glass-card stadium-widget">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <Ticket size={20} color="var(--color-primary)" /> Stadium Seating & Tickets
            </h3>
            <div className="stadium-graphic">
              <div className="stadium-ring">
                <div className="stadium-field"></div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Total Seating Capacity:</span>
              <span className="stadium-capacity-number">{activeStadium.capacity.toLocaleString()}</span>
            </div>
            <div className="booking-text">
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Ticket Booking Portal:</div>
              {activeStadium.ticket_booking_info}
            </div>
          </div>

          {/* WIDGET: Weather predictions (ES|QL Aggregated) */}
          <div className="glass-card weather-widget">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <CloudSun size={20} color="var(--color-primary)" /> Weather Forecast (ES|QL Aggregates)
            </h3>
            <div className="weather-cards-container">
              <div className="weather-metric-card">
                <span className="weather-metric-label">Historical Temp</span>
                <span className="weather-metric-val glow-text">{activeWeather.avg_temp_f}°F</span>
              </div>
              <div className="weather-metric-card">
                <span className="weather-metric-label">Rain Risk</span>
                <span className="weather-metric-val" style={{ color: activeWeather.precipitation_chance > 30 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {activeWeather.precipitation_chance}%
                </span>
              </div>
              <div className="weather-desc-card">
                <Wind size={20} color="var(--color-primary)" />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Expected Conditions:</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{activeWeather.conditions}</div>
                </div>
              </div>
            </div>
          </div>

          {/* WIDGET: Lodging and ETA planner */}
          <div className="glass-card hotels-widget" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <Building size={20} color="var(--color-primary)" /> Accommodations & Travel ETA (Geo-Sorted)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '-8px' }}>
              Elasticsearch geo-distance query output. Calculated from stadium center: ({activeStadium.latitude}, {activeStadium.longitude})
            </p>
            <div className="hotel-list">
              {activeAccommodations.map((hotel) => (
                <div key={hotel.hotel_id} className="hotel-item">
                  <div className="hotel-info">
                    <h4>{hotel.name}</h4>
                    <div className="hotel-rating-price">
                      <span className="star-rating">
                        <Star size={14} fill="currentColor" /> {hotel.rating}
                      </span>
                      <span>•</span>
                      <span className="hotel-price">${hotel.price_per_night} / night</span>
                      <span>•</span>
                      <span style={{ color: 'var(--color-primary)' }}>{hotel.distance_km} km away</span>
                    </div>
                  </div>
                  <div className="hotel-travel-eta">
                    <div>
                      <span className="eta-badge driving">
                        <Navigation size={12} fill="currentColor" /> Drive: {hotel.driving_eta} mins
                      </span>
                    </div>
                    <div>
                      <span className="eta-badge" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                        <Clock size={12} /> Walk: {hotel.walking_eta} mins
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
