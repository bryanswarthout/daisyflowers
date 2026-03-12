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
  VolumeOff as VolumeOffIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
  Menu as MenuIcon,
  Close as CloseIcon
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514')
  const [selectedVoice, setSelectedVoice] = useState('EXAVITQu4vr4xnSDxMaL')
  const messagesEndRef = useRef(null)
  const typewriterRef = useRef(null)
  const avatarRef = useRef(null)
  const audioRef = useRef(null)

  // ElevenLabs women's voices
  const elevenLabsVoices = [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Soft & warm' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Calm & clear' },
    { id: 'LcfcDJNUP1GQjkzn1xUU', name: 'Emily', desc: 'Calm & gentle' },
    { id: 'bVMeCyTHy58xNoL34h3p', name: 'Aria', desc: 'Expressive & rich' },
    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', desc: 'Upbeat & clear' },
    { id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda', desc: 'Witchy & magical' },
    { id: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole', desc: 'Whispery & intimate' },
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', desc: 'Warm & friendly' },
    { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', desc: 'Pleasant & curious' },
    { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', desc: 'Southern charm' },
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Cleanup typewriter effect and audio on unmount
    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
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

  const speakText = async (text) => {
    if (!speechEnabled) return

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    
    // Clean the text
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) return

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voiceId: selectedVoice }),
      })

      if (!response.ok) {
        console.error('ElevenLabs TTS error:', response.status)
        return
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onplay = () => {
        setIsPlayingAudio(true)
        setIsSpeaking(true)
      }

      audio.onended = () => {
        setIsPlayingAudio(false)
        setTimeout(() => setIsSpeaking(false), 500)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }

      audio.onerror = () => {
        setIsPlayingAudio(false)
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }

      audio.play()
    } catch (error) {
      console.error('TTS fetch error:', error)
      setIsPlayingAudio(false)
      setIsSpeaking(false)
    }
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
      // If disabling speech, stop any current audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setIsPlayingAudio(false)
      setIsSpeaking(false)
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
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'background.default' }}>
        
        {/* Mobile overlay */}
        {sidebarOpen && (
          <Box
            onClick={() => setSidebarOpen(false)}
            sx={{
              display: { xs: 'block', md: 'none' },
              position: 'fixed',
              inset: 0,
              bgcolor: 'rgba(0,0,0,0.5)',
              zIndex: 1199,
            }}
          />
        )}

        {/* Sidebar */}
        <Box
          className="sidebar"
          sx={{
            width: { xs: 260, md: 240 },
            minWidth: { xs: 260, md: 240 },
            height: '100vh',
            background: 'linear-gradient(180deg, #233D4B 0%, #1a3040 50%, #192C37 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 3,
            px: 1.5,
            position: { xs: 'fixed', md: 'relative' },
            left: { xs: sidebarOpen ? 0 : -260, md: 0 },
            top: 0,
            zIndex: { xs: 1200, md: 1 },
            transition: 'left 0.3s ease',
            boxShadow: { xs: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.3)' : 'none', md: '2px 0 10px rgba(0,0,0,0.1)' },
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Mobile close button */}
          <IconButton
            onClick={() => setSidebarOpen(false)}
            sx={{
              display: { xs: 'flex', md: 'none' },
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* Avatar */}
          <Box sx={{ mb: 2 }} ref={avatarRef}>
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
          
          <Typography variant="h6" component="h1" sx={{ color: 'white', fontWeight: 700, mb: 0.25, fontSize: '1.1rem', textAlign: 'center' }}>
            Daisy Flowers
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)', mb: 2, textAlign: 'center', lineHeight: 1.3 }}>
            Your AI Budtender from Beyond Hello
          </Typography>
          
          <Divider sx={{ width: '80%', borderColor: 'rgba(255,255,255,0.15)', mb: 2 }} />

          {/* Voice controls */}
          <Stack spacing={1} alignItems="center" sx={{ width: '100%', px: 0.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton 
                onClick={toggleSpeech}
                size="small"
                title={speechEnabled ? 'Disable speech' : 'Enable speech'}
                sx={{ color: speechEnabled ? '#d4a574 !important' : 'rgba(255,255,255,0.5) !important' }}
              >
                {speechEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {speechEnabled ? 'Voice On' : 'Voice Off'}
              </Typography>
            </Stack>
            {speechEnabled && (
              <FormControl size="small" sx={{ width: '100%' }}>
                <Select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  sx={{
                    fontSize: '0.7rem',
                    color: 'white',
                    height: 32,
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.6)' },
                    '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                  }}
                  startAdornment={<RecordVoiceOverIcon sx={{ fontSize: 13, mr: 0.5, color: 'rgba(255,255,255,0.5)' }} />}
                >
                  {elevenLabsVoices.map(v => (
                    <MenuItem key={v.id} value={v.id} sx={{ fontSize: '0.75rem' }}>
                      {v.name} — {v.desc}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          {/* Model selector at bottom */}
          <Divider sx={{ width: '80%', borderColor: 'rgba(255,255,255,0.15)', mb: 1.5, mt: 2 }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>Model</Typography>
          <FormControl size="small" sx={{ width: '100%', px: 0.5 }}>
            <Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoading}
              sx={{
                fontSize: '0.75rem',
                color: 'white',
                height: 32,
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.6)' },
                '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
              }}
            >
              <MenuItem value="claude-sonnet-4-20250514" sx={{ fontSize: '0.75rem' }}>Sonnet</MenuItem>
              <MenuItem value="claude-opus-4-20250514" sx={{ fontSize: '0.75rem' }}>Opus</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Main Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
          
          {/* Mobile top bar */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              px: 1.5,
              py: 1,
              background: 'linear-gradient(135deg, #233D4B 0%, #3A6378 100%)',
              gap: 1.5,
            }}
          >
            <IconButton onClick={() => setSidebarOpen(true)} sx={{ color: 'white !important' }}>
              <MenuIcon />
            </IconButton>
            <div className={`avatar-mini ${isSpeaking || isTypewriting ? 'speaking' : ''}`}>
              <img src="/girl.png" alt="Daisy" className="avatar-mini-image" />
            </div>
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
              Daisy Flowers
            </Typography>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, sm: 2, md: 3 } }}>
            <Box sx={{ maxWidth: 900, mx: 'auto' }}>
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

                    {/* Product Cards */}
                    {msg.products && msg.products.length > 0 && (
                      <Box sx={{ mt: 2, width: '100%' }}>
                        <Typography variant="h6" gutterBottom color="primary">
                          Recommended Products:
                        </Typography>
                        <Grid container spacing={2}>
                          {msg.products.map((product, pIdx) => (
                            <Grid size={{ xs: 12, sm: 6 }} key={pIdx}>
                              <Card 
                                elevation={2} 
                                sx={{ 
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
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
                                <CardContent sx={{ flexGrow: 1 }}>
                                  <Typography variant="h6" component="h3" gutterBottom>
                                    {product.name}
                                  </Typography>
                                  
                                  <Typography variant="subtitle2" color="primary" gutterBottom>
                                    {product.brand}
                                  </Typography>

                                  <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
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
                                </CardContent>

                                {product.path && (
                                  <Box sx={{ p: 2, pt: 0 }}>
                                    <Button
                                      component={Link}
                                      href={product.path}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="contained"
                                      size="small"
                                      fullWidth
                                    >
                                      View Product
                                    </Button>
                                  </Box>
                                )}
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
          </Box>

          {/* Input Form - pinned to bottom */}
          <Box
            sx={{
              p: { xs: 1, sm: 1.5, md: 2 },
              borderTop: '2px solid #d4a574',
              background: 'linear-gradient(145deg, #fefefe 0%, #f4f7f9 100%)',
            }}
          >
            <Box sx={{ maxWidth: 900, mx: 'auto' }}>
              <Box component="form" onSubmit={sendMessage}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? "Listening..." : "What are you looking for?"}
                    disabled={isLoading || isListening}
                    variant="outlined"
                    size="small"
                  />
                  
                  <IconButton 
                    onClick={isListening ? stopListening : startListening}
                    disabled={isLoading}
                    sx={{ 
                      p: 1, 
                      color: isListening ? '#d4a574 !important' : '#233D4B !important',
                    }}
                  >
                    {isListening ? <MicOffIcon /> : <MicIcon />}
                  </IconButton>
                  
                  <Button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    variant="contained"
                    endIcon={<SendIcon />}
                    sx={{ px: 2, whiteSpace: 'nowrap', minWidth: 'auto' }}
                  >
                    Send
                  </Button>
                </Stack>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default App
