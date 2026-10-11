This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Neural network hero

Appearance follows the root `DESIGN.md`: white canvas, SF/system typography,
56px/600 desktop heading, 17px body, blue actions, pill buttons and flat surfaces.
The neural diagram uses fine curved connections, outlined nodes and blue
interaction highlights; its topology and displayed values come from the model.

The interactive figure uses the existing MNIST model (784 → 16 → 16 → 10).
All 12,960 weights are drawn: the 12,544 input connections use Canvas and the
remaining 416 connections use SVG. Solid/dashed lines distinguish positive and
negative weights. Opacity reflects the absolute contribution `|weight × input|`,
normalized per layer; neuron values and output probabilities come from inference.
Write directly in the network's input field; its output shows the predicted digit
and probability. Ink paints every frame, while inference refreshes at most every
500 ms during a stroke and immediately on pen release. After lifting the pen,
the input field displays the exact 28 × 28
image used by inference. Select a neuron to highlight its real connections; arrow
keys navigate neurons and Escape restores the whole network. Sample digits are
identified as samples and run through the same model as handwriting. Writing
replaces the initial sample; clearing leaves the input empty. On phones, the
network runs vertically to keep the embedded writing field usable.

Blue signal trails travel from input through both hidden layers to the output,
followed by a small halo on active neurons. Each trail follows the strongest
actual signed incoming contribution for its destination; zero activations never
send a trail. The motion presents snapshots
of those real computations. Continuous strokes coalesce into waves at most every
1,500 ms, allowing each wave to finish before the next begins. The latest input
replaces any queued snapshot without restarting a wave in flight. Native browser animations
avoid React updates on every animation frame. Clearing, reduced motion, a hidden
tab or scrolling the figure out of view cancels the motion; the figure rests when
there is no fresh input.

Validation (Node 22.18+ for native TypeScript imports):

```bash
npm test
npm run lint
npm run build
npm run start -- --port 3124
```

With Playwright and Chrome installed, run `node tests/browser.mjs` to compare the
rendered input, activations and contributions with inference for all ten samples,
then verify embedded drawing, clearing, connection highlighting, keyboard, touch and responsive
layout. Pass a Playwright module path as the first argument when it is installed
outside this project. Optional `APP_URL` and `CHROME_PATH` environment variables
override the local URL and browser executable. Screenshots are written to `shots/`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
