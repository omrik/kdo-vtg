# KDO Video Tagger - Frontend Architecture

## Current State

- **App.tsx**: 2375 lines (monolithic)
- **Components**: Only `VideoModal.tsx` and `VideoCard.tsx` exist
- **Types**: All defined inline in App.tsx

## Refactoring Principles

1. **MOVE code, don't rewrite** - Copy exact JSX and logic
2. **Preserve all functionality** - Zero changes to behavior
3. **Incremental** - One change at a time, verify after each
4. **No UI changes** - Keep existing styles and classes

---

## Phase 1: Types (Safe - just moving declarations)

### Goal
Move all TypeScript interfaces from App.tsx to `frontend/src/types/index.ts`

### Interfaces to Move
```typescript
// Currently in App.tsx lines 31-151
User, Folder, ContentItem, VideoItem, Scene, ScanJob, Stats, 
Collection, Project, DuplicateInfo, ShotTypeInfo, ColorInfo, GpsInfo
```

### Result
- `App.tsx`: Remove interface declarations (~120 lines)
- `types/index.ts`: Add all interfaces
- `VideoModal.tsx`: Update import from App.tsx to types/index.ts

### Verification
```bash
npm run build
# Should compile without errors
```

---

## Phase 2: API Hooks (Safe - extract data fetching)

### Goal
Extract async functions into custom hooks for cleaner code organization

### New File: `frontend/src/hooks/useApi.ts`
```typescript
// Extract these functions from App.tsx:
- fetchFolders()
- fetchFolderContents()
- fetchVideos()
- fetchAllTags()
- fetchStats()
- fetchScanStatus()
- fetchCollections()
- fetchProjects()
- fetchDuplicates()
- fetchCollectionVideos()
- fetchProjectVideos()
- addToCollection()
- addToProject()
- createCollection()
- createProject()
- deleteCollection()
- deleteProject()
```

### Pattern
```typescript
export function useApi(token: string | null, API_BASE: string) {
  return {
    async fetchVideos(params?) { ... },
    async fetchCollections() { ... },
    // etc
  }
}
```

### Result
- App.tsx: Import from `useApi` hook
- Each function remains identical

---

## Phase 3: Shared Video Components (MERGE duplicates)

### Goal
Replace 3 identical video grid/list implementations with one reusable component

### Problem Identified
Lines 1779-1837 (Collections) and 1920-1978 (Projects) have **nearly identical** code for displaying videos in grid/list view.

### New File: `frontend/src/components/VideoListView.tsx`

```typescript
interface VideoListViewProps {
  videos: VideoItem[]
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onVideoClick: (video: VideoItem) => void
  formatDuration: (seconds: number | null) => string
  API_BASE: string
}
```

### Components to Create/Update

1. **VideoGrid** - Reuse existing from VideoCard.tsx patterns
2. **VideoList** - Table view of videos
3. **VideoListView** - Wrapper with view mode toggle

### Files Affected
- `components/VideoListView.tsx` (NEW)
- Update `App.tsx` lines 1779-1837 (Collections)
- Update `App.tsx` lines 1920-1978 (Projects)
- Update `App.tsx` lines 1590-1725 (Results) - same pattern

---

## Phase 4: Extract Modals (Safe - just moving JSX)

### Goal
Move inline modal JSX to separate component files

### Modals to Extract

1. **LoginModal** (App.tsx lines 2191-2235)
   - Props: `isFirstRun, isRegister, loginForm, onLogin, onCancel, onToggleRegister`
   - File: `components/LoginModal.tsx`

2. **NewCollectionModal** (App.tsx lines 2237-2260)
   - Props: `name, onChange, onCreate, onCancel`
   - File: `components/NewCollectionModal.tsx`

3. **NewProjectModal** (App.tsx lines 2262-2285)
   - Props: `name, onChange, onCreate, onCancel`
   - File: `components/NewProjectModal.tsx`

4. **AddToModal** (App.tsx lines 2301-2370)
   - Props: `type, collections, projects, onSelect, onCancel, onRefresh`
   - File: `components/AddToModal.tsx`

---

## Phase 5: Main Layout Components

### Header (Extract inline JSX)
- Move from App.tsx lines 1039-1071
- File: `components/Header.tsx`
- Props: `user, activeTab, tabs, onTabChange, onLogout, onLogin`

### Tab Navigation
- Currently embedded in Header
- Extract to `components/TabNav.tsx` if needed

---

## Final Structure

```
frontend/src/
├── App.tsx                    # ~400 lines (state + composition)
├── types/
│   └── index.ts               # All interfaces (moved from App.tsx)
├── hooks/
│   └── useApi.ts              # API functions (extracted)
├── components/
│   ├── VideoModal.tsx         # Existing
│   ├── VideoCard.tsx          # Existing
│   ├── VideoListView.tsx      # NEW - shared video grid/list
│   ├── Header.tsx             # NEW - app header + nav
│   ├── LoginModal.tsx         # NEW - extracted
│   ├── NewCollectionModal.tsx  # NEW - extracted
│   ├── NewProjectModal.tsx    # NEW - extracted
│   └── AddToModal.tsx         # NEW - extracted
└── index.css                  # Unchanged
```

---

## Implementation Order

1. **Phase 1**: Types → ✅ COMPLETE
2. **Phase 2**: API Hooks → ✅ CREATED (not integrated)
3. **Phase 3**: VideoListView → ✅ CREATED (not integrated)
4. **Phase 4**: Modals → PENDING
5. **Phase 5**: Integrate hooks into App.tsx → PENDING

## Current State

- `App.tsx`: 2122 lines (reduced from 2375, -253 lines)
- `types/index.ts`: All interfaces moved ✅
- `hooks/useApi.ts`: All API functions extracted, ready to use
- `components/VideoListView.tsx`: Integrated in Collections and Projects ✅

## Integration Complete

- Collections view: VideoListView integrated ✅
- Projects view: VideoListView integrated ✅
- Results view: Not refactored (has unique features: selection checkboxes, inline tag removal, FPS column)

## Future Improvements (Not Done)
- Results view refactoring (complex due to selection features)
- Integrate useApi hook into App.tsx
- Extract modals to separate components

---

## Verification Checklist After Each Phase

- [ ] `npm run build` passes
- [ ] Login/logout works
- [ ] Folder browsing works
- [ ] Scan starts and shows progress
- [ ] Results show videos with filters
- [ ] Collections CRUD works
- [ ] Projects CRUD works
- [ ] Duplicates detection works
- [ ] Settings (export/import/reset) works
- [ ] Video modal opens and edits work

---

## What NOT to Change

- CSS classes and styles
- Component structure/ordering in JSX
- Function logic (just move)
- State management approach
- API calls (same endpoints, same params)
