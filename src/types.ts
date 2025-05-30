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

// Chart group interface
export interface ChartGroup {
  id: string;
  name: string;
  keys: string[];
  createdAt: Date;
}

// User preferences
export interface UserPreferences {
  chartGroups: ChartGroup[];
  defaultView: 'individual' | 'groups' | 'data';
  favoriteMetrics: string[]; // Keys that the user frequently views
}

// Extended user data store with preferences
export interface UserDataStoreWithPreferences {
  [userId: number]: {
    data: DataSet;
    preferences: UserPreferences;
  };
}
