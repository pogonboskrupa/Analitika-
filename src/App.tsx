import { Routes, Route, Navigate } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { SheetProvider } from './context/SheetContext'
import Dashboard from './pages/Dashboard'
import Primaci from './pages/Primaci'
import PrimacDetail from './pages/PrimacDetail'
import Trendovi from './pages/Trendovi'
import Otprema from './pages/Otprema'
import Radilista from './pages/Radilista'
import IzvođačDetail from './pages/IzvođačDetail'
import Izvođači from './pages/Izvođači'
import Kupci from './pages/Kupci'
import KupacDetail from './pages/KupacDetail'
import StanjeZaliha from './pages/StanjeZaliha'
import Poredenje from './pages/Poredenje'
import GodišnjiPlan from './pages/GodišnjiPlan'

export default function App() {
  return (
    <SheetProvider>
      <div className="flex min-h-screen">
        <Navigation />
        <main className="flex-1 md:ml-64 min-h-screen bg-gray-50 dark:bg-gray-950 pt-14 md:pt-0">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/primaci" element={<Primaci />} />
              <Route path="/primaci/:id" element={<PrimacDetail />} />
              <Route path="/trendovi" element={<Trendovi />} />
              <Route path="/otprema" element={<Otprema />} />
              <Route path="/radilista" element={<Radilista />} />
              <Route path="/radilista/izvođač/:id" element={<IzvođačDetail />} />
              <Route path="/izvodjaci" element={<Izvođači />} />
              <Route path="/kupci" element={<Kupci />} />
              <Route path="/kupci/:id" element={<KupacDetail />} />
              <Route path="/zalihe" element={<StanjeZaliha />} />
              <Route path="/poredenje" element={<Poredenje />} />
              <Route path="/godisnji-plan" element={<GodišnjiPlan />} />
            </Routes>
          </div>
        </main>
      </div>
    </SheetProvider>
  )
}
