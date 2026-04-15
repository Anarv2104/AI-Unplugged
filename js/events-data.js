/**
 * AI Unplugged — Events mock data
 * Single source of truth for every page that lists or shows an event.
 * Edit this file to manage real events. Slugs (`id`) are used in URLs
 * (e.g. event.html?id=... and apply.html?event=...) so avoid changing
 * them once an event is live.
 *
 * `type` must be one of: Flagship | Execution | Showcase | Opportunity
 * `entry` must be one of: Open | Application | Invite Only | Curated
 * `status` must be one of: upcoming | past
 */
window.AI_UNPLUGGED_EVENTS = [
  {
    id: 'ai-open-hours-house-of-starts-ahmedabad-april-2026',
    title: 'AI Open Hours at House of Starts Ahmedabad Edition',
    type: 'Flagship',
    format: 'AI Open Hours',
    date: '2026-04-17',
    dateDisplay: 'April 17, 2026',
    location: '1st Floor, D Block, Satyam Corporate Square, Sindhu Bhavan Rd, behind Rajpath Rangoli Road, opp. Iconic 1010 Hospital, Bodakdev, Ahmedabad, Gujarat 380054',
    capacity: 40,
    entry: 'Application',
    duration: '2 hours',
    tagline: 'An AI Open Hours session with the House of Starts and eChai ecosystem in Ahmedabad.',
    description: [
      'AI Open Hours is a tighter, more conversational format for builders who want direct access to people actually working with AI. This Ahmedabad edition sits inside the House of Starts and eChai ecosystem, with the room designed for practical conversations over passive attendance.',
      'Expect open discussion, practical demos, sharp questions, and a room built for people who are actively building, exploring, or trying to get unstuck on what to do next with AI.'
    ],
    agenda: [
      { time: '5:30 PM', item: 'Doors open, intros' },
      { time: '6:00 PM', item: 'Open hours kickoff and context' },
      { time: '6:20 PM', item: 'Builder questions and live discussion' },
      { time: '7:00 PM', item: 'Short demos and practical walkthroughs' },
      { time: '7:30 PM', item: 'Open networking' },
      { time: '8:30 PM', item: 'Wrap' }
    ],
    speakers: [
      { name: 'To be announced', role: 'AI builder, Ahmedabad' },
      { name: 'To be announced', role: 'Founder or operator from the ecosystem' }
    ],
    status: 'upcoming'
  },
  {
    id: 'build-room-bangalore-june-2026',
    title: 'The Build Room — Bangalore',
    type: 'Execution',
    format: 'Build Room',
    date: '2026-06-08',
    dateDisplay: 'June 8, 2026',
    location: 'House of Starts, Bangalore',
    capacity: 24,
    entry: 'Application',
    duration: '8 hours',
    tagline: 'Show up. Build. Ship.',
    description: [
      'A focused, day-long build session. You arrive with a problem or an idea and leave with something working. Mentors float through the room, peers check in on each other, and there is no stage and no pizza-hackathon energy.',
      'Output matters. At the end of the day, every builder demos what they shipped. Applications are reviewed for signal, not credentials.'
    ],
    agenda: [
      { time: '10:00 AM', item: 'Check-in, goal setting' },
      { time: '10:30 AM', item: 'Build block 1' },
      { time: '1:00 PM', item: 'Lunch + sync' },
      { time: '2:00 PM', item: 'Build block 2' },
      { time: '5:00 PM', item: 'Mentor feedback round' },
      { time: '6:00 PM', item: 'End-of-day demos' }
    ],
    speakers: [
      { name: 'Mentor lineup', role: 'Announced to accepted builders' }
    ],
    status: 'past'
  },
  {
    id: 'demo-day-ahmedabad-july-2026',
    title: 'Demo Day — Cohort 01',
    type: 'Showcase',
    format: 'Demo Day',
    date: '2026-07-20',
    dateDisplay: 'July 20, 2026',
    location: 'House of Starts, Ahmedabad',
    capacity: 80,
    entry: 'Invite Only',
    duration: '3 hours',
    tagline: 'Proof of work, live.',
    description: [
      'Builders from the first cohort present what they have shipped over the last 8 weeks. Direct feedback from founders and operators in the room.',
      'This is an invite-only showcase for serious builders and ecosystem partners. If you are not presenting, you are here because you can actually help move something forward.'
    ],
    agenda: [
      { time: '5:00 PM', item: 'Guests arrive' },
      { time: '5:30 PM', item: 'Cohort demos — 8 builders' },
      { time: '7:00 PM', item: 'Open networking' },
      { time: '8:00 PM', item: 'Wrap' }
    ],
    speakers: [],
    status: 'past'
  },
  {
    id: 'talent-founder-exchange-bangalore-august-2026',
    title: 'Talent x Founder Exchange',
    type: 'Opportunity',
    format: 'Talent x Founder Exchange',
    date: '2026-08-15',
    dateDisplay: 'August 15, 2026',
    location: 'House of Starts, Bangalore',
    capacity: 30,
    entry: 'Curated',
    duration: '3 hours',
    tagline: 'Where internships and startup roles actually begin.',
    description: [
      'Founders come in with concrete problems. Builders pitch how they would solve them. Real opportunities — internships, contract work, full-time roles — start from conversations in this room.',
      'Curated on both sides. We match intent before anyone shows up.'
    ],
    agenda: [
      { time: '4:00 PM', item: 'Founder problem intros' },
      { time: '4:45 PM', item: '1:1 builder-founder rounds' },
      { time: '6:30 PM', item: 'Free-form mixer' },
      { time: '7:00 PM', item: 'Wrap' }
    ],
    speakers: [],
    status: 'past'
  },
  {
    id: 'builders-night-ahmedabad-march-2026',
    title: 'Builders Night Ahmedabad',
    type: 'Flagship',
    format: 'Builders Night',
    date: '2026-03-15',
    dateDisplay: 'March 15, 2026',
    location: 'House of Starts, Ahmedabad',
    capacity: 40,
    entry: 'Application',
    duration: '2 hours',
    tagline: 'The first one. It set the tone.',
    description: [
      'The first Builders Night of 2026. 40 builders, 4 live demos, one founder fireside. Sold out inside 48 hours.',
      'If you missed this one — the next Builders Night is where you want to be.'
    ],
    agenda: [
      { time: '6:00 PM', item: 'Doors open' },
      { time: '6:30 PM', item: 'Demos' },
      { time: '7:15 PM', item: 'Founder fireside' },
      { time: '8:00 PM', item: 'Networking' }
    ],
    speakers: [],
    status: 'past'
  },
  {
    id: 'build-room-ahmedabad-feb-2026',
    title: 'The Build Room — Ahmedabad',
    type: 'Execution',
    format: 'Build Room',
    date: '2026-02-22',
    dateDisplay: 'February 22, 2026',
    location: 'House of Starts, Ahmedabad',
    capacity: 20,
    entry: 'Application',
    duration: '8 hours',
    tagline: '20 builders. 20 shipped projects.',
    description: [
      'The pilot Build Room. Every single builder shipped something by 6 PM. Three went on to keep building and are now in early user conversations.'
    ],
    agenda: [
      { time: '10:00 AM', item: 'Kickoff' },
      { time: '10:30 AM', item: 'Build' },
      { time: '5:30 PM', item: 'Demos' }
    ],
    speakers: [],
    status: 'past'
  }
];
