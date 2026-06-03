import { addIngredient, fetchIngredients, requestRecommend } from "./api.js";
import {
  appendChatMessage,
  renderIngredientList,
  renderRecipeCards,
} from "./ui.js";

const form = document.getElementById("ingredient-form");
const input = document.getElementById("ingredient-input");
const listEl = document.getElementById("ingredient-list");
const recommendBtn = document.getElementById("recommend-btn");
const cardsEl = document.getElementById("recipe-cards");
const chatEl = document.getElementById("chat-messages");

async function loadIngredients() {
  const { ingredients } = await fetchIngredients();
  renderIngredientList(listEl, ingredients);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = input.value.trim();
  if (!name) return;
  try {
    const { ingredients } = await addIngredient(name);
    renderIngredientList(listEl, ingredients);
    input.value = "";
  } catch (err) {
    alert(err.message);
  }
});

recommendBtn.addEventListener("click", async () => {
  recommendBtn.disabled = true;
  try {
    appendChatMessage(chatEl, "user", "지금 재료로 만들 수 있는 요리 추천해줘!");
    const data = await requestRecommend();
    renderRecipeCards(cardsEl, data.recipes);
    appendChatMessage(chatEl, "assistant", data.chat_reply || "추천이 완료되었습니다.");
  } catch (err) {
    appendChatMessage(chatEl, "assistant", err.message);
  } finally {
    recommendBtn.disabled = false;
  }
});

loadIngredients().catch(console.error);
