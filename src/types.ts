export interface DataPoint {
  key: string;
  value: number;
  timestamp: Date;
}

export interface DataSet {
  [key: string]: {
    values: number[];
    timestamps: Date[];
  };
}

export interface ParsedData {
  key: string;
  value: number;
  timestamp?: Date; // Optional timestamp for historical data
}
