import React from 'react';
import { CloudSun, Wind } from 'lucide-react';
import type { Weather } from '../../types';

interface Props {
  activeWeather: Weather;
}

export const WeatherWidget: React.FC<Props> = ({ activeWeather }) => {
  return (
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
  );
};
