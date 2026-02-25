/* ============================================
   CHAPTER 6: LINKS & FRAMES IN HTML
   Interactive Learning Website — script.js
   All logic: navigation, quiz, confetti, stars
============================================ */

// ===== STATE =====
let completedPages = new Set();
let totalStars = 0;
let quizScore = 0;
let currentQuestion = 0;
let quizAnswered = false;
const TOTAL_PAGES = 6; // concept pages

// ===== PAGE NAVIGATION =====
function goTo(pageId) {

  // wait until DOM is ready
  setTimeout(() => {

    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));

    const target = document.getElementById(pageId);

    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      console.warn("Page not found:", pageId);
    }

  }, 10);
}

function completeAndGo(fromId, toId) {
  if (!completedPages.has(fromId)) {
    completedPages.add(fromId);
    addStars(2);
    showMotivation();
  }
  updateProgress();
  goTo(toId);
}

// ===== PROGRESS =====
function updateProgress() {
  const pct = Math.round((completedPages.size / TOTAL_PAGES) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = pct + '% Complete';
  // Update teacher report
  document.getElementById('report-concepts').textContent = completedPages.size + '/' + TOTAL_PAGES;
}

// ===== STARS =====
function addStars(n) {
  totalStars += n;
  document.getElementById('star-count').textContent = totalStars;
  document.getElementById('report-stars').textContent = totalStars + ' ⭐';
  animateStars();
}

function animateStars() {
  const el = document.getElementById('stars-display');
  el.style.transform = 'scale(1.4)';
  el.style.background = 'linear-gradient(135deg, #ff6b6b, #ffd700)';
  setTimeout(() => {
    el.style.transform = 'scale(1)';
    el.style.background = 'linear-gradient(135deg, #ffd700, #ffb700)';
  }, 400);
}

// ===== MOTIVATIONAL MESSAGES =====
const motivations = [
  '🎉 Awesome! Keep going!',
  '⭐ You\'re a superstar!',
  '🚀 Rocketing through!',
  '💪 Crushing it!',
  '🌟 You\'re amazing!',
  '🔥 On fire today!'
];

function showMotivation() {
  const msg = motivations[Math.floor(Math.random() * motivations.length)];
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.cssText = `
    position:fixed; top:60px; left:50%; transform:translateX(-50%);
    background:linear-gradient(135deg,#7c3aed,#ec4899);
    color:white; padding:12px 28px; border-radius:50px;
    font-family:'Nunito',sans-serif; font-weight:800; font-size:16px;
    z-index:9998; box-shadow:0 4px 20px rgba(0,0,0,0.2);
    animation: popIn 0.4s ease, fadeOut 0.5s ease 2s forwards;
  `;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

// ===== ANCHOR TAG DEMO =====
function updateAnchorDemo() {
  const text = document.getElementById('link-text-input').value || 'Click Me!';
  const url = document.getElementById('link-url-input').value || '#';
  document.getElementById('anchor-demo-code').textContent =
    `<A href="${url}">${text}</A>`;
}

// ===== BRAIN DEVELOPER: SELECT OPTION =====
function selectOption(el, result) {
  // Highlight selected
  el.classList.add(result === 'correct' ? 'selected-correct' : 'selected-wrong');
  if (result === 'correct') addStars(1);
}

// ===== REVEAL ANSWER =====
function revealAnswer(btn) {
  const reveal = btn.previousElementSibling;
  if (reveal.classList.contains('hidden')) {
    reveal.classList.remove('hidden');
    btn.textContent = '✅ Got it!';
    btn.style.background = 'var(--green-light)';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
  } else {
    reveal.classList.add('hidden');
    btn.textContent = '💡 Show Explanation';
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

// ===== FILL IN BLANKS CHECK =====
function checkFill(input) {
  const answer = input.dataset.answer.toLowerCase();
  const val = input.value.trim().toLowerCase();
  if (val === answer) {
    input.classList.remove('wrong');
    input.classList.add('correct');
    addStars(1);
  } else if (val.length > 0) {
    input.classList.remove('correct');
    if (val.length >= answer.length - 1) {
      input.classList.add('wrong');
    }
  } else {
    input.classList.remove('correct', 'wrong');
  }
}

// ===== TRUE/FALSE =====
function checkTF(btn, chosen) {
  const q = btn.closest('.tf-q');
  const reveal = q.querySelector('.tf-reveal');
  const revealText = reveal.textContent;
  const correctAnswer = revealText.includes('TRUE') ? 'T' : 'F';
  
  q.querySelectorAll('.tf-btn').forEach(b => {
    b.disabled = true;
    b.style.opacity = '0.6';
  });
  
  if (chosen === correctAnswer) {
    btn.classList.add('correct');
    addStars(1);
  } else {
    btn.classList.add('wrong');
    // Highlight correct
    q.querySelectorAll('.tf-btn').forEach(b => {
      if ((b.textContent === 'T' && correctAnswer === 'T') ||
          (b.textContent === 'F' && correctAnswer === 'F')) {
        b.classList.add('correct');
      }
    });
  }
  reveal.classList.remove('hidden');
}

// ===== LONG ANSWER TOGGLE =====
function toggleLA(header) {
  const answer = header.nextElementSibling;
  const toggle = header.querySelector('.la-toggle');
  if (answer.classList.contains('hidden')) {
    answer.classList.remove('hidden');
    toggle.style.transform = 'rotate(180deg)';
  } else {
    answer.classList.add('hidden');
    toggle.style.transform = 'rotate(0)';
  }
}

// ===== FLASHCARD FLIP =====
function flipCard(card) {
  card.classList.toggle('flipped');
}

// =====================
//   QUIZ LOGIC
// =====================
const questions = [
  {
    q: "What is the HTML tag used to create a hyperlink?",
    options: ["&lt;LINK&gt;", "&lt;A&gt;", "&lt;HREF&gt;", "&lt;URL&gt;"],
    answer: 1,
    explanation: "The Anchor tag &lt;A&gt; is used to create hyperlinks. Syntax: &lt;A href='url'&gt;Text&lt;/A&gt;"
  },
  {
    q: "Which CSS pseudo-class applies when a user moves the mouse over a link?",
    options: ["A:link", "A:visited", "A:hover", "A:active"],
    answer: 2,
    explanation: "A:hover applies styles when the mouse pointer is hovering over the link."
  },
  {
    q: "What attribute of the &lt;A&gt; tag defines the destination URL?",
    options: ["src", "link", "href", "url"],
    answer: 2,
    explanation: "The 'href' (Hypertext Reference) attribute defines where the link goes."
  },
  {
    q: "Which of the following is a correct audio file format for HTML?",
    options: [".mp4", ".avi", ".mp3", ".wmv"],
    answer: 2,
    explanation: "The &lt;AUDIO&gt; tag supports .mp3, .ogg, and .wav formats."
  },
  {
    q: "What tag is used to embed another HTML page inside a web page?",
    options: ["&lt;FRAME&gt;", "&lt;EMBED&gt;", "&lt;iFrame&gt;", "&lt;INCLUDE&gt;"],
    answer: 2,
    explanation: "The &lt;iFRAME&gt; (Inline Frame) tag embeds another HTML document inside the current page."
  },
  {
    q: "When a link on one page connects to another section on THE SAME PAGE, it is called:",
    options: ["External linking", "Absolute linking", "Internal linking", "Anchor linking"],
    answer: 2,
    explanation: "Internal linking connects to a different section on the SAME page."
  },
  {
    q: "Which attribute of &lt;iFrame&gt; specifies the document to display?",
    options: ["href", "link", "url", "src"],
    answer: 3,
    explanation: "The 'src' attribute specifies the path of the document shown in the inline frame."
  },
  {
    q: "Which CSS link state applies to a link the user has ALREADY VISITED?",
    options: ["A:link", "A:hover", "A:visited", "A:active"],
    answer: 2,
    explanation: "A:visited applies styles to links that the user has previously clicked."
  },
  {
    q: "Which video format is supported by the HTML &lt;VIDEO&gt; tag?",
    options: [".avi", ".wmv", ".flv", ".mp4"],
    answer: 3,
    explanation: "The &lt;VIDEO&gt; tag supports .mp4, .webm, and .ogg formats."
  },
  {
    q: "What does the 'autoplay' attribute do in &lt;AUDIO&gt; and &lt;VIDEO&gt; tags?",
    options: [
      "Shows controls on screen",
      "Plays the file automatically when page loads",
      "Loops the file endlessly",
      "Pauses the file"
    ],
    answer: 1,
    explanation: "'autoplay' makes the audio or video file start playing automatically when the web page loads."
  }
];

function renderQuestion() {
  const container = document.getElementById('quiz-question-box');
  const feedback = document.getElementById('quiz-feedback');
  const nextBtn = document.getElementById('quiz-next-btn');
  const result = document.getElementById('quiz-result');

  container.classList.remove('hidden');
  feedback.classList.add('hidden');
  nextBtn.classList.add('hidden');
  result.classList.add('hidden');
  quizAnswered = false;

  document.getElementById('quiz-progress-text').textContent =
    `Question ${currentQuestion + 1} of ${questions.length}`;

  const q = questions[currentQuestion];
  let html = `<div class="qtext">Q${currentQuestion + 1}. ${q.q}</div>`;
  html += `<div class="quiz-options">`;
  q.options.forEach((opt, i) => {
    html += `<button class="quiz-option" onclick="answerQuestion(${i})">${String.fromCharCode(65+i)}. ${opt}</button>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function answerQuestion(chosen) {
  if (quizAnswered) return;
  quizAnswered = true;

  const q = questions[currentQuestion];
  const opts = document.querySelectorAll('.quiz-option');
  opts.forEach((opt, i) => {
    opt.disabled = true;
    if (i === q.answer) opt.classList.add('correct');
    else if (i === chosen) opt.classList.add('wrong');
  });

  const feedback = document.getElementById('quiz-feedback');
  feedback.classList.remove('hidden');

  if (chosen === q.answer) {
    quizScore++;
    document.getElementById('quiz-score').textContent = quizScore;
    feedback.innerHTML = `✅ <strong>Correct!</strong> ${q.explanation}`;
    feedback.style.borderLeft = '4px solid var(--green)';
    feedback.style.background = '#f0fdf4';
    addStars(1);
  } else {
    feedback.innerHTML = `❌ <strong>Not quite!</strong> ${q.explanation}`;
    feedback.style.borderLeft = '4px solid var(--red)';
    feedback.style.background = '#fef2f2';
  }

  const nextBtn = document.getElementById('quiz-next-btn');
  nextBtn.classList.remove('hidden');
  if (currentQuestion === questions.length - 1) {
    nextBtn.textContent = '🎉 See Results!';
  } else {
    nextBtn.textContent = 'Next Question →';
  }
}

function nextQuestion() {
  currentQuestion++;
  if (currentQuestion >= questions.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

function showResults() {
  document.getElementById('quiz-question-box').classList.add('hidden');
  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('quiz-next-btn').classList.add('hidden');
  document.getElementById('quiz-result').classList.remove('hidden');

  const pct = Math.round((quizScore / questions.length) * 100);
  let title, msg, stars;

  if (pct >= 90) {
    title = '🏆 Outstanding!';
    msg = `You scored ${quizScore}/${questions.length}! You're a HTML champion!`;
    stars = '⭐⭐⭐⭐⭐';
    addStars(10);
    launchConfetti();
  } else if (pct >= 70) {
    title = '🌟 Great Job!';
    msg = `You scored ${quizScore}/${questions.length}! Almost perfect!`;
    stars = '⭐⭐⭐⭐';
    addStars(6);
    launchConfetti();
  } else if (pct >= 50) {
    title = '👍 Good Effort!';
    msg = `You scored ${quizScore}/${questions.length}. Review the concepts and try again!`;
    stars = '⭐⭐⭐';
    addStars(3);
  } else {
    title = '💪 Keep Practicing!';
    msg = `You scored ${quizScore}/${questions.length}. Go back and review — you've got this!`;
    stars = '⭐';
    addStars(1);
  }

  document.getElementById('result-title').textContent = title;
  document.getElementById('result-msg').textContent = msg;
  document.getElementById('result-stars').textContent = stars;
  document.getElementById('report-quiz').textContent = `${quizScore}/${questions.length} (${pct}%)`;
}

function restartQuiz() {
  quizScore = 0;
  currentQuestion = 0;
  quizAnswered = false;
  document.getElementById('quiz-score').textContent = '0';
  document.getElementById('quiz-result').classList.add('hidden');
  renderQuestion();
}

// =====================
//   CONFETTI ANIMATION
// =====================
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#7c3aed','#ec4899','#f59e0b','#10b981','#3b82f6','#f97316'];
  const particles = [];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20,
      r: Math.random() * 8 + 4,
      d: Math.random() * 3 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 20 - 10,
      tiltAngle: 0,
      tiltAngleInc: Math.random() * 0.07 + 0.05,
      shape: Math.random() > 0.5 ? 'circle' : 'rect'
    });
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.shape === 'circle') {
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tiltAngle);
        ctx.fillRect(-p.r, -p.r * 2, p.r * 2, p.r * 4);
        ctx.restore();
      }
      ctx.fill();
    });

    particles.forEach(p => {
      p.y += p.d;
      p.x += Math.sin(frame * 0.01 + p.tiltAngle) * 2;
      p.tiltAngle += p.tiltAngleInc;
    });

    frame++;
    if (frame < 180) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  draw();
}

// =====================
//   POPUP ANIMATION
// =====================
const style = document.createElement('style');
style.textContent = `
  @keyframes popIn {
    0% { transform: translateX(-50%) scale(0.5); opacity:0; }
    100% { transform: translateX(-50%) scale(1); opacity:1; }
  }
  @keyframes fadeOut {
    to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  }
`;
document.head.appendChild(style);

// =====================
//   INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  renderQuestion();
  updateProgress();
   goTo('page-home');

  // Make flashcards accessible via keyboard
  document.querySelectorAll('.flashcard').forEach(card => {
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') flipCard(card);
    });
    card.style.position = 'relative';
  });

  // Make long answer collapse keyboard accessible
  document.querySelectorAll('.la-q').forEach(q => {
    q.setAttribute('tabindex', '0');
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') toggleLA(q);
    });
  });

  // Auto-update anchor demo
  updateAnchorDemo();
});
