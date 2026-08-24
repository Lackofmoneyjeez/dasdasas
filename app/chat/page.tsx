import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ChatClient from '@/components/chat/ChatClient'

export default async function ChatPage() {
  const user = await requireAuth()
  
  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  })

  return (
    <ChatClient 
      user={user}
      initialConversations={conversations}
    />
  )
}
