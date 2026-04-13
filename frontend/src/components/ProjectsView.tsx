import { Briefcase, X, Plus, Trash2, Grid, List, Image, RefreshCw } from 'lucide-react'
import type { Project, VideoItem } from '../types'

interface ProjectsViewProps {
  projects: Project[]
  viewingProject: Project | null
  projectVideos: VideoItem[]
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
  onViewProject: (proj: Project) => void
  onCloseProject: () => void
  onDeleteProject: (id: number) => void
  onShowNewModal: () => void
  onOpenVideo: (video: VideoItem) => void
  onRefresh: () => void
  formatDuration: (seconds: number | null) => string
  API_BASE: string
}

export function ProjectsView({
  projects,
  viewingProject,
  projectVideos,
  viewMode,
  setViewMode,
  onViewProject,
  onCloseProject,
  onDeleteProject,
  onShowNewModal,
  onOpenVideo,
  onRefresh,
  formatDuration,
  API_BASE,
}: ProjectsViewProps) {
  return (
    <div className="main-content">
      <div className="card">
        <div className="card-header">
          <h2
            className="card-title"
            style={{ cursor: viewingProject ? 'pointer' : 'default' }}
            onClick={viewingProject ? onCloseProject : undefined}
          >
            <Briefcase size={20} />
            {viewingProject ? viewingProject.name : 'Projects'}
          </h2>
          {viewingProject ? (
            <button className="btn btn-secondary" onClick={onCloseProject}>
              <X size={16} />
              Back
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onRefresh}>
                <RefreshCw size={16} />
              </button>
              <button className="btn btn-primary" onClick={onShowNewModal}>
                <Plus size={16} />
                New Project
              </button>
            </>
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
                <Briefcase size={48} />
                <p>No videos in this project.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="video-grid">
                {projectVideos.map(video => (
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
                    </tr>
                  </thead>
                  <tbody>
                    {projectVideos.map(video => (
                      <tr key={video.id} onClick={() => onOpenVideo(video)} style={{ cursor: 'pointer' }}>
                        <td>{video.filename}</td>
                        <td>{video.resolution || '-'}</td>
                        <td>{formatDuration(video.duration)}</td>
                        <td>{video.rating ? '★'.repeat(video.rating) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="folder-grid">
            {projects.map(proj => (
              <div
                key={proj.id}
                className="folder-card"
                onClick={() => onViewProject(proj)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="folder-name">
                    <Briefcase size={20} />
                    {proj.name}
                  </div>
                  <button
                    className="btn-icon"
                    onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id) }}
                    title="Delete project"
                  >
                    <Trash2 size={16} color="var(--text-secondary)" />
                  </button>
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
            {projects.length === 0 && (
              <div className="empty-state">
                <Briefcase size={48} />
                <p>No projects yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
