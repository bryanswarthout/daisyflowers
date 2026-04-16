import { useState, useContext } from 'react'
import { AuthContext } from './AuthContext'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'

export default function AuthModal({ open, onClose }) {
  const { signIn, signUp } = useContext(AuthContext)
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [signUpForm, setSignUpForm] = useState({
    username: '',
    password: '',
    given_name: '',
    family_name: '',
    phone_number: '',
    birthdate: '',
  })

  const handleLoginChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value })
  }

  const handleSignUpChange = (e) => {
    setSignUpForm({ ...signUpForm, [e.target.name]: e.target.value })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(loginForm.username, loginForm.password)
      onClose()
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(signUpForm)
      onClose()
    } catch (err) {
      setError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#233D4B', color: '#fff' }}>
        {mode === 'login' ? 'Login' : 'Sign Up'}
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{error}</Alert>}

        {mode === 'login' ? (
          <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Email"
              name="username"
              type="email"
              value={loginForm.username}
              onChange={handleLoginChange}
              required
              fullWidth
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              value={loginForm.password}
              onChange={handleLoginChange}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Login'}
            </Button>
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              Don't have an account?{' '}
              <Link component="button" type="button" onClick={switchMode} underline="hover">
                Sign up here
              </Link>
            </Typography>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSignUp} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Email"
              name="username"
              type="email"
              value={signUpForm.username}
              onChange={handleSignUpChange}
              required
              fullWidth
            />
            <TextField
              label="First Name"
              name="given_name"
              value={signUpForm.given_name}
              onChange={handleSignUpChange}
              required
              fullWidth
            />
            <TextField
              label="Last Name"
              name="family_name"
              value={signUpForm.family_name}
              onChange={handleSignUpChange}
              required
              fullWidth
            />
            <TextField
              label="Phone Number"
              name="phone_number"
              type="tel"
              placeholder="1234567890"
              value={signUpForm.phone_number}
              onChange={handleSignUpChange}
              fullWidth
            />
            <TextField
              label="Birthdate"
              name="birthdate"
              type="date"
              value={signUpForm.birthdate}
              onChange={handleSignUpChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              value={signUpForm.password}
              onChange={handleSignUpChange}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Sign Up'}
            </Button>
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link component="button" type="button" onClick={switchMode} underline="hover">
                Login here
              </Link>
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
