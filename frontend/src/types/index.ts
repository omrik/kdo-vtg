export interface VideoItem {
  id: number
  filename: string
  filepath: string
  resolution: string | null
  width: number | null
  height: number | null
  duration: number | null
  fps: number | null
  codec: string | null
  camera_type: string | null
  date_created: string | null
  file_size: number | null
  tags: string[] | null
  scenes: Scene[] | null
  shot_types: ShotTypeInfo | null
  color_palette: ColorInfo[] | null
  gps_data: GpsInfo | null
  rating: number | null
  yolo_enabled: boolean
  scene_detection_enabled: boolean
  created_at: string
  thumbnail: string | null
}

export interface Scene {
  start_frame: number
  end_frame: number
  start_time: number
  end_time: number
  duration: number
  timestamp: number
}

export interface ShotTypeInfo {
  dominant_shot: string
  counts: { WS: number; MS: number; CU: number; ECU: number }
  total_analyzed: number
}

export interface ColorInfo {
  rgb: number[]
  hex: string
  percentage: number
}

export interface GpsInfo {
  latitude: number
  longitude: number
  altitude?: number
}

export interface Collection {
  id: number
  name: string
  description: string | null
  color: string
  video_count: number
  created_at: string
}

export interface Project {
  id: number
  name: string
  description: string | null
  status: string
  video_count: number
  created_at: string
}

export interface User {
  id: number
  username: string
  is_admin: boolean
}

export interface Folder {
  path: string
  name: string
  video_count: number
}

export interface FolderContent {
  name: string
  path: string
  type: 'folder' | 'video'
  video_count?: number
}

export interface Stats {
  total_videos: number
  total_duration_hours: number
  resolutions: { resolution: string; count: number }[]
  cameras: { camera: string; count: number }[]
  top_tags: [string, number][]
}

export interface DuplicateInfo {
  original: { id: number; filepath: string; filename: string }
  duplicate: { id: number; filepath: string; filename: string }
  filename: string
  duration: number | null
  resolution: string | null
  file_size: number | null
}

export interface ScanJob {
  id: number
  folder_path: string
  status: string
  total_files: number
  processed_files: number
  yolo_enabled: boolean
  sample_interval: number
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  progress: number
}

export interface ContentItem {
  name: string
  path: string
  type: 'folder' | 'video'
  video_count?: number
  size?: number
}

export type Tab = 'folders' | 'scan' | 'results' | 'collections' | 'projects' | 'duplicates' | 'settings'
