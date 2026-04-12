import { useState, useEffect } from 'react'
import {
  Video,
  FolderOpen,
  Play,
  X,
  RefreshCw,
  FileVideo,
  Tag,
  ChevronRight,
  Home,
  Bookmark,
  Briefcase,
  Settings,
  LogOut,
  LogIn,
  Plus,
  Trash2,
  Download,
  Upload,
  Grid,
  List,
  Image,
  FolderPlus,
  BriefcaseIcon,
} from 'lucide-react'

interface User {
  id: number
  username: string
  is_admin: boolean
}

interface Folder {
  name: string
  path: string
  video_count: number
}

interface ContentItem {
  name: string
  path: string
  type: 'folder' | 'video'
  video_count?: number
  size?: number
}

interface VideoItem {
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
  yolo_enabled: boolean
  created_at: string
  thumbnail: string | null
}

interface ScanJob {
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

interface Stats {
  total_videos: number
  total_duration_hours: number
  resolutions: { resolution: string; count: number }[]
  cameras: { camera: string; count: number }[]
  top_tags: [string, number][]
}

interface Collection {
  id: number
  name: string
  description: string | null
  color: string
  video_count: number
  created_at: string
}

interface Project {
  id: number
  name: string
  description: string | null
  status: string
  video_count: number
  created_at: string
}

type Tab = 'folders' | 'scan' | 'results' | 'collections' | 'projects' | 'settings'

const API_BASE = import.meta.env.VITE_API_URL || ''

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('folders')
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentPath, setCurrentPath] = useState<string>('/media')
  const [contents, setContents] = useState<ContentItem[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [currentScan, setCurrentScan] = useState<ScanJob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [scanSettings, setScanSettings] = useState<{
    yolo_enabled: boolean
    sample_interval: number
    model_name: string
    afterScan: 'none' | 'createByTag'
  }>({
    yolo_enabled: false,
    sample_interval: 10,
    model_name: 'yolov8n.pt',
    afterScan: 'none',
  })

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))

  const [collections, setCollections] = useState<Collection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [showAddToModal, setShowAddToModal] = useState<'collection' | 'project' | null>(null)
  const [addToVideoId, setAddToVideoId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    resolution: '',
    camera: '',
    minDuration: '',
    maxDuration: '',
    search: '',
  })

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [viewingCollection, setViewingCollection] = useState<Collection | null>(null)
  const [viewingProject, setViewingProject] = useState<Project | null>(null)
  const [collectionVideos, setCollectionVideos] = useState<VideoItem[]>([])
  const [projectVideos, setProjectVideos] = useState<VideoItem[]>([])
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [appLoading, setAppLoading] = useState(true)

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
      fetchAllTags()
    }
  }, [token])

  const checkSetupStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/setup-status`)
      const data = await res.json()
      setNeedsSetup(data.needs_setup)
      if (data.needs_setup) {
        setIsFirstRun(true)
        setIsRegister(true)
        setShowLoginModal(true)
      }
    } catch (err) {
      console.error('Failed to check setup status')
    }
  }

  const fetchMe = async () => {
    try {
      const storedToken = localStorage.getItem('token')
      if (!storedToken) return
      
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        setToken(storedToken)
      } else {
        setToken(null)
        localStorage.removeItem('token')
        setUser(null)
      }
    } catch (err) {
      console.error('Failed to fetch user')
    }
  }

  const handleLogin = async () => {
    setError(null)
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      if (res.ok) {
        setToken(data.access_token)
        setUser(data.user)
        localStorage.setItem('token', data.access_token)
        setShowLoginModal(false)
        setLoginForm({ username: '', password: '' })
        setError(null)
        if (isFirstRun) {
          setIsFirstRun(false)
          setIsRegister(false)
        }
      } else {
        setError(data.detail || `Error: ${res.status}`)
      }
    } catch (err) {
      setError(`Connection failed: ${err}`)
    }
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    setError(null)
    localStorage.removeItem('token')
    setActiveTab('folders')
  }
  const exportDatabase = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/export-db`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'kdo-vtg.db'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      setError('Failed to export database')
    }
  }

  const importDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.confirm('This will replace your current database. Are you sure?')) return
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/api/settings/import-db`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      })
      if (res.ok) {
        alert('Database imported. Please refresh the page.')
        window.location.reload()
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to import database')
      }
    } catch (err) {
      setError('Failed to import database')
    }
    e.target.value = ''
  }

  const resetDatabase = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/reset-db`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        alert('Database reset. Please refresh the page.')
        window.location.reload()
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to reset database')
      }
    } catch (err) {
      setError('Failed to reset database')
    }
  }

  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/folders`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setFolders(data.folders || [])
    } catch (err) {
      setError('Failed to fetch folders')
    }
  }

  const fetchFolderContents = async (path: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/folders/${encodeURIComponent(path)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setContents(data.contents || [])
      setCurrentPath(path)
    } catch (err) {
      setError('Failed to fetch folder contents')
    } finally {
      setLoading(false)
    }
  }

  const fetchVideos = async (folderPath?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (folderPath) params.set('folder_path', folderPath)
      if (selectedTag) params.set('tag', selectedTag)
      if (filters.resolution) params.set('resolution', filters.resolution)
      if (filters.camera) params.set('camera_type', filters.camera)
      if (filters.minDuration) params.set('min_duration', filters.minDuration)
      if (filters.maxDuration) params.set('max_duration', filters.maxDuration)
      if (filters.search) params.set('search', filters.search)
      
      const url = `${API_BASE}/api/videos${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }
      const data = await res.json()
      setVideos(data.videos || [])
    } catch (err) {
      console.error('Failed to fetch videos:', err)
      setError(`Failed to load videos: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllTags = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tags`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setAllTags(data.tags || [])
    } catch (err) {
      console.error('Failed to fetch tags')
    }
  }

  const addTagToVideo = async (videoId: number, tag: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/${videoId}/tags`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ tag }),
      })
      if (res.ok) {
        const data = await res.json()
        setVideos(videos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v))
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
        setVideos(videos.map(v => v.id === videoId ? { ...v, tags: data.tags } : v))
        fetchAllTags()
      }
    } catch (err) {
      setError('Failed to remove tag')
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats')
    }
  }

  const fetchScanStatus = async (scanId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/scan/${scanId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setCurrentScan(data)
      if (data.status === 'running') {
        setTimeout(() => fetchScanStatus(scanId), 1000)
      } else if (data.status === 'completed') {
        fetchVideos()
        fetchStats()
      }
    } catch (err) {
      console.error('Failed to fetch scan status')
    }
  }

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/collections`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setCollections(data.collections || [])
    } catch (err) {
      console.error('Failed to fetch collections')
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (err) {
      console.error('Failed to fetch projects')
    }
  }

  const addToCollection = async (videoId: number, collectionId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/collections/${collectionId}/videos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ video_id: videoId }),
      })
      if (res.ok) {
        fetchCollections()
        setShowAddToModal(null)
        setAddToVideoId(null)
      }
    } catch (err) {
      setError('Failed to add video to collection')
    }
  }

  const addToProject = async (videoId: number, projectId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/videos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ video_id: videoId }),
      })
      if (res.ok) {
        fetchProjects()
        setShowAddToModal(null)
        setAddToVideoId(null)
      }
    } catch (err) {
      setError('Failed to add video to project')
    }
  }

  const fetchCollectionVideos = async (collectionId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/collections/${collectionId}/videos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setCollectionVideos(data.videos || [])
    } catch (err) {
      setError('Failed to fetch collection videos')
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

  const fetchProjectVideos = async (projectId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/videos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setProjectVideos(data.videos || [])
    } catch (err) {
      setError('Failed to fetch project videos')
    }
  }

  const exportVideos = async (format: 'csv' | 'excel') => {
    const videoIds = selectedVideos.size > 0 ? Array.from(selectedVideos) : videos.map(v => v.id)
    try {
      const res = await fetch(`${API_BASE}/api/export/${format}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ video_ids: videoIds }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `videos.${format === 'excel' ? 'xlsx' : 'csv'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      setError('Failed to export videos')
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
    try {
      const res = await fetch(`${API_BASE}/api/collections`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: newCollectionName }),
      })
      if (res.ok) {
        fetchCollections()
        setNewCollectionName('')
        setShowNewCollectionModal(false)
      }
    } catch (err) {
      setError('Failed to create collection')
    }
  }

  const createProject = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: newProjectName }),
      })
      if (res.ok) {
        fetchProjects()
        setNewProjectName('')
        setShowNewProjectModal(false)
      }
    } catch (err) {
      setError('Failed to create project')
    }
  }

  const startScan = async () => {
    if (!selectedFolder) {
      setError('Please select a folder to scan')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { afterScan, ...scanOptions } = scanSettings
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          folder_path: selectedFolder,
          ...scanOptions,
        }),
      })
      const data = await res.json()
      const scanId = data.scan_id
      
      // Poll for scan completion to trigger afterScan action
      if (afterScan === 'createByTag') {
        const pollScan = async () => {
          const statusRes = await fetch(`${API_BASE}/api/scan/${scanId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          })
          const statusData = await statusRes.json()
          if (statusData.status === 'completed') {
            createCollectionsByTag()
          } else if (statusData.status === 'running') {
            setTimeout(pollScan, 2000)
          }
        }
        pollScan()
      }
      
      fetchScanStatus(scanId)
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
      fetchScanStatus(currentScan.id)
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

  const tabs = [
    { id: 'folders', label: 'Folders', icon: Home },
    { id: 'scan', label: 'Scan', icon: Play },
    { id: 'results', label: 'Results', icon: FileVideo },
    { id: 'collections', label: 'Collections', icon: Bookmark },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="app">
      {appLoading && (
        <div className="loading">
          <Video size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      <header className="header">
        <h1>
          <Video size={28} />
          KDO Video Tagger
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {user && (
            <nav className="nav-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id as Tab)}
                >
                  <tab.icon size={16} />
                  <span className="nav-label">{tab.label}</span>
                </button>
              ))}
            </nav>
          )}
          {user ? (
            <button className="btn btn-secondary" onClick={handleLogout}>
              <LogOut size={16} />
              {user.username}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowLoginModal(true)}>
              <LogIn size={16} />
              Login
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {user ? (
          <>
            {activeTab === 'folders' && (
          <>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Home size={20} />
                  Media Folders
                </h2>
                <button className="btn btn-secondary" onClick={fetchFolders}>
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              {folders.length === 0 ? (
                <div className="empty-state">
                  <FolderOpen size={48} />
                  <p>No media folders found. Mount your video folders to /media</p>
                </div>
              ) : (
                <div className="folder-grid">
                  {folders.map((folder) => (
                    <div
                      key={folder.path}
                      className={`folder-card ${selectedFolder === folder.path ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedFolder(folder.path)
                        fetchFolderContents(folder.path)
                      }}
                    >
                      <div className="folder-name">
                        <FolderOpen size={20} />
                        {folder.name}
                      </div>
                      <div className="folder-info">
                        {folder.video_count} videos
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {currentPath !== '/media' && (
              <div className="card">
                <div className="card-header">
                  <div className="breadcrumb">
                    <a href="#" onClick={(e) => { e.preventDefault(); fetchFolderContents('/media') }}>media</a>
                    {currentPath.split('/').filter(Boolean).slice(1).map((part, i, arr) => (
                      <span key={i}>
                        <ChevronRight size={14} />
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            fetchFolderContents('/media/' + arr.slice(0, i + 1).join('/'))
                          }}
                        >
                          {part}
                        </a>
                      </span>
                    ))}
                  </div>
                  <button className="btn btn-secondary" onClick={() => {
                    const parentPath = currentPath.split('/').slice(0, -1).join('/')
                    if (parentPath) fetchFolderContents(parentPath)
                  }}>
                    Back
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', margin: '0 -1rem', padding: '0.75rem 1rem' }}>
                  <span>{contents.filter(c => c.type === 'folder').length} folders, {contents.filter(c => c.type === 'video').length} videos</span>
                  {selectedFolder && (
                    <button className="btn btn-primary" onClick={() => setActiveTab('scan')}>
                      <Play size={14} />
                      Scan This Folder
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="loading">Loading...</div>
                ) : contents.length === 0 ? (
                  <div className="empty-state">
                    <FileVideo size={48} />
                    <p>No videos in this folder</p>
                  </div>
                ) : (
                  <div className="folder-grid">
                    {contents.map((item) => (
                      <div
                        key={item.path}
                        className={`folder-card ${selectedFolder === item.path ? 'selected' : ''}`}
                        onClick={() => {
                          if (item.type === 'folder') {
                            setSelectedFolder(item.path)
                            fetchFolderContents(item.path)
                          } else {
                            setSelectedFolder(item.path)
                          }
                        }}
                      >
                        <div className="folder-name">
                          <FolderOpen size={20} />
                          {item.name}
                        </div>
                        <div className="folder-info">
                          {item.video_count || 0} videos
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'scan' && (
          <>
            {currentScan && currentScan.status === 'running' && (
              <>
                <div className="scan-status">
                  <span className={`status-badge status-${currentScan.status}`}>
                    {currentScan.status}
                  </span>
                  <span>
                    Processing: {currentScan.processed_files} / {currentScan.total_files} files
                  </span>
                  <span style={{ flex: 1 }}>
                    {currentScan.progress.toFixed(1)}%
                  </span>
                  <button className="btn btn-danger" onClick={cancelScan}>
                    <X size={16} />
                    Cancel
                  </button>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${currentScan.progress}%` }} />
                </div>
              </>
            )}

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Play size={20} />
                  Scan Settings
                </h2>
              </div>

              <div className="settings-grid">
                <div className="form-group">
                  <label>Selected Folder</label>
                  <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                    {selectedFolder || 'No folder selected'}
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <input
                    type="checkbox"
                    id="yolo_enabled"
                    checked={scanSettings.yolo_enabled}
                    onChange={(e) => setScanSettings({ ...scanSettings, yolo_enabled: e.target.checked })}
                  />
                  <label htmlFor="yolo_enabled">Enable Object Detection (YOLO)</label>
                </div>

                <div className="form-group">
                  <label htmlFor="sample_interval">Sample Interval (seconds)</label>
                  <input
                    type="number"
                    id="sample_interval"
                    min={1}
                    max={60}
                    value={scanSettings.sample_interval}
                    onChange={(e) => setScanSettings({ ...scanSettings, sample_interval: parseInt(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>After Scan</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="radio"
                        name="afterScan"
                        value="none"
                        checked={scanSettings.afterScan === 'none'}
                        onChange={() => setScanSettings({ ...scanSettings, afterScan: 'none' })}
                      />
                      Do nothing
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="radio"
                        name="afterScan"
                        value="createByTag"
                        checked={scanSettings.afterScan === 'createByTag'}
                        onChange={() => setScanSettings({ ...scanSettings, afterScan: 'createByTag' })}
                      />
                      Create collections by tag
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={startScan}
                  disabled={!selectedFolder || loading || (currentScan?.status === 'running')}
                >
                  <Play size={16} />
                  {currentScan?.status === 'running' ? 'Scanning...' : 'Start Scan'}
                </button>
                <button className="btn btn-secondary" onClick={() => setActiveTab('folders')}>
                  <FolderOpen size={16} />
                  Change Folder
                </button>
              </div>
            </div>

            {stats && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <Tag size={20} />
                    Statistics
                  </h2>
                </div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{stats.total_videos}</div>
                    <div className="stat-label">Total Videos</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.total_duration_hours}</div>
                    <div className="stat-label">Hours of Video</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.resolutions.length}</div>
                    <div className="stat-label">Resolutions</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.cameras.length}</div>
                    <div className="stat-label">Camera Types</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'results' && (
          <>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <FileVideo size={20} />
                  Video Results
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                    ({videos.length} videos)
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => fetchVideos(selectedFolder || undefined)}>
                    <RefreshCw size={16} />
                  </button>
                  <button 
                    className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid size={16} />
                  </button>
                  <button 
                    className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('list')}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
                  <label style={{ fontSize: '0.7rem' }}>Resolution</label>
                  <select 
                    value={filters.resolution} 
                    onChange={(e) => setFilters({...filters, resolution: e.target.value})}
                  >
                    <option value="">All</option>
                    {stats?.resolutions.map(r => (
                      <option key={r.resolution} value={r.resolution}>{r.resolution}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, minWidth: '100px' }}>
                  <label style={{ fontSize: '0.7rem' }}>Camera</label>
                  <select 
                    value={filters.camera} 
                    onChange={(e) => setFilters({...filters, camera: e.target.value})}
                  >
                    <option value="">All</option>
                    {stats?.cameras.map(c => (
                      <option key={c.camera} value={c.camera}>{c.camera}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, width: '80px' }}>
                  <label style={{ fontSize: '0.7rem' }}>Min Dur</label>
                  <input 
                    type="number" 
                    placeholder="sec"
                    value={filters.minDuration} 
                    onChange={(e) => setFilters({...filters, minDuration: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, width: '80px' }}>
                  <label style={{ fontSize: '0.7rem' }}>Max Dur</label>
                  <input 
                    type="number" 
                    placeholder="sec"
                    value={filters.maxDuration} 
                    onChange={(e) => setFilters({...filters, maxDuration: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <label style={{ fontSize: '0.7rem' }}>Search</label>
                  <input 
                    type="text" 
                    placeholder="Search filename..."
                    value={filters.search} 
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
                  <label style={{ fontSize: '0.7rem' }}>Tag</label>
                  <select 
                    value={selectedTag || ''} 
                    onChange={(e) => setSelectedTag(e.target.value || null)}
                  >
                    <option value="">All Tags</option>
                    {allTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={() => fetchVideos(selectedFolder || undefined)}>
                  Filter
                </button>
                {(filters.resolution || filters.camera || filters.minDuration || filters.maxDuration || filters.search || selectedTag) && (
                  <button className="btn btn-secondary" onClick={() => {
                    setFilters({ resolution: '', camera: '', minDuration: '', maxDuration: '', search: '' })
                    setSelectedTag(null)
                    fetchVideos(selectedFolder || undefined)
                  }}>
                    <X size={14} />
                    Clear
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px', flexWrap: 'wrap' }}>
                {selectedVideos.size > 0 && (
                  <>
                    <span>{selectedVideos.size} selected</span>
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => setShowAddToModal('collection')}>
                      <FolderPlus size={14} />
                      Collection
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => setShowAddToModal('project')}>
                      <BriefcaseIcon size={14} />
                      Project
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedVideos(new Set())}>
                      Clear
                    </button>
                  </>
                )}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {selectedVideos.size === 0 && 'No selection - '}
                  Export:
                </span>
                <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => exportVideos('csv')}>
                  <Download size={14} />
                  CSV
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => exportVideos('excel')}>
                  <Download size={14} />
                  Excel
                </button>
              </div>

              {loading ? (
                <div className="loading">Loading...</div>
              ) : videos.length === 0 ? (
                <div className="empty-state">
                  <FileVideo size={48} />
                  <p>No videos found. Scan a folder or adjust filters.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="video-grid">
                  {videos.map((video) => (
                    <div key={video.id} className="video-card" onClick={() => toggleVideoSelection(video.id)}>
                      <input 
                        type="checkbox" 
                        checked={selectedVideos.has(video.id)}
                        onChange={() => toggleVideoSelection(video.id)}
                        style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2 }}
                      />
                      <div className="video-thumbnail">
                        {video.thumbnail ? (
                          <img src={`${API_BASE}/api/thumbnails/${video.id}`} alt={video.filename} />
                        ) : (
                          <div className="no-thumbnail">
                            <Image size={32} />
                          </div>
                        )}
                        <div className="video-duration">{formatDuration(video.duration)}</div>
                        {video.yolo_enabled && (
                          <div className="yolo-badge">YOLO</div>
                        )}
                      </div>
                      <div className="video-info">
                        <div className="video-name" title={video.filename}>{video.filename}</div>
                        <div className="video-meta">
                          {video.resolution && <span>{video.resolution}</span>}
                          {video.camera_type && <span>{video.camera_type}</span>}
                        </div>
                        <div className="video-tags">
                          {video.tags?.slice(0, 3).map((tag, i) => (
                            <span key={i} className="tag" onClick={(e) => { e.stopPropagation(); removeTagFromVideo(video.id, tag) }}>
                              {tag} <X size={10} />
                            </span>
                          ))}
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '2px 4px', fontSize: '0.65rem' }}
                            onClick={(e) => { e.stopPropagation(); setEditingVideo(video) }}
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                        <div className="video-actions">
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            onClick={(e) => { e.stopPropagation(); setAddToVideoId(video.id); setShowAddToModal('collection') }}
                          >
                            <FolderPlus size={12} />
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            onClick={(e) => { e.stopPropagation(); setAddToVideoId(video.id); setShowAddToModal('project') }}
                          >
                            <BriefcaseIcon size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '30px' }}></th>
                        <th>Filename</th>
                        <th>Thumb</th>
                        <th>Resolution</th>
                        <th>Duration</th>
                        <th>FPS</th>
                        <th>Camera</th>
                        <th>Tags</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.map((video) => (
                        <tr key={video.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedVideos.has(video.id)}
                              onChange={() => toggleVideoSelection(video.id)}
                            />
                          </td>
                          <td title={video.filepath}>{video.filename}</td>
                          <td>
                            {video.thumbnail ? (
                              <img 
                                src={`${API_BASE}/api/thumbnails/${video.id}`} 
                                alt="" 
                                style={{ width: '60px', height: '34px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            ) : (
                              <Image size={20} style={{ opacity: 0.5 }} />
                            )}
                          </td>
                          <td>{video.resolution || '-'}</td>
                          <td>{formatDuration(video.duration)}</td>
                          <td>{video.fps ? video.fps.toFixed(1) : '-'}</td>
                          <td>{video.camera_type || '-'}</td>
                          <td>
                            <div className="tags-container">
                              {video.tags?.map((tag, i) => (
                                <span key={i} className="tag" onClick={() => removeTagFromVideo(video.id, tag)} style={{ cursor: 'pointer' }}>
                                  {tag} <X size={10} />
                                </span>
                              ))}
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                onClick={() => setEditingVideo(video)}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px', fontSize: '0.7rem' }}
                                onClick={() => { setAddToVideoId(video.id); setShowAddToModal('collection') }}
                              >
                                <FolderPlus size={12} />
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '4px', fontSize: '0.7rem' }}
                                onClick={() => { setAddToVideoId(video.id); setShowAddToModal('project') }}
                              >
                                <BriefcaseIcon size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'collections' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Bookmark size={20} />
                {viewingCollection ? viewingCollection.name : 'Collections'}
              </h2>
              {viewingCollection ? (
                <button className="btn btn-secondary" onClick={() => setViewingCollection(null)}>
                  <X size={16} />
                  Back
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={createCollectionsByTag}>
                    <Tag size={14} />
                    By Tag
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowNewCollectionModal(true)}>
                    <Plus size={16} />
                    New Collection
                  </button>
                </>
              )}
            </div>

            {viewingCollection ? (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>
                    <Grid size={16} />
                  </button>
                  <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>
                    <List size={16} />
                  </button>
                </div>
                {collectionVideos.length === 0 ? (
                  <div className="empty-state">
                    <Video size={48} />
                    <p>No videos in this collection.</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="video-grid">
                    {collectionVideos.map((video) => (
                      <div key={video.id} className="video-card">
                        <div className="video-thumbnail">
                          {video.thumbnail ? (
                            <img src={`${API_BASE}/api/thumbnails/${video.id}`} alt={video.filename} />
                          ) : (
                            <div className="no-thumbnail"><Image size={32} /></div>
                          )}
                          <div className="video-duration">{formatDuration(video.duration)}</div>
                        </div>
                        <div className="video-info">
                          <div className="video-name" title={video.filename}>{video.filename}</div>
                          <div className="video-meta">
                            {video.resolution && <span>{video.resolution}</span>}
                            {video.camera_type && <span>{video.camera_type}</span>}
                          </div>
                          <div className="video-tags">
                            {video.tags?.slice(0, 3).map((tag, i) => (
                              <span key={i} className="tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Filename</th>
                          <th>Resolution</th>
                          <th>Duration</th>
                          <th>Camera</th>
                          <th>Tags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collectionVideos.map((video) => (
                          <tr key={video.id}>
                            <td title={video.filepath}>{video.filename}</td>
                            <td>{video.resolution || '-'}</td>
                            <td>{formatDuration(video.duration)}</td>
                            <td>{video.camera_type || '-'}</td>
                            <td>
                              <div className="tags-container">
                                {video.tags?.map((tag, i) => (
                                  <span key={i} className="tag">{tag}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : collections.length === 0 ? (
              <div className="empty-state">
                <Bookmark size={48} />
                <p>No collections yet. Create one to organize your videos.</p>
              </div>
            ) : (
              <div className="folder-grid">
                {collections.map((col) => (
                  <div 
                    key={col.id} 
                    className="folder-card" 
                    style={{ borderLeft: `4px solid ${col.color}`, cursor: 'pointer' }}
                    onClick={() => { setViewingCollection(col); fetchCollectionVideos(col.id) }}
                  >
                    <div className="folder-name">
                      <Bookmark size={20} style={{ color: col.color }} />
                      {col.name}
                    </div>
                    <div className="folder-info">
                      {col.video_count} videos
                    </div>
                    {col.description && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        {col.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Briefcase size={20} />
                {viewingProject ? viewingProject.name : 'Projects'}
              </h2>
              {viewingProject ? (
                <button className="btn btn-secondary" onClick={() => setViewingProject(null)}>
                  <X size={16} />
                  Back
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowNewProjectModal(true)}>
                  <Plus size={16} />
                  New Project
                </button>
              )}
            </div>

            {viewingProject ? (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>
                    <Grid size={16} />
                  </button>
                  <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>
                    <List size={16} />
                  </button>
                </div>
                {projectVideos.length === 0 ? (
                  <div className="empty-state">
                    <Video size={48} />
                    <p>No videos in this project.</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="video-grid">
                    {projectVideos.map((video) => (
                      <div key={video.id} className="video-card">
                        <div className="video-thumbnail">
                          {video.thumbnail ? (
                            <img src={`${API_BASE}/api/thumbnails/${video.id}`} alt={video.filename} />
                          ) : (
                            <div className="no-thumbnail"><Image size={32} /></div>
                          )}
                          <div className="video-duration">{formatDuration(video.duration)}</div>
                        </div>
                        <div className="video-info">
                          <div className="video-name" title={video.filename}>{video.filename}</div>
                          <div className="video-meta">
                            {video.resolution && <span>{video.resolution}</span>}
                            {video.camera_type && <span>{video.camera_type}</span>}
                          </div>
                          <div className="video-tags">
                            {video.tags?.slice(0, 3).map((tag, i) => (
                              <span key={i} className="tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Filename</th>
                          <th>Resolution</th>
                          <th>Duration</th>
                          <th>Camera</th>
                          <th>Tags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectVideos.map((video) => (
                          <tr key={video.id}>
                            <td title={video.filepath}>{video.filename}</td>
                            <td>{video.resolution || '-'}</td>
                            <td>{formatDuration(video.duration)}</td>
                            <td>{video.camera_type || '-'}</td>
                            <td>
                              <div className="tags-container">
                                {video.tags?.map((tag, i) => (
                                  <span key={i} className="tag">{tag}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <Briefcase size={48} />
                <p>No projects yet. Create one to plan your next movie.</p>
              </div>
            ) : (
              <div className="folder-grid">
                {projects.map((proj) => (
                  <div 
                    key={proj.id} 
                    className="folder-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setViewingProject(proj); fetchProjectVideos(proj.id) }}
                  >
                    <div className="folder-name">
                      <Briefcase size={20} />
                      {proj.name}
                    </div>
                    <div className="folder-info">
                      {proj.video_count} videos
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <span className={`status-badge status-${proj.status === 'active' ? 'running' : 'completed'}`}>
                        {proj.status}
                      </span>
                    </div>
                    {proj.description && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        {proj.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Settings size={20} />
                Settings
              </h2>
            </div>

            <div className="settings-grid">
              <div className="form-group">
                <label>Account</label>
                <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div>Logged in as <strong>{user.username}</strong></div>
                  <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleLogout}>
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Media Root</label>
                <input type="text" value="/media" readOnly />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Database</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={exportDatabase}>
                    <Download size={14} />
                    Export
                  </button>
                  <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    <Upload size={14} />
                    Import
                    <input type="file" accept=".db" onChange={importDatabase} hidden />
                  </label>
                  <button className="btn btn-danger" onClick={() => {
                    if (window.confirm('This will delete ALL data. Are you sure?')) {
                      resetDatabase()
                    }
                  }}>
                    <Trash2 size={14} />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        ) : (
          <div className="empty-state">
            <LogIn size={48} />
            <h2>Please Login</h2>
            <p>You need to be logged in to use this application.</p>
            <button className="btn btn-primary" onClick={() => setShowLoginModal(true)} style={{ marginTop: '1rem' }}>
              <LogIn size={16} />
              Login
            </button>
          </div>
        )}
      </main>

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
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleLogin}>
                {isFirstRun ? 'Create Account' : isRegister ? 'Register' : 'Login'}
              </button>
              {!isFirstRun && (
                <button className="btn btn-secondary" onClick={() => setShowLoginModal(false)}>
                  Cancel
                </button>
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
        <div className="modal-overlay" onClick={() => setShowNewCollectionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Collection</h2>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g., Summer 2024"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={createCollection}>
                Create
              </button>
              <button className="btn btn-secondary" onClick={() => setShowNewCollectionModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Project</h2>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Movie Project 2024"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={createProject}>
                Create
              </button>
              <button className="btn btn-secondary" onClick={() => setShowNewProjectModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVideo && (
        <div className="modal-overlay" onClick={() => setEditingVideo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Tags: {editingVideo.filename}</h2>
            <div className="form-group">
              <label>Current Tags</label>
              <div className="tags-container" style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px', minHeight: '40px' }}>
                {editingVideo.tags?.length ? editingVideo.tags.map((tag, i) => (
                  <span key={i} className="tag" onClick={() => {
                    removeTagFromVideo(editingVideo.id, tag)
                    setEditingVideo({ ...editingVideo, tags: editingVideo.tags?.filter(t => t !== tag) || null })
                  }} style={{ cursor: 'pointer' }}>
                    {tag} <X size={10} />
                  </span>
                )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No tags</span>}
              </div>
            </div>
            <div className="form-group">
              <label>Add Tag</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Enter tag name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagInput.trim()) {
                      addTagToVideo(editingVideo.id, newTagInput.trim())
                      setEditingVideo({ ...editingVideo, tags: [...(editingVideo.tags || []), newTagInput.trim()] })
                      setNewTagInput('')
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    if (newTagInput.trim()) {
                      addTagToVideo(editingVideo.id, newTagInput.trim())
                      setEditingVideo({ ...editingVideo, tags: [...(editingVideo.tags || []), newTagInput.trim()] })
                      setNewTagInput('')
                    }
                  }}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
              {allTags.length > 0 && (
                <>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Or select existing:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {allTags.filter(t => !editingVideo.tags?.includes(t)).map(tag => (
                      <button 
                        key={tag} 
                        className="tag" 
                        style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                        onClick={() => {
                          addTagToVideo(editingVideo.id, tag)
                          setEditingVideo({ ...editingVideo, tags: [...(editingVideo.tags || []), tag] })
                        }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => { setEditingVideo(null); setNewTagInput('') }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddToModal && (
        <div className="modal-overlay" onClick={() => { setShowAddToModal(null); setAddToVideoId(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add to {showAddToModal === 'collection' ? 'Collection' : 'Project'}</h2>
            <button className="btn btn-link" style={{ marginBottom: '1rem' }} onClick={() => {
              if (showAddToModal === 'collection') {
                fetchCollections()
              } else {
                fetchProjects()
              }
            }}>
              <RefreshCw size={14} /> Refresh list
            </button>
            {showAddToModal === 'collection' ? (
              collections.length === 0 ? (
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>No collections yet.</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowNewCollectionModal(true)}>
                    <Plus size={14} />
                    Create Collection
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {collections.map(col => (
                    <button 
                      key={col.id} 
                      className="btn btn-secondary" 
                      style={{ justifyContent: 'flex-start' }}
                      onClick={() => addToCollection(addToVideoId!, col.id)}
                    >
                      <Bookmark size={14} style={{ color: col.color }} />
                      {col.name} ({col.video_count} videos)
                    </button>
                  ))}
                </div>
              )
            ) : (
              projects.length === 0 ? (
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>No projects yet.</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowNewProjectModal(true)}>
                    <Plus size={14} />
                    Create Project
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {projects.map(proj => (
                    <button 
                      key={proj.id} 
                      className="btn btn-secondary" 
                      style={{ justifyContent: 'flex-start' }}
                      onClick={() => addToProject(addToVideoId!, proj.id)}
                    >
                      <Briefcase size={14} />
                      {proj.name} ({proj.video_count} videos)
                    </button>
                  ))}
                </div>
              )
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => { setShowAddToModal(null); setAddToVideoId(null) }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
