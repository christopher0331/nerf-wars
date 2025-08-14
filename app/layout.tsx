import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'
import './cyberpunk.css'

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'UNSC NERF Combat System',
  description: 'Tactical operations and combat control for NERF engagements',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={jetbrainsMono.className}>
        <div className="min-h-screen bg-black bg-opacity-90 text-cyan-400 relative">
          {/* Grid background pattern */}
          <div className="fixed inset-0 pointer-events-none z-0 bg-grid-pattern opacity-10"></div>
          
          {/* Main navigation */}
          <nav className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border-b border-cyan-800 shadow-lg shadow-cyan-900/30 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                {/* Logo area */}
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-cyan-900/50 border border-cyan-500/70 rounded-md flex items-center justify-center">
                    <span className="text-cyan-400 font-bold text-lg">N</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-cyan-300 uppercase tracking-wider">NERF Combat</h1>
                    <div className="text-xs text-cyan-500 font-mono -mt-1">TACTICAL SYSTEM</div>
                  </div>
                </div>
                
                {/* Navigation links */}
                <div className="flex items-center space-x-1">
                  <a href="/" className="text-cyan-300 hover:bg-blue-800/50 hover:text-cyan-200 px-3 py-2 rounded-md text-sm font-mono uppercase tracking-wide flex items-center transition-all duration-300">
                    <span className="text-cyan-500 mr-1">01.</span> Teams
                  </a>
                  <a href="/badges" className="text-cyan-300 hover:bg-blue-800/50 hover:text-cyan-200 px-3 py-2 rounded-md text-sm font-mono uppercase tracking-wide flex items-center transition-all duration-300">
                    <span className="text-cyan-500 mr-1">02.</span> Badges
                  </a>
                  <a href="/stations" className="text-cyan-300 hover:bg-blue-800/50 hover:text-cyan-200 px-3 py-2 rounded-md text-sm font-mono uppercase tracking-wide flex items-center transition-all duration-300">
                    <span className="text-cyan-500 mr-1">03.</span> Stations
                  </a>
                  <a href="/games" className="text-cyan-300 hover:bg-blue-800/50 hover:text-cyan-200 px-3 py-2 rounded-md text-sm font-mono uppercase tracking-wide flex items-center transition-all duration-300">
                    <span className="text-cyan-500 mr-1">04.</span> Games
                  </a>
                  <a href="/gameplay" className="text-cyan-300 hover:bg-blue-800/50 hover:text-cyan-200 px-3 py-2 rounded-md text-sm font-mono uppercase tracking-wide flex items-center transition-all duration-300">
                    <span className="text-cyan-500 mr-1">05.</span> Gameplay
                  </a>
                </div>
              </div>
            </div>
          </nav>
          
          {/* Scanner line effect on navigation */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent scanner-effect"></div>
          
          {/* Main content */}
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative z-10">
            {children}
          </main>
          
          {/* Footer with hexagon pattern */}
          <footer className="border-t border-cyan-900/50 mt-12 bg-blue-900/10 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <div className="text-xs text-cyan-600 font-mono">
                NERF COMBAT SYSTEM <span className="text-cyan-800">// VERSION 1.0</span>
              </div>
              <div className="text-xs text-cyan-700 font-mono">
                SYSTEM ACTIVE
              </div>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-900"></div>
          </footer>
        </div>
      </body>
    </html>
  )
}
