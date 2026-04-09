import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { adminSupabase, supabase } from './lib/supabase'
import { isAdminEmail } from './lib/constants'

const SplashScreen = lazy(() => import('./pages/entry/SplashScreen'))
const OnboardingScreen = lazy(() => import('./pages/entry/OnboardingScreen'))
const SignInScreen = lazy(() => import('./pages/entry/SignInScreen'))
const SignUpScreen = lazy(() => import('./pages/entry/SignUpScreen'))
const ForgotPasswordScreen = lazy(() => import('./pages/entry/ForgotPasswordScreen'))
const ResetLinkSentScreen = lazy(() => import('./pages/entry/ResetLinkSentScreen'))
const NewPasswordScreen = lazy(() => import('./pages/entry/NewPasswordScreen'))
const PasswordUpdatedScreen = lazy(() => import('./pages/entry/PasswordUpdatedScreen'))

const HomeScreen = lazy(() => import('./pages/home/HomeScreen'))

const AcquireScreen = lazy(() => import('./pages/exchange/AcquireScreen'))
const SellStep1Screen = lazy(() => import('./pages/exchange/SellStep1Screen'))
const SellStep2Screen = lazy(() => import('./pages/exchange/SellStep2Screen'))
const OrderStatusScreen = lazy(() => import('./pages/exchange/OrderStatusScreen'))
const OrderCompleteScreen = lazy(() => import('./pages/exchange/OrderCompleteScreen'))
const OrderExpiredScreen = lazy(() => import('./pages/exchange/OrderExpiredScreen'))
const ExchangeClosedScreen = lazy(() => import('./pages/exchange/ExchangeClosedScreen'))

const IntelligenceScreen = lazy(() => import('./pages/intelligence/IntelligenceScreen'))
const PostDetailScreen = lazy(() => import('./pages/intelligence/PostDetailScreen'))
const PlansScreen = lazy(() => import('./pages/intelligence/PlansScreen'))

const PortfolioScreen = lazy(() => import('./pages/portfolio/PortfolioScreen'))
const TransactionHistoryScreen = lazy(() => import('./pages/portfolio/TransactionHistoryScreen'))
const NotificationsScreen = lazy(() => import('./pages/portfolio/NotificationsScreen'))
const AccountScreen = lazy(() => import('./pages/portfolio/AccountScreen'))
const SavedBanksScreen = lazy(() => import('./pages/portfolio/SavedBanksScreen'))

const AdminSignInScreen = lazy(() => import('./pages/admin/AdminSignInScreen'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminNewPost = lazy(() => import('./pages/admin/AdminNewPost'))
const AdminPosts = lazy(() => import('./pages/admin/AdminPosts'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))

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
      const authClient = isAdminRoute ? adminSupabase : supabase
      const { data, error } = await authClient.auth.getSession()
      if (cancelled) return

      if (error || !data.session) {
        // For any unauthenticated visit to /admin/*, send them to /admin/login.
        setRedirectTo(isAdminRoute ? '/admin/login' : '/signin')
        setReady(true)
        return
      }

      const email = data.session.user.email
      if (isAdminRoute && !isAdminEmail(email)) {
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
        <Suspense
          fallback={
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
              Loading...
            </div>
          }
        >
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
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
