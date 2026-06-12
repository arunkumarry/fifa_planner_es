import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Compass, MessageSquare, Loader2 } from 'lucide-react';
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

export default function App() {
  const [selectedMatchId, setSelectedMatchId] = useState<string>('M_2');
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { sender: 'agent', text: 'Hello! I am your FIFA 2026 Match Day AI Planner, connected via MCP to your Elasticsearch Serverless workspace. Which match day can I help you plan?' }
  ]);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [showConsole, setShowConsole] = useState<boolean>(true);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);
  
  // Data State
  const [matches, setMatches] = useState<Match[]>([]);
  const [stadiums, setStadiums] = useState<Record<string, Stadium>>({});
  const [activeWeather, setActiveWeather] = useState<Weather | null>(null);
  const [activeAccommodations, setActiveAccommodations] = useState<Accommodation[]>([]);
  const [activeHospitals, setActiveHospitals] = useState<Hospital[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, any>>({});
  
  // Loading State
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isLoadingWidgets, setIsLoadingWidgets] = useState<boolean>(false);
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const consoleLogsRef = useRef<HTMLDivElement>(null);

  const addConsoleLog = (type: 'info' | 'tool-call' | 'tool-return' | 'error', text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev, { timestamp, type, text }]);
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        addConsoleLog('info', 'Fetching live MCP data: matches and stadiums...');
        const [mRes, sRes, tRes] = await Promise.all([
          fetch('/api/matches'),
          fetch('/api/stadiums'),
          fetch('/api/teams/stats')
        ]);
        const mData = await mRes.json();
        const sData = await sRes.json();
        const tData = await tRes.json();
        
        setMatches(mData);
        setTeamStats(tData);
        const stMap: Record<string, Stadium> = {};
        if (Array.isArray(sData)) {
          sData.forEach((s: any) => stMap[s.stadium_id] = s);
        } else {
          Object.assign(stMap, sData);
        }
        setStadiums(stMap);
        
        if (mData.length > 0 && !mData.find((m: any) => m.match_id === selectedMatchId)) {
          setSelectedMatchId(mData[0].match_id);
        }
      } catch (e: any) {
        addConsoleLog('error', 'Failed to fetch initial data: ' + e.message);
      } finally {
        setIsLoadingInitial(false);
      }
    }
    loadInitialData();
  }, []);

  const activeMatch = matches.find(m => m.match_id === selectedMatchId) || matches[0];
  const activeStadium = activeMatch ? (stadiums[activeMatch.stadium_id] || {
    stadium_id: 'default', name: 'TBD Stadium', city: activeMatch.city, capacity: 65000, ticket_booking_info: '', latitude: 0, longitude: 0
  }) : null;

  useEffect(() => {
    async function loadWidgetData() {
      if (!activeMatch || !activeStadium) return;
      setIsLoadingWidgets(true);
      try {
        addConsoleLog('info', `Fetching MCP data for Match: ${activeMatch.match_id}`);
        const [wRes, aRes, hRes] = await Promise.all([
          fetch(`/api/weather/${encodeURIComponent(activeMatch.city)}`),
          fetch(`/api/accommodations/${encodeURIComponent(activeStadium.stadium_id)}`),
          fetch(`/api/hospitals/${encodeURIComponent(activeStadium.stadium_id)}`)
        ]);
        const wData = await wRes.json();
        const aData = await aRes.json();
        const hData = await hRes.json();
        
        let w = null;
        if (Array.isArray(wData)) {
          const activeMonth = activeMatch.date && activeMatch.date.split('-')[1] === '06' ? 'June' : 'July';
          w = wData.find((ww: any) => ww.month === activeMonth) || wData[0];
        } else {
          w = wData;
        }
        setActiveWeather(w);
        
        const processedAcc = Array.isArray(aData) ? aData.map((acc: any) => {
          const distance = acc.distance_km !== undefined ? acc.distance_km : getDistanceKm(acc.latitude, acc.longitude, activeStadium.latitude, activeStadium.longitude);
          return {
            ...acc,
            distance_km: parseFloat(distance.toFixed(2)),
            driving_eta: Math.round((distance / 40) * 60) + 5,
            walking_eta: Math.round((distance / 5) * 60)
          };
        }).sort((a: any, b: any) => a.distance_km - b.distance_km) : [];
        setActiveAccommodations(processedAcc);
        
        const processedHosp = Array.isArray(hData) ? hData.map((h: any) => {
          const distance = h.distance_km !== undefined ? h.distance_km : getDistanceKm(h.latitude, h.longitude, activeStadium.latitude, activeStadium.longitude);
          return {
            ...h,
            distance_km: parseFloat(distance.toFixed(2))
          };
        }).sort((a: any, b: any) => a.distance_km - b.distance_km) : [];
        setActiveHospitals(processedHosp);

      } catch (e: any) {
        addConsoleLog('error', 'Failed to fetch widget data: ' + e.message);
      } finally {
        setIsLoadingWidgets(false);
      }
    }
    loadWidgetData();
  }, [activeMatch?.match_id, activeStadium?.stadium_id]);

  useEffect(() => {
    if (chatMessagesRef.current) chatMessagesRef.current.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);
  useEffect(() => {
    if (consoleLogsRef.current) consoleLogsRef.current.scrollTo({ top: consoleLogsRef.current.scrollHeight, behavior: 'smooth' });
  }, [consoleLogs]);

  const handleMatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMatchId = e.target.value;
    setSelectedMatchId(newMatchId);
    
    const targetMatch = matches.find(m => m.match_id === newMatchId);
    if (!targetMatch) return;
    const targetStadiumName = stadiums[targetMatch.stadium_id]?.name || 'TBD Venue';
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
    try {
      addConsoleLog('tool-call', `Sending message to Vertex AI: "${userMessage}"`);
      const activeMonth = activeMatch?.date && activeMatch.date.split('-')[1] === '06' ? 'June' : 'July';
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage, 
          context: { activeMatch, activeStadium, activeMonth }
        })
      });
      if (!response.ok) {
        try {
          const errData = await response.json();
          if (errData.logs && Array.isArray(errData.logs)) errData.logs.forEach((log: any) => addConsoleLog(log.type, log.message));
          throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        } catch {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      const data = await response.json();
      if (data.logs && Array.isArray(data.logs)) data.logs.forEach((log: any) => addConsoleLog(log.type, log.message));
      setChatMessages(prev => [...prev, { sender: 'agent', text: data.reply }]);
    } catch (err: any) {
      addConsoleLog('error', `Failed to connect to backend: ${err.message}`);
      setChatMessages(prev => [...prev, { sender: 'agent', text: `Sorry, I encountered an error. (${err.message})` }]);
    }
  };

  if (isLoadingInitial) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', flexDirection: 'column', gap: '16px' }}>
        <Loader2 size={48} className="rotating-football" color="var(--color-primary)" />
        <h2>Loading Live MCP Data...</h2>
      </div>
    );
  }

  if (!activeMatch || !activeStadium) {
    return <div className="app-container" style={{ color: 'white', padding: '2rem' }}>Error loading data.</div>;
  }

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
              {matches.map((m) => (
                <option key={m.match_id} value={m.match_id}>
                  {m.team_1} vs {m.team_2} ({m.city})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="widgets-grid" style={{ position: 'relative' }}>
          {isLoadingWidgets && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '12px', color: 'white', flexDirection: 'column', gap: '8px', backdropFilter: 'blur(2px)' }}>
              <Loader2 size={32} className="rotating-football" color="var(--color-primary)" />
              <span style={{ fontWeight: 600 }}>Syncing...</span>
            </div>
          )}

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

          <MatchupWidget activeMatch={activeMatch} team1Stats={teamStats[activeMatch.team_1]} team2Stats={teamStats[activeMatch.team_2]} />
          <StadiumWidget activeStadium={activeStadium} />
          {activeWeather && <WeatherWidget activeWeather={activeWeather} />}
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
