import type { Metadata } from 'next';
import { GradientText, LinkButton } from '@hannasage/projection-ui/core';
import { ArmatureShell } from '@/components/ArmatureShell';
import { SpringLab } from '@/components/SpringLab';

export const metadata: Metadata = {
  title: 'Armature',
  description: 'A physics motion engine for the web. Play with a live spring and see how flavors give each product its own way of moving.',
  alternates: { canonical: 'https://projectionui.dev/armature/' },
};

const example = `import { createSpring, retarget, stepSpring } from "@hannasage/armature";

let spring = retarget(createSpring({ stiffness: 170, damping: 26 }, 0), 1);

function frame(seconds: number): number {
  spring = stepSpring(spring, 1, seconds);
  return spring.value;
}`;

export default function ArmaturePage() {
  return <ArmatureShell>
    <header className="armature-hero" aria-labelledby="armature-title">
      <span className="armature-pill"><i aria-hidden="true" />Pre-release. Not published yet.</span>
      <GradientText as="h1" id="armature-title">Armature</GradientText>
      <p className="armature-lede">A physics motion engine for the web. Springs that behave the same at any frame rate, scroll reveals that read how fast you scroll, and named flavors that give each product its own way of moving.</p>
      <div className="landing-actions">
        <LinkButton className="landing-primary landing-glow-button" variant="primary" appearance="gradient" href="#lab" style={{ padding: '0 18px', fontSize: 14 }}>Play with a spring</LinkButton>
        <LinkButton className="landing-outline landing-glow-button" href="#flavors" style={{ background: 'transparent', color: 'var(--ui-accent-text)', borderColor: 'var(--ui-primary)', padding: '0 18px', fontSize: 14 }}>How flavors work</LinkButton>
      </div>
    </header>

    <section id="lab" className="armature-section" aria-labelledby="armature-lab-title">
      <h2 id="armature-lab-title">Motion is an equation. Change it.</h2>
      <p className="armature-sub">Every Armature spring solves one equation. Move the sliders and the curve redraws from the real solver, 120 steps a second. The lab runs the same step as the package: semi-implicit Euler at 1/120 second.</p>
      <SpringLab />
    </section>

    <section id="flavors" className="armature-section" aria-labelledby="armature-flavors-title">
      <h2 id="armature-flavors-title">One engine. Many ways of moving.</h2>
      <p className="armature-sub">A flavor is a named movement language. It sets the spring constants, the attribute names the engine reads, and the CSS variables it writes. The engine never learns a flavor&apos;s name.</p>
      <div className="armature-flavors">
        <article className="armature-card-plain"><span className="armature-tag">Engine</span><h3>Fixed-step springs</h3><p>The solver steps in 1/120 second slices and keeps the leftover time, so a 30, 60, or 144 Hz screen lands in the same place. It runs in Node, so tests need no browser.</p></article>
        <article className="armature-card-plain"><span className="armature-tag">Flavor one</span><h3>Liquid glass</h3><p>A refracting lens, a travelling nav indicator, a pressable surface with a glint, and scroll reveals that read scroll speed.</p></article>
        <article className="armature-card-plain"><span className="armature-tag">Flavor two</span><h3>Mechanical</h3><p>A flavor that matches the look of Projection UI. Crisp presses and switch thumbs that overshoot a little and settle in about a fifth of a second. Exits settle with no bounce.</p></article>
      </div>
    </section>

    <section className="armature-section" aria-labelledby="armature-use-title">
      <h2 id="armature-use-title">Use the engine alone</h2>
      <p className="armature-sub">The engine needs no flavor. This steps a spring toward 1.</p>
      <pre className="armature-code" role="region" aria-label="Engine-only example" tabIndex={0}><code>{example}</code></pre>
      <ul className="armature-facts">
        <li><span>License</span>MIT</li>
        <li><span>Runtime dependencies</span>None in the engine. React is optional.</li>
        <li><span>Entries</span>Engine, dom, react, glass, and glass for React. ESM only.</li>
        <li><span>Status</span>Pre-release. The API can still change.</li>
      </ul>
    </section>
  </ArmatureShell>;
}
