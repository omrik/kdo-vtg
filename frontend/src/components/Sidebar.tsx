import { 
  Video, FolderOpen, Play, Bookmark, Briefcase, 
  Copy, Settings, RefreshCw
} from 'lucide-react'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  currentScan: { status: string } | null
}

const tabs = [
  { id: 'folders', icon: FolderOpen, label: 'Folders' },
  { id: 'results', icon: Play, label: 'Results' },
  { id: 'collections', icon: Bookmark, label: 'Collections' },
  { id: 'projects', icon: Briefcase, label: 'Projects' },
  { id: 'duplicates', icon: Copy, label: 'Duplicates' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export function Sidebar({ activeTab, setActiveTab, currentScan }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <Video size={24} />
          <span>KDO Video Tagger</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
            {currentScan?.status === 'running' && tab.id === 'folders' && (
              <RefreshCw size={14} className="spin" />
            )}
          </button>
        ))}
      </nav>
    </aside>
  )
}
