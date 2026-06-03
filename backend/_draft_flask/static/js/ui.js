export function renderIngredientList(container, ingredients) {
  container.innerHTML = ingredients
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join("");
}

export function renderRecipeCards(container, recipes = []) {
  if (!recipes.length) {
    container.innerHTML = '<p class="empty">추천 버튼을 눌러 레시피를 받아보세요.</p>';
    return;
  }
  container.innerHTML = recipes
    .map(
      (r) => `
      <article class="recipe-card">
        <h3>${escapeHtml(r.title || "레시피")}</h3>
        <p>${escapeHtml(r.description || r.summary || "")}</p>
      </article>
    `
    )
    .join("");
}

export function appendChatMessage(container, role, text) {
  const el = document.createElement("div");
  el.className = `chat-bubble chat-bubble--${role}`;
  el.textContent = text;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
