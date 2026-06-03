import Header from './sections/Header'
import Hero from './sections/Hero'
import Features from './sections/Features'
import Community from './sections/Community'
import CallToAction from './sections/CallToAction'
import Footer from './sections/Footer'
import './Home.css'

const Home = ({ onEnterScene }) => (
  <div className="home">
    <Header />
    <main>
      <Hero onEnterScene={onEnterScene} />
      <Features />
      <Community />
      <CallToAction />
    </main>
    <Footer />
  </div>
)

export default Home
