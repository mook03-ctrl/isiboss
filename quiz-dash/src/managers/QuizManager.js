window.QuizManager = class QuizManager {
  constructor(chapter) {
    this.used = new Set();
    this.decks = {};
    this.setChapter(chapter || 1);
  }

  setChapter(chapter) {
    this.chapter = chapter;
    this.tier = Math.floor((chapter - 1) / 3) + 1;
    this.used.clear();
    const extra = ["math", "english", "trivia"];
    this.gateSubjects = shuffle(["math", "english", "trivia", extra[rand(0, 2)], extra[rand(0, 2)]]);
    this.subject = { id: "mix", ko: "퀴즈", en: "QUIZ" };
  }

  meta() {
    return {
      chapter: this.chapter,
      tier: this.tier,
      subject: "수학 · 영어 · 상식",
      subjectEn: "QUIZ",
    };
  }

  next() {
    const id = this.gateSubjects.length ? this.gateSubjects.pop() : ["math", "english", "trivia"][rand(0, 2)];
    this.subject = SUBJECTS[id];
    for (let i = 0; i < 12; i += 1) {
      const made = id === "math" ? this.math() : id === "english" ? this.english() : this.trivia();
      const key = made.prompt + "|" + made.correct;
      if (this.used.has(key)) continue;
      this.used.add(key);
      return this.pack(made);
    }
    this.used.clear();
    const fallback = id === "math" ? this.math() : id === "english" ? this.english() : this.trivia();
    return this.pack(fallback);
  }

  pack(made) {
    const flip = Math.random() < 0.5;
    return {
      prompt: made.prompt,
      A: flip ? made.wrong : made.correct,
      B: flip ? made.correct : made.wrong,
      answer: flip ? "B" : "A",
      chapter: this.chapter,
      subject: this.subject.ko,
      subjectEn: this.subject.en,
    };
  }

  draw(key, list) {
    const deck = this.decks[key];
    if (!deck || !deck.length) this.decks[key] = shuffle(list.slice());
    return this.decks[key].pop();
  }

  math() {
    const made = mulDivProblem(this.tier);
    return { prompt: made.prompt, correct: String(made.answer), wrong: String(distract(made.answer)) };
  }

  english() {
    const bank = this.tier <= 1 ? EN_T1 : this.tier === 2 ? EN_T2 : EN_T3;
    const word = this.draw("en-" + this.tier, bank);
    let other = bank[rand(0, bank.length - 1)];
    if (other[0] === word[0]) other = bank[(bank.indexOf(word) + 3) % bank.length];
    const ask = EN_ASK[rand(0, EN_ASK.length - 1)];
    return { prompt: ask(word[1]), correct: word[0], wrong: other[0] };
  }

  trivia() {
    const bank = this.tier <= 1 ? TR_T1 : this.tier === 2 ? TR_T2 : TR_T3;
    const row = this.draw("tr-" + this.tier, bank);
    return { prompt: row[0], correct: row[1], wrong: row[2] };
  }
};

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = rand(0, i);
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

function distract(answer) {
  const hops = answer >= 80
    ? [10, -10, 20, -20, 5, -5, 12, -12, 15, -15, 2, -2]
    : [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10];
  for (let i = 0; i < 12; i += 1) {
    const next = answer + hops[rand(0, hops.length - 1)];
    if (next !== answer && next > 0 && next < 200000) return next;
  }
  return answer + 10;
}

const SUBJECTS = {
  math: { id: "math", ko: "수학", en: "MATH" },
  english: { id: "english", ko: "영어", en: "ENGLISH" },
  trivia: { id: "trivia", ko: "상식", en: "TRIVIA" },
};

function tens(tier) {
  if (tier <= 1) return rand(10, 20);
  if (tier === 2) return rand(12, 32);
  return rand(14, 48);
}

function one(tier) {
  if (tier <= 1) return rand(2, 5);
  if (tier === 2) return rand(2, 8);
  return rand(3, 9);
}

function mulDivProblem(tier) {
  return Math.random() < 0.5 ? productForm(tier) : quotientForm(tier);
}

function productForm(tier) {
  const a = tens(tier);
  const b = one(tier);
  const prompt = Math.random() < 0.5 ? a + " × " + b + " = ?" : b + " × " + a + " = ?";
  return { prompt, answer: a * b };
}

function quotientForm(tier) {
  const divisor = one(tier);
  const high = tier <= 1 ? 9 : 12;
  for (let i = 0; i < 24; i += 1) {
    const answer = rand(2, high);
    const dividend = divisor * answer;
    if (dividend >= 10 && dividend <= 99) {
      return { prompt: dividend + " ÷ " + divisor + " = ?", answer: answer };
    }
  }
  return { prompt: "24 ÷ 3 = ?", answer: 8 };
}

const EN_ASK = [
  (gloss) => 'Meaning: "' + gloss + '"',
  (gloss) => 'Which word means "' + gloss + '"?',
  (gloss) => '"' + gloss + '" = ?',
  (gloss) => 'Pick the word: "' + gloss + '"',
];

const EN_T1 = [
  ["Adventure", "an exciting trip"],
  ["Brave", "ready to face danger"],
  ["Celebrate", "to have a happy party"],
  ["Discover", "to find something new"],
  ["Enormous", "very, very big"],
  ["Famous", "known by many people"],
  ["Gentle", "soft and kind"],
  ["Honest", "telling the truth"],
  ["Imagine", "to picture in your mind"],
  ["Journey", "a long trip"],
  ["Kindness", "being nice to others"],
  ["Measure", "to find the size"],
  ["Neighbor", "a person who lives nearby"],
  ["Protect", "to keep someone safe"],
  ["Rescue", "to save from danger"],
  ["Whisper", "to speak very softly"],
];

const EN_T2 = [
  ["Habitat", "the home of an animal"],
  ["Climate", "the usual weather of a place"],
  ["Continent", "a very large area of land"],
  ["Energy", "the power to make things go"],
  ["Fossil", "old remains kept in rock"],
  ["Gravity", "the pull toward Earth"],
  ["Hurricane", "a huge spinning storm"],
  ["Island", "land with water all around"],
  ["Magnet", "metal that pulls iron"],
  ["Mammal", "an animal with fur"],
  ["Orbit", "the path around the sun"],
  ["Planet", "a large world in space"],
  ["Predator", "an animal that hunts"],
  ["Prey", "an animal that is hunted"],
  ["Recycle", "to use something again"],
  ["Volcano", "a mountain that can erupt"],
];

const EN_T3 = [
  ["Compare", "to see how things are alike"],
  ["Describe", "to tell what something is like"],
  ["Predict", "to say what may happen"],
  ["Solution", "the answer to a problem"],
  ["Experiment", "a test you do to learn"],
  ["Evidence", "facts that show what is true"],
  ["Diagram", "a drawing that explains"],
  ["Character", "a person in a story"],
  ["Setting", "where and when a story happens"],
  ["Fiction", "a story that is made up"],
  ["Equator", "the line around Earth's middle"],
  ["Pollution", "harmful dirt in air or water"],
  ["Shelter", "a place that keeps you safe"],
  ["Tradition", "a custom passed down in a family"],
  ["Government", "the group that leads a community"],
  ["Invention", "a new thing someone makes"],
];

const TR_T1 = [
  ["지구에서 가장 큰 바다는?", "태평양", "대서양"],
  ["물의 화학식은?", "H2O", "CO2"],
  ["태양계에서 가장 큰 행성은?", "목성", "토성"],
  ["대한민국의 수도는?", "서울", "부산"],
  ["사람에게 가장 가까운 별은?", "태양", "북극성"],
  ["식물이 광합성에 쓰는 기체는?", "이산화탄소", "산소"],
  ["지구를 도는 위성은?", "달", "화성"],
  ["삼각형 내각의 합은?", "180도", "360도"],
  ["한글을 만든 왕은?", "세종대왕", "태종"],
  ["얼음이 녹으면 생기는 것은?", "물", "수증기"],
  ["가장 단단한 자연 광물은?", "다이아몬드", "금"],
  ["한반도가 있는 대륙은?", "아시아", "유럽"],
];

const TR_T2 = [
  ["임진왜란이 일어난 해는?", "1592년", "1492년"],
  ["훈민정음이 반포된 해는?", "1446년", "1392년"],
  ["모나리자를 그린 화가는?", "다 빈치", "미켈란젤로"],
  ["조선을 건국한 인물은?", "이성계", "이순신"],
  ["3·1 운동의 해는?", "1919년", "1945년"],
  ["광복절은 언제인가?", "8월 15일", "3월 1일"],
  ["만리장성이 있는 나라는?", "중국", "인도"],
  ["자유의 여신상이 있는 도시는?", "뉴욕", "파리"],
  ["고려를 건국한 인물은?", "왕건", "궁예"],
  ["프랑스 대혁명의 해는?", "1789년", "1689년"],
  ["셰익스피어의 나라는?", "영국", "프랑스"],
  ["피라미드로 유명한 나라는?", "이집트", "그리스"],
];

const TR_T3 = [
  ["지구 대기에서 가장 많은 기체는?", "질소", "산소"],
  ["광합성으로 나오는 기체는?", "산소", "질소"],
  ["인체에서 가장 큰 장기는?", "피부", "간"],
  ["빛이 1초에 가는 거리는 대략?", "30만 km", "3만 km"],
  ["원주율의 시작은?", "3.14", "3.41"],
  ["주기율표를 정리한 과학자는?", "멘델레예프", "뉴턴"],
  ["태양이 에너지를 만드는 방식은?", "핵융합", "핵분열"],
  ["세계에서 가장 높은 산은?", "에베레스트", "K2"],
  ["아마존 강이 있는 대륙은?", "남아메리카", "아프리카"],
  ["면역을 맡은 혈액 세포는?", "백혈구", "적혈구"],
  ["뉴턴 제1법칙의 이름은?", "관성의 법칙", "작용·반작용"],
  ["DNA에서 A와 쌍을 이루는 염기는?", "T", "G"],
];
