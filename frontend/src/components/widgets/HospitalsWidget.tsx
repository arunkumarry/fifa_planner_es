import React from 'react';
import { Activity } from 'lucide-react';
import type { Hospital } from '../../types';

interface Props {
  activeHospitals: Hospital[];
}

export const HospitalsWidget: React.FC<Props> = ({ activeHospitals }) => {
  return (
    <div className="glass-card hospitals-widget" style={{ gridColumn: '1 / -1' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
        <Activity size={20} color="#ef4444" /> Medical Facilities (Geo-Sorted)
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '-8px' }}>
        Nearest hospitals to the stadium
      </p>
      <div className="hotel-list">
        {activeHospitals.map((hospital) => (
          <div key={hospital.hospital_id} className="hotel-item" style={{ borderLeft: '3px solid #ef4444' }}>
            <div className="hotel-info">
              <h4>{hospital.name}</h4>
              <div className="hotel-rating-price">
                <span style={{ color: '#ef4444' }}>{hospital.distance_km} km away</span>
                <span>•</span>
                <span>{hospital.beds} Beds</span>
                <span>•</span>
                <span>{hospital.trauma !== 'NOT AVAILABLE' && hospital.trauma !== 'None' ? hospital.trauma : 'General Hospital'}</span>
              </div>
            </div>
            <div className="hotel-travel-eta">
              <div>
                <span className="eta-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                   Tel: {hospital.telephone}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
