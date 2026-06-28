"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

export function SearchBar() {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/otsing?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center bg-white/[.07] border border-white/[.14] h-[38px] w-full max-w-[460px] px-[14px] gap-[10px]"
      role="search"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,.4)" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Otsi tooteid, brände, artikleid..."
        className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/40 outline-none"
        aria-label="Otsi tooteid"
      />
    </form>
  )
}
