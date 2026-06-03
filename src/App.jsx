import { useState } from 'react'
import Home from './views/Home/index'
import Scene from './views/Scene/index'
import './App.css'

const App = () => {
  const [page, setPage] = useState('home')

  if (page === 'scene') {
    return <Scene onBack={() => setPage('home')} />
  }

  return <Home onEnterScene={() => setPage('scene')} />
}

export default App
