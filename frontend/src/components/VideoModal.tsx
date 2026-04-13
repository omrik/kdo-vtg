import { useState } from 'react'
import { X, Star, MapPin } from 'lucide-react'
import type { VideoItem } from '../types'

interface VideoModalProps {
  video: VideoItem
  onClose: () => void
  onRate: (videoId: number, rating: number) => void
  onAddTag: (videoId: number, tag: string) => void
  onRemoveTag: (videoId: number, tag: string) => void
  allTags: string[]
  formatDuration: (seconds: number | null) => string
  api: { API_BASE: string }
  token?: string | null
}

export function VideoModal({ 
  video, 
  onClose, 
  onRate, 
  onAddTag, 
  onRemoveTag, 
  allTags,
  formatDuration,
  api
}: VideoModalProps) {
  const API_BASE = api.API_BASE

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.1rem', wordBreak: 'break-word' }}>{video.filename}</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{video.filepath}</div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.25rem 0.5rem' }}>
            <X size={16} />
          </button>
        </div>
        
        {video.thumbnail && (
          <div style={{ marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
            <img 
              src={`${API_BASE}/api/thumbnails/${video.id}`} 
              alt={video.filename}
              style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }}
            />
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          <InfoBlock label="Resolution" value={video.resolution || '-'} />
          <InfoBlock label="Duration" value={formatDuration(video.duration)} />
          <InfoBlock label="Camera" value={video.camera_type || '-'} />
          <InfoBlock label="FPS" value={video.fps ? video.fps.toFixed(1) : '-'} />
        </div>

        <div className="form-group">
          <label style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Rating</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                size={24}
                fill={video.rating && star <= video.rating ? 'var(--warning)' : 'none'}
                color={video.rating && star <= video.rating ? 'var(--warning)' : 'var(--text-secondary)'}
                style={{ cursor: 'pointer' }}
                onClick={() => onRate(video.id, star)}
              />
            ))}
            {video.rating && (
              <button 
                className="btn btn-link" 
                style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}
                onClick={() => onRate(video.id, 0)}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {video.gps_data && (
          <div className="form-group">
            <label><MapPin size={14} style={{ marginRight: '0.5rem' }} />Location</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <span>{video.gps_data.latitude.toFixed(6)}, {video.gps_data.longitude.toFixed(6)}</span>
              <a 
                href={`https://www.google.com/maps?q=${video.gps_data.latitude},${video.gps_data.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              >
                Open Map
              </a>
            </div>
          </div>
        )}

        {video.shot_types && (
          <div className="form-group">
            <label>Shot Types</label>
            <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Dominant: <strong>{video.shot_types.dominant_shot}</strong>
              </div>
              <ShotTypeBar counts={video.shot_types.counts} total={video.shot_types.total_analyzed} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                <span>WS: Wide Shot</span>
                <span>MS: Medium Shot</span>
                <span>CU: Close Up</span>
                <span>ECU: Extreme CU</span>
              </div>
            </div>
          </div>
        )}

        {video.color_palette && video.color_palette.length > 0 && (
          <div className="form-group">
            <label>Color Palette</label>
            <div style={{ display: 'flex', gap: '0.25rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
              {video.color_palette.map((color, i) => (
                <div 
                  key={i} 
                  title={`${color.hex} (${color.percentage.toFixed(1)}%)`}
                  style={{ 
                    background: color.hex, 
                    width: '50px', 
                    height: '50px', 
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '4px',
                    fontSize: '0.6rem',
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                  }}
                >
                  {color.percentage.toFixed(0)}
                </div>
              ))}
            </div>
          </div>
        )}

        {video.scenes && video.scenes.length > 0 && (
          <div className="form-group">
            <label>Scenes ({video.scenes.length} detected)</label>
            <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.8rem' }}>
              {video.scenes.slice(0, 20).map((scene, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span>Scene {i + 1}</span>
                  <span>{formatDuration(scene.start_time)} - {formatDuration(scene.end_time)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{scene.duration.toFixed(1)}s</span>
                </div>
              ))}
              {video.scenes.length > 20 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '0.5rem' }}>
                  +{video.scenes.length - 20} more scenes
                </div>
              )}
            </div>
          </div>
        )}

        <hr style={{ margin: '1rem 0', borderColor: 'var(--border)' }} />

        <div className="form-group">
          <label>Tags</label>
          <div className="tags-container" style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px', minHeight: '40px' }}>
            {video.tags?.length ? video.tags.map((tag, i) => (
              <span 
                key={i} 
                className="tag" 
                onClick={() => onRemoveTag(video.id, tag)} 
                style={{ cursor: 'pointer' }}
              >
                {tag} <X size={10} />
              </span>
            )) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No tags</span>}
          </div>
          <TagInput 
            videoId={video.id} 
            onAddTag={onAddTag} 
            existingTags={video.tags || []}
            allTags={allTags}
          />
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="form-group">
      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</label>
      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function ShotTypeBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  const colors: Record<string, string> = { WS: '#3b82f6', MS: '#22c55e', CU: '#f59e0b', ECU: '#ef4444' }
  const types = ['WS', 'MS', 'CU', 'ECU']
  const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(0) : 0

  return (
    <div style={{ display: 'flex', gap: '2px', height: '24px', borderRadius: '4px', overflow: 'hidden' }}>
      {types.map(type => (
        <div 
          key={type}
          style={{ 
            width: `${pct(counts[type])}%`, 
            background: colors[type],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            color: 'white',
            fontWeight: 600
          }}
        >
          {pct(counts[type])}%
        </div>
      ))}
    </div>
  )
}

function TagInput({ videoId, onAddTag, existingTags, allTags }: { 
  videoId: number
  onAddTag: (id: number, tag: string) => void
  existingTags: string[]
  allTags: string[]
}) {
  const [input, setInput] = useState('')
  
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter tag name"
          style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              onAddTag(videoId, input.trim())
              setInput('')
            }
          }}
        />
        <button 
          className="btn btn-primary" 
          onClick={() => {
            if (input.trim()) {
              onAddTag(videoId, input.trim())
              setInput('')
            }
          }}
        >
          Add
        </button>
      </div>
      {allTags.filter(t => !existingTags.includes(t)).length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Or select:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {allTags.filter(t => !existingTags.includes(t)).slice(0, 10).map(tag => (
              <button 
                key={tag} 
                className="tag" 
                style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                onClick={() => onAddTag(videoId, tag)}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
