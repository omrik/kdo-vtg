import { Grid, List, Image } from 'lucide-react'
import type { VideoItem } from '../types'

interface VideoListViewProps {
  videos: VideoItem[]
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onVideoClick: (video: VideoItem) => void
  formatDuration: (seconds: number | null) => string
  API_BASE: string
  showAddToButtons?: boolean
  onAddToCollection?: (videoId: number) => void
  onAddToProject?: (videoId: number) => void
}

export function VideoListView({
  videos,
  viewMode,
  onViewModeChange,
  onVideoClick,
  formatDuration,
  API_BASE,
  showAddToButtons = false,
  onAddToCollection,
  onAddToProject,
}: VideoListViewProps) {
  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <Grid size={48} />
        <p>No videos found.</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button 
          className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onViewModeChange('grid')}
        >
          <Grid size={16} />
        </button>
        <button 
          className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onViewModeChange('list')}
        >
          <List size={16} />
        </button>
      </div>

      {viewMode === 'grid' ? (
        <div className="video-grid">
          {videos.map((video) => (
            <div key={video.id} className="video-card" onClick={() => onVideoClick(video)}>
              <div className="video-thumbnail">
                {video.thumbnail ? (
                  <img src={`${API_BASE}/api/thumbnails/${video.id}`} alt={video.filename} />
                ) : (
                  <div className="no-thumbnail"><Image size={32} /></div>
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
                  {video.rating && <span>{'★'.repeat(video.rating)}</span>}
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
                {showAddToButtons && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} onClick={() => onVideoClick(video)} style={{ cursor: 'pointer' }}>
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
                  {showAddToButtons && (
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px', fontSize: '0.7rem' }}
                          onClick={(e) => { e.stopPropagation(); onAddToCollection?.(video.id) }}
                        >
                          <Grid size={12} />
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px', fontSize: '0.7rem' }}
                          onClick={(e) => { e.stopPropagation(); onAddToProject?.(video.id) }}
                        >
                          <List size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
