import { Settings, LogOut, Download, Upload, Trash2, Video } from 'lucide-react'
import type { User } from '../types'

interface SettingsViewProps {
  user: User | null
  appVersion: string
  onLogout: () => void
  onExportDb: () => void
  onImportDb: (e: React.ChangeEvent<HTMLInputElement>) => void
  onResetDb: () => void
}

export function SettingsView({
  user,
  appVersion,
  onLogout,
  onExportDb,
  onImportDb,
  onResetDb,
}: SettingsViewProps) {
  return (
    <div className="main-content">
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
              <div>Logged in as <strong>{user?.username}</strong></div>
              <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onLogout}>
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
              <button className="btn btn-secondary" onClick={onExportDb}>
                <Download size={14} />
                Export
              </button>
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                Import
                <input type="file" accept=".db" onChange={onImportDb} hidden />
              </label>
              <button className="btn btn-danger" onClick={() => {
                if (window.confirm('This will delete ALL data. Are you sure?')) {
                  onResetDb()
                }
              }}>
                <Trash2 size={14} />
                Reset
              </button>
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <label>About</label>
            <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                <Video size={32} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>KDO Video Tagger</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Version: {appVersion}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                A self-hosted video metadata tagger for organizing video projects.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="https://github.com/omrik/kdo-vtg" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                  GitHub
                </a>
                <a href="https://github.com/omrik/kdo-vtg/blob/main/docs/USAGE.md" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                  Documentation
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
