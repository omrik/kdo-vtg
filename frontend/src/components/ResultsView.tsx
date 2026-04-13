import { useState } from 'react'
import { Video, Grid, List, Image, RefreshCw, Trash2, Tag, Play, Check, FolderPlus, Briefcase } from 'lucide-react'
import type { VideoItem } from '../types'

interface ResultsViewProps {
  videos: VideoItem[]
  loading: boolean
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
  selectedVideos: Set<number>
  onToggleSelect: (videoId: number, e: React.MouseEvent) => void
  onOpenVideo: (video: VideoItem) => void
  onBatchAddTag: (tag: string) => void
  onBatchDelete: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onAddToCollection: (videoId: number) => void
  onAddToProject: (videoId: number) => void
  onRefresh: () => void
  formatDuration: (seconds: number | null) => string
  API_BASE: string
}

export function ResultsView({
  videos,
  loading,
  viewMode,
  setViewMode,
  selectedVideos,
  onToggleSelect,
  onOpenVideo,
  onBatchAddTag,
  onBatchDelete,
  onSelectAll,
  onClearSelection,
  onAddToCollection,
  onAddToProject,
  onRefresh,
  formatDuration,
  API_BASE,
}: ResultsViewProps) {
  const [newTagInput, setNewTagInput] = useState('')

  return (
    <div className="main-content">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Play size={20} />
            Results
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {selectedVideos.size > 0 && (
              <div className="batch-bar" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.875rem' }}>{selectedVideos.size} selected</span>
                <button className="btn btn-secondary" onClick={onSelectAll} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  Select All
                </button>
                <button className="btn btn-secondary" onClick={onClearSelection} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  Clear
                </button>
                <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTagInput.trim()) {
                        onBatchAddTag(newTagInput.trim())
                        setNewTagInput('')
                      }
                    }}
                    style={{ width: '100px', fontSize: '0.75rem', padding: '2px 6px' }}
                  />
                  <button className="btn btn-secondary" onClick={() => newTagInput.trim() && onBatchAddTag(newTagInput.trim())} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                    <Tag size={12} />
                  </button>
                </div>
                <button className="btn btn-secondary" onClick={onBatchDelete} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            )}
            <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>
              <Grid size={16} />
            </button>
            <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>
              <List size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : videos.length === 0 ? (
          <div className="empty-state">
            <Video size={48} />
            <p>No videos found. Scan a folder first.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="video-grid">
            {videos.map(video => (
              <div
                key={video.id}
                className={`video-card ${selectedVideos.has(video.id) ? 'selected' : ''}`}
                onClick={(e) => onToggleSelect(video.id, e)}
              >
                {selectedVideos.has(video.id) && (
                  <div className="selection-indicator">
                    <Check size={14} />
                  </div>
                )}
                <div className="video-thumbnail" onClick={() => onOpenVideo(video)}>
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
                    {video.rating && <span>★ {video.rating}</span>}
                  </div>
                  <div className="video-tags">
                    {video.tags?.slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="video-actions">
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onAddToCollection(video.id) }} title="Add to collection">
                    <FolderPlus size={14} />
                  </button>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onAddToProject(video.id) }} title="Add to project">
                    <Briefcase size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Filename</th>
                  <th>Resolution</th>
                  <th>Duration</th>
                  <th>Camera</th>
                  <th>Tags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {videos.map(video => (
                  <tr key={video.id} className={selectedVideos.has(video.id) ? 'selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedVideos.has(video.id)}
                        onChange={() => {}}
                        onClick={(e) => onToggleSelect(video.id, e)}
                      />
                    </td>
                    <td title={video.filepath} onClick={() => onOpenVideo(video)} style={{ cursor: 'pointer' }}>
                      {video.filename}
                    </td>
                    <td>{video.resolution || '-'}</td>
                    <td>{formatDuration(video.duration)}</td>
                    <td>{video.camera_type || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                        {video.tags?.slice(0, 3).map((tag, i) => (
                          <span key={i} className="tag">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn-icon" onClick={() => onOpenVideo(video)} title="View">
                          <Play size={14} />
                        </button>
                        <button className="btn-icon" onClick={() => onAddToCollection(video.id)} title="Add to collection">
                          <FolderPlus size={14} />
                        </button>
                        <button className="btn-icon" onClick={() => onAddToProject(video.id)} title="Add to project">
                          <Briefcase size={14} />
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
    </div>
  )
}
