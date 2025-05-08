export interface DataPoint {
  key: string;
  value: number;
  timestamp: Date;
  userId?: number; // Add user ID to data point
}

export interface DataSet {
  [key: string]: {
    values: number[];
    timestamps: Date[];
    userIds: number[]; // Add user IDs array
  };
}

export interface ParsedData {
  key: string;
  value: number;
  timestamp?: Date; // Optional timestamp for historical data
  userId?: number;  // Optional user ID
}

// User data structure
export interface UserDataStore {
  [userId: number]: DataSet;
}
