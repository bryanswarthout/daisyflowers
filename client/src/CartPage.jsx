import React, { useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import postscribe from 'postscribe'
import { CartContext } from './CartContext'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Paper,
  Chip,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  ShoppingCart as ShoppingCartIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

function CartPage() {
  const { cart, cartCount, removeFromCart, clearCart } = useContext(CartContext)
  const navigate = useNavigate()

  useEffect(() => {
    if (cartCount === 0) return

    // Remove any previous Jane container
    const oldCartEl = document.getElementById('jane-container')
    if (oldCartEl) oldCartEl.remove()

    // Inject Jane's headless embed script
    const target = document.getElementById('jane-cart-embed')
    if (target) {
      target.innerHTML = ''
      postscribe(
        '#jane-cart-embed',
        '<script id="jane-frame-script" src="https://api.iheartjane.com/v1/headless/embed.js"></script>'
      )
    }

    function receiveMessage(event) {
      const payload = event.data && event.data.payload
      const messageType = event.data && event.data.messageType

      if (
        messageType === 'loadingEvent' &&
        payload &&
        payload.name === 'headlessAppLoaded'
      ) {
        const frame = document.getElementById('jane-menu')
        if (frame) {
          const localCart = localStorage.getItem('savedCart')
          const data = localCart ? JSON.parse(localCart).data : cart.data
          frame.contentWindow.postMessage(data, '*')
        }
      }
    }

    window.addEventListener('message', receiveMessage, false)
    return () => window.removeEventListener('message', receiveMessage, false)
  }, [cartCount])

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #233D4B 0%, #3A6378 100%)',
          px: { xs: 2, md: 3 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <IconButton onClick={() => navigate('/')} sx={{ color: 'white' }}>
          <ArrowBackIcon />
        </IconButton>
        <ShoppingCartIcon sx={{ color: 'white' }} />
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, flex: 1 }}>
          Your Cart
        </Typography>
        {cartCount > 0 && (
          <Chip
            label={`${cartCount} item${cartCount !== 1 ? 's' : ''}`}
            sx={{
              bgcolor: '#d4a574',
              color: 'white',
              fontWeight: 600,
            }}
          />
        )}
      </Box>

      {/* Cart Content */}
      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, maxWidth: 960, mx: 'auto', width: '100%' }}>
        {cartCount === 0 ? (
          <Paper
            elevation={1}
            sx={{
              p: 4,
              textAlign: 'center',
              mt: 4,
            }}
          >
            <ShoppingCartIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Your cart is empty
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Ask Daisy for recommendations and add products to your cart!
            </Typography>
            <Button variant="contained" onClick={() => navigate('/')}>
              Back to Daisy
            </Button>
          </Paper>
        ) : (
          <>
            {/* Cart item summary */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Cart Items</Typography>
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={clearCart}>
                  Clear All
                </Button>
              </Stack>
              {cart.data.payload.products.map((item, idx) => (
                <Stack
                  key={idx}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    py: 1,
                    borderTop: idx > 0 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Box>
                    <Typography variant="body1">
                      Product #{item.productId}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Weight: {item.priceId} &middot; Qty: {item.count}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeFromCart(item.productId, item.priceId)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Paper>

            {/* Jane embed */}
            <Paper elevation={1} sx={{ p: 0, overflow: 'hidden', minHeight: 400 }}>
              <div id="jane-cart-embed" />
            </Paper>
          </>
        )}
      </Box>
    </Box>
  )
}

export default CartPage
