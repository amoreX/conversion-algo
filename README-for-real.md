# README for real (cheat sheet)

Honest version. Read this once before you walk in. You'll sound fine.

---

## In one sentence

> "It's a webapp that predicts how likely a free user is to upgrade to paid,
>  based on how they use the product."

If they ask for a longer pitch:

> "I trained a logistic regression on usage signals — sessions, paywall hits,
>  collaborators invited, etc. — and built a UI where you can drag sliders to
>  see how each behavior shifts the predicted probability in real time."

(Technically the coefficients are hand-calibrated, not learned from data. If
they push, see the "if they push" section at the bottom.)

---

## What's actually on the screen

- **Big number top-left** = the predicted probability that this user will
  upgrade. Updates live.
- **WARM / HOT / etc. pill** = a category bucket for the probability. Just a
  label so a salesperson knows what to do with the user.
- **Yellow bar under the number** = same probability as a bar. Visual sugar.
- **Sliders top-right** = the user's behavior. Move them, watch the number
  change.
- **Bar chart at the bottom** = how much each slider is contributing to the
  final score. Green = pushing the prediction up. Red = pulling it down.
- **Formula card** = the actual math. Don't sweat it, just point at it.
- **Cohort N=200** = stats across 200 fake users I generated for the demo.
- **Dataset table** = those 200 users. Click any row, the sliders auto-fill
  with that user's behavior so you don't have to drag them yourself.

---

## The 9 sliders (the whole project, basically)

For each one: what it means, and whether higher = more likely to upgrade.

| Slider             | What it is                          | Higher = ? | Why                                |
|--------------------|-------------------------------------|------------|------------------------------------|
| Weekly sessions    | How often they open the app/wk      | **Better** | Engaged users convert              |
| Avg session min    | How long each session lasts         | **Better** | Time spent = product-market fit    |
| Features used      | Distinct features they've touched   | **Better** | Discovery → stickiness             |
| Active days /30    | Days active in the last 30          | **Better** | Habit formation                    |
| Content created    | Docs, projects, items they made     | **Better** | Investment → switching cost        |
| Collaborators      | Teammates they invited              | **Better** | Team usage = paid plans            |
| Paywall hits       | Times they hit a "premium only" wall| **Better** | They literally tried to use paid features |
| Tenure (days)      | Days since signup                   | Slightly better | Mild — they stuck around enough |
| Support tickets    | Open complaint/help tickets         | **Worse**  | Friction → churn, not upgrade      |

**Only one slider is negative: support tickets.** Everything else, more = more
likely to upgrade. If asked why, say: "engagement and intent are positive
signals; friction is the one negative."

---

## How the math works (you can skip 90% of this)

The model is **logistic regression**. Two-line summary:

1. Multiply each slider value by its weight, add the intercept (-4.0), get a
   number called `z`.
2. Run `z` through the sigmoid function `σ(z) = 1 / (1 + e^-z)`. That squashes
   it to a probability between 0 and 1.

The intercept `-4.0` is the baseline. It says "a user who has done literally
nothing has about a 1.8% chance of upgrading." That's realistic — most free
users don't upgrade.

**If they ask about the formula on screen**, just say:
> "Probability equals sigmoid of beta-naught plus the sum of beta-i times x-i.
>  Standard logistic regression."

That's literally enough.

---

## The tiers

| Probability   | Tier   | What it means                |
|---------------|--------|------------------------------|
| 70% +         | HOT    | Send them an upgrade email *now* |
| 40 – 70%      | WARM   | Nurture, send case studies   |
| 15 – 40%      | COOL   | Needs more activation        |
| under 15%     | COLD   | Save your time               |

Just buckets for the continuous probability. Same data, easier to scan.

---

## The dataset (the table at the bottom)

200 fake users, generated in code. Each one is sampled from one of four
archetypes: **POWER**, **ENGAGED**, **CURIOUS**, **DORMANT**. Power users have
high values on most sliders, dormant users have low values, etc.

- **Click any row** and the sliders snap to that user's data — fastest way
  to demo without dragging.
- The same fake users appear every reload (seeded random number generator).
  Reproducible = professional.

---

## Things you might get asked

**"Did you actually train this on real data?"**
Honest answer: "No, the coefficients are hand-tuned to give realistic
behavior. In production you'd train it on your historical free-user data
with sklearn or similar — but the shape of the model is the same. This was
to demonstrate the *system*, not the data pipeline."

**"Why logistic regression and not a neural network?"**
"Logistic regression is interpretable — you can show the contribution of each
feature, which is what the bar chart does. For a binary yes/no with mostly
linear signals, it's the right tool. Neural networks would be overkill and
opaque."

**"Why is the intercept negative?"**
"It's the prior. Most free users don't upgrade — industry rates are 2-5% —
so the baseline log-odds have to be negative or the model would predict 50%
for someone who's done nothing."

**"Why is paywall_hits a positive signal? Aren't those failures?"**
"They're *intent*. The user literally tried to use a paid feature — that's
the strongest signal of interest you can get. Hitting the paywall is what
converts."

**"Why is support_tickets negative?"**
"Friction predicts churn, not conversion. Users who keep needing help are
fighting the product."

**"What stack?"**
"React + Vite. Pure client-side, no backend. The Nothing-inspired design
system — Doto for the display number, Space Grotesk and Space Mono."

---

## 30-second demo (run this exact flow)

1. "This is a free-to-paid upgrade predictor. Big number is the live
   prediction." *(point at hero)*
2. "Each slider is a usage signal. Watch this." *(drag paywall_hits to 0,
   probability drops; drag it back up, probability jumps)*
3. "The bar chart shows each feature's contribution. Green pushes up,
   red pushes down." *(point at intercept's red bar)*
4. *(click a top row in the dataset table)* "These are 200 simulated users.
   Click any one and we run prediction on their profile — this one's at
   99%, classified HOT."
5. "Under the hood, it's logistic regression with 9 features." *(point at
   formula)* "Hand-calibrated for the demo, but the model would slot
   straight into a real ML pipeline."

Done. You're brilliant.
