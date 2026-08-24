import { prisma } from './db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const SESSION_COOKIE = 'ai-chat-session'

export interface SessionUser {
  id: string
  name: string
  email: string
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return sessionId
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value
  
  if (!sessionId) return null

  try {
    const user = await prisma.user.findFirst({
      where: { id: sessionId },
      select: { id: true, name: true, email: true }
    })

    if (!user) return null
    return user
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function requireApiAuth(): Promise<SessionUser | null> {
  const user = await getSession()
  if (!user) {
    return null
  }
  return user
}
