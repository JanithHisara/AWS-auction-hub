'use client'

export function apiUrl(path: string): string {
  if (typeof window === 'undefined') {
    const origin = process.env.API_ORIGIN || 'http://backend:4000'
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`
  }
  return path.startsWith('/') ? path : `/${path}`
}

