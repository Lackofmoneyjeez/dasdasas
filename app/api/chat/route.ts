import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiAuth } from '@/lib/auth'
import { generateAIResponse, generateAIResponseStream, buildConversationContext, generateConversationTitle } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiAuth()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { conversationId, message } = body

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'Conversation ID and message are required' },
        { status: 400 }
      )
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: message,
      },
    })

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })

    const context = buildConversationContext(messages)

    const acceptHeader = request.headers.get('accept')
    const wantsStreaming = acceptHeader?.includes('text/event-stream')

    if (wantsStreaming) {
      try {
        const stream = await generateAIResponseStream(context, conversationId, user.id)
        
        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (error) {
        console.error('Streaming error:', error)
        const content = await generateAIResponse(context, conversationId, user.id)
        
        if (messages.length === 1) {
          const title = await generateConversationTitle(message)
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { title },
          })
        }

        return NextResponse.json({ content })
      }
    } else {
      const content = await generateAIResponse(context, conversationId, user.id)

      if (messages.length === 1) {
        const title = await generateConversationTitle(message)
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { title },
        })
      }

      return NextResponse.json({ content })
    }
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
