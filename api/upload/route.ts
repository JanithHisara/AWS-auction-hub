import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { PERMISSIONS } from '../../lib/permissions'
import { authorizeAdmin } from '../admin/_auth'

const uploadsDirectory = path.resolve(process.cwd(), 'uploads')
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_VIDEO_SIZE = 50 * 1024 * 1024

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

export const receiveUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new Error('Unsupported file type. Upload JPG, PNG, WebP, GIF, MP4, WebM, or MOV files.'))
      return
    }
    callback(null, true)
  },
}).single('file')

function getVerifiedMediaType(file: Express.Multer.File): 'image' | 'gif' | 'video' | null {
  const { buffer, mimetype } = file
  if (mimetype === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image'
  }
  if (mimetype === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image'
  }
  if (mimetype === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image'
  }
  if (mimetype === 'image/gif' && /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) {
    return 'gif'
  }
  if ((mimetype === 'video/mp4' || mimetype === 'video/quicktime') &&
    buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video'
  }
  if (mimetype === 'video/webm' &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return 'video'
  }
  return null
}

function getExtension(mimetype: string): string {
  switch (mimetype) {
    case 'image/jpeg': return '.jpg'
    case 'image/png': return '.png'
    case 'image/webp': return '.webp'
    case 'image/gif': return '.gif'
    case 'video/mp4': return '.mp4'
    case 'video/webm': return '.webm'
    case 'video/quicktime': return '.mov'
    default: throw new Error('Unsupported file type.')
  }
}

export async function postUpload(request: Request, response: Response, next: NextFunction) {
  try {
    const admin = await authorizeAdmin(request, response, PERMISSIONS.UPLOAD_FILES)
    if (!admin) return

    receiveUpload(request, response, async error => {
      if (error) {
        const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
        response.status(status).json({
          error: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
            ? 'The uploaded file exceeds the 50MB limit.'
            : error.message,
        })
        return
      }

      try {
        const file = request.file
        if (!file) {
          response.status(400).json({ error: 'Choose a file to upload.' })
          return
        }

        const mediaType = getVerifiedMediaType(file)
        if (!mediaType) {
          response.status(400).json({ error: 'The file contents do not match a supported image or video type.' })
          return
        }
        if (mediaType !== 'video' && file.size > MAX_IMAGE_SIZE) {
          response.status(413).json({ error: 'Images must be 5MB or smaller.' })
          return
        }

        await mkdir(uploadsDirectory, { recursive: true })
        const filename = `${randomUUID()}${getExtension(file.mimetype)}`
        await writeFile(path.join(uploadsDirectory, filename), file.buffer, { flag: 'wx' })

        response.status(201).json({
          url: `/uploads/${filename}`,
          media_type: mediaType,
        })
      } catch (uploadError) {
        next(uploadError)
      }
    })
  } catch (error) {
    next(error)
  }
}
