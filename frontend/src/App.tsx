import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Compass, MessageSquare } from 'lucide-react';
import './App.css';

import type { Match, Stadium, Accommodation, Hospital, Weather, Message, ConsoleLog } from './types';
import { getDistanceKm } from './utils/geo';

import { MatchupWidget } from './components/widgets/MatchupWidget';
import { StadiumWidget } from './components/widgets/StadiumWidget';
import { WeatherWidget } from './components/widgets/WeatherWidget';
import { AccommodationsWidget } from './components/widgets/AccommodationsWidget';
import { HospitalsWidget } from './components/widgets/HospitalsWidget';
import { ConsolePanel } from './components/ConsolePanel';
import { ChatPanel } from './components/ChatPanel';

import DATA_SOURCE from './data.json';
const MATCHES: Match[] = DATA_SOURCE.matches || [];
const STADIUMS: Record<string, Stadium> = DATA_SOURCE.stadiums || {};
const ACCOMMODATIONS: Accommodation[] = DATA_SOURCE.accommodations || [];
const HOSPITALS: Hospital[] = (DATA_SOURCE as any).hospitals || [];
const WEATHER_HISTORY: Record<string, Record<string, Weather>> = (DATA_SOURCE.weather || {}) as any;

export default function App() {
  const [selectedMatchId, setSelectedMatchId] = useState<string>('M_2');
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { sender: 'agent', text: 'Hello! I am your FIFA 2026 Match Day AI Planner, connected via MCP to your Elasticsearch Serverless workspace. Which match day can I help you plan?' }
  ]);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState<boolean>(true);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const consoleLogsRef = useRef<HTMLDivElement>(null);

  const activeMatch = MATCHES.find(m => m.match_id === selectedMatchId) || MATCHES[0];
  const activeStadium = STADIUMS[activeMatch.stadium_id] || {
    stadium_id: 'default',
    name: 'TBD Stadium',
    city: activeMatch.city,
    capacity: 65000,
    ticket_booking_info: 'Official tickets at fifa.com/tickets.',
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

  const team1Stats = (DATA_SOURCE as any).teamStats?.[activeMatch.team_1];
  const team2Stats = (DATA_SOURCE as any).teamStats?.[activeMatch.team_2];

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

  const activeHospitals = HOSPITALS
    .filter(h => h.stadium_id === activeMatch.stadium_id)
    .map(h => {
      const distance = h.distance_km !== undefined ? h.distance_km : getDistanceKm(h.latitude, h.longitude, activeStadium.latitude, activeStadium.longitude);
      return {
        ...h,
        distance_km: parseFloat(distance.toFixed(2))
      };
    })
    .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (consoleLogsRef.current) {
      consoleLogsRef.current.scrollTo({ top: consoleLogsRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [consoleLogs]);

  useEffect(() => {
    addConsoleLog('info', 'Google Cloud Agent Builder: Initializing Gemini Session...');
    addConsoleLog('info', 'Google Cloud Agent Builder: Connecting to Elastic MCP Server...');
    triggerMatchPlanLogs(selectedMatchId);
  }, []);

  const addConsoleLog = (type: 'info' | 'tool-call' | 'tool-return' | 'error', text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev, { timestamp, type, text }]);
  };

  const triggerMatchPlanLogs = (matchId: string) => {
    addConsoleLog('info', `Triggering match-day planner update for Match ID: ${matchId}`);
  };

  const handleMatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMatchId = e.target.value;
    setSelectedMatchId(newMatchId);
    triggerMatchPlanLogs(newMatchId);

    const targetMatch = MATCHES.find(m => m.match_id === newMatchId) || MATCHES[0];
    if (!targetMatch) return;
    const targetStadiumName = (STADIUMS[targetMatch.stadium_id] && STADIUMS[targetMatch.stadium_id].name) || 'TBD Venue';
    setChatMessages(prev => [
      ...prev,
      { sender: 'system', text: `Switched dashboard view to ${targetMatch.team_1} vs ${targetMatch.team_2} in ${targetMatch.city}` },
      { sender: 'agent', text: `I've updated the planning dashboard for the ${targetMatch.team_1} vs ${targetMatch.team_2} match at ${targetStadiumName} on ${targetMatch.date}. Let me know if you want accommodation recommendations under a budget, travel ETAs, or ticketing assistance!` }
    ]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatInput('');

    // Let's connect to the real backend!
    try {
      addConsoleLog('tool-call', `Sending message to Vertex AI: "${userMessage}"`);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage, 
          context: {
            activeMatch,
            activeStadium,
            activeMonth
          }
        })
      });

      if (!response.ok) {
        try {
          const errData = await response.json();
          if (errData.logs && Array.isArray(errData.logs)) {
            errData.logs.forEach((log: any) => {
              addConsoleLog(log.type, log.message);
            });
          }
          throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        } catch {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      const data = await response.json();
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((log: { type: any, message: string }) => {
          addConsoleLog(log.type, log.message);
        });
      } else {
        addConsoleLog('tool-return', `Backend replied`);
      }
      setChatMessages(prev => [...prev, { sender: 'agent', text: data.reply }]);
    } catch (err: any) {
      addConsoleLog('error', `Failed to connect to backend: ${err.message}`);
      setChatMessages(prev => [...prev, { sender: 'agent', text: `Sorry, I encountered an error communicating with my backend. Is it running? (${err.message})` }]);
    }
  };

  return (
    <div className="app-container">
      <aside className={`chat-sidebar ${isChatExpanded ? 'expanded' : ''}`}>
        <ChatPanel 
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleSendMessage={handleSendMessage}
          chatMessagesRef={chatMessagesRef}
          onClose={() => setIsChatExpanded(false)}
        />
        <ConsolePanel 
          consoleLogs={consoleLogs}
          showConsole={showConsole}
          setShowConsole={setShowConsole}
          consoleLogsRef={consoleLogsRef}
        />
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="glow-text" style={{ fontSize: '1.8rem', fontWeight: 900 }}>MATCH DAY DESK</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>FIFA World Cup 2026 Fan Service Agent Dashboard</p>
          </div>
          <div className="header-football-container">
            <svg viewBox="0 0 100 100" width="48" height="48" className="rotating-football">
              <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" />
              <polygon points="50,38 60,45 56,57 44,57 40,45" fill="currentColor" />
              <line x1="50" y1="38" x2="50" y2="15" stroke="currentColor" strokeWidth="3" />
              <line x1="60" y1="45" x2="80" y2="35" stroke="currentColor" strokeWidth="3" />
              <line x1="56" y1="57" x2="70" y2="80" stroke="currentColor" strokeWidth="3" />
              <line x1="44" y1="57" x2="30" y2="80" stroke="currentColor" strokeWidth="3" />
              <line x1="40" y1="45" x2="20" y2="35" stroke="currentColor" strokeWidth="3" />
              <polygon points="50,15 42,8 58,8" fill="currentColor" />
              <polygon points="80,35 90,28 85,42" fill="currentColor" />
              <polygon points="70,80 80,85 68,92" fill="currentColor" />
              <polygon points="30,80 20,85 32,92" fill="currentColor" />
              <polygon points="20,35 10,28 15,42" fill="currentColor" />
            </svg>
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
          <div className="glass-card match-banner-card">
            <div className="match-vs-display">
              <div className="team-block"><div className="team-name">{activeMatch.team_1}</div></div>
              <div className="vs-badge">VS</div>
              <div className="team-block"><div className="team-name">{activeMatch.team_2}</div></div>
            </div>
            <div className="match-meta-info">
              <div className="meta-item city-time"><MapPin size={18} color="var(--color-primary)" /> {activeMatch.city}</div>
              <div className="meta-item"><Calendar size={16} /> {activeMatch.date}</div>
              <div className="meta-item"><Compass size={16} /> Stadium: {activeStadium.name}</div>
            </div>
          </div>

          <MatchupWidget activeMatch={activeMatch} team1Stats={team1Stats} team2Stats={team2Stats} />
          <StadiumWidget activeStadium={activeStadium} />
          <WeatherWidget activeWeather={activeWeather} />
          <AccommodationsWidget activeAccommodations={activeAccommodations} activeStadium={activeStadium} />
          <HospitalsWidget activeHospitals={activeHospitals} activeStadium={activeStadium} />
        </div>
      </main>

      <button 
        className="mobile-chat-toggle glow-btn"
        onClick={() => setIsChatExpanded(true)}
      >
        <MessageSquare size={20} />
        <span>Chat with Agent</span>
      </button>
    </div>
  );
}
