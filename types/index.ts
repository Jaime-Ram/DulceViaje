// Bus Stop
export interface BusStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  lines?: string[];
}

// Bus Line
export interface BusLine {
  id: string;
  name: string;
  shortName: string;
  color?: string;
  textColor?: string;
  destinations?: string[];
}

// Line Variant
export interface LineVariant {
  id: string;
  lineId: string;
  lineName: string;
  headsign: string;
  direction: number;
  stops?: BusStop[];
}

// Upcoming Bus / Departure
export interface UpcomingBus {
  lineId: string;
  lineName: string;
  lineVariantId: string;
  headsign: string;
  eta: number; // seconds
  etaMinutes: number;
  busId?: string;
  latitude?: number;
  longitude?: number;
  isRealtime: boolean;
}

// Live Bus Position
export interface LiveBus {
  busId: string;
  lineId: string;
  lineName: string;
  lineVariantId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  lastUpdate: string;
}

// Journey / Trip Plan
export interface Journey {
  id: string;
  from: Location;
  to: Location;
  departureTime: Date;
  arrivalTime: Date;
  duration: number; // minutes
  legs: JourneyLeg[];
  transfers: number;
}

export interface JourneyLeg {
  type: 'walk' | 'bus';
  from: Location;
  to: Location;
  departureTime: Date;
  arrivalTime: Date;
  duration: number;
  distance?: number;
  line?: BusLine;
  headsign?: string;
  stopSequence?: BusStop[];
  wheelchairAccessible?: boolean | null; // null = unknown
}

// Location
export interface Location {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  stopId?: number;
}

// Favorite
export interface FavoriteStop {
  id: number;
  name: string;
  customName?: string;
  latitude: number;
  longitude: number;
}

export interface FavoriteRoute {
  id: string;
  from: Location;
  to: Location;
  label?: string;
}

// Disruption / Alert
export interface Disruption {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  lines?: string[];
  startTime?: Date;
  endTime?: Date;
}

// GTFS types
export interface GTFSRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_color?: string;
  route_text_color?: string;
}

export interface GTFSStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}
