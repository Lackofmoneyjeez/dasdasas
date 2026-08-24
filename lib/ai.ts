import { prisma } from './db'

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function generateAIResponse(
  messages: AIMessage[],
  conversationId: string,
  userId: string
): Promise<string> {
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || 'gpt-3.5-turbo'
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured')
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to generate AI response')
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    await prisma.message.create({
      data: {
        conversationId: conversationId,
        role: 'assistant',
        content: content,
      },
    })

    return content
  } catch (error) {
    console.error('AI API Error:', error)
    throw error
  }
}

export async function generateAIResponseStream(
  messages: AIMessage[],
  conversationId: string,
  userId: string
): Promise<ReadableStream> {
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || 'gpt-3.5-turbo'
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured')
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to generate AI response')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response stream')
  }

  const fullContent = await collectStreamContent(reader)
  
  await prisma.message.create({
    data: {
      conversationId: conversationId,
      role: 'assistant',
      content: fullContent,
    },
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const chunks = fullContent.match(/.{1,50}/g) || [fullContent]
      chunks.forEach((chunk, index) => {
        setTimeout(() => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
          if (index === chunks.length - 1) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          }
        }, index * 50)
      })
    }
  })

  return stream
}

async function collectStreamContent(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  let content = ''
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      const lines = text.split('\n').filter(line => line.trim() !== '')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices[0]?.delta?.content || ''
            content += delta
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return content
}

export function buildConversationContext(messages: Array<{ role: string; content: string }>): AIMessage[] {
  return messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }))
}

export async function generateConversationTitle(userMessage: string): Promise<string> {
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || 'gpt-3.5-turbo'
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) {
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '')
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Generate a very short title (5 words max) for this conversation based on the user\'s first message. Return only the title, no other text.',
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.5,
        max_tokens: 20,
      }),
    })

    if (!response.ok) {
      return userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '')
    }

    const data = await response.json()
    return data.choices[0]?.message?.content?.trim() || userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '')
  } catch {
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '')
  }
}
