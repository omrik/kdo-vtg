import { useState, useEffect } from 'react'
import {
  Video,
  FolderOpen,
  Settings,
  Download,
  Play,
  X,
  RefreshCw,
  FileVideo,
  Tag,
  ChevronRight,
  Home,
  Trash2,
} from 'lucide-react'

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

type Tab = 'folders' | 'scan' | 'results' | 'settings'

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

  useEffect(() => {
    fetchFolders()
    fetchStats()
  }, [])

  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/folders`)
      const data = await res.json()
      setFolders(data.folders || [])
    } catch (err) {
      setError('Failed to fetch folders')
    }
  }

  const fetchFolderContents = async (path: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/folders/${encodeURIComponent(path)}`)
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
      const res = await fetch(url)
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
      const res = await fetch(`${API_BASE}/api/stats`)
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats')
    }
  }

  const fetchScanStatus = async (scanId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/scan/${scanId}`)
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
        headers: { 'Content-Type': 'application/json' },
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
      })
      fetchScanStatus(currentScan.id)
    } catch (err) {
      setError('Failed to cancel scan')
    }
  }

  const exportCSV = async () => {
    const url = selectedFolder
      ? `${API_BASE}/api/videos/export/csv?folder_path=${encodeURIComponent(selectedFolder)}`
      : `${API_BASE}/api/videos/export/csv`
    window.open(url, '_blank')
  }

  const exportExcel = async () => {
    const url = selectedFolder
      ? `${API_BASE}/api/videos/export/excel?folder_path=${encodeURIComponent(selectedFolder)}`
      : `${API_BASE}/api/videos/export/excel`
    window.open(url, '_blank')
  }

  const deleteVideos = async () => {
    if (!confirm('Are you sure you want to delete all video records?')) return
    try {
      const url = selectedFolder
        ? `${API_BASE}/api/videos?folder_path=${encodeURIComponent(selectedFolder)}`
        : `${API_BASE}/api/videos`
      await fetch(url, { method: 'DELETE' })
      fetchVideos()
      fetchStats()
    } catch (err) {
      setError('Failed to delete videos')
    }
  }

  const navigateToFolder = (path: string) => {
    fetchFolderContents(path)
  }

  const navigateUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/')
    if (parentPath) {
      fetchFolderContents(parentPath)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="app">
      <header className="header">
        <h1>
          <Video size={28} />
          KDO Video Tagger
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${activeTab === 'folders' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('folders')}
          >
            <FolderOpen size={16} />
            Folders
          </button>
          <button
            className={`btn ${activeTab === 'scan' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveTab('scan')
              if (selectedFolder) {
                fetchFolderContents(selectedFolder)
              }
            }}
          >
            <Play size={16} />
            Scan
          </button>
          <button
            className={`btn ${activeTab === 'results' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveTab('results')
              fetchVideos(selectedFolder || undefined)
            }}
          >
            <FileVideo size={16} />
            Results
          </button>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-message">
            {error}
            <button
              onClick={() => setError(null)}
              style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
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
                            navigateToFolder('/media/' + arr.slice(0, i + 1).join('/'))
                          }}
                        >
                          {part}
                        </a>
                      </span>
                    ))}
                  </div>
                  <button className="btn btn-secondary" onClick={navigateUp}>
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
            )}

            {currentScan && currentScan.status === 'running' && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${currentScan.progress}%` }}
                />
              </div>
            )}

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Settings size={20} />
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
                  <label htmlFor="model_name">YOLO Model</label>
                  <select
                    id="model_name"
                    value={scanSettings.model_name}
                    onChange={(e) => setScanSettings({ ...scanSettings, model_name: e.target.value })}
                    disabled={!scanSettings.yolo_enabled}
                  >
                    <option value="yolov8n.pt">YOLOv8 Nano (fastest)</option>
                    <option value="yolov8s.pt">YOLOv8 Small</option>
                    <option value="yolov8m.pt">YOLOv8 Medium</option>
                    <option value="yolov8l.pt">YOLOv8 Large</option>
                  </select>
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
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveTab('folders')}
                >
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
                  {selectedFolder && ` - ${selectedFolder.split('/').pop()}`}
                </h2>
                <div className="export-buttons">
                  <button className="btn btn-secondary" onClick={() => fetchVideos(selectedFolder || undefined)}>
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                  <button className="btn btn-secondary" onClick={exportCSV}>
                    <Download size={16} />
                    CSV
                  </button>
                  <button className="btn btn-secondary" onClick={exportExcel}>
                    <Download size={16} />
                    Excel
                  </button>
                  <button className="btn btn-danger" onClick={deleteVideos}>
                    <Trash2 size={16} />
                    Clear
                  </button>
                </div>
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
                        <th>Date</th>
                        <th>Tags</th>
                        <th>Actions</th>
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
                          <td>{video.date_created?.split('T')[0] || '-'}</td>
                          <td>
                            <div className="tags-container">
                              {video.tags?.slice(0, 3).map((tag, i) => (
                                <span key={i} className="tag">{tag}</span>
                              ))}
                              {video.tags && video.tags.length > 3 && (
                                <span className="tag">+{video.tags.length - 3}</span>
                              )}
                              {(!video.tags || video.tags.length === 0) && '-'}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => window.open(`file://${video.filepath}`)}
                            >
                              Open
                            </button>
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
      </main>
    </div>
  )
}

export default App
