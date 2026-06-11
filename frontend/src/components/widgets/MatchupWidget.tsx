import React from 'react';
import { Gauge } from 'lucide-react';
import type { Match } from '../../types';

interface Props {
  activeMatch: Match;
  team1Stats: any;
  team2Stats: any;
}

export const MatchupWidget: React.FC<Props> = ({ activeMatch, team1Stats, team2Stats }) => {
  if (!team1Stats && !team2Stats) return null;

  return (
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
  );
};
