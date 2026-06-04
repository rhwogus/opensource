"""Compatibility wrapper around the GPT package used by Flask routes."""

from gpt.service import ask_recipe_question, estimate_expiry, is_api_key_configured, recommend_recipes

__all__ = [
    "ask_recipe_question",
    "estimate_expiry",
    "is_api_key_configured",
    "recommend_recipes",
]
