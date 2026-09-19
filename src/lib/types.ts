export type Style = 'worlds_fair' | 'concrete_base';
export type Side = 'A' | 'B';
export type SideStatus = 'available' | 'adopted' | 'expiring';
export type BenchStatus = 'available' | 'partial' | 'adopted' | 'expiring';

export interface Settings {
  defaultTermMonths: number;
  minTermMonths: number;
  maxTermMonths: number;
  expiringSoonDays: number;
}

/** What the public is allowed to see about an adoption. No email. */
export interface PublicAdoption {
  id: number;
  side: Side;
  displayName: string;
  plaqueText: string;
  startDate: string;
  endDate: string;
  daysLeft: number;
}

export interface SideInfo {
  side: Side;
  status: SideStatus;
  adoption: PublicAdoption | null;
}

export interface BenchDTO {
  id: string;
  name: string;
  description: string;
  area: string;
  style: Style;
  lengthFt: 4 | 8;
  lat: number;
  lng: number;
  imageUrl: string;
  isPlaceholder: boolean;
  status: BenchStatus;
  sides: SideInfo[];
}

export interface BenchesResponse {
  benches: BenchDTO[];
  settings: Settings;
  today: string;
  sampleCount: number;
}

export interface BenchRow {
  id: string;
  name: string;
  description: string;
  area: string;
  style: Style;
  lengthFt: 4 | 8;
  lat: number;
  lng: number;
  imageUrl: string;
}

export interface AdoptionRow {
  benchId: string;
  side: Side;
  adopterName: string;
  adopterEmail: string;
  plaqueText: string;
  isAnonymous: boolean;
  startDate: string;
  endDate: string;
}

export interface AdoptInput {
  side: Side;
  adopterName: string;
  email: string;
  plaqueText: string;
  termMonths: number;
  anonymous: boolean;
}
