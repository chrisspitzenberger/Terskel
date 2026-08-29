// =============================================================================
// Strava API TypeScript Interfaces
// =============================================================================

// --- Webhook Event ---

export interface StravaWebhookEvent {
  /** Always "activity" or "athlete" */
  object_type: "activity" | "athlete";
  /** The Strava ID of the activity or athlete */
  object_id: number;
  /** "create", "update", or "delete" */
  aspect_type: "create" | "update" | "delete";
  /** The Strava athlete ID of the owner */
  owner_id: number;
  /** The subscription ID */
  subscription_id: number;
  /** Unix epoch timestamp */
  event_time: number;
  /** Updated fields (only for "update" events) */
  updates?: Record<string, string>;
}

// --- Token Refresh ---

export interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  /** Unix timestamp in seconds when the token expires */
  expires_at: number;
  expires_in: number;
}

// --- Activity API Response ---

export interface StravaPolylineMap {
  id: string;
  polyline: string | null;
  summary_polyline: string | null;
  resource_state: number;
}

export interface StravaMetaAthlete {
  id: number;
  resource_state: number;
}

export interface StravaLap {
  id: number;
  resource_state: number;
  name: string;
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  device_watts?: boolean;
  lap_index: number;
  split: number;
  pace_zone?: number;
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_heartrate?: number;
  pace_zone: number;
  average_grade_adjusted_speed?: number;
}

export interface StravaBestEffort {
  id: number;
  resource_state: number;
  name: string;
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  pr_rank: number | null;
  achievements: Array<{
    type_id: number;
    type: string;
    rank: number;
  }>;
}

export interface StravaSegment {
  id: number;
  resource_state: number;
  name: string;
  activity_type: string;
  distance: number;
  average_grade: number;
  maximum_grade: number;
  elevation_high: number;
  elevation_low: number;
  start_latlng: [number, number];
  end_latlng: [number, number];
  climb_category: number;
  city: string | null;
  state: string | null;
  country: string | null;
  private: boolean;
  hazardous: boolean;
  starred: boolean;
}

export interface StravaSegmentEffort {
  id: number;
  resource_state: number;
  name: string;
  activity: { id: number; resource_state: number };
  athlete: { id: number; resource_state: number };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  start_date_local: string;
  distance: number;
  start_index: number;
  end_index: number;
  average_cadence?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  device_watts?: boolean;
  segment: StravaSegment;
  kom_rank: number | null;
  pr_rank: number | null;
  achievements: Array<{
    type_id: number;
    type: string;
    rank: number;
  }>;
  hidden: boolean;
}

export interface StravaGear {
  id: string;
  primary: boolean;
  name: string;
  resource_state: number;
  distance: number;
}

export interface StravaDetailedActivity {
  id: number;
  resource_state: number;
  external_id: string | null;
  upload_id: number | null;
  athlete: StravaMetaAthlete;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: StravaPolylineMap;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  gear_id: string | null;
  from_accepted_tag: boolean | null;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_temp?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  max_watts?: number;
  elev_high?: number;
  elev_low?: number;
  pr_count: number;
  total_photo_count: number;
  has_kudoed: boolean;
  workout_type: number | null;
  suffer_score: number | null;
  description: string | null;
  calories: number;
  segment_efforts: StravaSegmentEffort[];
  splits_metric: StravaSplit[];
  laps: StravaLap[];
  best_efforts?: StravaBestEffort[];
  gear: StravaGear | null;
  device_name: string | null;
  embed_token: string;
  /** Only present if explicitly set */
  perceived_exertion?: number;
}

// --- Activity Streams API Response ---

export interface StravaStream<T = number> {
  type: string;
  data: T[];
  series_type: string;
  original_size: number;
  resolution: string;
}

export interface StravaStreamSet {
  time?: StravaStream<number>;
  distance?: StravaStream<number>;
  latlng?: StravaStream<[number, number]>;
  altitude?: StravaStream<number>;
  velocity_smooth?: StravaStream<number>;
  heartrate?: StravaStream<number>;
  cadence?: StravaStream<number>;
  watts?: StravaStream<number>;
  temp?: StravaStream<number>;
  moving?: StravaStream<boolean>;
  grade_smooth?: StravaStream<number>;
}

// --- Summary Activity (List endpoint) ---

export interface StravaSummaryActivity {
  id: number;
  resource_state: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  start_latlng: [number, number] | null;
  end_latlng: [number, number] | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: StravaPolylineMap;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  gear_id: string | null;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_temp?: number;
  average_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  elev_high?: number;
  elev_low?: number;
  pr_count: number;
  total_photo_count: number;
  workout_type: number | null;
  suffer_score: number | null;
}
