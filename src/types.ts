export enum EventLevel {
  INFO = 'Info',
  MINOR = 'Minor',
  MODERATE = 'Moderate',
  SEVERE = 'Severe',
  CRITICAL = 'Critical',
}

export interface DisasterEvent {
  id: string;
  source: string;
  category: string;
  title: string;
  content?: string;
  level: EventLevel;
  timestamp: number;
}

export type CategoryGroup = {
  category: string;
  latestEvent: DisasterEvent;
  events: DisasterEvent[];
};

export interface SourceStatus {
  name: string;
  isConnected: boolean;
  lastUpdate: number;
}
