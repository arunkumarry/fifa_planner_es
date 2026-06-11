import React from 'react';
import { Ticket } from 'lucide-react';
import type { Stadium } from '../../types';

interface Props {
  activeStadium: Stadium;
}

export const StadiumWidget: React.FC<Props> = ({ activeStadium }) => {
  return (
    <div className="glass-card stadium-widget">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
        <Ticket size={20} color="var(--color-primary)" /> Stadium Seating & Tickets
      </h3>
      <div className="stadium-graphic">
        <div className="stadium-ring">
          <div className="stadium-field"></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Total Seating Capacity:</span>
        <span className="stadium-capacity-number">{activeStadium.capacity.toLocaleString()}</span>
      </div>
      <div className="booking-text">
        <div style={{ fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Ticket Booking Portal:</div>
        {activeStadium.ticket_booking_info}
      </div>
    </div>
  );
};
