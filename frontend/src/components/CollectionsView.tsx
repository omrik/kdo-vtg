import { Bookmark, X, Plus, Tag, Star, Trash2, Grid, List, Image } from 'lucide-react'
import type { Collection, VideoItem } from '../types'

interface CollectionsViewProps {
  collections: Collection[]
  viewingCollection: Collection | null
  collectionVideos: VideoItem[]
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
  onViewCollection: (col: Collection) => void
  onCloseCollection: () => void
  onDeleteCollection: (id: number) => void
  onCreateByTag: () => void
  onCreateByRating: () => void
  onShowNewModal: () => void
  onOpenVideo: (video: VideoItem) => void
  formatDuration: (seconds: number | null) => string
  API_BASE: string
}

export function CollectionsView({
  collections,
  viewingCollection,
  collectionVideos,
  viewMode,
  setViewMode,
  onViewCollection,
  onCloseCollection,
  onDeleteCollection,
  onCreateByTag,
  onCreateByRating,
  onShowNewModal,
  onOpenVideo,
  formatDuration,
  API_BASE,
}: CollectionsViewProps) {
  return (
    <div className="main-content">
      <div className="card">
        <div className="card-header">
          <h2
            className="card-title"
            style={{ cursor: viewingCollection ? 'pointer' : 'default' }}
            onClick={viewingCollection ? onCloseCollection : undefined}
          >
            <Bookmark size={20} />
            {viewingCollection ? viewingCollection.name : 'Collections'}
          </h2>
          {viewingCollection ? (
            <button className="btn btn-secondary" onClick={onCloseCollection}>
              <X size={16} />
              Back
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onCreateByTag}>
                <Tag size={14} />
                By Tag
              </button>
              <button className="btn btn-secondary" onClick={onCreateByRating}>
                <Star size={14} />
                By Rating
              </button>
              <button className="btn btn-primary" onClick={onShowNewModal}>
                <Plus size={16} />
                New
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
                <Bookmark size={48} />
                <p>No videos in this collection.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="video-grid">
                {collectionVideos.map(video => (
                  <div key={video.id} className="video-card" onClick={() => onOpenVideo(video)}>
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
                        {video.rating && <span>★ {video.rating}</span>}
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
                      <th>Rating</th>
                      <th>Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionVideos.map(video => (
                      <tr key={video.id} onClick={() => onOpenVideo(video)} style={{ cursor: 'pointer' }}>
                        <td>{video.filename}</td>
                        <td>{video.resolution || '-'}</td>
                        <td>{formatDuration(video.duration)}</td>
                        <td>{video.rating ? '★'.repeat(video.rating) : '-'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
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
          </>
        ) : (
          <div className="folder-grid">
            {collections.map(col => (
              <div
                key={col.id}
                className="folder-card"
                style={{ borderLeft: `4px solid ${col.color}` }}
                onClick={() => onViewCollection(col)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="folder-name">
                    <Bookmark size={20} style={{ color: col.color }} />
                    {col.name}
                  </div>
                  <button
                    className="btn-icon"
                    onClick={(e) => { e.stopPropagation(); onDeleteCollection(col.id) }}
                    title="Delete collection"
                  >
                    <Trash2 size={16} color="var(--text-secondary)" />
                  </button>
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
            {collections.length === 0 && (
              <div className="empty-state">
                <Bookmark size={48} />
                <p>No collections yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
