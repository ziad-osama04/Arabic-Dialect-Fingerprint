"""
LLM Service — Arabic Dialect Text Conversion (OpenRouter API)
============================================================
Uses OpenRouter to access various AI models (like Gemini 2.0 Flash)
to convert Arabic text between dialects.
"""

import os
import json
import logging
import requests

logger = logging.getLogger(__name__)

# API Configuration
OPENROUTER_API_KEY = "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"
# Ordered list of free models to try (fallback chain)
FREE_MODELS = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-4-27b-it:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
]
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Dialect display names — matches classifier codes (EGY, GLF, LEV, MAG)
DIALECT_NAMES = {
    "EGY": "المصرية (Egyptian Arabic)",
    "GLF": "الخليجية (Gulf Arabic)",
    "LEV": "الشامية (Levantine Arabic)",
    "MAG": "المغربية (Maghrebi Arabic)",
    "MSA": "الفصحى (Modern Standard Arabic)",
}

def _build_prompt(text: str, src_dialect: str, tgt_dialect: str) -> str:
    """Build a deterministic Arabic prompt for dialect conversion."""
    src_name = DIALECT_NAMES.get(src_dialect, src_dialect)
    tgt_name = DIALECT_NAMES.get(tgt_dialect, tgt_dialect)

    return (
        f"أنت مترجم محترف ومتخصص في اللهجات العربية الدارجة. "
        f"المطلوب منك تحويل النص التالي من اللهجة {src_name} إلى اللهجة {tgt_name} الدارجة والمحلية المحكية في الشارع، وليس الفصحى! "
        f"استخدم المصطلحات الشعبية والكلمات العامية الخاصة باللهجة {tgt_name} حصراً. "
        f"أعد النص المحوّل فقط بدون أي شرح، بدون مقدمات، وبدون استخدام اللغة العربية الفصحى.\n\n"
        f"النص الأصلي: {text}\n\n"
        f"النص المحوّل إلى {tgt_name} :"
    )


def check_llm_status() -> bool:
    """Check if OpenRouter API is accessible (tries all free models)."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:3000",
        "X-OpenRouter-Title": "Arabic Dialect Fingerprint",
    }
    for model in FREE_MODELS:
        try:
            data = {
                "model": model,
                "messages": [{"role": "user", "content": "Say OK"}],
                "max_tokens": 5
            }
            response = requests.post(OPENROUTER_URL, headers=headers, data=json.dumps(data), timeout=5)
            if response.status_code == 200:
                return True
        except Exception:
            continue
    return False


def translate_dialect(text: str, src_dialect: str, tgt_dialect: str) -> str:
    """
    Convert Arabic text from one dialect to another using OpenRouter.
    """
    if not text or not text.strip():
        return text

    if src_dialect == tgt_dialect:
        return text

    prompt = _build_prompt(text, src_dialect, tgt_dialect)

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:3000",
        "X-OpenRouter-Title": "Arabic Dialect Fingerprint",
        "Content-Type": "application/json"
    }

    last_error = "No models available"

    for model in FREE_MODELS:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "أنت مساعد لغوي متخصص في اللهجات العربية العامية. يجب أن تجيب بالنص المحوّل باللهجة الدارجة فقط، ويمنع منعاً باتاً استخدام الفصحى."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.2
        }

        try:
            print(f"DEBUG: Trying [{model}] for {src_dialect} -> {tgt_dialect}...")
            logger.info(f"Translating using [{model}]: {src_dialect} -> {tgt_dialect}")

            response = requests.post(
                OPENROUTER_URL,
                headers=headers,
                data=json.dumps(payload),
                timeout=12
            )

            print(f"DEBUG: Status {response.status_code} from [{model}]")

            if response.status_code in (429, 404, 402, 403):
                last_error = f"HTTP {response.status_code} from {model}"
                logger.warning(f"Model [{model}] unavailable ({response.status_code}), trying next...")
                continue

            if response.status_code != 200:
                error_data = response.json()
                last_error = error_data.get('error', {}).get('message', f'Error {response.status_code}')
                continue

            data = response.json()
            result = data['choices'][0]['message']['content'].strip()
            result = result.strip("\"'\u201c\u201d\u2018\u2019\u00ab\u00bb").strip()

            logger.info(f"SUCCESS with [{model}]: {result[:50]}...")
            return result

        except Exception as e:
            last_error = str(e)
            logger.warning(f"Model [{model}] threw exception: {e}, trying next...")
            continue

    logger.error(f"All models exhausted. Last error: {last_error}")
    raise RuntimeError(f"All translation models are currently unavailable. Please try again in a moment.")


def dialect_to_msa(text: str, src_dialect: str) -> str:
    """Convert dialectal Arabic text to Modern Standard Arabic (MSA)."""
    return translate_dialect(text, src_dialect, "MSA")
