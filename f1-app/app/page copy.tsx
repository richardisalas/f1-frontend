"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import f1GPTLogo from "./assests/F1-logo.png"
import { useChat } from "ai/react"
import { Message } from "ai"

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center space-x-2">
          <Image src={f1GPTLogo} alt="F1GPT Logo" width={40} height={40} className="rounded-lg" />
          <h1 className="text-xl font-semibold text-[#0077C8]">F1GPT</h1>
        </div>
        <nav>
          <ul className="flex space-x-4 text-sm">
            <li>
              <a href="#" className="text-gray-600 hover:text-[#0077C8]">About</a>
            </li>
            <li>
              <a href="#" className="text-gray-600 hover:text-[#0077C8]">F1 News</a>
            </li>
            <li>
              <a href="#" className="text-gray-600 hover:text-[#0077C8]">Teams</a>
            </li>
          </ul>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-12">
              <div className="mb-8">
                <Image src={f1GPTLogo} alt="F1GPT Logo" width={120} height={120} className="rounded-xl" />
              </div>
              <h2 className="mb-4 text-center text-2xl font-semibold text-gray-800">Welcome to F1GPT</h2>
              <p className="mb-6 max-w-md text-center text-gray-600">
                The ultimate place for Formula 1 super fans! Ask F1GPT anything about the sport, 
                from the latest news to the history of the sport.
              </p>
              <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  "Tell me about the latest F1 race results",
                  "Who is the current world champion?",
                  "Explain DRS and how it works",
                  "What are the biggest rule changes this season?",
                ].map((example, i) => (
                  <button
                    key={i}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#0077C8]/40 hover:bg-blue-50"
                    onClick={() => {
                      // Here you would normally set the input and trigger a submission
                      // This is a simplified example
                    }}
                  >
                    <span className="text-sm text-gray-700">{example}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`px-4 py-6 ${
                    message.role === "user" ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <div className="mx-auto flex max-w-3xl items-start space-x-4">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
                      {message.role === "user" ? (
                        <span className="text-xs font-medium">You</span>
                      ) : (
                        <span className="text-xs font-medium text-[#0077C8]">F1</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="prose prose-blue max-w-none">
                        {message.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="relative rounded-xl border border-gray-300 shadow-sm focus-within:border-[#0077C8] focus-within:ring-1 focus-within:ring-[#0077C8]">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask anything about Formula 1..."
                className="w-full rounded-xl border-0 py-3 pl-4 pr-12 text-gray-900 focus:ring-0 sm:text-sm"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-[#0077C8] p-1.5 text-white transition-colors disabled:bg-gray-300"
              >
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
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">
              Powered by GPT-4 and Formula 1 knowledge
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}