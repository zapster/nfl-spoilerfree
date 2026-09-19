# NFL Spoiler-Free

A simple mockup for browsing NFL regular-season games without revealing
results by default.

## Contents

- `PLAN.md` - product and implementation plan
- `DECISIONS.md` - durable product and architecture decisions
- `regular-season-mockup.html` - standalone schedule-view mockup

## Review

Open `regular-season-mockup.html` directly in a browser. It has no build step
or external JavaScript dependencies. The mockup centers Week 7, lets you
expand Week 6 or Week 8, and reveals scores one game at a time.

The mockup uses sample data and preview logo URLs. It is not yet connected to
the live nflverse data source.
