import type { Metadata } from 'next';
import HomeWorkspace from '@/components/home-workspace';
import HomeAreaMap from '@/components/home-area-map';
import HospitalNavigationModel from '@/components/landing-hero-art';
import './landing.css';

export const metadata: Metadata = {
  title: 'SurgeWise · Preparedness starts with a question',
  description: 'Explore historical dengue patterns, hospital surge scenarios, and the evidence behind SurgeWise. A Quezon City preparedness research prototype.',
};

export default function Home() {
  return (
    <HomeWorkspace>
      <section className="home-canvas" aria-labelledby="home-title">
        {/* Tile map of Metro Manila city outlines; the hospital navigation model floats over
            the dark teal Quezon City tile, at the size of the hospital drawn there before. */}
        <HomeAreaMap overlay={<HospitalNavigationModel />} />
        <div className="home-intro">
          <p className="home-eyebrow">Dengue preparedness, connected.</p>
          <h1 id="home-title">What would a surge<br />ask of our hospitals?</h1>
          <p>Explore the model.<br />{' '}Find your next question.</p>
        </div>
      </section>
    </HomeWorkspace>
  );
}
