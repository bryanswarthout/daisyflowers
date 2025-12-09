import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm Daisy Flowers from Beyond Hello. What are you looking for today?",
      products: []
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState(null)
  const [speechEnabled, setSpeechEnabled] = useState(true)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [typewriterText, setTypewriterText] = useState('')
  const [isTypewriting, setIsTypewriting] = useState(false)
  const messagesEndRef = useRef(null)
  const typewriterRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Load voices when component mounts
    if ('speechSynthesis' in window) {
      // Load voices
      window.speechSynthesis.getVoices()
      
      // Some browsers need this event
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }
    
    // Cleanup typewriter effect on unmount
    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current)
      }
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    if (isLoading) {
      setIsSpeaking(true)
    } else {
      // Keep speaking animation for 2 seconds after response arrives
      const timer = setTimeout(() => setIsSpeaking(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isLoading, messages])

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = 'en-US'
      
      recognitionInstance.onstart = () => {
        setIsListening(true)
      }
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
      }
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
      
      recognitionInstance.onend = () => {
        setIsListening(false)
      }
      
      setRecognition(recognitionInstance)
    }
  }, [])

  const startListening = () => {
    if (recognition && !isListening) {
      recognition.start()
    }
  }

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop()
    }
  }

  const getBestFemaleVoice = () => {
    const voices = window.speechSynthesis.getVoices()
    
    // Prioritize attractive British female voices first
    const preferredVoices = [
      'Microsoft Hazel Desktop - English (Great Britain)',
      'Google UK English Female',
      'Kate',
      'Serena', 
      'Moira',
      'Fiona',
      'Microsoft Susan Mobile - English (Great Britain)',
      'Samantha',
      'Karen',
      'Tessa',
      'Microsoft Zira - English (United States)',
      'Google US English Female'
    ]
    
    // First try to find preferred voices
    for (const preferred of preferredVoices) {
      const voice = voices.find(v => v.name.includes(preferred.split(' - ')[0]))
      if (voice) return voice
    }
    
    // Look for any British accent
    const britishVoice = voices.find(voice => 
      (voice.lang.includes('GB') || voice.lang.includes('UK') || 
       voice.name.toLowerCase().includes('british') ||
       voice.name.toLowerCase().includes('england')) &&
      (voice.name.toLowerCase().includes('female') || 
       voice.name.toLowerCase().includes('woman') ||
       voice.gender === 'female')
    )
    
    if (britishVoice) return britishVoice
    
    // Fallback to any attractive female voice
    const femaleVoice = voices.find(voice => 
      (voice.name.toLowerCase().includes('female') || 
       voice.name.toLowerCase().includes('woman') ||
       voice.gender === 'female') && 
      voice.lang.startsWith('en')
    )
    
    return femaleVoice || voices.find(voice => voice.lang.startsWith('en'))
  }

  const speakWordByWord = (words, currentIndex = 0) => {
    if (!speechEnabled || !('speechSynthesis' in window) || currentIndex >= words.length) {
      setIsPlayingAudio(false)
      return
    }

    const word = words[currentIndex]
    if (!word.trim()) {
      speakWordByWord(words, currentIndex + 1)
      return
    }

    const utterance = new SpeechSynthesisUtterance(word)
    
    // Configure for more natural female voice
    utterance.rate = 1.3 // Faster speech rate
    utterance.pitch = 1.1 // Natural female pitch
    utterance.volume = 0.9
    
    const voice = getBestFemaleVoice()
    if (voice) {
      utterance.voice = voice
    }

    utterance.onstart = () => {
      setIsPlayingAudio(true)
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      // Continue with next word immediately
      speakWordByWord(words, currentIndex + 1)
    }

    utterance.onerror = () => {
      console.error('Speech error, continuing to next word')
      speakWordByWord(words, currentIndex + 1)
    }

    window.speechSynthesis.speak(utterance)
  }

  const speakText = (text) => {
    if (!speechEnabled || !('speechSynthesis' in window)) return

    // Stop any currently playing speech
    window.speechSynthesis.cancel()
    
    // Clean the text
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    // Feminine British woman speech settings
    utterance.rate = 1.1 // Slower and more conversational
    utterance.pitch = 1.3 // Higher pitch for more feminine voice
    utterance.volume = 0.9
    
    const voice = getBestFemaleVoice()
    if (voice) {
      utterance.voice = voice
    }

    utterance.onstart = () => {
      setIsPlayingAudio(true)
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsPlayingAudio(false)
      setTimeout(() => setIsSpeaking(false), 500)
    }

    utterance.onerror = () => {
      setIsPlayingAudio(false)
    }

    window.speechSynthesis.speak(utterance)
  }

  const typewriterWithSpeech = (text, callback) => {
    setIsTypewriting(true)
    setTypewriterText('')
    
    // Clean text for both display and speech
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    const words = cleanText.split(' ')
    let currentIndex = 0
    
    // Start speech immediately if enabled
    if (speechEnabled) {
      speakText(cleanText)
    }
    
    const timer = setInterval(() => {
      if (currentIndex < words.length) {
        setTypewriterText(prev => 
          prev + (currentIndex === 0 ? '' : ' ') + words[currentIndex]
        )
        currentIndex++
      } else {
        clearInterval(timer)
        setIsTypewriting(false)
        setTypewriterText('')
        if (callback) callback()
      }
    }, 130) // Slower to match feminine speech pace
    
    typewriterRef.current = timer
  }

  const toggleSpeech = () => {
    setSpeechEnabled(!speechEnabled)
    if (!speechEnabled) {
      // If enabling speech, speak the last assistant message
      const lastAssistantMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.role === 'assistant')
      if (lastAssistantMessage) {
        speakText(lastAssistantMessage.content)
      }
    } else {
      // If disabling speech, stop any current speech
      window.speechSynthesis.cancel()
      setIsPlayingAudio(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage, products: [] }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage })
      })

      const data = await response.json()

      if (response.ok) {
        // Add empty message first for typewriter effect
        const emptyMessage = { 
          role: 'assistant', 
          content: '',
          products: data.products || [],
          isTypewriting: true
        }
        setMessages(prev => [...prev, emptyMessage])
        
        // Start synchronized typewriter and speech
        typewriterWithSpeech(data.response, () => {
          // Replace with final message
          const finalMessage = { 
            role: 'assistant', 
            content: data.response,
            products: data.products || []
          }
          setMessages(prev => {
            const newMessages = [...prev]
            newMessages[newMessages.length - 1] = finalMessage
            return newMessages
          })
        })
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Sorry, I encountered an error: ${data.error}`,
          products: []
        }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I couldn\'t connect to the server. Please make sure it\'s running.',
        products: []
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="avatar-container">
          <div className={`avatar ${isSpeaking || isTypewriting ? 'speaking' : ''}`}>
            <img 
              src="/girl.png" 
              alt="Daisy Flowers" 
              className="avatar-image"
            />
            <div className="mouth-overlay">
              <div className="mouth-animation"></div>
            </div>
            <div className="avatar-pulse"></div>
          </div>
        </div>
        <h1>🌼 Daisy Flowers</h1>
        <p>Your AI Budtender from Beyond Hello</p>
        <div className="speech-controls">
          <button 
            onClick={toggleSpeech}
            className={`speech-toggle ${speechEnabled ? 'enabled' : 'disabled'}`}
            title={speechEnabled ? 'Click to disable speech' : 'Click to enable speech'}
          >
            {speechEnabled ? '🔊' : '🔇'} Voice {speechEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.isTypewriting ? typewriterText : msg.content}
              </div>
              {msg.products && msg.products.length > 0 && (
                <div className="product-cards">
                  {msg.products.map((product, pIdx) => (
                    <div key={pIdx} className="product-card">
                      {product.image && (
                        <div className="product-image">
                          <img src={product.image} alt={product.name} />
                        </div>
                      )}
                      <div className="product-info">
                        <h3 className="product-name">{product.name}</h3>
                        <p className="product-brand">{product.brand}</p>
                        <div className="product-details">
                          <span className="product-kind">{product.kind}</span>
                          {product.thc && <span className="product-thc">THC: {product.thc}</span>}
                          {product.cbd && <span className="product-cbd">CBD: {product.cbd}</span>}
                        </div>
                        {product.price && (
                          <p className="product-price">${product.price}</p>
                        )}
                        {product.path && (
                          <a 
                            href={`https://beyond-hello.com/pennsylvania-dispensaries/bristol/medical-menu/menu${product.path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="product-link"
                          >
                            View Product →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="message-content loading">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "What are you looking for?"}
            disabled={isLoading || isListening}
            className="message-input"
          />
          <button 
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading}
            className={`mic-button ${isListening ? 'listening' : ''}`}
          >
            🎤
          </button>
          <button type="submit" disabled={isLoading || !input.trim()} className="send-button">
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
