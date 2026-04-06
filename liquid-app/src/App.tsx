import { useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { ADMIN_EMAIL } from './lib/constants'

import SplashScreen from './pages/entry/SplashScreen'
import OnboardingScreen from './pages/entry/OnboardingScreen'
import SignInScreen from './pages/entry/SignInScreen'
import SignUpScreen from './pages/entry/SignUpScreen'
import ForgotPasswordScreen from './pages/entry/ForgotPasswordScreen'
import ResetLinkSentScreen from './pages/entry/ResetLinkSentScreen'
import NewPasswordScreen from './pages/entry/NewPasswordScreen'
import PasswordUpdatedScreen from './pages/entry/PasswordUpdatedScreen'

import HomeScreen from './pages/home/HomeScreen'

import AcquireScreen from './pages/exchange/AcquireScreen'
import SellStep1Screen from './pages/exchange/SellStep1Screen'
import SellStep2Screen from './pages/exchange/SellStep2Screen'
import OrderStatusScreen from './pages/exchange/OrderStatusScreen'
import OrderCompleteScreen from './pages/exchange/OrderCompleteScreen'
import OrderExpiredScreen from './pages/exchange/OrderExpiredScreen'
import ExchangeClosedScreen from './pages/exchange/ExchangeClosedScreen'

import IntelligenceScreen from './pages/intelligence/IntelligenceScreen'
import PostDetailScreen from './pages/intelligence/PostDetailScreen'
import PlansScreen from './pages/intelligence/PlansScreen'

import PortfolioScreen from './pages/portfolio/PortfolioScreen'
import TransactionHistoryScreen from './pages/portfolio/TransactionHistoryScreen'
import NotificationsScreen from './pages/portfolio/NotificationsScreen'
import AccountScreen from './pages/portfolio/AccountScreen'
import SavedBanksScreen from './pages/portfolio/SavedBanksScreen'

import AdminSignInScreen from './pages/admin/AdminSignInScreen'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminNewPost from './pages/admin/AdminNewPost'
import AdminPosts from './pages/admin/AdminPosts'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSettings from './pages/admin/AdminSettings'

function RootRedirect() {
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const { data } = await supabase.auth.getSession()
      const session = data.session

      const onboarded = localStorage.getItem('liquid_onboarded') === 'true'

      if (session) setTarget(onboarded ? '/home' : '/onboarding')
      else setTarget(onboarded ? '/signin' : '/onboarding')
    }

    run().catch(() => {
      if (!cancelled) setTarget('/onboarding')
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!target) return null
  return <Navigate to={target} replace />
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setReady(false)

      const isAdminRoute = location.pathname.startsWith('/admin')
      const { data, error } = await supabase.auth.getSession()
      if (cancelled) return

      if (error || !data.session) {
        // For any unauthenticated visit to /admin/*, send them to /admin/login.
        setRedirectTo(isAdminRoute ? '/admin/login' : '/signin')
        setReady(true)
        return
      }

      const email = data.session.user.email ?? ''

      if (isAdminRoute && email !== ADMIN_EMAIL) {
        setRedirectTo('/admin/login')
        setReady(true)
        return
      }

      setRedirectTo(null)
      setReady(true)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (!ready) return null
  if (redirectTo) return <Navigate to={redirectTo} replace />
  return children
}

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/signin" element={<SignInScreen />} />
          <Route path="/signup" element={<SignUpScreen />} />
          <Route
            path="/forgot-password"
            element={<ForgotPasswordScreen />}
          />
          <Route
            path="/forgot-password/sent"
            element={<ResetLinkSentScreen />}
          />
          <Route
            path="/reset-password"
            element={<NewPasswordScreen />}
          />
          <Route
            path="/reset-password/success"
            element={<PasswordUpdatedScreen />}
          />

          {/* Protected (auth required) */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomeScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange/buy"
            element={
              <ProtectedRoute>
                <AcquireScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange/sell/step1"
            element={
              <ProtectedRoute>
                <SellStep1Screen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange/sell/step2"
            element={
              <ProtectedRoute>
                <SellStep2Screen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange/order/:orderId"
            element={
              <ProtectedRoute>
                <OrderStatusScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange/complete/:orderId"
            element={
              <ProtectedRoute>
                <OrderCompleteScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange/expired/:orderId"
            element={
              <ProtectedRoute>
                <OrderExpiredScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange/closed"
            element={
              <ProtectedRoute>
                <ExchangeClosedScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intelligence"
            element={
              <ProtectedRoute>
                <IntelligenceScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intelligence/post/:postId"
            element={
              <ProtectedRoute>
                <PostDetailScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans"
            element={
              <ProtectedRoute>
                <PlansScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio"
            element={
              <ProtectedRoute>
                <PortfolioScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <TransactionHistoryScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/banks"
            element={
              <ProtectedRoute>
                <SavedBanksScreen />
              </ProtectedRoute>
            }
          />

          {/* Admin (email required except /admin/login) */}
          <Route path="/admin/login" element={<AdminSignInScreen />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminOrders />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/post/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminNewPost mode="new" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/post/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminNewPost mode="edit" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/posts"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminPosts />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminUsers />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminSettings />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
