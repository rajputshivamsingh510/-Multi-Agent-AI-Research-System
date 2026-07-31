(function () {
  const form = document.getElementById("research-form");
  const input = document.getElementById("topic-input");
  const submitBtn = document.getElementById("submit-btn");
  const ticker = document.getElementById("status-ticker");
  const tickerText = document.getElementById("ticker-text");
  const errorBox = document.getElementById("error-box");
  const results = document.getElementById("results");
  const reportTopic = document.getElementById("report-topic");
  const reportBody = document.getElementById("report-body");
  const stampScore = document.getElementById("stamp-score");
  const critiqueBody = document.getElementById("critique-body");

  // Case number + date, purely cosmetic dossier detail.
  document.getElementById("case-no").textContent =
    "CASE NO. " + String(Math.floor(100000 + Math.random() * 899999));
  document.getElementById("today-date").textContent = new Date().toLocaleDateString(
    "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );

  const STATUS_MESSAGES = [
    "Assembling the file\u2026",
    "Sending the search agent out\u2026",
    "Reading the strongest lead\u2026",
    "Drafting the report\u2026",
    "Sending it to the reviewer\u2026",
  ];
  let tickerInterval = null;

  function startTicker() {
    let i = 0;
    tickerText.textContent = STATUS_MESSAGES[0];
    ticker.classList.remove("hidden");
    tickerInterval = setInterval(() => {
      i = (i + 1) % STATUS_MESSAGES.length;
      tickerText.textContent = STATUS_MESSAGES[i];
    }, 2600);
  }

  function stopTicker() {
    clearInterval(tickerInterval);
    ticker.classList.add("hidden");
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const KNOWN_HEADERS = /^(introduction|key findings|conclusion|sources)\s*:?$/i;

  // Turns the writer chain's plain/markdown-ish text into structured HTML.
  function renderReport(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let paragraph = [];
    let list = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        html += `<p>${escapeHtml(paragraph.join(" ")).trim()}</p>`;
        paragraph = [];
      }
    };
    const flushList = () => {
      if (list.length) {
        html += `<ul>${list.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`;
        list = [];
      }
    };

    for (let raw of lines) {
      const line = raw.trim();

      if (!line) {
        flushParagraph();
        continue;
      }

      const mdHeader = line.match(/^#{1,3}\s*(.+)$/);
      const boldHeader = line.match(/^\*\*(.+?)\*\*:?$/);

      if (mdHeader || boldHeader || KNOWN_HEADERS.test(line.replace(/\*\*/g, ""))) {
        flushParagraph();
        flushList();
        const label = (mdHeader ? mdHeader[1] : boldHeader ? boldHeader[1] : line).replace(
          /\*\*/g,
          ""
        );
        html += `<h3>${escapeHtml(label.replace(/:$/, ""))}</h3>`;
        continue;
      }

      const bullet = line.match(/^[-*\u2022]\s+(.*)$/);
      if (bullet) {
        flushParagraph();
        list.push(bullet[1]);
        continue;
      }

      flushList();
      paragraph.push(line);
    }
    flushParagraph();
    flushList();
    return html || `<p>${escapeHtml(text)}</p>`;
  }

  // Parses the critic_chain's fixed template into structured pieces.
  function renderCritique(text) {
    const scoreMatch = text.match(/score\s*:?\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
    stampScore.textContent = scoreMatch ? `${scoreMatch[1]}/10` : "\u2013/10";

    const strengthsMatch = text.match(
      /strengths\s*:?\s*([\s\S]*?)(?=areas to improve|one line verdict|$)/i
    );
    const improveMatch = text.match(
      /areas to improve\s*:?\s*([\s\S]*?)(?=one line verdict|$)/i
    );
    const verdictMatch = text.match(/one line verdict\s*:?\s*([\s\S]*)$/i);

    const toItems = (block) =>
      (block || "")
        .split("\n")
        .map((l) => l.trim().replace(/^[-*\u2022]\s*/, ""))
        .filter(Boolean);

    const strengths = toItems(strengthsMatch && strengthsMatch[1]);
    const improvements = toItems(improveMatch && improveMatch[1]);
    const verdict = verdictMatch ? verdictMatch[1].trim() : "";

    let html = "";
    if (strengths.length) {
      html += `<h4>Strengths</h4><ul>${strengths
        .map((s) => `<li>${escapeHtml(s)}</li>`)
        .join("")}</ul>`;
    }
    if (improvements.length) {
      html += `<h4>Areas to improve</h4><ul>${improvements
        .map((s) => `<li>${escapeHtml(s)}</li>`)
        .join("")}</ul>`;
    }
    if (verdict) {
      html += `<div class="verdict">&ldquo;${escapeHtml(verdict)}&rdquo;</div>`;
    }
    if (!html) {
      html = `<p>${escapeHtml(text)}</p>`;
    }
    critiqueBody.innerHTML = html;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = input.value.trim();
    if (!topic) return;

    submitBtn.disabled = true;
    errorBox.classList.add("hidden");
    results.classList.add("hidden");
    startTicker();

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "The desk couldn't close this case.");
      }

      reportTopic.textContent = data.topic;
      reportBody.innerHTML = renderReport(data.report || "");
      renderCritique(data.feedback || "");
      results.classList.remove("hidden");
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      errorBox.textContent = `Case closed without a result: ${err.message}`;
      errorBox.classList.remove("hidden");
    } finally {
      stopTicker();
      submitBtn.disabled = false;
    }
  });
})();
