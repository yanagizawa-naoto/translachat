#!/usr/bin/env python3
"""TranslaChat Translation API - Flask REST wrapper for TranslateGemma GGUF model."""

import threading
import time

from flask import Flask, jsonify, request
from llama_cpp import Llama

MODEL_PATH = "/home/naoto/models/translategemma-12b-it-q4_k_m.gguf"

app = Flask(__name__)
llm = None
llm_lock = threading.Lock()


def load_model():
    global llm
    print(f"Loading model from {MODEL_PATH}...")
    start = time.time()
    llm = Llama(
        model_path=MODEL_PATH,
        n_gpu_layers=-1,
        n_ctx=2048,
        verbose=False,
    )
    elapsed = time.time() - start
    print(f"Model loaded in {elapsed:.1f}s")


def translate(source_lang, target_lang, text):
    prompt = (
        f"<start_of_turn>user\n"
        f"type:text,source_lang_code:{source_lang},target_lang_code:{target_lang},text:{text}<end_of_turn>\n"
        f"<start_of_turn>model\n"
        f"type:text,source_lang_code:{source_lang},target_lang_code:{target_lang},text:"
    )

    with llm_lock:
        output = llm(
            prompt,
            max_tokens=512,
            temperature=0.0,
            stop=["<end_of_turn>", "<eos>"],
            echo=False,
        )

    result = output["choices"][0]["text"].strip()
    return result


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "translategemma-12b-it-q4_k_m"})


@app.route("/translate", methods=["POST"])
def translate_endpoint():
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    text = data.get("text", "").strip()
    source_lang = data.get("source_lang", "")
    target_lang = data.get("target_lang", "")

    if not text or not source_lang or not target_lang:
        return jsonify({"error": "text, source_lang, target_lang required"}), 400

    if source_lang == target_lang:
        return jsonify({"translated_text": text})

    try:
        start = time.time()
        translated = translate(source_lang, target_lang, text)
        elapsed = time.time() - start
        return jsonify({
            "translated_text": translated,
            "elapsed": round(elapsed, 3),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    load_model()
    app.run(host="0.0.0.0", port=5050, threaded=True)
