import { Routes, Route, Navigate } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { SheetProvider } from './context/SheetContext'
import Dashboard from './pages/Dashboard'
import Primaci from './pages/Primaci'
import PrimacDetail from './pages/PrimacDetail'
import Trendovi from './pages/Trendovi'

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
            </Routes>
          </div>
        </main>
      </div>
    </SheetProvider>
  )
}
