# Prototype

**You own the decision, not the code. The prototype is a throwaway instrument; the real
build follows Feature.**

This is the one playbook where the smallest-change rule and the verification bar turn
around: speed over polish, no code quality, no planning. The rigor is in picking the
right design cheaply. Propose variations the operator didn't ask for; throw an approach
away and try another.

1. Name the decision the prototype exists to make: which layout, interaction or density,
   or, for an empirical fork, which behaviour, timing or approach. No decision means no
   prototype: route to Feature.
2. When the design space is open, gather references first (prior art, themes, layouts)
   and let the operator pick directions before building. Skip it when the direction is
   set.
3. Build it throwaway in the scratchpad, apart from the repository. For a visual decision,
   plain HTML, CSS and JS or the lightest stack that renders the idea; an artifact page
   works too. For a behavioural or timing decision, the smallest script that exercises
   the question. No framework, no tests, no abstractions.
4. When comparing alternatives, put them behind one switcher (buttons or a key), each
   labelled (`exhaust-the-design-space`, made cheap).
5. Check it on the real surface. For a visual decision, screenshot each variant (the
   browser tools when present) and drive the interaction. For a behavioural one, observe
   the thing you are deciding: log the timing, print the output. The observation is the
   test.
6. Present the alternatives, the tradeoffs and a recommendation. The output is the
   decision and the throwaway artifact, not code to ship. Hand the chosen direction to
   Feature, or to `architect` for the shape.

**Reply:** the variants, the evidence (screenshots, or the observed output or timing), the
tradeoffs, your recommendation, and the scratch path. Say plainly that the prototype is
throwaway.
