/**
 * Static marketing content. Kept out of components so copy edits never risk
 * touching layout, and so this can later be swapped for Supabase-backed data
 * behind the same shape.
 */

export interface PlanTier {
  slug: string;
  name: string;
  /** Integer paise. Never rupees, never a float. */
  pricePaise: number;
  /** Struck-through anchor price, also in paise. */
  comparePaise?: number;
  durationWeeks: number;
  tagline: string;
  features: string[];
  consults: number;
  includesTrainer: boolean;
  recommended?: boolean;
}

export const PLAN_TIERS: readonly PlanTier[] = [
  {
    slug: "starter",
    name: "Starter",
    pricePaise: 49900,
    comparePaise: 99900,
    durationWeeks: 2,
    tagline: "Your full 7-day chart, unlocked.",
    features: [
      "Complete 7-day diet chart (all meals)",
      "BMI, BMR, TDEE and macro breakdown",
      "Veg / non-veg day scheduling",
      "Printable and downloadable PDF",
      "Grocery list for the week",
      "WhatsApp support for 2 weeks",
    ],
    consults: 0,
    includesTrainer: false,
  },
  {
    slug: "pro",
    name: "Pro Coaching",
    pricePaise: 249900,
    comparePaise: 399900,
    durationWeeks: 6,
    tagline: "Diet plus a dietician on call.",
    features: [
      "Everything in Starter",
      "6-week progressive plan, refreshed fortnightly",
      "2 × 1-to-1 video or phone consults",
      "Custom workout split for your goal",
      "Weekly check-ins on WhatsApp",
      "Plan adjusted to your progress",
    ],
    consults: 2,
    includesTrainer: false,
    recommended: true,
  },
  {
    slug: "elite",
    name: "Elite Transformation",
    pricePaise: 599900,
    comparePaise: 899900,
    durationWeeks: 16,
    tagline: "The full 16-week transformation.",
    features: [
      "Everything in Pro",
      "16-week periodised diet and training",
      "4 × 1-to-1 consults with dietician and trainer",
      "Form checks on your lifts over video",
      "Supplement guidance",
      "Priority WhatsApp access to the coach",
    ],
    consults: 4,
    includesTrainer: true,
  },
];

export function findTier(slug: string) {
  return PLAN_TIERS.find((t) => t.slug === slug);
}

export interface Transformation {
  slug: string;
  displayName: string;
  goalLabel: string;
  weeks: number;
  startKg: number;
  endKg: number;
  beforeSrc: string;
  afterSrc: string;
  testimonial: string;
}

export const TRANSFORMATIONS: readonly Transformation[] = [
  {
    slug: "rahul",
    displayName: "Rahul S.",
    goalLabel: "Fat loss",
    weeks: 14,
    startKg: 94,
    endKg: 78,
    beforeSrc: "/placeholder/rahul-before.jpg",
    afterSrc: "/placeholder/rahul-after.jpg",
    testimonial:
      "The plan used food my mother already cooked. That is the only reason I stuck to it for 14 weeks.",
  },
  {
    slug: "priya",
    displayName: "Priya M.",
    goalLabel: "Fat loss + tone",
    weeks: 20,
    startKg: 76,
    endKg: 61,
    beforeSrc: "/placeholder/priya-before.jpg",
    afterSrc: "/placeholder/priya-after.jpg",
    testimonial:
      "I was vegetarian and every other coach handed me chicken. Here the plan actually respected that.",
  },
  {
    slug: "arjun",
    displayName: "Arjun K.",
    goalLabel: "Muscle gain",
    weeks: 12,
    startKg: 58,
    endKg: 68,
    beforeSrc: "/placeholder/arjun-before.jpg",
    afterSrc: "/placeholder/arjun-after.jpg",
    testimonial:
      "Gained 10 kg without junk. The non-veg days were scheduled around my hostel mess menu.",
  },
  {
    slug: "meera",
    displayName: "Meera R.",
    goalLabel: "Post-pregnancy",
    weeks: 24,
    startKg: 82,
    endKg: 65,
    beforeSrc: "/placeholder/meera-before.jpg",
    afterSrc: "/placeholder/meera-after.jpg",
    testimonial:
      "Slow, steady and safe. The check-in calls kept me honest on the weeks I wanted to quit.",
  },
];

export interface Coach {
  slug: string;
  name: string;
  kind: "dietician" | "trainer";
  headline: string;
  bio: string;
  specialties: string[];
  experienceYears: number;
  photoSrc: string;
}

export const COACHES: readonly Coach[] = [
  {
    slug: "mack",
    name: "Coach Mack",
    kind: "trainer",
    headline: "Head coach and founder",
    bio: "Twelve years on the gym floor, from first-time lifters to stage-ready physiques. Builds plans around what you can actually sustain, not what looks good on paper.",
    specialties: ["Body recomposition", "Strength", "Contest prep"],
    experienceYears: 12,
    photoSrc: "/placeholder/coach-mack.jpg",
  },
  {
    slug: "dietician",
    name: "Dr. Sneha Verma",
    kind: "dietician",
    headline: "Clinical dietician, RD",
    bio: "Registered dietician specialising in Indian household nutrition, PCOS and thyroid-friendly planning, and diabetic-safe fat loss.",
    specialties: ["PCOS", "Thyroid", "Diabetic-safe plans"],
    experienceYears: 9,
    photoSrc: "/placeholder/coach-dietician.jpg",
  },
  {
    slug: "trainer",
    name: "Vikram Rao",
    kind: "trainer",
    headline: "Strength and conditioning",
    bio: "Ex-athlete turned coach. Handles form correction over video and programming for people training at home or in a crowded local gym.",
    specialties: ["Home workouts", "Form correction", "Mobility"],
    experienceYears: 7,
    photoSrc: "/placeholder/coach-trainer.jpg",
  },
];

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Tell us your body",
    body: "Age, height, weight, activity level and goal. Takes ninety seconds. We calculate your BMI, BMR and daily calorie target while you type.",
  },
  {
    step: "02",
    title: "Pick your food rules",
    body: "Vegan, vegetarian or non-veg — and if non-veg, choose exactly which days of the week you eat meat. Flag allergies and anything you refuse to eat.",
  },
  {
    step: "03",
    title: "Get your 7-day chart",
    body: "A full week of Indian meals portioned in katoris and rotis, hitting your calorie and protein targets. Day one is free to preview.",
  },
  {
    step: "04",
    title: "Talk to a human",
    body: "Unlock the full plan and book a 1-to-1 call with the dietician or trainer. We adjust as your body responds.",
  },
] as const;

export const FAQS = [
  {
    q: "Is the diet chart really generated automatically?",
    a: "Yes. The calculations — BMI, BMR via the Mifflin-St Jeor equation, TDEE, and your macro split — run instantly, and the 7-day chart is built from a curated Indian food library to hit those targets. A dietician reviews paid plans before your first consult.",
  },
  {
    q: "Can I choose which days I eat non-veg?",
    a: "That is exactly how it works. Select non-veg as your preference, then tick the weekdays you eat meat or fish. Every other day is built from the vegetarian library, so a Tuesday-and-Friday-only eater gets a plan that respects it.",
  },
  {
    q: "Do you handle vegan diets properly?",
    a: "Vegan plans exclude all dairy and eggs, and the protein target is raised slightly to account for plant proteins being less bioavailable. If the target cannot be met from whole foods alone, the plan says so and suggests a plant protein rather than quietly falling short.",
  },
  {
    q: "What if I have a medical condition?",
    a: "Tell us in the medical notes field. Automated plans are general fitness guidance, not medical treatment — if you have diabetes, thyroid issues, kidney disease, are pregnant, or have a history of eating disorders, speak to your doctor first, and book a consult so a dietician can adapt the plan.",
  },
  {
    q: "How do the 1-to-1 sessions work?",
    a: "Pick a coach, a date, and your preferred time slot. Once your booking is confirmed you get a WhatsApp link and phone number to reach your coach directly at that time — no extra app to install.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All payments run through Razorpay, so UPI, credit and debit cards, net banking and wallets all work. Prices are in Indian rupees.",
  },
  {
    q: "Can I get a refund?",
    a: "If the plan has not been unlocked and no consult has taken place, write to us within 7 days of purchase and we will refund in full. See the refund policy for the detail.",
  },
] as const;

export const MARQUEE_ITEMS = [
  "CERTIFIED COACHING",
  "INDIAN MEAL PLANS",
  "VEG · VEGAN · NON-VEG",
  "1-TO-1 DIETICIAN CALLS",
  "1200+ CLIENTS COACHED",
  "NO CRASH DIETS",
] as const;
