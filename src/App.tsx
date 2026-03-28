import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { OnboardingForm } from './features/onboarding/OnboardingForm'
import { ProductLinkForm } from './features/verdict/ProductLinkForm'
import { clearSkinProfile, loadSkinProfile, saveSkinProfile } from './services/storage'

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum-700">SkinSense</p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
          Find out if this skincare product is right for you
        </h1>
        <p className="text-sm text-zinc-600">
          Paste a product link. We synthesize web reviews through your skin profile.
        </p>
      </header>
      {children}
    </main>
  )
}

function OnboardingPage() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Your skin profile</h2>
        <p className="mb-4 text-sm text-zinc-600">Takes under 90 seconds. Stored on your device only.</p>
        <OnboardingForm
          initialProfile={loadSkinProfile()}
          onComplete={(profile) => {
            saveSkinProfile(profile)
            navigate('/')
          }}
        />
      </section>
    </AppShell>
  )
}

function HomePage() {
  const profile = loadSkinProfile()
  if (!profile) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <AppShell>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700">
          <span>
            Profile: {profile.skinType.replace('_', ' ')}, top concern{' '}
            {profile.topConcern.replace('_', ' ')}
          </span>
          <button
            type="button"
            onClick={() => {
              clearSkinProfile()
              window.location.href = '/onboarding'
            }}
            className="rounded-md border border-zinc-300 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-200"
          >
            Edit profile
          </button>
        </div>
        <ProductLinkForm profile={profile} />
      </section>
    </AppShell>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
