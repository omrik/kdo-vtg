import { FolderOpen, ChevronRight, RefreshCw, FolderPlus, Image } from 'lucide-react'

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

interface FoldersViewProps {
  folders: Folder[]
  contents: ContentItem[]
  currentPath: string
  loading: boolean
  onFolderSelect: (folder: Folder) => void
  onContentSelect: (item: ContentItem) => void
  onBack: () => void
  onRefresh: () => void
  onCreateFolder: () => void
}

export function FoldersView({
  folders,
  contents,
  currentPath,
  loading,
  onFolderSelect,
  onContentSelect,
  onBack,
  onRefresh,
  onCreateFolder,
}: FoldersViewProps) {
  const isRoot = currentPath === '/media'
  const pathParts = currentPath.split('/').filter(Boolean)

  return (
    <div className="main-content">
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isRoot ? (
              <FolderOpen size={20} />
            ) : (
              <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.25rem 0.5rem' }}>
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                Back
              </button>
            )}
            <h2 className="card-title">
              {isRoot ? 'Folders' : pathParts[pathParts.length - 1]}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            {!isRoot && (
              <button className="btn btn-secondary" onClick={onCreateFolder}>
                <FolderPlus size={16} />
                New Folder
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {isRoot ? (
              <div className="folder-grid">
                {folders.map(folder => (
                  <div
                    key={folder.path}
                    className="folder-card"
                    onClick={() => onFolderSelect(folder)}
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
                {folders.length === 0 && (
                  <div className="empty-state">
                    <FolderOpen size={48} />
                    <p>No folders found</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="folder-grid">
                {contents.map(item => (
                  <div
                    key={item.path}
                    className={`folder-card ${item.type === 'video' ? 'video-folder' : ''}`}
                    onClick={() => onContentSelect(item)}
                  >
                    <div className="folder-name">
                      {item.type === 'folder' ? (
                        <FolderOpen size={20} />
                      ) : (
                        <Image size={20} />
                      )}
                      {item.name}
                    </div>
                    <div className="folder-info">
                      {item.type === 'folder' && item.video_count !== undefined
                        ? `${item.video_count} videos`
                        : item.type === 'video' && item.size
                          ? `${(item.size / 1024 / 1024).toFixed(1)} MB`
                          : ''}
                    </div>
                  </div>
                ))}
                {contents.length === 0 && (
                  <div className="empty-state">
                    <FolderOpen size={48} />
                    <p>Empty folder</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
