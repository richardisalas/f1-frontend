"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import f1GPTLogo from "./assests/F1-logo.png"
import { useChat } from "ai/react"

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, setMessages } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [waitingForFirstToken, setWaitingForFirstToken] = useState(false)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Effect to handle loading states
  useEffect(() => {
    if (isLoading) {
      setWaitingForFirstToken(true)
    }
  }, [isLoading])

  // Effect to detect first token
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      setWaitingForFirstToken(false)
    }
  }, [messages])

  // Function to handle example clicks
  const handleExampleClick = (example: string) => {
    setInput(example)
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        )
      }
    }, 100)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <Link 
          href="/" 
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          onClick={() => {
            setMessages([])
            setInput("")
          }}
        >
          <Image src={f1GPTLogo} alt="GrandPrixGPT Logo" width={40} height={40} className="rounded-lg" />
          <h1 className="text-xl font-semibold text-[#0077C8]">GrandPrixGPT</h1>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col bg-white">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-12">
              <div className="mb-8">
                <Image src={f1GPTLogo} alt="GrandPrixGPT Logo" width={120} height={120} className="rounded-xl" />
              </div>
              <h2 className="mb-4 text-center text-2xl font-semibold text-gray-800">Welcome to GrandPrixGPT</h2>
              <p className="mb-6 max-w-md text-center text-gray-600">
                The ultimate place for Formula 1 super fans! Ask GrandPrixGPT anything about the sport, 
                from the latest news to the history of the sport.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                <button
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
                  onClick={() => handleExampleClick("Tell me about the latest F1 race results")}
                >
                  Tell me about the latest F1 race results
                </button>
                <button
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
                  onClick={() => handleExampleClick("Who is the current world champion?")}
                >
                  Who is the current world champion?
                </button>
                <button
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
                  onClick={() => handleExampleClick("Explain DRS and how it works")}
                >
                  Explain DRS and how it works
                </button>
                <button
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
                  onClick={() => handleExampleClick("What are the biggest rule changes this season?")}
                >
                  What are the biggest rule changes this season?
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-8 max-w-5xl mx-auto">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[85%] ${
                      message.role === "user"
                        ? "bg-[#0077C8] text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {waitingForFirstToken && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-4 py-2 max-w-[85%] bg-gray-100">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0077C8] border-t-transparent"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white px-4 py-2">
          <div className="mx-auto max-w-5xl">
            <form ref={formRef} onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask anything about Formula 1..."
                className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-16 focus:border-[#0077C8] focus:outline-none focus:ring-2 focus:ring-[#0077C8]/50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-[#0077C8] p-1.5 text-white transition-colors disabled:bg-gray-300"
              >
                {waitingForFirstToken ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-gray-500">
              Powered by GPT-4 and Formula 1 knowledge
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}