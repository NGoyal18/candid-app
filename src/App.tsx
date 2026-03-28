import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { OnboardingForm } from './features/onboarding/OnboardingForm'
import { ProductLinkForm } from './features/verdict/ProductLinkForm'
import { clearSkinProfile, loadSkinProfile, saveSkinProfile } from './services/storage'

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-5 px-[28px] py-7">
      <header className="space-y-1">
        <h1 className="candid-display text-[38px] leading-none italic text-[#1c1208]">candid</h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#9a8a72]">no filter. just facts.</p>
      </header>
      {children}
    </main>
  )
}

function OnboardingPage() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <section className="border-[1.5px] border-[#d4c4b0] bg-[#fff8f0] p-5">
        <h2 className="candid-display mb-1 text-xl italic text-[#1c1208]">your skin profile</h2>
        <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-[#9a8a72]">
          takes under 90 seconds. stored on your device only.
        </p>
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
      <section className="border-[1.5px] border-[#d4c4b0] bg-[#fff8f0] p-5">
        <div className="mb-4 flex items-center justify-between gap-2 border border-[#d4c4b0] bg-[#fff8f0] p-3 text-[10px] uppercase tracking-[0.18em] text-[#9a8a72]">
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
            className="border border-[#d4c4b0] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#1c1208]"
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
