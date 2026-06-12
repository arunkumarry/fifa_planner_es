export interface Match {
  match_id: string;
  team_1: string;
  team_2: string;
  date: string;
  stadium_id: string;
  city: string;
}

export interface Stadium {
  stadium_id: string;
  name: string;
  city: string;
  capacity: number;
  ticket_booking_info: string;
  latitude: number;
  longitude: number;
}

export interface Accommodation {
  hotel_id: string;
  name: string;
  stadium_id: string;
  latitude: number;
  longitude: number;
  price_per_night: number;
  rating: number;
  distance_miles?: number;
  driving_eta?: number;
  walking_eta?: number;
}

export interface Hospital {
  hospital_id: string;
  name: string;
  stadium_id: string;
  latitude: number;
  longitude: number;
  distance_miles?: number;
  beds: number;
  trauma: string;
  telephone: string;
}

export interface Weather {
  city: string;
  month: string;
  avg_temp_f: number;
  precipitation_chance: number;
  conditions: string;
}

export interface Message {
  sender: 'user' | 'agent' | 'system';
  text: string;
}

export interface ConsoleLog {
  timestamp: string;
  type: 'info' | 'tool-call' | 'tool-return' | 'error';
  text: string;
}
