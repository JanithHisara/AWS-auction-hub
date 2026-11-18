import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

config({ path: ['.env.local', '.env'] })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
})
