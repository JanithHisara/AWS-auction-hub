import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024   // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024  // 50MB

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const GIF_TYPES = ['image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const ALL_ALLOWED_TYPES = [...IMAGE_TYPES, ...GIF_TYPES, ...VIDEO_TYPES]

function getMediaType(mimeType: string): 'image' | 'gif' | 'video' {
  if (VIDEO_TYPES.includes(mimeType)) return 'video'
  if (GIF_TYPES.includes(mimeType)) return 'gif'
  return 'image'
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.UPLOAD_FILES)
    const supabase = createAdminClient()

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 })
    }

    if (!ALL_ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ message: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF, MP4, WebM, MOV' }, { status: 400 })
    }

    const mediaType = getMediaType(file.type)
    const maxSize = mediaType === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    const maxLabel = mediaType === 'video' ? '50MB' : '5MB'

    if (file.size > maxSize) {
      return NextResponse.json({ message: `File too large (max ${maxLabel})` }, { status: 400 })
    }

    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
    const filePath = mediaType === 'video' ? `gems/videos/${fileName}` : `gems/${fileName}`

    const { data, error } = await supabase.storage
      .from('gem-images')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ message: 'Upload failed: ' + error.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gem-images')
      .getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: data.path,
      media_type: mediaType,
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ message: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
  }
}
