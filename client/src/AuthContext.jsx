import { createContext, useState, useEffect } from 'react'
import { getCurrentUser, signIn as ampSignIn, signUp as ampSignUp, signOut as ampSignOut } from 'aws-amplify/auth'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(username, password) {
    const response = await ampSignIn({ username, password })
    const currentUser = await getCurrentUser()
    setUser(currentUser)
    return response
  }

  async function signUp({ username, password, given_name, family_name, phone_number, birthdate }) {
    await ampSignUp({
      username,
      password,
      options: {
        userAttributes: {
          given_name,
          family_name,
          phone_number: phone_number ? `+1${phone_number}` : undefined,
          birthdate,
        },
      },
    })
    // Auto sign-in after signup
    await ampSignIn({ username, password })
    const currentUser = await getCurrentUser()
    setUser(currentUser)
    return currentUser
  }

  async function signOut() {
    await ampSignOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
