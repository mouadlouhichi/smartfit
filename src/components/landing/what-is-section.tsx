export function WhatIsSection() {
  return (
    <section
      aria-labelledby="what-is-smartfit"
      className="relative border-y border-[color:var(--foreground)]/10 bg-[color:var(--foreground)]/[0.02] py-16 lg:py-20"
    >
      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)] lg:gap-16 lg:px-12">
        <h2 id="what-is-smartfit" className="font-display text-3xl tracking-tight lg:text-4xl">
          What is SmartFit?
          <br />
          The free workout tracker.
        </h2>
        <p className="max-w-4xl text-lg leading-relaxed text-[color:var(--muted-foreground)] lg:text-xl">
          SmartFit is a private fitness tracker that separates what a session is — strength, cardio,
          HIIT or mobility — from the recurring plan it belongs to. It supports 4 proven training
          strategies: Push/Pull/Legs, Upper/Lower, Full Body 3× and Cardio &amp; Conditioning.
          SmartFit never pairs with a watch or ring; you log sessions manually so nothing is
          misattributed. Your data lives entirely on your device — there is no account and no cloud
          watching you.
        </p>
      </div>
    </section>
  );
}
