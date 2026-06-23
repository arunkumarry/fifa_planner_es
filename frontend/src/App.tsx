import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Compass, MessageSquare, Loader2 } from 'lucide-react';
import './App.css';

import type { Match, Stadium, Accommodation, Hospital, Weather, Message, ConsoleLog, Standing } from './types';
import { getDistanceKm } from './utils/geo';

import { MatchupWidget } from './components/widgets/MatchupWidget';
import { StadiumWidget } from './components/widgets/StadiumWidget';
import { WeatherWidget } from './components/widgets/WeatherWidget';
import { AccommodationsWidget } from './components/widgets/AccommodationsWidget';
import { HospitalsWidget } from './components/widgets/HospitalsWidget';
import { TeamViewWidget } from './components/widgets/TeamViewWidget';
import { RankingsWidget } from './components/widgets/RankingsWidget';
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
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('');
  const [activeStandings, setActiveStandings] = useState<Standing[]>([]);
  const [allStandings, setAllStandings] = useState<Standing[]>([]);
  const [isLoadingStandings, setIsLoadingStandings] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'matchup' | 'standings'>('matchup');
  
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
        addConsoleLog('info', 'Fetching live MCP data: matches, stadiums, and standings...');
        const [mRes, sRes, tRes, stRes] = await Promise.all([
          fetch('/api/matches'),
          fetch('/api/stadiums'),
          fetch('/api/teams/stats'),
          fetch('/api/standings')
        ]);
        const mData = await mRes.json();
        const sData = await sRes.json();
        const tData = await tRes.json();
        const stData = await stRes.json();
        
        setMatches(mData);
        setTeamStats(tData);
        setAllStandings(stData);

        const todayStr = new Date().toLocaleDateString('en-CA');
        const todaysMatch = mData.find((m: any) => m.date.startsWith(todayStr));
        if (todaysMatch) {
          setSelectedMatchId(todaysMatch.match_id);
        } else if (mData.length > 0) {
          setSelectedMatchId(mData[0].match_id);
        }

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
    async function loadStandings() {
      if (!selectedGroupFilter) return;
      setIsLoadingStandings(true);
      try {
        addConsoleLog('info', `Fetching standings for ${selectedGroupFilter}...`);
        const res = await fetch(`/api/standings/${encodeURIComponent(selectedGroupFilter)}`);
        const data = await res.json();
        setActiveStandings(data);
      } catch (e: any) {
        addConsoleLog('error', 'Failed to fetch standings data: ' + e.message);
      } finally {
        setIsLoadingStandings(false);
      }
    }
    loadStandings();
  }, [selectedGroupFilter]);

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
    const isCompleted = targetMatch.status === 'completed';
    const agentText = isCompleted
      ? `I've updated the planning dashboard for the ${targetMatch.team_1} vs ${targetMatch.team_2} match at ${targetStadiumName} on ${targetMatch.date}. Let me know if you want to know stats of this match or something like that!`
      : `I've updated the planning dashboard for the ${targetMatch.team_1} vs ${targetMatch.team_2} match at ${targetStadiumName} on ${targetMatch.date}. Let me know if you want accommodation recommendations under a budget, travel ETAs, or ticketing assistance!`;

    setChatMessages(prev => [
      ...prev,
      { sender: 'system', text: `Switched dashboard view to ${targetMatch.team_1} vs ${targetMatch.team_2} in ${targetMatch.city}` },
      { sender: 'agent', text: agentText }
    ]);
  };

  const triggerChat = async (messageText: string, contextOverride?: any) => {
    if (!messageText.trim()) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: messageText }]);
    try {
      addConsoleLog('tool-call', `Sending message to Vertex AI: "${messageText}"`);
      const ctx = contextOverride || { activeMatch, activeStadium, activeMonth: activeMatch?.date && activeMatch.date.split('-')[1] === '06' ? 'June' : 'July' };
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, context: ctx })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.logs && Array.isArray(data.logs)) data.logs.forEach((log: any) => addConsoleLog(log.type, log.message));
      setChatMessages(prev => [...prev, { sender: 'agent', text: data.reply }]);
      setIsChatExpanded(true);
    } catch (err: any) {
      addConsoleLog('error', `Failed to connect to backend: ${err.message}`);
      setChatMessages(prev => [...prev, { sender: 'agent', text: `Sorry, I encountered an error. (${err.message})` }]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    await triggerChat(userMessage);
  };

  const GROUPS = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Group G', 'Group H', 'Group I', 'Group J', 'Group K', 'Group L'];

  const handleTeamMatchClick = (matchId: string) => {
    setSelectedMatchId(matchId);
    setSelectedTeamFilter('');
    setSelectedGroupFilter('');
    setActiveTab('matchup');
    
    const targetMatch = matches.find(m => m.match_id === matchId);
    if (!targetMatch) return;
    const activeMonth = targetMatch.date && targetMatch.date.split('-')[1] === '06' ? 'June' : 'July';
    
    const prompt = `I want to explore the match between ${targetMatch.team_1} and ${targetMatch.team_2} in ${targetMatch.city}. Can you predict the outcome?`;
    triggerChat(prompt, { activeMatch: targetMatch, activeStadium: stadiums[targetMatch.stadium_id], activeMonth });
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h1 className="glow-text" style={{ fontSize: '1.8rem', fontWeight: 900 }}>MATCH DAY DESK</h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>FIFA World Cup 2026 Fan Service Agent Dashboard</p>
            </div>
            <div className="header-football-container">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 2100 2100" className="rotating-football">
                <path fill="var(--color-primary)" fillRule="nonzero" d="M 1867.710938 1050 C 1867.710938 1275.265625 1787.738281 1467.867188 1627.808594 1627.804688 C 1467.871094 1787.742188 1275.269531 1867.710938 1050 1867.710938 C 824.734375 1867.710938 632.132812 1787.742188 472.195312 1627.804688 C 312.257812 1467.867188 232.289062 1275.265625 232.289062 1050 C 232.289062 824.730469 312.257812 632.128906 472.195312 472.191406 C 632.132812 312.261719 824.734375 232.289062 1050 232.289062 C 1275.269531 232.289062 1467.871094 312.261719 1627.808594 472.191406 C 1787.738281 632.128906 1867.710938 824.730469 1867.710938 1050 Z M 1756.210938 690.140625 C 1702.140625 584.261719 1627.808594 494.71875 1533.191406 421.511719 L 1536.570312 470.5 Z M 1769.71875 729 L 1766.339844 725.621094 L 1768.03125 725.621094 L 1526.441406 482.328125 L 1298.359375 560.050781 L 1298.359375 845.570312 L 1538.261719 1046.621094 L 1761.28125 977.351562 Z M 1837.300781 1139.542969 L 1764.660156 994.25 L 1541.640625 1063.519531 L 1384.519531 1357.488281 L 1445.339844 1534.882812 L 1681.871094 1528.125 C 1769.71875 1412.113281 1821.53125 1282.585938 1837.300781 1139.542969 Z M 1281.460938 843.878906 L 1281.460938 558.359375 L 1014.519531 423.199219 L 771.234375 614.109375 L 783.0625 872.601562 L 1016.210938 990.871094 Z M 1004.378906 409.679688 L 955.390625 262.699219 C 772.925781 285.21875 616.929688 361.808594 487.398438 492.46875 L 502.605469 583.699219 L 759.40625 602.28125 Z M 487.398438 590.460938 L 472.195312 507.671875 C 353.929688 633.820312 284.660156 782.5 264.386719 953.699219 L 360.6875 886.121094 Z M 1431.828125 1539.953125 L 1369.308594 1362.554688 L 1071.960938 1279.769531 L 855.710938 1453.789062 L 946.941406 1698.765625 L 1225.710938 1719.039062 Z M 1061.828125 1266.253906 L 1011.140625 1004.378906 L 776.304688 887.808594 L 543.152344 1093.929688 L 593.839844 1333.835938 L 843.882812 1441.960938 Z M 1286.53125 1805.203125 L 1225.710938 1735.933594 L 943.5625 1713.96875 L 855.710938 1817.027344 C 918.785156 1833.921875 983.546875 1842.371094 1050 1842.371094 C 1131.101562 1842.371094 1209.941406 1829.980469 1286.53125 1805.203125 Z M 578.632812 1338.902344 L 526.257812 1095.621094 L 365.757812 903.011719 L 261.007812 975.660156 C 258.753906 999.308594 257.628906 1024.089844 257.628906 1050 C 257.628906 1181.78125 288.039062 1305.113281 348.863281 1419.996094 L 456.988281 1489.265625 Z M 473.882812 1594.015625 L 451.921875 1504.472656 L 365.757812 1450.410156 C 396.167969 1501.09375 432.210938 1548.964844 473.882812 1594.015625 "/>
              </svg>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', width: '100%' }}>
            <button 
              className={activeTab === 'matchup' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setActiveTab('matchup')}
            >
              Match Day Desk
            </button>
            <button 
              className={activeTab === 'standings' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => {
                setActiveTab('standings');
                if (!selectedGroupFilter) {
                  setSelectedGroupFilter('Group A');
                }
              }}
            >
              Tournament Standings
            </button>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', width: '100%', marginTop: '8px' }}>
            {activeTab === 'matchup' ? (
              <>
                <div>
                  <div className="selector-label">Filter by Team</div>
                  <select 
                    value={selectedTeamFilter} 
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedTeamFilter(val);
                      if (val) {
                        setSelectedGroupFilter('');
                      }
                    }}
                    className="match-select"
                    style={{ width: '180px' }}
                  >
                    <option value="">All Teams</option>
                    {Array.from(new Set(matches.flatMap(m => [m.team_1, m.team_2])))
                      .filter(t => {
                        if (allStandings.length > 0) {
                          return allStandings.some(s => s.team === t);
                        }
                        return !/^\d+[A-L]$/.test(t) && !/^W\d+$/.test(t) && !/^RU\d+$/.test(t) && !/^3[A-L]{3,6}$/.test(t);
                      })
                      .sort()
                      .map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <div className="selector-label">Active Match Day</div>
                  <select 
                    value={selectedMatchId} 
                    onChange={handleMatchChange}
                    className="match-select"
                    disabled={!!selectedTeamFilter}
                    style={{ opacity: selectedTeamFilter ? 0.5 : 1 }}
                  >
                    {matches.map((m) => {
                      const dateObj = new Date(m.date);
                      const formattedDate = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', weekday: 'short' });
                      return (
                        <option key={m.match_id} value={m.match_id}>
                          {m.team_1} vs {m.team_2} ({m.city}) - {formattedDate}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <div className="selector-label">Filter by Group</div>
                <select 
                  value={selectedGroupFilter} 
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedGroupFilter(val);
                  }}
                  className="match-select"
                  style={{ width: '150px' }}
                >
                  {GROUPS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {activeTab === 'standings' ? (
          <div className="widgets-grid" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {isLoadingStandings && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '12px', color: 'white', flexDirection: 'column', gap: '8px', backdropFilter: 'blur(2px)' }}>
                <Loader2 size={32} className="rotating-football" color="var(--color-primary)" />
                <span style={{ fontWeight: 600 }}>Loading Standings...</span>
              </div>
            )}
            <RankingsWidget groupName={selectedGroupFilter || 'Group A'} standings={activeStandings} />
          </div>
        ) : selectedTeamFilter ? (
          <div className="widgets-grid" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <TeamViewWidget 
              team={selectedTeamFilter} 
              matches={matches} 
              teamStats={teamStats} 
              stadiums={stadiums} 
              onMatchClick={handleTeamMatchClick}
            />
          </div>
        ) : (
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
        )}
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
