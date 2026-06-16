import React from 'react';
import { Gauge, Trophy } from 'lucide-react';
import type { Match } from '../../types';

interface Props {
  activeMatch: Match;
  team1Stats: any;
  team2Stats: any;
}

export const MatchupWidget: React.FC<Props> = ({ activeMatch, team1Stats, team2Stats }) => {
  if (!team1Stats && !team2Stats) return null;

  const isCompleted = activeMatch.status === 'completed';
  const team1Won = activeMatch.winner === activeMatch.team_1;
  const team2Won = activeMatch.winner === activeMatch.team_2;
  const isDraw = activeMatch.winner === 'Draw';

  return (
    <div className="glass-card matchup-widget" style={isCompleted ? { gridColumn: '1 / -1' } : {}}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '16px' }}>
        <Gauge size={20} color="var(--color-primary)" /> {isCompleted ? 'Final Match Results & Analytics' : 'Team Matchup Analytics'}
      </h3>
      
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div className="matchup-metrics-container">
            <div className="matchup-row" style={{ background: 'none', border: 'none', padding: '0 12px 4px 12px' }}>
              <div className="matchup-team-name glow-text" style={{ textAlign: 'right', marginBottom: 0, color: team1Won ? 'var(--color-primary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                {team1Won && <Trophy size={16} />}
                {activeMatch.team_1}
              </div>
              <div className="matchup-label" style={{ fontWeight: 800, color: '#fff' }}>VS</div>
              <div className="matchup-team-name glow-text" style={{ textAlign: 'left', marginBottom: 0, color: team2Won ? 'var(--color-primary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }}>
                {activeMatch.team_2}
                {team2Won && <Trophy size={16} />}
              </div>
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

        {isCompleted && (
          <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>Final Score</div>
              <div className="glow-text" style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1 }}>{activeMatch.score}</div>
              <div style={{ fontSize: '1.2rem', color: 'var(--color-primary)', marginTop: '8px', fontWeight: 'bold' }}>
                {isDraw ? 'Match Drawn' : `${activeMatch.winner} Wins!`}
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, textAlign: 'center', fontStyle: 'italic', fontSize: '1.1rem' }}>
              "{activeMatch.summary}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
