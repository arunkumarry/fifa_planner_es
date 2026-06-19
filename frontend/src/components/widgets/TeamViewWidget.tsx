import { useEffect, useState } from 'react';
import { Calendar, MapPin, Search } from 'lucide-react';
import type { Match, Stadium, Weather } from '../../types';

interface TeamViewWidgetProps {
  team: string;
  matches: Match[];
  teamStats: Record<string, any>;
  stadiums: Record<string, Stadium>;
  onMatchClick: (matchId: string) => void;
}

export function TeamViewWidget({ team, matches, teamStats, stadiums, onMatchClick }: TeamViewWidgetProps) {
  const [weatherMap, setWeatherMap] = useState<Record<string, Weather>>({});
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  const teamMatches = matches.filter(m => m.team_1 === team || m.team_2 === team);
  const stats = teamStats[team] || {};

  useEffect(() => {
    async function loadWeather() {
      setIsLoadingWeather(true);
      try {
        const uniqueCities = Array.from(new Set(teamMatches.map(m => m.city)));
        const fetchPromises = uniqueCities.map(city => 
          fetch(`/api/weather/${encodeURIComponent(city)}`).then(r => r.json()).then(data => ({ city, data }))
        );
        
        const results = await Promise.all(fetchPromises);
        const wMap: Record<string, Weather> = {};
        
        results.forEach(({ city, data }) => {
          let w = null;
          if (Array.isArray(data)) {
             w = data.find((ww: any) => ww.month === 'June') || data[0];
          } else {
             w = data;
          }
          if (w) wMap[city] = w;
        });
        
        setWeatherMap(wMap);
      } catch (e) {
        console.error('Failed to load weather for team view', e);
      } finally {
        setIsLoadingWeather(false);
      }
    }
    
    if (teamMatches.length > 0) {
      loadWeather();
    }
  }, [team, teamMatches.length]);

  return (
    <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 className="glow-text" style={{ fontSize: '2rem', margin: 0 }}>{team} National Team</h2>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', color: 'var(--color-text-muted)' }}>
            <span><strong>FIFA Rank:</strong> {stats.fifa_rank_pre_tournament || 'N/A'}</span>
            <span><strong>Global Win Prob:</strong> {stats.winner_pct ? (stats.winner_pct * 100).toFixed(1) + '%' : 'N/A'}</span>
            <span><strong>Squad Value:</strong> {stats.squad_total_market_value_eur ? '€' + (stats.squad_total_market_value_eur / 1000000).toFixed(0) + 'M' : 'N/A'}</span>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '12px 8px', color: 'var(--color-primary)' }}>Date</th>
              <th style={{ padding: '12px 8px', color: 'var(--color-primary)' }}>Opponent</th>
              <th style={{ padding: '12px 8px', color: 'var(--color-primary)' }}>Location</th>
              <th style={{ padding: '12px 8px', color: 'var(--color-primary)' }}>Weather</th>
              <th style={{ padding: '12px 8px', color: 'var(--color-primary)' }}>Prediction</th>
              <th style={{ padding: '12px 8px', color: 'var(--color-primary)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {teamMatches.map(m => {
              const isTeam1 = m.team_1 === team;
              const opponent = isTeam1 ? m.team_2 : m.team_1;
              const dateObj = new Date(m.date);
              const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
              const stadiumName = stadiums[m.stadium_id]?.name || 'TBD Venue';
              const weather = weatherMap[m.city];

              return (
                <tr key={m.match_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} 
                    className="hover-row">
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="var(--color-text-muted)" />
                      {formattedDate}
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{opponent}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} color="var(--color-primary)" /> {m.city}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{stadiumName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {isLoadingWeather ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
                    ) : weather ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{weather.avg_temp_f}°F</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{weather.precipitation_chance}% Rain</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {m.status === 'completed' ? (
                      <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{m.score}</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Ask Agent</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <button 
                      className="glow-btn" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => onMatchClick(m.match_id)}
                    >
                      <Search size={14} />
                      Explore
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <style>{`
        .hover-row:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
