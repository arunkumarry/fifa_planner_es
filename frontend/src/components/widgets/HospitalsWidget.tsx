import React from 'react';
import { Activity, Map } from 'lucide-react';
import type { Hospital, Stadium } from '../../types';
import { openGoogleMapsRoute } from '../../utils/geo';

interface Props {
  activeHospitals: Hospital[];
  activeStadium: Stadium;
}

export const HospitalsWidget: React.FC<Props> = ({ activeHospitals, activeStadium }) => {
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
            <div className="hotel-travel-eta" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <div>
                <span className="eta-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                   Tel: {hospital.telephone}
                </span>
              </div>
              <button 
                className="glow-btn" 
                style={{ width: '100%', padding: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '6px', borderColor: '#ef4444', color: '#ef4444' }}
                onClick={() => openGoogleMapsRoute(hospital.latitude, hospital.longitude, activeStadium.latitude, activeStadium.longitude)}
              >
                <Map size={14} /> Directions
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
