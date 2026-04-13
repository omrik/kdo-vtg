import { Copy, Trash2, RefreshCw } from 'lucide-react'

interface DuplicateInfo {
  original: { id: number; filepath: string; filename: string }
  duplicate: { id: number; filepath: string; filename: string }
  filename: string
  duration: number | null
  resolution: string | null
  file_size: number | null
}

interface DuplicatesViewProps {
  duplicates: DuplicateInfo[]
  loading: boolean
  onRefresh: () => void
  onDelete: (id: number) => void
  formatDuration: (seconds: number | null) => string
}

export function DuplicatesView({
  duplicates,
  loading,
  onRefresh,
  onDelete,
  formatDuration,
}: DuplicatesViewProps) {
  return (
    <div className="main-content">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Copy size={20} />
            Duplicates
          </h2>
          <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="loading">Checking for duplicates...</div>
        ) : duplicates.length === 0 ? (
          <div className="empty-state">
            <Copy size={48} />
            <p>No duplicates found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Duration</th>
                  <th>Resolution</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map((dup, idx) => (
                  <tr key={idx}>
                    <td title={dup.duplicate.filepath}>{dup.filename}</td>
                    <td>{dup.duration ? formatDuration(dup.duration) : '-'}</td>
                    <td>{dup.resolution || '-'}</td>
                    <td>{dup.file_size ? `${(dup.file_size / 1024 / 1024 / 1024).toFixed(2)} GB` : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => window.open(`file://${dup.duplicate.filepath}`, '_blank')}
                          title="Open duplicate"
                        >
                          Open
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => {
                            if (window.confirm('Delete this duplicate?')) {
                              onDelete(dup.duplicate.id)
                            }
                          }}
                        >
                          <Trash2 size={12} />
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
