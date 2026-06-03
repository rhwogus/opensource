const API_BASE = "/api";

export async function fetchIngredients() {
  const res = await fetch(`${API_BASE}/ingredients`);
  if (!res.ok) throw new Error("재료 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function addIngredient(name) {
  const res = await fetch(`${API_BASE}/ingredients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "재료 추가에 실패했습니다.");
  }
  return res.json();
}

export async function requestRecommend() {
  const res = await fetch(`${API_BASE}/recommend`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "추천 요청에 실패했습니다.");
  }
  return res.json();
}
