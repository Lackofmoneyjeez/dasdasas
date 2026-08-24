import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiAuth, clearSession } from '@/lib/auth'

export async function DELETE() {
  try {
    const user = await requireApiAuth()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await prisma.user.delete({
      where: { id: user.id },
    })

    await clearSession()

    return NextResponse.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
