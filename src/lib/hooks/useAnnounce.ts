'use client'

export function useAnnounce() {
  function announce(message: string) {
    const el = document.getElementById('sr-announcer')
    if (!el) return
    // Clear then set to ensure re-announcement for same message
    el.textContent = ''
    requestAnimationFrame(() => {
      el.textContent = message
    })
  }
  return announce
}
