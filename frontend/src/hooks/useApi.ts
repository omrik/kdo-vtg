import { useCallback } from 'react'
import type { VideoItem, Folder, ContentItem, Collection, Project, DuplicateInfo, ScanJob, Stats } from '../types'

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export function useApi(token: string | null, API_BASE: string) {
  
  const fetchFolders = useCallback(async (): Promise<Folder[]> => {
    const res = await fetch(`${API_BASE}/api/folders`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.folders || []
  }, [token, API_BASE])

  const fetchFolderContents = useCallback(async (path: string): Promise<ContentItem[]> => {
    const res = await fetch(`${API_BASE}/api/folders/${encodeURIComponent(path)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.contents || []
  }, [token, API_BASE])

  const fetchVideos = useCallback(async (params?: {
    folder_path?: string
    tag?: string
    resolution?: string
    camera?: string
    min_duration?: string
    max_duration?: string
    search?: string
  }): Promise<VideoItem[]> => {
    const searchParams = new URLSearchParams()
    if (params?.folder_path) searchParams.set('folder_path', params.folder_path)
    if (params?.tag) searchParams.set('tag', params.tag)
    if (params?.resolution) searchParams.set('resolution', params.resolution)
    if (params?.camera) searchParams.set('camera_type', params.camera)
    if (params?.min_duration) searchParams.set('min_duration', params.min_duration)
    if (params?.max_duration) searchParams.set('max_duration', params.max_duration)
    if (params?.search) searchParams.set('search', params.search)
    
    const url = `${API_BASE}/api/videos${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.videos || []
  }, [token, API_BASE])

  const fetchAllTags = useCallback(async (): Promise<string[]> => {
    const res = await fetch(`${API_BASE}/api/tags`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.tags || []
  }, [token, API_BASE])

  const fetchStats = useCallback(async (): Promise<Stats | null> => {
    const res = await fetch(`${API_BASE}/api/stats`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) return null
    return await res.json()
  }, [token, API_BASE])

  const fetchScanStatus = useCallback(async (scanId: number): Promise<ScanJob | null> => {
    const res = await fetch(`${API_BASE}/api/scan/${scanId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) return null
    return await res.json()
  }, [token, API_BASE])

  const fetchCollections = useCallback(async (): Promise<Collection[]> => {
    const res = await fetch(`${API_BASE}/api/collections`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.collections || []
  }, [token, API_BASE])

  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    const res = await fetch(`${API_BASE}/api/projects`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.projects || []
  }, [token, API_BASE])

  const fetchDuplicates = useCallback(async (): Promise<DuplicateInfo[]> => {
    const res = await fetch(`${API_BASE}/api/videos/duplicates`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.duplicates || []
  }, [token, API_BASE])

  const fetchCollectionVideos = useCallback(async (collectionId: number): Promise<VideoItem[]> => {
    const res = await fetch(`${API_BASE}/api/collections/${collectionId}/videos`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.videos || []
  }, [token, API_BASE])

  const fetchProjectVideos = useCallback(async (projectId: number): Promise<VideoItem[]> => {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/videos`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    return data.videos || []
  }, [token, API_BASE])

  const addToCollection = useCallback(async (videoId: number, collectionId: number): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/collections/${collectionId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ video_id: videoId })
    })
    return res.ok
  }, [token, API_BASE])

  const addToProject = useCallback(async (videoId: number, projectId: number): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ video_id: videoId })
    })
    return res.ok
  }, [token, API_BASE])

  const createCollection = useCallback(async (name: string): Promise<Collection | null> => {
    const res = await fetch(`${API_BASE}/api/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ name })
    })
    if (!res.ok) return null
    return await res.json()
  }, [token, API_BASE])

  const createProject = useCallback(async (name: string): Promise<Project | null> => {
    const res = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ name })
    })
    if (!res.ok) return null
    return await res.json()
  }, [token, API_BASE])

  const deleteCollection = useCallback(async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/collections/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return res.ok
  }, [token, API_BASE])

  const deleteProject = useCallback(async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/projects/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return res.ok
  }, [token, API_BASE])

  const batchAddTag = useCallback(async (videoIds: number[], tag: string): Promise<number> => {
    const res = await fetch(`${API_BASE}/api/videos/batch/add-tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ video_ids: videoIds, tag })
    })
    if (!res.ok) return 0
    const data = await res.json()
    return data.updated || 0
  }, [token, API_BASE])

  const batchRemoveTag = useCallback(async (videoIds: number[], tag: string): Promise<number> => {
    const res = await fetch(`${API_BASE}/api/videos/batch/remove-tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ video_ids: videoIds, tag })
    })
    if (!res.ok) return 0
    const data = await res.json()
    return data.updated || 0
  }, [token, API_BASE])

  const deleteVideo = useCallback(async (id: number): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/videos/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return res.ok
  }, [token, API_BASE])

  const exportVideos = useCallback(async (videoIds: number[], format: 'csv' | 'excel' | 'edl' | 'pdf'): Promise<Blob | null> => {
    const res = await fetch(`${API_BASE}/api/export/${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ video_ids: videoIds })
    })
    if (!res.ok) return null
    return await res.blob()
  }, [token, API_BASE])

  const startScan = useCallback(async (folderPath: string, settings: {
    yolo_enabled: boolean
    scene_detection_enabled: boolean
    shot_type_enabled: boolean
    color_palette_enabled: boolean
    sample_interval: number
  }): Promise<ScanJob | null> => {
    const res = await fetch(`${API_BASE}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ folder_path: folderPath, ...settings })
    })
    if (!res.ok) return null
    return await res.json()
  }, [token, API_BASE])

  const cancelScan = useCallback(async (scanId: number): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/scan/${scanId}/cancel`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return res.ok
  }, [token, API_BASE])

  const addTagToVideo = useCallback(async (videoId: number, tag: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/videos/${videoId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ tag })
    })
    return res.ok
  }, [token, API_BASE])

  const removeTagFromVideo = useCallback(async (videoId: number, tag: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/api/videos/${videoId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    return res.ok
  }, [token, API_BASE])

  const rateVideo = useCallback(async (videoId: number, rating: number): Promise<number | null> => {
    const res = await fetch(`${API_BASE}/api/videos/${videoId}/rating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ rating })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.rating
  }, [token, API_BASE])

  const getVideo = useCallback(async (videoId: number): Promise<VideoItem | null> => {
    const res = await fetch(`${API_BASE}/api/videos/${videoId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) return null
    return await res.json()
  }, [token, API_BASE])

  return {
    fetchFolders,
    fetchFolderContents,
    fetchVideos,
    fetchAllTags,
    fetchStats,
    fetchScanStatus,
    fetchCollections,
    fetchProjects,
    fetchDuplicates,
    fetchCollectionVideos,
    fetchProjectVideos,
    addToCollection,
    addToProject,
    createCollection,
    createProject,
    deleteCollection,
    deleteProject,
    batchAddTag,
    batchRemoveTag,
    deleteVideo,
    exportVideos,
    startScan,
    cancelScan,
    addTagToVideo,
    removeTagFromVideo,
    rateVideo,
    getVideo,
  }
}
