export interface PrimkaRow {
  datum: Date;
  primac: string;
  odjel: string;
  radiliste: string;
  izvođač: string;
  poslovoda: string;
  // Četinari
  fl_c: number;
  i_c: number;
  ii_c: number;
  iii_c: number;
  rd_c: number;
  trupci_c: number;
  cel_duga: number;
  cel_cijepana: number;
  skart: number;
  sigma_cetinari: number;
  // Lišćari
  fl_l: number;
  i_l: number;
  ii_l: number;
  iii_l: number;
  trupci_l: number;
  ogr_dugi: number;
  ogr_cijepani: number;
  gule: number;
  liscare: number;
  ukupno: number;
}

export interface OtpremaRow {
  datum: Date;
  otpremac: string;
  kupac: string;
  odjel: string;
  radiliste: string;
  izvođač: string;
  poslovoda: string;
  // Četinari
  fl_c: number;
  i_c: number;
  ii_c: number;
  iii_c: number;
  rd_c: number;
  trupci_c: number;
  cel_duga: number;
  cel_cijepana: number;
  skart: number;
  sigma_cetinari: number;
  // Lišćari
  fl_l: number;
  i_l: number;
  ii_l: number;
  iii_l: number;
  trupci_l: number;
  ogr_dugi: number;
  ogr_cijepani: number;
  gule: number;
  liscare: number;
  ukupno: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export type QuickSelect = "7d" | "30d" | "90d" | "ytd" | "all";

// Serializable versions for passing between server/client
export interface PrimkaRowSerialized extends Omit<PrimkaRow, "datum"> {
  datum: string;
}

export interface OtpremaRowSerialized extends Omit<OtpremaRow, "datum"> {
  datum: string;
}

export interface PrimacSummary {
  primac: string;
  totalUkupno: number;
  totalCetinari: number;
  totalLiscare: number;
  count: number;
}

export interface OdjelSummary {
  odjel: string;
  totalUkupno: number;
}

export interface DailyTotal {
  datum: string;
  ukupno: number;
  cetinari: number;
  liscare: number;
}

export interface RadilisteSummary {
  radiliste: string;
  totalUkupno: number;
  totalCetinari: number;
  totalLiscare: number;
  count: number;
}

export interface IzvođačSummary {
  izvođač: string;
  totalUkupno: number;
  totalCetinari: number;
  totalLiscare: number;
  count: number;
}

export interface OtpremacSummary {
  otpremac: string;
  totalUkupno: number;
  totalCetinari: number;
  totalLiscare: number;
  count: number;
}

export interface KupacSummary {
  kupac: string;
  totalUkupno: number;
}

export interface GradeData {
  name: string;
  cetinari: number;
  liscare: number;
  ukupno: number;
}
