import React from 'react';
import { Award, Shield } from 'lucide-react';
import type { Standing } from '../../types';

interface Props {
  groupName: string;
  standings: Standing[];
}

export const RankingsWidget: React.FC<Props> = ({ groupName, standings }) => {
  if (!standings || standings.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>No standings data available for {groupName}.</p>
      </div>
    );
  }

  // Sort standings by position just in case
  const sortedStandings = [...standings].sort((a, b) => a.pos - b.pos);

  return (
    <div className="glass-card" style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', marginBottom: '20px' }}>
        <Award size={20} color="var(--color-primary)" /> {groupName} Standings
      </h3>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', width: '60px' }}>POS</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>TEAM</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '70px' }}>PTS</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '60px' }}>GP</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '50px' }}>W</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '50px' }}>D</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '50px' }}>L</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '60px' }}>GF</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '60px' }}>GA</th>
            <th style={{ padding: '12px 8px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', width: '60px' }}>GD</th>
          </tr>
        </thead>
        <tbody>
          {sortedStandings.map((item) => {
            const isQualified = item.pos <= 2; // Top 2 teams qualify
            const gdValue = typeof item.gd === 'string' ? parseInt(item.gd, 10) : item.gd;
            const gdSign = gdValue > 0 ? '+' : '';
            
            return (
              <tr 
                key={item.team} 
                className="standing-row"
                style={{ 
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  transition: 'background-color 0.2s ease',
                  background: isQualified ? 'rgba(0, 242, 254, 0.01)' : 'transparent'
                }}
              >
                <td style={{ padding: '16px 8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isQualified 
                      ? 'rgba(0, 242, 254, 0.15)' 
                      : 'rgba(255, 255, 255, 0.03)',
                    color: isQualified ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    border: isQualified 
                      ? '1px solid rgba(0, 242, 254, 0.3)' 
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.9rem',
                    fontFamily: 'Orbitron, sans-serif'
                  }}>
                    {item.pos}
                  </span>
                </td>
                <td style={{ padding: '16px 8px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color={isQualified ? 'var(--color-primary)' : 'var(--color-text-muted)'} style={{ opacity: 0.8 }} />
                    <span style={{ color: isQualified ? '#fff' : 'var(--color-text-main)' }}>{item.team}</span>
                    {isQualified && (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        background: 'rgba(16, 185, 129, 0.15)', 
                        color: 'var(--color-success)', 
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontWeight: 'bold',
                        letterSpacing: '1px'
                      }}>
                        Q
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px 8px', textAlign: 'center', fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.05rem', fontFamily: 'Orbitron, sans-serif' }}>
                  {item.pts}
                </td>
                <td style={{ padding: '16px 8px', textAlign: 'center', color: '#fff', opacity: 0.9 }}>{item.gp}</td>
                <td style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--color-success)', opacity: 0.9 }}>{item.w}</td>
                <td style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{item.d}</td>
                <td style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--color-danger)', opacity: 0.9 }}>{item.l}</td>
                <td style={{ padding: '16px 8px', textAlign: 'center', opacity: 0.8 }}>{item.gf}</td>
                <td style={{ padding: '16px 8px', textAlign: 'center', opacity: 0.8 }}>{item.ga}</td>
                <td style={{ 
                  padding: '16px 8px', 
                  textAlign: 'center', 
                  fontWeight: 'bold', 
                  color: gdValue > 0 
                    ? 'var(--color-success)' 
                    : gdValue < 0 
                      ? 'var(--color-danger)' 
                      : 'var(--color-text-muted)' 
                }}>
                  {gdSign}{gdValue}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
          <span>Q = Qualified to Knockout Stage (Top 2)</span>
        </div>
      </div>
    </div>
  );
};
