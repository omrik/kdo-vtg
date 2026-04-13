import { Image, Star } from 'lucide-react'
import type { VideoItem } from '../types'

interface VideoCardProps {
  video: VideoItem
  viewMode: 'grid' | 'list'
  selected: boolean
  onClick: () => void
  onSelect: (e: React.MouseEvent) => void
  onRate: (videoId: number, rating: number) => void
  formatDuration: (seconds: number | null) => string
  API_BASE: string
}

export function VideoCard({ 
  video, 
  viewMode, 
  selected, 
  onClick, 
  onSelect,
  onRate,
  formatDuration,
  API_BASE 
}: VideoCardProps) {
  if (viewMode === 'list') {
    return (
      <tr onClick={onClick} style={{ cursor: 'pointer' }}>
        <td onClick={onSelect}>
          <input 
            type="checkbox" 
            checked={selected}
            onChange={() => {}}
            onClick={onSelect}
          />
        </td>
        <td onClick={onClick} style={{ cursor: 'pointer' }} title={video.filepath}>
          {video.filename}
        </td>
        <td onClick={onClick} style={{ cursor: 'pointer' }}>
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
            {video.tags?.slice(0, 3).map((tag, i) => (
              <span key={i} className="tag">{tag}</span>
            ))}
          </div>
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          <StarRating rating={video.rating} onRate={(r) => onRate(video.id, r)} size={14} />
        </td>
      </tr>
    )
  }

  return (
    <div className="video-card" onClick={onClick}>
      <input 
        type="checkbox" 
        checked={selected}
        onChange={() => {}}
        onClick={onSelect}
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
        {video.yolo_enabled && <div className="yolo-badge">YOLO</div>}
      </div>
      <div className="video-info">
        <div className="video-name" title={video.filename}>{video.filename}</div>
        <StarRating rating={video.rating} onRate={(r) => onRate(video.id, r)} size={12} />
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
  )
}

export function StarRating({ rating, onRate, size = 16 }: { rating: number | null; onRate: (r: number) => void; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1px', marginBottom: '0.25rem' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          size={size}
          fill={rating && star <= rating ? 'var(--warning)' : 'none'}
          color={rating && star <= rating ? 'var(--warning)' : 'var(--text-secondary)'}
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onRate(star) }}
        />
      ))}
      {rating && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>{rating}/5</span>}
    </div>
  )
}
