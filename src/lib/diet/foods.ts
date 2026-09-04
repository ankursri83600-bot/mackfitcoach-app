import type { AllergenTag, DietTag, Food, FoodCategory, FoodRole, Unit } from "./types";

/**
 * Indian-first food library.
 *
 * Values are representative Indian-kitchen averages in the style of IFCT/USDA
 * tables, rounded for planning. They are NOT clinical figures.
 *
 * Legume and grain entries whose measure says "cooked" are stated per DRY
 * weight, because that is how people actually portion them before cooking.
 *
 * Composed dishes (mixed_sabzi, chicken_curry, egg_bhurji, dosa) already
 * include their cooking oil — flagged with `includesCookingFat` so the selector
 * doesn't add ghee on top and double-count.
 *
 * Stored as tuples so ~95 entries stay reviewable in one screen-scroll.
 */
type Row = [
  id: string,
  name: string,
  category: FoodCategory,
  diet: DietTag,
  allergens: AllergenTag[],
  baseQty: number,
  unit: Unit,
  measure: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  step: number,
  min: number,
  max: number,
  rank: number,
  includesCookingFat?: boolean,
];

const ROWS: Row[] = [
  // ── GRAINS / ROTI / RICE ─────────────────────────────────────────────────
  ["roti_atta", "Whole-wheat Roti", "grain", "vegan", ["gluten"], 1, "piece", "roti", 120, 3.5, 24, 1.2, 1, 1, 7, 9],
  ["roti_bajra", "Bajra Roti", "grain", "vegan", [], 1, "piece", "roti", 130, 4.0, 26, 1.5, 1, 1, 4, 6],
  ["roti_jowar", "Jowar Roti", "grain", "vegan", [], 1, "piece", "roti", 125, 3.6, 26, 1.2, 1, 1, 4, 6],
  ["rice_white", "Cooked White Rice", "grain", "vegan", [], 150, "g", "katori", 195, 4.0, 42, 0.5, 0.5, 0.5, 3.5, 8],
  ["rice_brown", "Cooked Brown Rice", "grain", "vegan", [], 150, "g", "katori", 168, 3.9, 35, 1.4, 0.5, 0.5, 3.5, 7],
  ["poha", "Poha (dry weight)", "grain", "vegan", [], 40, "g", "katori cooked", 147, 2.8, 32, 0.5, 0.25, 0.75, 3, 7],
  ["upma_sooji", "Sooji Upma (dry sooji)", "grain", "vegan", ["gluten"], 40, "g", "katori cooked", 145, 4.4, 30, 0.4, 0.25, 0.75, 2, 6],
  ["oats", "Rolled Oats", "grain", "vegan", ["gluten"], 40, "g", "half katori", 152, 5.3, 27, 2.6, 0.25, 0.5, 3, 9],
  ["dalia", "Broken Wheat (Dalia)", "grain", "vegan", ["gluten"], 40, "g", "katori cooked", 137, 4.8, 30, 0.5, 0.25, 0.5, 3, 7],
  ["quinoa", "Cooked Quinoa", "grain", "vegan", [], 150, "g", "katori", 180, 6.6, 31, 2.9, 0.5, 0.5, 3, 5],
  ["idli", "Idli", "grain", "vegetarian", [], 1, "piece", "idli", 58, 2.0, 12, 0.4, 1, 2, 5, 7],
  ["dosa_plain", "Plain Dosa", "grain", "vegetarian", [], 1, "piece", "dosa", 133, 3.0, 20, 4.5, 1, 1, 3, 6, true],
  ["bread_ww", "Whole-wheat Bread", "grain", "vegan", ["gluten"], 1, "piece", "slice", 75, 3.0, 13, 1.0, 1, 1, 4, 6],
  ["sweet_potato", "Boiled Sweet Potato", "grain", "vegan", [], 100, "g", "medium", 90, 2.0, 21, 0.1, 0.5, 0.5, 3.5, 7],
  ["potato_boiled", "Boiled Potato", "grain", "vegan", [], 100, "g", "medium", 87, 2.0, 20, 0.1, 0.5, 0.5, 2, 5],
  ["murmura", "Puffed Rice (Murmura)", "grain", "vegan", [], 30, "g", "katori", 116, 2.1, 26, 0.3, 0.5, 0.5, 2, 4],

  // ── DALS / LEGUMES (dry weight) ──────────────────────────────────────────
  ["dal_toor", "Toor Dal", "legume", "vegan", [], 30, "g", "katori cooked", 101, 6.6, 19, 0.5, 0.5, 0.5, 3.5, 9],
  ["dal_moong", "Yellow Moong Dal", "legume", "vegan", [], 30, "g", "katori cooked", 99, 7.2, 18, 0.4, 0.5, 0.5, 3.5, 9],
  ["dal_masoor", "Masoor Dal", "legume", "vegan", [], 30, "g", "katori cooked", 105, 7.6, 18, 0.4, 0.5, 0.5, 2.5, 8],
  ["dal_chana", "Chana Dal", "legume", "vegan", [], 30, "g", "katori cooked", 110, 6.3, 18, 1.6, 0.5, 0.5, 2.5, 7],
  ["rajma", "Rajma (Kidney Beans)", "legume", "vegan", [], 30, "g", "katori cooked", 101, 7.0, 18, 0.4, 0.5, 0.5, 3.5, 8],
  ["chana_kabuli", "Kabuli Chana", "legume", "vegan", [], 30, "g", "katori cooked", 110, 6.0, 18, 1.8, 0.5, 0.5, 3.5, 8],
  ["chana_kala", "Kala Chana", "legume", "vegan", [], 30, "g", "katori cooked", 108, 6.3, 18, 1.5, 0.5, 0.5, 2.5, 7],
  ["lobia", "Lobia (Black-eyed Peas)", "legume", "vegan", [], 30, "g", "katori cooked", 103, 7.0, 18, 0.4, 0.5, 0.5, 2, 5],
  ["sprouts_moong", "Moong Sprouts", "legume", "vegan", [], 100, "g", "katori", 106, 7.6, 19, 0.4, 0.5, 0.5, 2, 8],

  // ── PANEER / TOFU / SOY ──────────────────────────────────────────────────
  ["soya_chunks", "Soya Chunks (dry)", "plant_protein", "vegan", ["soy"], 25, "g", "katori cooked", 86, 13.0, 8, 0.2, 0.5, 0.5, 4, 9],
  ["paneer_full", "Paneer (full fat)", "plant_protein", "vegetarian", ["dairy"], 100, "g", "cubes", 296, 18.0, 3.4, 25.0, 0.25, 0.5, 2, 8],
  ["paneer_lowfat", "Paneer (low fat)", "plant_protein", "vegetarian", ["dairy"], 100, "g", "cubes", 200, 20.0, 4.0, 12.0, 0.25, 0.5, 2.5, 9],
  ["tofu_firm", "Firm Tofu", "plant_protein", "vegan", ["soy"], 100, "g", "block", 145, 15.0, 4.0, 9.0, 0.25, 0.5, 2.5, 8],
  ["soy_milk", "Unsweetened Soy Milk", "plant_protein", "vegan", ["soy"], 200, "ml", "glass", 66, 6.6, 3.0, 3.6, 0.5, 0.5, 2, 7],

  // ── DAIRY ────────────────────────────────────────────────────────────────
  ["milk_toned", "Toned Milk", "dairy", "vegetarian", ["dairy"], 200, "ml", "glass", 116, 6.4, 9.4, 6.0, 0.5, 0.5, 2, 8],
  ["milk_skim", "Double-toned Milk", "dairy", "vegetarian", ["dairy"], 200, "ml", "glass", 70, 6.8, 10.0, 0.2, 0.5, 0.5, 2, 8],
  ["curd", "Curd (dahi)", "dairy", "vegetarian", ["dairy"], 150, "g", "katori", 90, 4.7, 7.0, 5.0, 0.5, 0.5, 2, 9],
  ["hung_curd", "Hung Curd / Greek Yogurt", "dairy", "vegetarian", ["dairy"], 150, "g", "katori", 146, 15.0, 6.0, 6.0, 0.5, 0.5, 2, 8],
  ["buttermilk", "Chaas (Buttermilk)", "dairy", "vegetarian", ["dairy"], 200, "ml", "glass", 40, 2.0, 4.0, 1.5, 0.5, 1, 2, 7],
  ["cheese_slice", "Cheese Slice", "dairy", "vegetarian", ["dairy"], 20, "g", "slice", 80, 5.0, 1.0, 6.0, 1, 1, 2, 3],
  ["whey_iso", "Whey Protein Isolate", "supplement", "vegetarian", ["dairy"], 30, "g", "scoop", 120, 25.0, 2.0, 1.0, 0.5, 0.5, 2, 6],
  ["pea_protein", "Pea Protein Powder", "supplement", "vegan", [], 30, "g", "scoop", 115, 24.0, 1.0, 1.5, 0.5, 0.5, 2, 5],

  // ── EGGS ─────────────────────────────────────────────────────────────────
  ["egg_whole", "Whole Egg", "egg", "vegetarian", ["egg"], 1, "piece", "egg", 72, 6.3, 0.4, 4.8, 1, 1, 4, 9],
  ["egg_white", "Egg White", "egg", "vegetarian", ["egg"], 1, "piece", "white", 17, 3.6, 0.2, 0.1, 1, 2, 8, 8],
  ["egg_bhurji", "Egg Bhurji (2 eggs)", "egg", "vegetarian", ["egg"], 1, "piece", "serving", 190, 13.0, 3.0, 14.0, 1, 1, 2, 6, true],

  // ── CHICKEN / FISH / MUTTON ──────────────────────────────────────────────
  ["chicken_breast", "Chicken Breast", "meat", "non_veg", [], 100, "g", "raw", 120, 23.0, 0.0, 2.6, 0.5, 0.5, 3, 10],
  ["chicken_thigh", "Chicken Thigh", "meat", "non_veg", [], 100, "g", "raw", 177, 24.0, 0.0, 8.0, 0.5, 0.5, 2, 6],
  ["chicken_curry", "Chicken Curry (home-style)", "meat", "non_veg", [], 150, "g", "katori", 230, 22.0, 5.0, 13.0, 0.5, 0.5, 2, 7, true],
  ["keema", "Chicken Keema", "meat", "non_veg", [], 100, "g", "raw", 143, 20.0, 0.0, 7.0, 0.5, 0.5, 2, 5],
  ["mutton_lean", "Lean Mutton", "meat", "non_veg", [], 100, "g", "raw", 143, 26.0, 0.0, 4.0, 0.5, 0.5, 1.5, 4],
  ["fish_rohu", "Rohu / Local Fish", "fish", "non_veg", ["fish"], 100, "g", "raw", 97, 17.0, 0.0, 2.5, 0.5, 0.5, 2.5, 7],
  ["fish_surmai", "Surmai (Kingfish)", "fish", "non_veg", ["fish"], 100, "g", "raw", 105, 21.0, 0.0, 2.0, 0.5, 0.5, 2.5, 6],
  ["fish_salmon", "Salmon", "fish", "non_veg", ["fish"], 100, "g", "raw", 208, 20.0, 0.0, 13.0, 0.5, 0.5, 2, 3],
  ["tuna_canned", "Canned Tuna (in water)", "fish", "non_veg", ["fish"], 100, "g", "tin drained", 116, 26.0, 0.0, 1.0, 0.5, 0.5, 2, 5],
  ["prawns", "Prawns", "fish", "non_veg", ["shellfish"], 100, "g", "raw", 99, 24.0, 0.2, 0.3, 0.5, 0.5, 2, 4],

  // ── VEGETABLES ───────────────────────────────────────────────────────────
  ["palak", "Palak (Spinach), cooked", "vegetable", "vegan", [], 150, "g", "katori", 35, 4.4, 5.0, 0.6, 0.5, 0.5, 2, 9],
  ["lauki", "Lauki (Bottle Gourd)", "vegetable", "vegan", [], 150, "g", "katori", 21, 0.9, 5.0, 0.2, 0.5, 0.5, 2, 8],
  ["bhindi", "Bhindi (Okra)", "vegetable", "vegan", [], 150, "g", "katori", 50, 2.7, 10.5, 0.3, 0.5, 0.5, 2, 8],
  ["gobhi", "Cauliflower", "vegetable", "vegan", [], 150, "g", "katori", 38, 2.9, 7.5, 0.4, 0.5, 0.5, 2, 8],
  ["cabbage", "Cabbage", "vegetable", "vegan", [], 150, "g", "katori", 38, 1.9, 8.7, 0.2, 0.5, 0.5, 2, 6],
  ["beans_french", "French Beans", "vegetable", "vegan", [], 150, "g", "katori", 47, 2.7, 10.5, 0.2, 0.5, 0.5, 2, 7],
  ["carrot", "Carrot", "vegetable", "vegan", [], 100, "g", "medium", 41, 0.9, 9.6, 0.2, 0.5, 0.5, 2, 7],
  ["capsicum", "Capsicum", "vegetable", "vegan", [], 100, "g", "medium", 31, 1.0, 6.0, 0.3, 0.5, 0.5, 2, 6],
  ["tomato", "Tomato", "vegetable", "vegan", [], 100, "g", "medium", 18, 0.9, 3.9, 0.2, 0.5, 0.5, 3, 7],
  ["cucumber", "Cucumber Salad", "vegetable", "vegan", [], 150, "g", "bowl", 23, 1.0, 5.4, 0.2, 0.5, 1, 2, 9],
  ["broccoli", "Broccoli", "vegetable", "vegan", [], 150, "g", "katori", 51, 4.2, 10.0, 0.5, 0.5, 0.5, 2, 5],
  ["tinda", "Tinda / Parwal", "vegetable", "vegan", [], 150, "g", "katori", 30, 1.4, 6.2, 0.2, 0.5, 0.5, 2, 5],
  ["baingan", "Baingan (Brinjal)", "vegetable", "vegan", [], 150, "g", "katori", 37, 1.5, 8.7, 0.3, 0.5, 0.5, 2, 6],
  ["mixed_sabzi", "Mixed Veg Sabzi", "vegetable", "vegan", [], 150, "g", "katori", 110, 3.0, 12.0, 6.0, 0.5, 0.5, 2, 9, true],

  // ── FRUITS ───────────────────────────────────────────────────────────────
  ["apple", "Apple", "fruit", "vegan", [], 1, "piece", "medium", 94, 0.5, 25.0, 0.3, 0.5, 0.5, 2, 9],
  ["banana", "Banana", "fruit", "vegan", [], 1, "piece", "medium", 105, 1.3, 27.0, 0.4, 0.5, 0.5, 2, 9],
  ["papaya", "Papaya", "fruit", "vegan", [], 150, "g", "katori", 65, 0.7, 16.0, 0.4, 0.5, 0.5, 2, 8],
  ["guava", "Guava", "fruit", "vegan", [], 1, "piece", "medium", 68, 2.6, 14.3, 1.0, 1, 1, 2, 8],
  ["orange", "Orange", "fruit", "vegan", [], 1, "piece", "medium", 62, 1.2, 15.4, 0.2, 1, 1, 2, 7],
  ["watermelon", "Watermelon", "fruit", "vegan", [], 200, "g", "bowl", 60, 1.2, 15.0, 0.3, 0.5, 0.5, 2, 6],
  ["pomegranate", "Pomegranate", "fruit", "vegan", [], 100, "g", "half katori", 83, 1.7, 18.7, 1.2, 0.5, 0.5, 2, 6],
  ["mango", "Mango", "fruit", "vegan", [], 1, "piece", "small", 90, 0.8, 22.5, 0.4, 0.5, 0.5, 1.5, 5],
  ["berries", "Mixed Berries", "fruit", "vegan", [], 100, "g", "half katori", 45, 0.9, 10.0, 0.4, 0.5, 0.5, 2, 4],
  ["pear", "Pear", "fruit", "vegan", [], 1, "piece", "medium", 101, 0.6, 27.0, 0.2, 0.5, 0.5, 2, 5],

  // ── NUTS / SEEDS ─────────────────────────────────────────────────────────
  ["almonds", "Almonds", "nut_seed", "vegan", ["nut"], 12, "g", "10 pieces", 69, 2.5, 2.4, 6.0, 0.5, 0.5, 3.5, 9],
  ["walnuts", "Walnuts", "nut_seed", "vegan", ["nut"], 10, "g", "4 halves", 65, 1.5, 1.4, 6.5, 0.5, 0.5, 2, 8],
  ["peanuts", "Roasted Peanuts", "nut_seed", "vegan", ["nut"], 20, "g", "muthi", 113, 5.2, 3.2, 9.4, 0.5, 0.5, 3, 8],
  ["peanut_butter", "Peanut Butter", "nut_seed", "vegan", ["nut"], 15, "g", "tbsp", 94, 4.0, 3.0, 8.0, 0.5, 0.5, 3, 7],
  ["chia", "Chia Seeds", "nut_seed", "vegan", [], 10, "g", "tbsp", 49, 1.7, 4.2, 3.1, 0.5, 0.5, 2, 6],
  ["flax", "Ground Flaxseed", "nut_seed", "vegan", [], 10, "g", "tbsp", 53, 1.8, 2.9, 4.2, 0.5, 0.5, 2, 6],
  ["pumpkin_seeds", "Pumpkin Seeds", "nut_seed", "vegan", [], 15, "g", "tbsp", 84, 4.4, 1.6, 7.2, 0.5, 0.5, 2, 5],
  ["cashew", "Cashews", "nut_seed", "vegan", ["nut"], 10, "g", "6 pieces", 55, 1.8, 3.0, 4.4, 0.5, 0.5, 2, 4],

  // ── FATS / OILS ──────────────────────────────────────────────────────────
  ["oil_mustard", "Mustard Oil", "fat", "vegan", [], 5, "ml", "tsp", 45, 0.0, 0.0, 5.0, 0.5, 0.5, 4, 8],
  ["ghee", "Desi Ghee", "fat", "vegetarian", ["dairy"], 5, "ml", "tsp", 45, 0.0, 0.0, 5.0, 0.5, 0.5, 3, 8],
  ["oil_olive", "Olive Oil", "fat", "vegan", [], 5, "ml", "tsp", 45, 0.0, 0.0, 5.0, 0.5, 0.5, 3, 6],
  ["oil_coconut", "Coconut Oil", "fat", "vegan", [], 5, "ml", "tsp", 45, 0.0, 0.0, 5.0, 0.5, 0.5, 3, 4],

  // ── BEVERAGES ────────────────────────────────────────────────────────────
  ["black_coffee", "Black Coffee (no sugar)", "beverage", "vegan", [], 200, "ml", "cup", 2, 0.3, 0.0, 0.0, 1, 1, 3, 8],
  ["green_tea", "Green Tea", "beverage", "vegan", [], 200, "ml", "cup", 1, 0.0, 0.2, 0.0, 1, 1, 4, 8],
  ["chai_toned", "Masala Chai (no sugar)", "beverage", "vegetarian", ["dairy"], 150, "ml", "cup", 60, 2.0, 7.0, 2.0, 1, 1, 2, 7],
  ["lemon_water", "Lemon Water", "beverage", "vegan", [], 250, "ml", "glass", 6, 0.1, 1.8, 0.0, 1, 1, 3, 9],
  ["coconut_water", "Coconut Water", "beverage", "vegan", [], 200, "ml", "glass", 38, 0.5, 7.0, 0.4, 1, 1, 2, 6],

  // ── SNACKS ───────────────────────────────────────────────────────────────
  ["roasted_chana", "Roasted Chana", "snack", "vegan", [], 30, "g", "muthi", 111, 6.3, 17.0, 1.4, 0.5, 0.5, 3, 9],
  ["makhana", "Roasted Makhana", "snack", "vegan", [], 20, "g", "bowl", 70, 2.0, 16.0, 0.1, 0.5, 0.5, 2, 8],
  ["khakhra", "Khakhra", "snack", "vegan", ["gluten"], 1, "piece", "khakhra", 60, 2.0, 9.0, 1.8, 1, 1, 3, 6],
  ["dhokla", "Dhokla", "snack", "vegetarian", [], 80, "g", "2 pieces", 130, 5.0, 18.0, 4.0, 0.5, 0.5, 2, 6],
  ["sprouts_chaat", "Sprouts Chaat", "snack", "vegan", [], 150, "g", "bowl", 140, 9.0, 22.0, 1.5, 0.5, 0.5, 1.5, 7],
];

/** A protein source must supply this much per reference serving to count. */
const MIN_PROTEIN_G_FOR_ROLE = 5.5;
/** A carb staple must be this calorie-dense per serving to anchor a meal. */
const MIN_KCAL_FOR_CARB_ROLE = 55;

/**
 * Roles are DERIVED from category and macro content rather than hand-listed, so
 * they cannot drift out of sync with the numbers above.
 *
 * Both thresholds here are load-bearing, and each fixes a real failure:
 *
 *  - Macro SHARE alone is not enough to be a carb staple. Coconut water takes
 *    74% of its 38 kcal from carbs, and by share alone it qualified as the
 *    "carb" for a 667 kcal lunch — leaving the slot with no calorie carrier at
 *    all, so no amount of portion scaling could reach the target. A staple must
 *    clear an absolute calorie bar, and must be a grain, legume or snack.
 *  - Protein share alone made cooked spinach (50% of its 35 kcal from protein) a
 *    protein source. An absolute gram floor keeps vegetables out of that role.
 */
function deriveRoles(row: Row): FoodRole[] {
  const [, , category, , , , , , kcal, protein] = row;
  const roles = new Set<FoodRole>();
  const proteinShare = (protein * 4) / Math.max(kcal, 1);

  if (["meat", "fish", "egg", "plant_protein", "supplement", "dairy"].includes(category)) {
    roles.add("protein");
  }
  if (proteinShare >= 0.25 && protein >= MIN_PROTEIN_G_FOR_ROLE) {
    roles.add("protein");
  }

  // Only real staples anchor a meal's calories.
  if (
    ["grain", "legume", "snack"].includes(category) &&
    kcal >= MIN_KCAL_FOR_CARB_ROLE
  ) {
    roles.add("carb");
  }

  // Dal carries both jobs in an Indian thali.
  if (category === "legume") roles.add("protein");

  if (category === "vegetable") roles.add("veg");
  if (category === "fruit") roles.add("fruit");
  if (category === "fat" || category === "nut_seed") roles.add("fat");
  if (category === "beverage") roles.add("drink");
  if (category === "snack") roles.add("snack");

  return [...roles];
}

function toFood(row: Row): Food {
  const [
    id,
    name,
    category,
    diet,
    allergens,
    baseQty,
    unit,
    measure,
    kcal,
    protein,
    carbs,
    fat,
    step,
    min,
    max,
    rank,
    includesCookingFat,
  ] = row;

  return {
    id,
    name,
    category,
    diet,
    allergens,
    roles: deriveRoles(row),
    base: { qty: baseQty, unit, measure },
    kcal,
    protein,
    carbs,
    fat,
    step,
    min,
    max,
    rank,
    includesCookingFat,
  };
}

export const FOODS: readonly Food[] = Object.freeze(ROWS.map(toFood));

export const FOOD_BY_ID: ReadonlyMap<string, Food> = new Map(FOODS.map((f) => [f.id, f]));

/** Allergen tags that actually appear in the library, for building the UI. */
export const ALLERGEN_OPTIONS: readonly { tag: AllergenTag; label: string }[] = [
  { tag: "dairy", label: "Dairy / milk" },
  { tag: "gluten", label: "Gluten / wheat" },
  { tag: "nut", label: "Nuts" },
  { tag: "soy", label: "Soy" },
  { tag: "egg", label: "Egg" },
  { tag: "fish", label: "Fish" },
  { tag: "shellfish", label: "Shellfish" },
];

/**
 * Measures describing the FORM of a food rather than a countable container.
 * These read best weight-first — "50 g cubes", not "½ cubes (50 g)".
 */
const FORM_MEASURES = new Set(["cubes", "block", "raw", "tin drained"]);

/** Nouns that take an English plural. Katori/roti/idli stay invariant. */
const PLURALISABLE = new Set([
  "cup",
  "glass",
  "bowl",
  "slice",
  "scoop",
  "piece",
  "half",
  "dosa",
  "egg",
  "white",
  "khakhra",
  "serving",
  "tin",
  "medium",
]);

const SINGULARISE: Record<string, string> = {
  halves: "half",
  pieces: "piece",
  cups: "cup",
  slices: "slice",
  glasses: "glass",
  bowls: "bowl",
  scoops: "scoop",
  servings: "serving",
};

function inflect(noun: string, count: number): string {
  // Multi-word measures ("katori cooked") are left alone — pluralising the
  // wrong token produces "katori cookeds".
  if (noun.includes(" ")) return noun;

  // Anything above exactly one takes the plural: "1½ cups", not "1½ cup".
  if (count <= 1) return SINGULARISE[noun] ?? noun;

  const base = SINGULARISE[noun] ?? noun;
  if (!PLURALISABLE.has(base)) return noun;
  if (base.endsWith("s")) return base;
  return base === "half" ? "halves" : `${base}s`;
}

/**
 * Renders a scaled household measure — "2 roti", "1½ katori", "3 tsp". The
 * fraction glyphs matter: "1.5 katori" reads like a lab instruction.
 *
 * Three distinct shapes, because one rule cannot cover them all:
 *
 *  1. The measure already embeds its own count ("4 halves", "10 pieces",
 *     "half katori"). Scaling the multiplier onto the label would produce
 *     "½ 4 halves", so the embedded number is scaled instead → "2 halves".
 *  2. The measure describes a form rather than a container ("cubes", "raw").
 *     "½ cubes (50 g)" is nonsense; "50 g cubes" is what a person reads.
 *  3. Everything else is a countable container → "1½ katori (225 g)".
 */
export function formatPortion(food: Food, multiplier: number): string {
  const measure = food.base.measure;
  const totalQty = food.base.qty * multiplier;
  const unit = food.base.unit;

  // 1. Embedded count, including the word "half".
  const embedded = measure.match(/^(\d+(?:\.\d+)?|half)\s+(.+)$/);
  if (embedded) {
    const baseCount = embedded[1] === "half" ? 0.5 : Number(embedded[1]);
    const scaled = baseCount * multiplier;
    const label = `${formatCount(scaled)} ${inflect(embedded[2], scaled)}`;
    return unit === "piece" ? label : `${label} (${Math.round(totalQty)} ${unit})`;
  }

  // 2. Form measures read weight-first.
  if (FORM_MEASURES.has(measure)) {
    return `${Math.round(totalQty)} ${unit} ${measure}`;
  }

  // 3. Countable containers and per-piece foods.
  if (unit === "piece") {
    return `${formatCount(totalQty)} ${inflect(measure, totalQty)}`;
  }

  return `${formatCount(multiplier)} ${inflect(measure, multiplier)} (${Math.round(totalQty)} ${unit})`;
}

/**
 * Vulgar fractions in eighths and thirds.
 *
 * Eighths are needed because a food whose measure is already a half ("half
 * katori") scaled by a 0.75 step lands on 0.375 — which previously rendered as
 * "0.38 katori", i.e. exactly the lab-instruction look the glyphs exist to
 * avoid. Anything that still misses every glyph falls back to the nearest
 * eighth rather than a raw decimal; the gram figure beside it stays exact.
 */
const FRACTION_GLYPHS: readonly [number, string][] = [
  [0.125, "⅛"],
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.375, "⅜"],
  [0.5, "½"],
  [0.625, "⅝"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
  [0.875, "⅞"],
];

function formatCount(n: number): string {
  let whole = Math.floor(n + 1e-9);
  const frac = n - whole;

  let glyph = "";
  if (frac > 0.02) {
    let best = FRACTION_GLYPHS[0];
    let bestDelta = Infinity;
    for (const candidate of FRACTION_GLYPHS) {
      const delta = Math.abs(frac - candidate[0]);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }
    // Closer to the next whole number than to any fraction.
    if (1 - frac < bestDelta) {
      whole += 1;
    } else {
      glyph = best[1];
    }
  }

  if (whole === 0) return glyph || "0";
  return glyph ? `${whole}${glyph}` : String(whole);
}
