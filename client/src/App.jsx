import { useState, useRef, useEffect } from 'react'
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  Chip, 
  IconButton,
  CircularProgress,
  Stack,
  Divider,
  Link,
  FormControl,
  Select,
  MenuItem
} from '@mui/material'
import { 
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Send as SendIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon
} from '@mui/icons-material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './App.css'

// Create a custom theme for a more professional look
const theme = createTheme({
  palette: {
    primary: {
      main: '#233D4B', // Beyond Hello dark teal
      light: '#3A6378',
      dark: '#192C37',
    },
    secondary: {
      main: '#d4a574', // Warm gold accent
      light: '#e8c4a0',
      dark: '#b8956b',
    },
    success: {
      main: '#3A8A9E',
      light: '#6AABB8',
      dark: '#2D6370',
    },
    background: {
      default: '#f4f7f9', // Soft teal-tinted background
      paper: '#fefefe',
    },
    grey: {
      50: '#f7f9fa',
      100: '#edf2f5',
      200: '#dce6ec',
      300: '#c4d4de',
      400: '#a0bbca',
      500: '#7a9eb0',
      600: '#5d8195',
      700: '#47657a',
      800: '#354b5b',
      900: '#233D4B',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      color: '#233D4B',
    },
    h6: {
      fontWeight: 500,
      color: '#3A6378',
    },
    body1: {
      color: '#2c3e35',
    },
    body2: {
      color: '#354b5b',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f7f9fa 100%)',
          boxShadow: '0 4px 20px rgba(35, 61, 75, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          background: 'linear-gradient(135deg, #233D4B 0%, #3A6378 100%)',
          boxShadow: '0 4px 15px rgba(35, 61, 75, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #192C37 0%, #1C3340 100%)',
            boxShadow: '0 6px 20px rgba(35, 61, 75, 0.4)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #ffffff 0%, #f7f9fa 100%)',
          border: '1px solid rgba(35, 61, 75, 0.08)',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(35, 61, 75, 0.15)',
            borderColor: 'rgba(35, 61, 75, 0.2)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#ffffff',
            '& fieldset': {
              borderColor: 'rgba(35, 61, 75, 0.23)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(35, 61, 75, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#233D4B',
            },
          },
        },
      },
    },
  },
})

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
  const [showFloatingAvatar, setShowFloatingAvatar] = useState(false)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514')
  const messagesEndRef = useRef(null)
  const typewriterRef = useRef(null)
  const avatarRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Floating avatar scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (avatarRef.current) {
        const avatarRect = avatarRef.current.getBoundingClientRect()
        const isAvatarVisible = avatarRect.top >= -avatarRect.height && avatarRect.bottom <= window.innerHeight + avatarRect.height
        setShowFloatingAvatar(!isAvatarVisible)
      }
    }

    window.addEventListener('scroll', handleScroll)
    // Also check on resize
    window.addEventListener('resize', handleScroll)
    // Check initial state
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  // Floating avatar scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (avatarRef.current) {
        const avatarRect = avatarRef.current.getBoundingClientRect()
        const isAvatarVisible = avatarRect.top >= -avatarRect.height && avatarRect.bottom <= window.innerHeight + avatarRect.height
        setShowFloatingAvatar(!isAvatarVisible)
      }
    }

    window.addEventListener('scroll', handleScroll)
    // Also check on resize
    window.addEventListener('resize', handleScroll)
    // Check initial state
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

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
      // Build conversation history for context (last 10 exchanges max)
      const history = messages
        .filter(m => m.content && (m.role === 'user' || m.role === 'assistant'))
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, history, model: selectedModel })
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        {/* Header */}
        <Paper 
          elevation={3} 
          className="header-paper"
          sx={{ 
            mb: 1,
            background: 'linear-gradient(135deg, #233D4B 0%, #3A6378 100%) !important',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 30% 70%, rgba(212, 165, 116, 0.1) 0%, transparent 50%)',
              pointerEvents: 'none',
            }
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ py: 1.5, textAlign: 'center' }}>
              {/* Restored Original Avatar Container */}
              <Box sx={{ mb: 1 }} ref={avatarRef}>
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
              </Box>
              
              <Typography variant="h5" component="h1" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                Daisy Flowers
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 0.5 }}>
                Your AI Budtender from Beyond Hello
              </Typography>
              
              <IconButton 
                onClick={toggleSpeech}
                color={speechEnabled ? 'primary' : 'default'}
                size="small"
                title={speechEnabled ? 'Click to disable speech' : 'Click to enable speech'}
              >
                {speechEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
            </Box>
          </Container>
        </Paper>

        {/* Chat Container */}
        <Container maxWidth="lg" sx={{ pb: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)' }}>
            {/* Messages */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
              <Stack spacing={2}>
                {messages.map((msg, idx) => (
                  <Box key={idx} sx={{ width: '100%' }}>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 2,
                        background: msg.role === 'user' 
                          ? 'linear-gradient(135deg, #233D4B 0%, #3A6378 100%)'
                          : 'linear-gradient(145deg, #fefefe 0%, #f4f7f9 100%)',
                        color: msg.role === 'user' ? 'white' : '#2c3e35',
                        border: msg.role === 'user' 
                          ? '1px solid rgba(35, 61, 75, 0.3)'
                          : '1px solid rgba(35, 61, 75, 0.1)',
                        ml: msg.role === 'user' ? 'auto' : 0,
                        mr: msg.role === 'user' ? 0 : 'auto',
                        maxWidth: msg.role === 'user' ? '70%' : '100%',
                        width: msg.role === 'assistant' ? '100%' : 'auto',
                        boxShadow: msg.role === 'user'
                          ? '0 4px 15px rgba(35, 61, 75, 0.25)'
                          : '0 2px 10px rgba(35, 61, 75, 0.08)',
                      }}
                    >
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                        {msg.isTypewriting ? typewriterText : msg.content}
                      </Typography>
                    </Paper>

                    {/* Product Cards - Now below the text response */}
                    {msg.products && msg.products.length > 0 && (
                      <Box sx={{ mt: 2, width: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                          Recommended Products:
                        </Typography>
                        <Grid container spacing={2}>
                          {msg.products.map((product, pIdx) => (
                            <Grid item xs={12} sm={6} key={pIdx}>
                              <Card 
                                elevation={2} 
                                sx={{ 
                                  height: '100%',
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    elevation: 4,
                                    transform: 'translateY(-2px)'
                                  }
                                }}
                              >
                                {product.image && (
                                  <CardMedia
                                    component="img"
                                    height="200"
                                    image={product.image}
                                    alt={product.name}
                                    sx={{ objectFit: 'contain', backgroundColor: '#f5f5f5' }}
                                  />
                                )}
                                <CardContent>
                                  <Typography variant="h6" component="h3" gutterBottom>
                                    {product.name}
                                  </Typography>
                                  
                                  <Typography variant="subtitle2" color="primary" gutterBottom>
                                    {product.brand}
                                  </Typography>

                                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                    <Chip 
                                      label={product.kind} 
                                      size="small" 
                                      color="primary" 
                                      variant="outlined"
                                    />
                                    {product.thc && (
                                      <Chip 
                                        label={`THC: ${product.thc}`} 
                                        size="small" 
                                        color="secondary"
                                        variant="outlined"
                                      />
                                    )}
                                    {product.cbd && (
                                      <Chip 
                                        label={`CBD: ${product.cbd}`} 
                                        size="small" 
                                        color="info"
                                        variant="outlined"
                                      />
                                    )}
                                  </Stack>

                                  {product.price && (
                                    <Typography variant="h6" color="primary" gutterBottom>
                                      {product.price}
                                    </Typography>
                                  )}

                                  {product.path && (
                                    <Button
                                      component={Link}
                                      href={product.path}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="contained"
                                      size="small"
                                      fullWidth
                                      sx={{ mt: 1 }}
                                    >
                                      View Product
                                    </Button>
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}
                  </Box>
                ))}
                
                {isLoading && (
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      p: 2, 
                      background: 'linear-gradient(145deg, #f4f7f9 0%, #dce6ec 100%)',
                      border: '1px solid rgba(35, 61, 75, 0.15)',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <CircularProgress size={20} sx={{ color: '#233D4B' }} />
                      <Typography sx={{ color: '#2c3e35' }}>Daisy is thinking...</Typography>
                    </Stack>
                  </Paper>
                )}
                <div ref={messagesEndRef} />
              </Stack>
            </Box>

            {/* Input Form */}
            <Paper 
              elevation={3} 
              sx={{ 
                p: 2,
                background: 'linear-gradient(145deg, #fefefe 0%, #f4f7f9 100%)',
                border: '1px solid rgba(35, 61, 75, 0.1)',
                borderTop: '2px solid #d4a574',
              }}
            >
              <Box component="form" onSubmit={sendMessage}>
                <Stack spacing={1}>
                  <TextField
                    fullWidth
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? "Listening..." : "What are you looking for?"}
                    disabled={isLoading || isListening}
                    variant="outlined"
                    size="medium"
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <Select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isLoading}
                        sx={{
                          fontSize: '0.75rem',
                          color: '#233D4B',
                          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(35, 61, 75, 0.23)' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(35, 61, 75, 0.5)' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#233D4B' },
                          background: 'white',
                        }}
                      >
                        <MenuItem value="claude-sonnet-4-20250514" sx={{ fontSize: '0.75rem' }}>Sonnet</MenuItem>
                        <MenuItem value="claude-opus-4-20250514" sx={{ fontSize: '0.75rem' }}>Opus</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <Box sx={{ flexGrow: 1 }} />
                    
                    <IconButton 
                      onClick={isListening ? stopListening : startListening}
                      disabled={isLoading}
                      color={isListening ? 'secondary' : 'default'}
                      sx={{ p: 1.5, color: isListening ? undefined : '#233D4B !important' }}
                    >
                      {isListening ? <MicOffIcon /> : <MicIcon />}
                    </IconButton>
                    
                    <Button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      variant="contained"
                      size="large"
                      endIcon={<SendIcon />}
                      sx={{ px: 3 }}
                    >
                      Send
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          </Box>
        </Container>
      </Box>
      
      {/* Floating Avatar */}
      {showFloatingAvatar && (
        <div className={`floating-avatar ${isSpeaking || isTypewriting ? 'speaking' : ''}`}>
          <div className="floating-avatar-inner">
            <img 
              src="/girl.png" 
              alt="Daisy Flowers" 
              className="floating-avatar-image"
            />
            <div className="floating-mouth-overlay">
              <div className="floating-mouth-animation"></div>
            </div>
            <div className="floating-avatar-pulse"></div>
          </div>
        </div>
      )}
    </ThemeProvider>
  )
}

export default App
