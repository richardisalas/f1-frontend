"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import f1GPTLogo from "./assets/F1-logo.png"
import { useChat, Message } from "ai/react"

export default function Home() {
  // Always use a relative URL for API requests to avoid cross-origin issues
  const apiUrl = '/api/chat';
  
  console.log("Using API URL:", apiUrl);
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, setMessages, error } = useChat({
    api: apiUrl,
    onError: (err) => {
      console.error("Chat error:", err);
      setIsSubmitting(false);
      setWaitingForFirstToken(false);
      setDbError(err instanceof Error ? err.message : "Failed to communicate with the server");
    },
    onFinish: () => {
      setIsSubmitting(false);
      setWaitingForFirstToken(false);
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: {
      // Add any additional configuration needed for the API
      config: {
        temperature: 0.7,
        stream: true,
      }
    }
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [waitingForFirstToken, setWaitingForFirstToken] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      console.log("Submitting form with:", example);
      const event = new Event('submit', { bubbles: true, cancelable: true });
      formRef.current?.dispatchEvent(event);
    }, 150);
  }

  // Custom form submission function
  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;
    
    try {
      console.log("Form submitted with:", input);
      setIsSubmitting(true);
      setWaitingForFirstToken(true);
      
      // Clear input first
      setInput("");
      
      // Create a custom request rather than using useChat's handleSubmit for Safari compatibility
      if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        // Special handling for Safari
        const userMessage: Message = { 
          id: Date.now().toString(),
          role: 'user', 
          content: input 
        };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
              messages: newMessages,
              config: {
                temperature: 0.7,
                stream: true,
              }
            }),
            credentials: 'same-origin',
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          }
          
          // Add blank assistant message
          const assistantMessage: Message = { 
            id: (Date.now() + 1).toString(),
            role: 'assistant', 
            content: '' 
          };
          setMessages([...newMessages, assistantMessage]);
          
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Response body is not readable');
          }
          
          // Process the stream
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Process the chunk data
            const text = new TextDecoder().decode(value);
            const chunks = text.split('\n\n').filter(Boolean);
            
            // Find and update content
            for (const chunk of chunks) {
              if (chunk.startsWith('data: ') && chunk !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(chunk.replace('data: ', ''));
                  const content = data.choices[0]?.delta?.content || '';
                  if (content) {
                    // Update message content directly
                    const updatedMessages = [...messages];
                    if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role === 'assistant') {
                      const lastMessage = updatedMessages[updatedMessages.length - 1];
                      lastMessage.content += content;
                      setMessages(updatedMessages);
                      setWaitingForFirstToken(false);
                    }
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in custom fetch:', error);
          setDbError(error instanceof Error ? error.message : 'Error processing request');
        } finally {
          setIsSubmitting(false);
          setWaitingForFirstToken(false);
        }
      } else {
        // Use handleSubmit for other browsers
        handleSubmit(e);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setDbError(error instanceof Error ? error.message : "Failed to submit message");
    } finally {
      setIsSubmitting(false);
    }
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