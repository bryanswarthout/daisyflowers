import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Amplify } from 'aws-amplify'
import { CartProvider } from './CartContext.jsx'
import { AuthProvider } from './AuthContext.jsx'
import App from './App.jsx'
import CartPage from './CartPage.jsx'
import './index.css'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_LmHQ6ZRSN',
      userPoolClientId: '1r4b0las4peshtsuvmnmu4tg63',
      loginWith: {
        oauth: {
          domain: 'jushi-staging.auth.us-east-1.amazoncognito.com',
          redirectSignIn: [window.location.origin + '/'],
          redirectSignOut: [window.location.origin + '/logout'],
          responseType: 'token',
          scopes: ['openid', 'email', 'profile'],
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/cart" element={<CartPage />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
