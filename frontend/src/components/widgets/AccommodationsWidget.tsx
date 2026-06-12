import React from 'react';
import { Building, Star, Navigation, Clock, Map } from 'lucide-react';
import type { Accommodation, Stadium } from '../../types';
import { openGoogleMapsRoute } from '../../utils/geo';

interface Props {
  activeAccommodations: Accommodation[];
  activeStadium: Stadium;
}

export const AccommodationsWidget: React.FC<Props> = ({ activeAccommodations, activeStadium }) => {
  return (
    <div className="glass-card hotels-widget" style={{ gridColumn: '1 / -1' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
        <Building size={20} color="var(--color-primary)" /> Accommodations & Travel ETA (Geo-Sorted)
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '-8px' }}>
        Elasticsearch geo-distance query output. Calculated from stadium center: ({activeStadium.latitude}, {activeStadium.longitude})
      </p>
      <div className="hotel-list">
        {activeAccommodations.map((hotel) => (
          <div key={hotel.hotel_id} className="hotel-item">
            <div className="hotel-info">
              <h4>{hotel.name}</h4>
              <div className="hotel-rating-price">
                <span className="star-rating">
                  <Star size={14} fill="currentColor" /> {hotel.rating}
                </span>
                <span>•</span>
                <span className="hotel-price">${hotel.price_per_night} / night</span>
                <span>•</span>
                <span style={{ color: 'var(--color-primary)' }}>{hotel.distance_km} km away</span>
              </div>
            </div>
            <div className="hotel-travel-eta" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="eta-badge driving">
                  <Navigation size={12} fill="currentColor" /> Drive: {hotel.driving_eta} mins
                </span>
                <span className="eta-badge" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                  <Clock size={12} /> Walk: {hotel.walking_eta} mins
                </span>
              </div>
              <button 
                className="glow-btn" 
                style={{ width: '100%', padding: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '6px' }}
                onClick={() => openGoogleMapsRoute(hotel.latitude, hotel.longitude, activeStadium.latitude, activeStadium.longitude)}
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
