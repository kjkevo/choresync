'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import BottomNav from '@/components/ui/BottomNav'

const DEMO_MEMBERS = [
  { id: 'd1', name: 'Jordan Rivera', color: '#FF6B2B', initials: 'JR' },
  { id: 'd2', name: 'Alex Kim',      color: '#6366F1', initials: 'AK' },
  { id: 'd3', name: 'Sam Torres',    color: '#10B981', initials: 'ST' },
  { id: 'd4', name: 'Riley Chen',    color: '#8B5CF6', initials: 'RC' },
]

const INITIAL_MESSAGES = [
  { id: 'm1', uid: 'd2', text: "Hey everyone, whose turn is it to take out the trash?", time: '9:14 AM' },
  { id: 'm2', uid: 'd3', text: "I did it last week! 😅", time: '9:15 AM' },
  { id: 'm3', uid: 'd1', text: "I think it's Riley's turn this week", time: '9:16 AM' },
  { id: 'm4', uid: 'd4', text: "On it! Also I restocked the dish soap 🧼", time: '9:18 AM' },
  { id: 'm5', uid: 'd2', text: "You're the best Riley 🙌", time: '9:19 AM' },
  { id: 'm6', uid: 'd3', text: "I finished vacuuming the living room btw", time: '9:45 AM' },
  { id: 'm7', uid: 'd1', text: "Nice work Sam! Kitchen is done too ✅", time: '9:47 AM' },
  { id: 'm8', uid: 'd4', text: "We're all crushing it this week 🔥", time: '10:02 AM' },
  { id: 'm9', uid: 'd2', text: "Should we do a deep clean this Saturday?", time: '10:15 AM' },
  { id: 'm10', uid: 'd1', text: "Yes! Let's make a plan in the app", time: '10:16 AM' },
  { id: 'm11', uid: 'd3', text: "I'm in 👍", time: '10:17 AM' },
  { id: 'm12', uid: 'd4', text: "Same, works for me 👌", time: '10:17 AM' },
]

type Msg = { id: string; uid: string; text: string; time: string }

function Avatar({ member, size = 32 }: { member: typeof DEMO_MEMBERS[0]; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: member.color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, color: '#fff',
    }}>
      {member.initials}
    </div>
  )
}

export default function ChatDemoClient() {
  const [messages, setMessages] = useState<Msg[]>(INITIAL_MESSAGES)
  const [input, setInput]       = useState('')
  const [tab, setTab]           = useState<'chat' | 'announcements'>('chat')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const memberMap  = Object.fromEntries(DEMO_MEMBERS.map(m => [m.id, m]))
  const me         = DEMO_MEMBERS[0] // Jordan Rivera = "you"

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => { scrollToBottom() }, [scrollToBottom])

  function now() {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setInput('')
    const newMsg: Msg = { id: `new-${Date.now()}`, uid: me.id, text, time: now() }
    setMessages(prev => [...prev, newMsg])
    setTimeout(() => scrollToBottom(true), 30)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: '#F7F8FA', fontFamily: '"Nunito", sans-serif',
      }}>
        {/* Header */}
        <header style={{ flexShrink: 0, background: '#fff', boxShadow: '0 1px 0 #E5E7EB' }}>
          <div style={{ padding: '14px 20px 0', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <span style={{
                fontFamily: '"Poppins", sans-serif', fontWeight: 700,
                fontSize: 17, color: '#111827',
              }}>
                Sunrise Apartment
              </span>
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700,
                background: '#FFF3EE', color: '#FF6B2B',
                borderRadius: 20, padding: '2px 8px',
              }}>
                DEMO
              </span>
            </div>
          </div>

          {/* Tab strip */}
          <div style={{ display: 'flex', maxWidth: 640, margin: '12px auto 0' }}>
            {(['chat', 'announcements'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 800,
                  fontFamily: '"Nunito", sans-serif',
                  color: tab === t ? '#FF6B2B' : '#9CA3AF',
                  borderBottom: `2.5px solid ${tab === t ? '#FF6B2B' : 'transparent'}`,
                }}
              >
                {t === 'chat' ? '💬 Chat' : '📌 Announcements'}
              </button>
            ))}
          </div>
        </header>

        {tab === 'chat' ? (
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
              <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {messages.map((msg, idx) => {
                  const member  = memberMap[msg.uid]
                  const isMe    = msg.uid === me.id
                  const prevSame = idx > 0 && messages[idx - 1].uid === msg.uid

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex', gap: 8, alignItems: 'flex-end',
                        flexDirection: isMe ? 'row-reverse' : 'row',
                        marginTop: prevSame ? 2 : 14,
                      }}
                    >
                      {/* Avatar */}
                      <div style={{ width: 32, flexShrink: 0, opacity: prevSame ? 0 : 1 }}>
                        {!prevSame && <Avatar member={member} size={32} />}
                      </div>

                      {/* Bubble */}
                      <div style={{
                        maxWidth: '72%', display: 'flex', flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start', gap: 3,
                      }}>
                        {!prevSame && (
                          <div style={{
                            display: 'flex', gap: 6, alignItems: 'baseline',
                            flexDirection: isMe ? 'row-reverse' : 'row',
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: member.color }}>
                              {isMe ? 'You' : member.name}
                            </span>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{msg.time}</span>
                          </div>
                        )}
                        <div style={{
                          background: isMe ? '#FF6B2B' : '#fff',
                          color: isMe ? '#fff' : '#111827',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          padding: '9px 14px', fontSize: 14, lineHeight: 1.5,
                          boxShadow: isMe
                            ? '0 2px 10px rgba(255,107,43,0.25)'
                            : '0 1px 4px rgba(0,0,0,0.08)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} style={{ height: 4 }} />
              </div>
            </div>

            {/* Input bar */}
            <div style={{
              flexShrink: 0, borderTop: '1px solid #E5E7EB',
              background: '#fff', padding: '10px 16px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: 640, margin: '0 auto' }}>
                <Avatar member={me} size={32} />
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message the household…"
                  rows={1}
                  style={{
                    flex: 1, resize: 'none', borderRadius: 20,
                    border: '1.5px solid #E5E7EB', background: '#F7F8FA',
                    padding: '9px 16px', fontSize: 14, color: '#111827',
                    fontFamily: '"Nunito", sans-serif', outline: 'none',
                    maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#FF6B2B' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: input.trim() ? '#FF6B2B' : '#E5E7EB',
                    color: input.trim() ? '#fff' : '#9CA3AF',
                    border: 'none',
                    cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s',
                    boxShadow: input.trim() ? '0 3px 10px rgba(255,107,43,0.35)' : 'none',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Announcements placeholder */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32,
          }}>
            <div style={{ fontSize: 48 }}>📌</div>
            <p style={{ marginTop: 12, fontWeight: 700, color: '#374151', fontSize: 16 }}>
              No announcements yet
            </p>
            <p style={{ marginTop: 4, fontSize: 13, color: '#9CA3AF' }}>
              Admins can post important messages here.
            </p>
          </div>
        )}

        <div style={{ height: 68, flexShrink: 0 }} />
      </div>

      <BottomNav />
    </>
  )
}
