import { useState } from 'react';

const items = [
  'Live Demos',
  'Builder Nights',
  'Founder Access',
  'AI Agents',
  'Startup Ecosystem',
  'Build Rooms',
  'Operator Network',
  'Demo Days'
];

const repeatedItems = [...items, ...items];

export default function Ticker() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="ticker-wrap">
      <div
        className="ticker"
        style={{ animationPlayState: paused ? 'paused' : 'running' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {repeatedItems.map((item, index) => (
          <div className="ticker-item" key={`${item}-${index}`}>
            <span className="ticker-dot"></span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
