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

  const [scanSettings, setScanSettings] = useState({
    yolo_enabled: false,
    sample_interval: 10,
    model_name: 'yolov8n.pt',
  })

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))

  const [collections, setCollections] = useState<Collection[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [appLoading, setAppLoading] = useState(true)

  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [isRegister, setIsRegister] = useState(false)

  useEffect(() => {
    checkSetupStatus()
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
        setIsRegister(true)
        setShowLoginModal(true)
      }
    } catch (err) {
      console.error('Failed to check setup status')
    } finally {
      setAppLoading(false)
    }
  }

  const fetchMe = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`)
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        setToken(null)
        localStorage.removeItem('token')
      }
    } catch (err) {
      console.error('Failed to fetch user')
    }
  }

  const handleLogin = async () => {
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
    localStorage.removeItem('token')
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
    try {
      const url = folderPath
        ? `${API_BASE}/api/videos?folder_path=${encodeURIComponent(folderPath)}`
        : `${API_BASE}/api/videos`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const data = await res.json()
      setVideos(data.videos || [])
    } catch (err) {
      setError('Failed to fetch videos')
    } finally {
      setLoading(false)
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
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          folder_path: selectedFolder,
          ...scanSettings,
        }),
      })
      const data = await res.json()
      fetchScanStatus(data.scan_id)
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
                        setActiveTab('scan')
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
                            setActiveTab('scan')
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
                </h2>
                <button className="btn btn-secondary" onClick={() => fetchVideos(selectedFolder || undefined)}>
                  <RefreshCw size={16} />
                </button>
              </div>

              {loading ? (
                <div className="loading">Loading...</div>
              ) : videos.length === 0 ? (
                <div className="empty-state">
                  <FileVideo size={48} />
                  <p>No videos scanned yet. Go to the Scan tab to start scanning.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Filename</th>
                        <th>Resolution</th>
                        <th>Duration</th>
                        <th>FPS</th>
                        <th>Camera</th>
                        <th>Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.map((video) => (
                        <tr key={video.id}>
                          <td title={video.filepath}>{video.filename}</td>
                          <td>{video.resolution || '-'}</td>
                          <td>{formatDuration(video.duration)}</td>
                          <td>{video.fps ? video.fps.toFixed(1) : '-'}</td>
                          <td>{video.camera_type || '-'}</td>
                          <td>
                            <div className="tags-container">
                              {video.tags?.slice(0, 3).map((tag, i) => (
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
            </div>
          </>
        )}

        {activeTab === 'collections' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Bookmark size={20} />
                Collections
              </h2>
              <button className="btn btn-primary" onClick={() => setShowNewCollectionModal(true)}>
                <Plus size={16} />
                New Collection
              </button>
            </div>

            {collections.length === 0 ? (
              <div className="empty-state">
                <Bookmark size={48} />
                <p>No collections yet. Create one to organize your videos.</p>
              </div>
            ) : (
              <div className="folder-grid">
                {collections.map((col) => (
                  <div key={col.id} className="folder-card" style={{ borderLeft: `4px solid ${col.color}` }}>
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
                Projects
              </h2>
              <button className="btn btn-primary" onClick={() => setShowNewProjectModal(true)}>
                <Plus size={16} />
                New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state">
                <Briefcase size={48} />
                <p>No projects yet. Create one to plan your next movie.</p>
              </div>
            ) : (
              <div className="folder-grid">
                {projects.map((proj) => (
                  <div key={proj.id} className="folder-card">
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
                {user ? (
                  <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                    <div>Logged in as <strong>{user.username}</strong></div>
                    <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleLogout}>
                      <LogOut size={14} />
                      Logout
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={() => setShowLoginModal(true)}>
                    <LogIn size={14} />
                    Login / Register
                  </button>
                )}
              </div>

              <div className="form-group">
                <label>Media Root</label>
                <input type="text" value="/media" readOnly />
              </div>
            </div>
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
            {!isFirstRun && (
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
    </div>
  )
}

export default App
