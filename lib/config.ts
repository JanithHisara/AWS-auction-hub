export function requiredSecret(name: string, environment: Readonly<Record<string, string | undefined>> = process.env): string {
  const value = environment[name]
  if (!value || value.trim().length < 32 || /replace[-_ ]?me|change[-_ ]?me|placeholder|super.secret/i.test(value)) {
    throw new Error(`${name} must be configured with an independent random secret of at least 32 characters.`)
  }
  return value
}

function isLoopbackHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      !url.username && !url.password
  } catch {
    return false
  }
}

export function sessionCookieSecure(environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (environment.NODE_ENV !== 'production') return false
  return !(environment.APP_ENV === 'local' && isLoopbackHttpUrl(environment.NEXT_PUBLIC_APP_URL || ''))
}

export function validateServerEnvironment(environment: Readonly<Record<string, string | undefined>> = process.env): void {
  if (environment.NODE_ENV !== 'production') return
  if (environment.APP_ENV && !['local', 'production'].includes(environment.APP_ENV)) {
    throw new Error('APP_ENV must be local or production.')
  }
  if (!environment.DATABASE_URL || !/^postgres(?:ql)?:\/\//.test(environment.DATABASE_URL)) {
    throw new Error('DATABASE_URL must be configured with a PostgreSQL connection URL.')
  }
  requiredSecret('AUTH_SECRET', environment)
  requiredSecret('CRON_SECRET', environment)
  if (environment.AUTH_SECRET === environment.CRON_SECRET) {
    throw new Error('AUTH_SECRET and CRON_SECRET must be different.')
  }
  const appUrl = new URL(environment.NEXT_PUBLIC_APP_URL || '')
  const local = environment.APP_ENV === 'local'
  if (appUrl.protocol !== 'https:' && !(local && isLoopbackHttpUrl(appUrl.href))) {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS in production. Local HTTP requires APP_ENV=local and a loopback URL.')
  }
  const origins = (environment.FRONTEND_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)
  if (!origins.length || origins.some(origin => {
    const url = new URL(origin)
    return (url.protocol !== 'https:' && !(local && isLoopbackHttpUrl(origin))) || url.origin !== origin
  })) {
    throw new Error('FRONTEND_ORIGINS must contain explicit HTTPS origins, or loopback HTTP origins with APP_ENV=local.')
  }
}
