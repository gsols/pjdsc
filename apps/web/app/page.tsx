import type { Metadata } from 'next';
import HospitalNavigationModel from '@/components/landing-hero-art';
import HomeWorkspace from '@/components/home-workspace';
import HomeDotField from '@/components/home-dot-field';
import { LANDING_FACTS } from '@/lib/landing-facts';
import './landing.css';

export const metadata: Metadata = {
  title: 'SurgeWise · Preparedness starts with a question',
  description: 'Explore historical dengue patterns, hospital surge scenarios, and the evidence behind SurgeWise. A Quezon City preparedness research prototype.',
};

export default function Home() {
  return (
    <HomeWorkspace>
      <section className="home-canvas" aria-labelledby="home-title">
        <HomeDotField />
        <div className="home-intro">
          <p className="home-eyebrow">Dengue preparedness, connected.</p>
          <h1 id="home-title">What would a surge<br />ask of our hospitals?</h1>
          <p>Explore the model.<br />{' '}Find your next question.</p>
        </div>
        <HospitalNavigationModel />
        <div className="home-canvas-notes">
          <span className="home-interaction-hint"><span className="home-mouse-hint" aria-hidden="true" />Hover or focus to explore · Click to open</span>
        </div>
      </section>
      <div className="home-status-bar" role="note">
        <span>Historical evidence <span aria-hidden="true">/</span> Hypothetical scenarios up to {LANDING_FACTS.simulationDays} days</span>
        <span>No live surveillance or hospital bed availability</span>
      </div>
    </HomeWorkspace>
  );
}
