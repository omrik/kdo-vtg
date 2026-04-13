import { useState, useEffect } from 'react'
import {
  FolderOpen, Play, RefreshCw, Tag,
  Plus, LogIn, Bookmark, Briefcase,
} from 'lucide-react'

import { Sidebar } from './components/Sidebar'
import { FoldersView } from './components/FoldersView'
import { ResultsView } from './components/ResultsView'
import { CollectionsView } from './components/CollectionsView'
import { ProjectsView } from './components/ProjectsView'
import { DuplicatesView } from './components/DuplicatesView'
import { SettingsView } from './components/SettingsView'
import { VideoModal } from './components/VideoModal'

import type { 
  User, Folder, ContentItem, VideoItem, Collection, Project, 
  DuplicateInfo, ScanJob 
} from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

type Tab = 'folders' | 'scan' | 'results' | 'collections' | 'projects' | 'duplicates' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('folders')
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentPath, setCurrentPath] = useState<string>('/media')
  const [contents, setContents] = useState<ContentItem[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [currentScan, setCurrentScan] = useState<ScanJob | null>(null)
  const [loading, setLoading] = useState(false)
  const [, setError] = useState<string | null>(null)

  const [scanSettings, setScanSettings] = useState({
    yolo_enabled: false,
    scene_detection_enabled: false,
    shot_type_enabled: false,
    color_palette_enabled: false,
    sample_interval: 10,
    model_name: 'yolov8n.pt',
    afterScan: 'none' as 'none' | 'createByTag',
  })

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))

  const [collections, setCollections] = useState<Collection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [stats, setStats] = useState<{ total_videos: number; total_duration: number; total_size: number; total_duration_hours?: string; resolutions: string[]; cameras: string[] } | null>(null)

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [showAddToModal, setShowAddToModal] = useState<'collection' | 'project' | null>(null)
  const [addToVideoId, setAddToVideoId] = useState<number | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')

  const [viewingCollection, setViewingCollection] = useState<Collection | null>(null)
  const [viewingProject, setViewingProject] = useState<Project | null>(null)
  const [collectionVideos, setCollectionVideos] = useState<VideoItem[]>([])
  const [projectVideos, setProjectVideos] = useState<VideoItem[]>([])

  const [isFirstRun, setIsFirstRun] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  const [appVersion] = useState<string>('Loading...')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [isRegister, setIsRegister] = useState(false)

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        setToken(storedToken)
        await fetchMe()
        fetchFolders()
        fetchStats()
        fetchCollections()
        fetchProjects()
      } else {
        await checkSetupStatus()
      }
      setAppLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (token) {
      fetchMe()
      fetchFolders()
      fetchStats()
      fetchCollections()
      fetchProjects()
    }
  }, [token])

  const checkSetupStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/setup-status`)
      const data = await res.json()
      if (data.needs_setup) {
        setIsFirstRun(true)
        setNeedsSetup(true)
        setShowLoginModal(true)
      } else {
        setNeedsSetup(true)
      }
    } catch (err) {
      setError('Failed to check setup status')
    }
  }

  const fetchMe = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      }
    } catch (err) {
      setError('Failed to fetch user')
    }
  }

  const handleLogin = async () => {
    try {
      const endpoint = isFirstRun ? '/api/auth/register' : '/api/auth/login'
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const data = await res.json()
      if (res.ok) {
        setToken(data.access_token)
        localStorage.setItem('token', data.access_token)
        setShowLoginModal(false)
        setIsFirstRun(false)
        fetchMe()
        fetchFolders()
        fetchStats()
        fetchCollections()
        fetchProjects()
      } else {
        setError(data.detail || 'Login failed')
      }
    } catch (err) {
      setError('Login failed')
    }
  }

  const handleLogout = () => {
    setToken(null)
    localStorage.removeItem('token')
    setUser(null)
    setVideos([])
    setFolders([])
    setCollections([])
    setProjects([])
  }

  const exportDatabase = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/export-db`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'kdo-vtg.db'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Failed to export database')
    }
  }

  const importDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/api/settings/import-db`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      })
      if (res.ok) {
        alert('Database imported successfully!')
        window.location.reload()
      }
    } catch (err) {
      setError('Failed to import database')
    }
  }

  const resetDatabase = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/reset-db`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        alert('Database reset successfully!')
        window.location.reload()
      }
    } catch (err) {
      setError('Failed to reset database')
    }
  }

  const fetchFolders = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/folders`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      }
    } catch (err) {
      setError('Failed to fetch folders')
    } finally {
      setLoading(false)
    }
  }

  const fetchFolderContents = async (path: string) => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/folders/contents?path=${encodeURIComponent(path)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setContents(data.contents || [])
        setCurrentPath(path)
      }
    } catch (err) {
      setError('Failed to fetch folder contents')
    } finally {
      setLoading(false)
    }
  }

  const fetchVideos = async (folderPath?: string) => {
    try {
      setLoading(true)
      const url = folderPath 
        ? `${API_BASE}/api/videos?folder_path=${encodeURIComponent(folderPath)}`
        : `${API_BASE}/api/videos`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setVideos(data.videos || [])
      }
    } catch (err) {
      setError('Failed to fetch videos')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllTags = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tags`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setAllTags(data.tags || [])
      }
    } catch (err) {
      setError('Failed to fetch tags')
    }
  }

  const addTagToVideo = async (videoId: number, tag: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/${videoId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tag }),
      })
      if (res.ok) {
        const data = await res.json()
        const updatedVideos = videos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v)
        setVideos(updatedVideos)
        setCollectionVideos(collectionVideos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v))
        setProjectVideos(projectVideos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v))
        if (editingVideo && editingVideo.id === videoId) {
          setEditingVideo({ ...editingVideo, tags: data.tags })
        }
        fetchAllTags()
      }
    } catch (err) {
      setError('Failed to add tag')
    }
  }

  const removeTagFromVideo = async (videoId: number, tag: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/${videoId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        const updatedVideos = videos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v)
        setVideos(updatedVideos)
        setCollectionVideos(collectionVideos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v))
        setProjectVideos(projectVideos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v))
        if (editingVideo && editingVideo.id === videoId) {
          setEditingVideo({ ...editingVideo, tags: data.tags })
        }
        fetchAllTags()
      }
    } catch (err) {
      setError('Failed to remove tag')
    }
  }

  const rateVideo = async (videoId: number, rating: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/${videoId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating }),
      })
      if (res.ok) {
        const data = await res.json()
        const updatedVideos = videos.map(v => v.id === videoId ? { ...v, rating: data.rating } : v)
        setVideos(updatedVideos)
        setCollectionVideos(collectionVideos.map(v => v.id === videoId ? { ...v, rating: data.rating } : v))
        setProjectVideos(projectVideos.map(v => v.id === videoId ? { ...v, rating: data.rating } : v))
        if (editingVideo && editingVideo.id === videoId) {
          setEditingVideo({ ...editingVideo, rating: data.rating })
        }
      }
    } catch (err) {
      setError('Failed to rate video')
    }
  }

  const openVideoModal = async (video: VideoItem) => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/${video.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const freshVideo = await res.json()
        setEditingVideo(freshVideo)
        fetchAllTags()
      } else {
        setEditingVideo(video)
      }
    } catch (err) {
      setEditingVideo(video)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setStats({
          ...data,
          resolutions: Object.keys(data.resolutions || {}),
          cameras: Object.keys(data.cameras || {}),
        })
      }
    } catch (err) {
      setError('Failed to fetch stats')
    }
  }

  const fetchScanStatus = async (scanId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/scan/${scanId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentScan(data)
        if (data.status === 'running' || data.status === 'pending') {
          setTimeout(() => fetchScanStatus(scanId), 2000)
        } else if (data.status === 'completed') {
          fetchVideos()
          fetchStats()
          fetchFolders()
        }
      }
    } catch (err) {
      setError('Failed to fetch scan status')
    }
  }

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/collections`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setCollections(data.collections || [])
      }
    } catch (err) {
      setError('Failed to fetch collections')
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch (err) {
      setError('Failed to fetch projects')
    }
  }

  const fetchDuplicates = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/videos/duplicates`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setDuplicates(data.duplicates || [])
      }
    } catch (err) {
      setError('Failed to fetch duplicates')
    } finally {
      setLoading(false)
    }
  }

  const addToCollection = async (videoId: number, collectionId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/collections/${collectionId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ video_id: videoId })
      })
      if (res.ok) {
        fetchCollections()
      }
    } catch (err) {
      setError('Failed to add to collection')
    }
  }

  const addToProject = async (videoId: number, projectId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ video_id: videoId })
      })
      if (res.ok) {
        fetchProjects()
      }
    } catch (err) {
      setError('Failed to add to project')
    }
  }

  const fetchCollectionVideos = async (collectionId: number) => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/collections/${collectionId}/videos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setCollectionVideos(data.videos || [])
      }
    } catch (err) {
      setError('Failed to fetch collection videos')
    } finally {
      setLoading(false)
    }
  }

  const createCollectionsByTag = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/auto-create-collections-by-tag`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        alert(`Created ${data.collections_created} collections from tags`)
        fetchCollections()
      }
    } catch (err) {
      setError('Failed to create collections by tag')
    }
  }

  const createCollectionsByRating = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) throw new Error('Failed to fetch videos')
      
      const data = await res.json()
      const videos = data.videos
      const ratings = [5, 4, 3, 2, 1]
      let created = 0
      
      for (const rating of ratings) {
        const ratedVideos = videos.filter((v: VideoItem) => v.rating === rating)
        if (ratedVideos.length > 0) {
          const name = `${rating} Star${rating !== 1 ? 's' : ''}`
          const createRes = await fetch(`${API_BASE}/api/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ name, color: '#f59e0b' })
          })
          if (createRes.ok) {
            const collection = await createRes.json()
            for (const video of ratedVideos) {
              await fetch(`${API_BASE}/api/collections/${collection.id}/videos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ video_id: video.id })
              })
            }
            created++
          }
        }
      }
      
      alert(`Created ${created} collections from ratings`)
      fetchCollections()
    } catch (err) {
      setError('Failed to create collections by rating')
    }
  }

  const deleteCollection = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/collections/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        fetchCollections()
        setViewingCollection(null)
      }
    } catch (err) {
      setError('Failed to delete collection')
    }
  }

  const deleteProject = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        fetchProjects()
        setViewingProject(null)
      }
    } catch (err) {
      setError('Failed to delete project')
    }
  }

  const fetchProjectVideos = async (projectId: number) => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/videos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setProjectVideos(data.videos || [])
      }
    } catch (err) {
      setError('Failed to fetch project videos')
    } finally {
      setLoading(false)
    }
  }

  const batchAddTag = async (tag: string) => {
    const ids = Array.from(selectedVideos)
    try {
      const res = await fetch(`${API_BASE}/api/videos/batch/add-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ video_ids: ids, tag })
      })
      if (res.ok) {
        fetchVideos()
        fetchAllTags()
      }
    } catch (err) {
      setError('Failed to batch add tag')
    }
  }

  const batchDeleteSelected = async () => {
    const ids = Array.from(selectedVideos)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} video(s)?`)) return
    try {
      const res = await fetch(`${API_BASE}/api/videos/batch/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ video_ids: ids })
      })
      if (res.ok) {
        setSelectedVideos(new Set())
        fetchVideos()
      }
    } catch (err) {
      setError('Failed to batch delete videos')
    }
  }

  const toggleVideoSelection = (videoId: number) => {
    const newSelected = new Set(selectedVideos)
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId)
    } else {
      newSelected.add(videoId)
    }
    setSelectedVideos(newSelected)
  }

  const createCollection = async () => {
    if (!newCollectionName.trim()) return
    try {
      const res = await fetch(`${API_BASE}/api/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: newCollectionName.trim() })
      })
      if (res.ok) {
        setNewCollectionName('')
        setShowNewCollectionModal(false)
        fetchCollections()
      }
    } catch (err) {
      setError('Failed to create collection')
    }
  }

  const createProject = async () => {
    if (!newProjectName.trim()) return
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: newProjectName.trim() })
      })
      if (res.ok) {
        setNewProjectName('')
        setShowNewProjectModal(false)
        fetchProjects()
      }
    } catch (err) {
      setError('Failed to create project')
    }
  }

  const startScan = async () => {
    if (!selectedFolder) return
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          folder_path: selectedFolder,
          ...scanSettings
        })
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentScan(data)
        setActiveTab('results')
        fetchScanStatus(data.id)
      }
    } catch (err) {
      setError('Failed to start scan')
    } finally {
      setLoading(false)
    }
  }

  const cancelScan = async () => {
    if (!currentScan) return
    try {
      await fetch(`${API_BASE}/api/scan/${currentScan.id}/cancel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      setCurrentScan(null)
    } catch (err) {
      setError('Failed to cancel scan')
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (appLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  return (
    <div className="app">
      {user ? (
        <>
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab as any} 
            currentScan={currentScan}
          />
          <main className="main">
            {activeTab === 'folders' && (
              <FoldersView
                folders={folders}
                contents={contents}
                currentPath={currentPath}
                loading={loading}
                onFolderSelect={(f) => { setSelectedFolder(f.path); setActiveTab('scan'); }}
                onContentSelect={(item) => {
                  if (item.type === 'folder') {
                    fetchFolderContents(item.path)
                  } else {
                    fetchVideos(item.path)
                    setActiveTab('results')
                  }
                }}
                onBack={() => {
                  const parts = currentPath.split('/').filter(Boolean)
                  if (parts.length > 1) {
                    parts.pop()
                    fetchFolderContents('/' + parts.join('/'))
                  } else {
                    setCurrentPath('/media')
                    setContents([])
                  }
                }}
                onRefresh={fetchFolders}
                onCreateFolder={() => {}}
              />
            )}

            {activeTab === 'scan' && selectedFolder && (
              <ScanView
                selectedFolder={selectedFolder}
                scanSettings={scanSettings}
                setScanSettings={setScanSettings}
                currentScan={currentScan}
                loading={loading}
                onStartScan={startScan}
                onCancelScan={cancelScan}
                onChangeFolder={() => setActiveTab('folders')}
                stats={stats}
              />
            )}

            {activeTab === 'results' && (
              <ResultsView
                videos={videos}
                loading={loading}
                viewMode={viewMode}
                setViewMode={setViewMode}
                selectedVideos={selectedVideos}
                onToggleSelect={toggleVideoSelection}
                onOpenVideo={openVideoModal}
                onBatchAddTag={batchAddTag}
                onBatchDelete={() => batchDeleteSelected()}
                onSelectAll={() => setSelectedVideos(new Set(videos.map(v => v.id)))}
                onClearSelection={() => setSelectedVideos(new Set())}
                onAddToCollection={(id) => { setAddToVideoId(id); setShowAddToModal('collection'); }}
                onAddToProject={(id) => { setAddToVideoId(id); setShowAddToModal('project'); }}
                onRefresh={() => fetchVideos()}
                formatDuration={formatDuration}
                API_BASE={API_BASE}
              />
            )}

            {activeTab === 'collections' && (
              <CollectionsView
                collections={collections}
                viewingCollection={viewingCollection}
                collectionVideos={collectionVideos}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onViewCollection={(col) => { setViewingCollection(col); fetchCollectionVideos(col.id); }}
                onCloseCollection={() => setViewingCollection(null)}
                onDeleteCollection={deleteCollection}
                onCreateByTag={createCollectionsByTag}
                onCreateByRating={createCollectionsByRating}
                onShowNewModal={() => setShowNewCollectionModal(true)}
                onOpenVideo={openVideoModal}
                formatDuration={formatDuration}
                API_BASE={API_BASE}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsView
                projects={projects}
                viewingProject={viewingProject}
                projectVideos={projectVideos}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onViewProject={(proj) => { setViewingProject(proj); fetchProjectVideos(proj.id); }}
                onCloseProject={() => setViewingProject(null)}
                onDeleteProject={deleteProject}
                onShowNewModal={() => setShowNewProjectModal(true)}
                onOpenVideo={openVideoModal}
                onRefresh={fetchProjects}
                formatDuration={formatDuration}
                API_BASE={API_BASE}
              />
            )}

            {activeTab === 'duplicates' && (
              <DuplicatesView
                duplicates={duplicates}
                loading={loading}
                onRefresh={fetchDuplicates}
                onDelete={() => fetchVideos()}
                formatDuration={formatDuration}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                user={user}
                appVersion={appVersion}
                onLogout={handleLogout}
                onExportDb={exportDatabase}
                onImportDb={importDatabase}
                onResetDb={resetDatabase}
              />
            )}

            {showLoginModal && (
              <div className="modal-overlay" onClick={isFirstRun ? undefined : () => setShowLoginModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>{isFirstRun ? 'Welcome! Create Admin Account' : isRegister ? 'Register' : 'Login'}</h2>
                  {isFirstRun && (
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                      Create your admin account to get started.
                    </p>
                  )}
                  <div className="form-group">
                    <label>Username</label>
                    <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={handleLogin}>
                      {isFirstRun ? 'Create Account' : isRegister ? 'Register' : 'Login'}
                    </button>
                    {!isFirstRun && (
                      <button className="btn btn-secondary" onClick={() => setShowLoginModal(false)}>Cancel</button>
                    )}
                  </div>
                  {needsSetup && (
                    <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                      <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(!isRegister) }}>
                        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {showNewCollectionModal && (
              <div className="modal-overlay" onClick={() => { setShowNewCollectionModal(false); setNewCollectionName(''); }}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>New Collection</h2>
                  <div className="form-group">
                    <label>Name</label>
                    <input type="text" value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder="e.g., Summer 2024" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={createCollection}>Create</button>
                    <button className="btn btn-secondary" onClick={() => { setShowNewCollectionModal(false); setNewCollectionName(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {showNewProjectModal && (
              <div className="modal-overlay" onClick={() => { setShowNewProjectModal(false); setNewProjectName(''); }}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>New Project</h2>
                  <div className="form-group">
                    <label>Name</label>
                    <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g., Wedding Edit" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={createProject}>Create</button>
                    <button className="btn btn-secondary" onClick={() => { setShowNewProjectModal(false); setNewProjectName(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {showAddToModal && (
              <div className="modal-overlay" onClick={() => { setShowAddToModal(null); setAddToVideoId(null); }}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>Add to {showAddToModal === 'collection' ? 'Collection' : 'Project'}</h2>
                  <button className="btn btn-link" style={{ marginBottom: '1rem' }} onClick={() => { showAddToModal === 'collection' ? fetchCollections() : fetchProjects(); }}>
                    <RefreshCw size={14} /> Refresh list
                  </button>
                  {showAddToModal === 'collection' ? (
                    collections.length === 0 ? (
                      <div>
                        <p style={{ color: 'var(--text-secondary)' }}>No collections yet.</p>
                        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowNewCollectionModal(true)}>
                          <Plus size={14} /> Create Collection
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {collections.map(col => (
                          <button key={col.id} className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { addToCollection(addToVideoId!, col.id); setShowAddToModal(null); setAddToVideoId(null); }}>
                            <Bookmark size={14} style={{ color: col.color }} /> {col.name} ({col.video_count} videos)
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    projects.length === 0 ? (
                      <div>
                        <p style={{ color: 'var(--text-secondary)' }}>No projects yet.</p>
                        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowNewProjectModal(true)}>
                          <Plus size={14} /> Create Project
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {projects.map(proj => (
                          <button key={proj.id} className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { addToProject(addToVideoId!, proj.id); setShowAddToModal(null); setAddToVideoId(null); }}>
                            <Briefcase size={14} /> {proj.name} ({proj.video_count} videos)
                          </button>
                        ))}
                      </div>
                    )
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => { setShowAddToModal(null); setAddToVideoId(null); }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {editingVideo && (
              <VideoModal
                video={editingVideo}
                onClose={() => setEditingVideo(null)}
                onRate={rateVideo}
                onAddTag={addTagToVideo}
                onRemoveTag={removeTagFromVideo}
                allTags={allTags}
                formatDuration={formatDuration}
                api={{ API_BASE }}
                token={token}
              />
            )}
          </main>
        </>
      ) : (
        <div className="empty-state">
          <LogIn size={48} />
          <h2>Please Login</h2>
          <p>You need to be logged in to use this application.</p>
          <button className="btn btn-primary" onClick={() => setShowLoginModal(true)} style={{ marginTop: '1rem' }}>
            <LogIn size={16} /> Login
          </button>
        </div>
      )}
    </div>
  )
}

function ScanView({ selectedFolder, scanSettings, setScanSettings, currentScan, loading, onStartScan, onCancelScan, onChangeFolder, stats }: {
  selectedFolder: string
  scanSettings: any
  setScanSettings: any
  currentScan: ScanJob | null
  loading: boolean
  onStartScan: () => void
  onCancelScan: () => void
  onChangeFolder: () => void
  stats: { total_videos: number; total_duration: number; total_size: number; total_duration_hours?: string; resolutions: string[]; cameras: string[] } | null
}) {
  return (
    <div className="main-content">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><Play size={20} /> Scan Folder</h2>
        </div>

        <div className="settings-grid">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ marginBottom: '0.5rem' }}>Scan Options</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={scanSettings.yolo_enabled} onChange={(e) => setScanSettings({ ...scanSettings, yolo_enabled: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>Object Detection</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Detect objects in video frames</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={scanSettings.scene_detection_enabled} onChange={(e) => setScanSettings({ ...scanSettings, scene_detection_enabled: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>Scene Detection</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Detect scene changes</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={scanSettings.shot_type_enabled} onChange={(e) => setScanSettings({ ...scanSettings, shot_type_enabled: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>Shot Type Analysis</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Classify shots as WS/MS/CU</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={scanSettings.color_palette_enabled} onChange={(e) => setScanSettings({ ...scanSettings, color_palette_enabled: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>Color Palette</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Extract dominant colors</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={scanSettings.afterScan === 'createByTag'} onChange={(e) => setScanSettings({ ...scanSettings, afterScan: e.target.checked ? 'createByTag' : 'none' })} style={{ width: '18px', height: '18px' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>Create by Tag</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Auto-create collections</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="sample_interval">Sample Interval (seconds)</label>
            <input type="number" id="sample_interval" min={1} max={60} value={scanSettings.sample_interval} onChange={(e) => setScanSettings({ ...scanSettings, sample_interval: parseInt(e.target.value) })} style={{ width: '80px' }} />
          </div>
        </div>

        {currentScan && currentScan.status === 'running' && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div className="spinner-small" />
              <span>Scanning... {currentScan.processed_files}/{currentScan.total_files} files</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${(currentScan.processed_files / currentScan.total_files) * 100}%`, height: '100%', background: 'var(--primary)' }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Selected: </span>
            <span style={{ fontWeight: 500 }}>{selectedFolder}</span>
          </div>
          <button className="btn btn-secondary" onClick={onChangeFolder}>
            <FolderOpen size={16} /> Change Folder
          </button>
          {currentScan?.status === 'running' ? (
            <button className="btn btn-danger" onClick={onCancelScan}>Cancel</button>
          ) : (
            <button className="btn btn-primary" onClick={onStartScan} disabled={loading}>
              <Play size={16} /> Start Scan
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><Tag size={20} /> Statistics</h2>
        </div>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-value">{stats?.total_videos ?? '-'}</div><div className="stat-label">Total Videos</div></div>
          <div className="stat-card"><div className="stat-value">{stats?.total_duration_hours ?? '-'}</div><div className="stat-label">Hours of Video</div></div>
          <div className="stat-card"><div className="stat-value">{stats?.resolutions?.length ?? '-'}</div><div className="stat-label">Resolutions</div></div>
          <div className="stat-card"><div className="stat-value">{stats?.cameras?.length ?? '-'}</div><div className="stat-label">Camera Types</div></div>
        </div>
      </div>
    </div>
  )
}

export default App
