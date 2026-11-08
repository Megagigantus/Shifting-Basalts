import { firebaseConfigured } from './firebase'

function App() {
  return (
    <main className="placeholder">
      <h1>Shifting Basalts</h1>
      <p>Tracker coming soon.</p>
      <p className="status">
        Firebase: {firebaseConfigured ? 'connected' : 'not set up yet (see .env.example)'}
      </p>
    </main>
  )
}

export default App
