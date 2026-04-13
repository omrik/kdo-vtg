const API_BASE = import.meta.env.VITE_API_URL || ''

const getHeaders = (token: string | null) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
})

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      return res.json()
    },
    register: async (username: string, password: string) => {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      return res.json()
    },
    me: async (token: string) => {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.json()
    },
    setupStatus: async () => {
      const res = await fetch(`${API_BASE}/api/auth/setup-status`)
      return res.json()
    }
  },

  folders: async (token: string | null) => {
    const res = await fetch(`${API_BASE}/api/folders`, { headers: getHeaders(token) })
    return res.json()
  },

  folderContents: async (path: string, token: string | null) => {
    const res = await fetch(`${API_BASE}/api/folders/contents?path=${encodeURIComponent(path)}`, {
      headers: getHeaders(token)
    })
    return res.json()
  },

  videos: {
    list: async (token: string | null, folderPath?: string) => {
      const url = folderPath 
        ? `${API_BASE}/api/videos?folder_path=${encodeURIComponent(folderPath)}`
        : `${API_BASE}/api/videos`
      const res = await fetch(url, { headers: getHeaders(token) })
      return res.json()
    },
    get: async (id: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/${id}`, { headers: getHeaders(token) })
      return res.json()
    },
    addTag: async (id: number, tag: string, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/${id}/tags`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ tag })
      })
      return res.json()
    },
    removeTag: async (id: number, tag: string, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/${id}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
        headers: getHeaders(token)
      })
      return res.json()
    },
    setRating: async (id: number, rating: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/${id}/rating`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ rating })
      })
      return res.json()
    },
    batchAddTag: async (ids: number[], tag: string, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/batch/add-tag`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ video_ids: ids, tag })
      })
      return res.json()
    },
    batchRemoveTag: async (ids: number[], tag: string, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/batch/remove-tag`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ video_ids: ids, tag })
      })
      return res.json()
    },
    batchDelete: async (ids: number[], token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/batch/delete`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ video_ids: ids })
      })
      return res.json()
    },
    duplicates: async (token: string | null) => {
      const res = await fetch(`${API_BASE}/api/videos/duplicates`, { headers: getHeaders(token) })
      return res.json()
    }
  },

  scan: {
    start: async (folderPath: string, settings: Record<string, any>, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ folder_path: folderPath, ...settings })
      })
      return res.json()
    },
    status: async (id: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/scan/${id}`, { headers: getHeaders(token) })
      return res.json()
    },
    cancel: async (id: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/scan/${id}/cancel`, { method: 'POST', headers: getHeaders(token) })
      return res.json()
    }
  },

  collections: {
    list: async (token: string | null) => {
      const res = await fetch(`${API_BASE}/api/collections`, { headers: getHeaders(token) })
      return res.json()
    },
    create: async (data: { name: string; description?: string; color: string }, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/collections`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(data)
      })
      return res.json()
    },
    delete: async (id: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/collections/${id}`, {
        method: 'DELETE',
        headers: getHeaders(token)
      })
      return res.json()
    },
    getVideos: async (id: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/collections/${id}/videos`, { headers: getHeaders(token) })
      return res.json()
    },
    addVideo: async (id: number, videoId: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/collections/${id}/videos`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ video_id: videoId })
      })
      return res.json()
    }
  },

  projects: {
    list: async (token: string | null) => {
      const res = await fetch(`${API_BASE}/api/projects`, { headers: getHeaders(token) })
      return res.json()
    },
    create: async (data: { name: string; description?: string }, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(data)
      })
      return res.json()
    },
    delete: async (id: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/projects/${id}`, {
        method: 'DELETE',
        headers: getHeaders(token)
      })
      return res.json()
    },
    getVideos: async (id: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/projects/${id}/videos`, { headers: getHeaders(token) })
      return res.json()
    },
    addVideo: async (id: number, videoId: number, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/projects/${id}/videos`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ video_id: videoId })
      })
      return res.json()
    }
  },

  tags: async (token: string | null) => {
    const res = await fetch(`${API_BASE}/api/tags`, { headers: getHeaders(token) })
    return res.json()
  },

  stats: async (token: string | null) => {
    const res = await fetch(`${API_BASE}/api/stats`, { headers: getHeaders(token) })
    return res.json()
  },

  version: async () => {
    const res = await fetch(`${API_BASE}/api/version`)
    return res.json()
  },

  settings: {
    autoCreateCollections: async (token: string | null) => {
      const res = await fetch(`${API_BASE}/api/settings/auto-create-collections-by-tag`, {
        method: 'POST',
        headers: getHeaders(token)
      })
      return res.json()
    },
    exportDb: async (token: string | null) => {
      const res = await fetch(`${API_BASE}/api/settings/export-db`, { headers: getHeaders(token) })
      return res.blob()
    },
    resetDb: async (token: string | null) => {
      const res = await fetch(`${API_BASE}/api/settings/reset-db`, {
        method: 'POST',
        headers: getHeaders(token)
      })
      return res.json()
    }
  },

  export: {
    csv: async (videoIds: number[] | null, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/export/csv`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(videoIds ? { video_ids: videoIds } : {})
      })
      return res.blob()
    },
    excel: async (videoIds: number[] | null, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/export/excel`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(videoIds ? { video_ids: videoIds } : {})
      })
      return res.blob()
    },
    edl: async (videoIds: number[] | null, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/export/edl`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(videoIds ? { video_ids: videoIds } : {})
      })
      return res.blob()
    },
    pdf: async (videoIds: number[] | null, token: string | null) => {
      const res = await fetch(`${API_BASE}/api/export/pdf`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(videoIds ? { video_ids: videoIds } : {})
      })
      return res.blob()
    }
  }
}

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

export { API_BASE }
