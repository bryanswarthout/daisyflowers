import React, { useState, createContext, useEffect } from 'react'

const STORE_ID = 1635

let persistedState = {
  data: {
    messageType: 'buildCart',
    payload: {
      products: [],
      cognitoToken: 'token',
      user: {
        firstName: 'Guest',
        lastName: 'User',
        birthDate: '1990-01-01',
        phone: '0000000000',
        email: 'guest@example.com',
        externalId: '00000',
      },
      storeId: STORE_ID,
      headlessPartnerName: 'Beyond Hello',
      options: {
        font: {
          fontFamily: 'Roboto',
          url: 'https://fonts.googleapis.com/css?family=Roboto',
        },
        theme: {
          themeColor: '#233D4B',
          navigationColor: '#d4a574',
          ctaTextColor: '#ffffff',
        },
        redirectUrl: '/',
        disableAuthFeatures: true,
        disableLoadingSpinner: false,
        disableWeightSelection: false,
      },
    },
  },
}

export const CartContext = createContext({ ...persistedState })

export const CartProvider = (props) => {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('savedCart')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {}
    }
    return { ...persistedState }
  })

  useEffect(() => {
    persistedState = { ...cart }
    localStorage.setItem('savedCart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (productId, priceId) => {
    setCart(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const existing = copy.data.payload.products.find(
        p => p.productId === productId && p.priceId === priceId
      )
      if (existing) {
        existing.count++
      } else {
        copy.data.payload.products.push({ productId, priceId, count: 1 })
      }
      copy.data.payload.options.redirectUrl = window.location.href
      return copy
    })
  }

  const removeFromCart = (productId, priceId) => {
    setCart(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      copy.data.payload.products = copy.data.payload.products.filter(
        p => !(p.productId === productId && p.priceId === priceId)
      )
      return copy
    })
  }

  const clearCart = () => {
    const fresh = JSON.parse(JSON.stringify(persistedState))
    fresh.data.payload.products = []
    setCart(fresh)
  }

  const cartCount = cart.data.payload.products.reduce((sum, p) => sum + p.count, 0)

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, removeFromCart, clearCart, cartCount }}>
      {props.children}
    </CartContext.Provider>
  )
}
