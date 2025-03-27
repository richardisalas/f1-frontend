"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import f1GPTLogo from "./assets/F1-logo.png"
import { useChat } from 'ai/react'

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [waitingForFirstToken, setWaitingForFirstToken] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Use the chat hook with minimal configuration
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setInput,
    setMessages,
  } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      // Handle successful response
      console.log('[DEBUG] Got API response:', response.status);
      if (response.status === 200) {
        console.log('[DEBUG] Response status OK');
        setWaitingForFirstToken(false);
        
        // Debug the response headers
        console.log('[DEBUG] Response headers:', 
          Array.from(response.headers.entries())
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
        );
        
        // Debug the response body
        response.clone().text().then(text => {
          console.log('[DEBUG] First part of response body:', text.slice(0, 300));
          
          // Additional debug for stream format
          const lines = text.split('\n\n').slice(0, 3);
          console.log('[DEBUG] Response format analysis:', 
            lines.map(line => {
              try {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') return 'End marker found';
                  const parsed = JSON.parse(data);
                  return `Valid JSON with keys: ${Object.keys(parsed).join(', ')}`;
                }
                return `Line doesn't start with 'data: ': ${line.slice(0, 20)}...`;
              } catch (e) {
                return `Failed to parse: ${e.message}`;
              }
            })
          );
        }).catch(e => {
          console.error('[DEBUG] Failed to read response:', e);
        });
      } else {
        console.error('Error response:', response.status, response.statusText);
        setDbError(`API responded with status: ${response.status} - ${response.statusText}`);
      }
    },
    onError: (error) => {
      console.error('[DEBUG] Chat error:', error)
      let errorMessage = error instanceof Error ? error.message : 'Failed to communicate with the server'
      
      // Check for specific error patterns
      if (errorMessage.includes('parse') || errorMessage.includes('stream')) {
        console.error('[DEBUG] Parse error detected in stream');
        
        // Try to get more information about what caused the parse error
        try {
          if (typeof window !== 'undefined') {
            console.log('[DEBUG] Document title:', document.title);
            console.log('[DEBUG] Available globals:', 
              Object.keys((window as any).__NEXT_DATA__?.props?.pageProps || {})
            );
          }
        } catch (debugError) {
          console.error('[DEBUG] Error inspecting window:', debugError);
        }
        
        errorMessage = "Failed to parse stream data. The server response format might be invalid."
      }
      
      setDbError(errorMessage)
      setIsSubmitting(false)
      setWaitingForFirstToken(false)
    },
    onFinish: () => {
      console.log('[DEBUG] Chat finished successfully');
      setIsSubmitting(false)
      setWaitingForFirstToken(false)
    },
    // Configure to match our backend format
    body: {
      // Any additional parameters
    }
  })

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
    if (messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content) {
      setWaitingForFirstToken(false);
    }
  }, [messages]);

  // Function to handle example clicks
  const handleExampleClick = (example: string) => {
    console.log("Example clicked:", example);
    // First set the input
    setInput(example)
    
    // Then trigger the form submission after a small delay
    setTimeout(() => {
      if (formRef.current) {
        console.log("Submitting form with:", example);
        const event = new Event('submit', { bubbles: true, cancelable: true });
        formRef.current.dispatchEvent(event);
      }
    }, 150);
  }

  // Handle form submission
  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Validate input
    if (!input.trim() || isSubmitting) return
    
    // Clear previous errors
    setDbError(null)
    
    console.log('Form submitted with:', input)
    setIsSubmitting(true)
    setWaitingForFirstToken(true)
    
    // Use the handleSubmit directly from the useChat hook
    handleSubmit(e)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f8]">
      {/* Header */}
      <header className="app-header sticky top-0 z-10">
        <Link 
          href="/" 
          className="flex items-center hover:opacity-80 transition-opacity no-underline"
          onClick={() => {
            setMessages([])
            setInput("")
          }}
        >
          <Image 
            src={f1GPTLogo} 
            alt="F1 Logo" 
            width={42} 
            height={42} 
            className="logo-image" 
          />
          <h1 className="app-title">GrandPrixGPT</h1>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="welcome-container h-[calc(100vh-90px)] flex flex-col items-center justify-center py-6">
            <div className="logo-container mb-3">
              <Image 
                src={f1GPTLogo} 
                alt="GrandPrixGPT Logo" 
                width={180} 
                height={180} 
                className="welcome-logo" 
              />
            </div>
            
            <h2 className="welcome-title">Welcome to GrandPrixGPT</h2>
            
            <p className="welcome-text">
              The ultimate place for Formula 1 super fans! Ask<br />
              GrandPrixGPT anything about the sport, from the latest<br />
              news to the history of the sport.
            </p>
            
            <div className="examples-grid">
              <button
                className="example-button"
                onClick={() => handleExampleClick("Tell me about the latest F1 race results")}
              >
                Tell me about the latest F1 race results
              </button>
              <button
                className="example-button"
                onClick={() => handleExampleClick("Who is the current world champion?")}
              >
                Who is the current world champion?
              </button>
              <button
                className="example-button"
                onClick={() => handleExampleClick("Explain DRS and how it works")}
              >
                Explain DRS and how it works
              </button>
              <button
                className="example-button"
                onClick={() => handleExampleClick("What are the biggest rule changes this season?")}
              >
                What are the biggest rule changes this season?
              </button>
            </div>
          </div>
        ) : (
          <div>
            {error && (
              <div className="message-container assistant">
                <div className="message-content">
                  <div className="message text-red-500">
                    Error: Unable to communicate with the AI service. Please check your API keys and try again.
                    {dbError && <div className="mt-2 text-sm">{dbError}</div>}
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((message, i) => (
              <div
                key={i}
                className={`message-container ${message.role === "user" ? "user" : "assistant"}`}
              >
                <div className="message-content">
                  <div className="message">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading spinner - only show when waiting for first token */}
            {waitingForFirstToken && (
              <div className="message-container assistant">
                <div className="message-content">
                  <div className="flex">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#7e22ce] border-t-transparent"></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input area */}
      <div className="input-container">
        <form 
          ref={formRef} 
          onSubmit={onFormSubmit} 
          className="input-form"
        >
          <div className="relative w-full">
            <textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask anything about Formula 1..."
              className="chat-input"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    onFormSubmit(e as any);
                  }
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="send-button"
              aria-label="Send message"
            >
              {waitingForFirstToken ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M22 2L11 13"
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M22 2L15 22L11 13L2 9L22 2Z" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
          <p className="footer-text mt-2">
            Powered by GPT-4 and Formula 1 knowledge
          </p>
        </form>
      </div>
    </div>
  )
}