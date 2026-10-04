"""Meaning-based index for the "How are you feeling?" box (no API key, no server).

Same model and conventions as the Kathamrita site (C:\\Git Projects\\ramakrishna):
Xenova/multilingual-e5-small, quantized ONNX; texts embedded as "passage: …", the visitor's words
in the browser as "query: …"; mean pooling, L2-normalised; stored as int8.

Rows in docs/search/vectors.bin (int8 [N x 384]):
  every song in docs/songs.json order (Bengali title + lyrics; songs without Bengali lyrics get
  their English title), then one row per mood description (MOOD_TEXT order).
docs/search/index.json: {"model", "dim", "scale", "songs": [ids], "has_text": [0/1], "moods": [names]}

Run with the Kathamrita venv (it has onnxruntime + tokenizers):
  wsl -e bash -lc "cd '/mnt/c/Git Projects/rabindrasangeet' && ../ramakrishna/.venv/bin/python scripts/embed_songs.py"
  ... add --eval to print what sample sentences match.
Re-run only when lyrics or the mood descriptions change.
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT.parent / "ramakrishna" / "models" / "multilingual-e5-small"
OUT = ROOT / "docs" / "search"
SCALE = 127.0
MAX_LINES = 12   # the opening of a song carries its feeling; keeps texts within the model's window
MARGIN = 0.015   # moods within this of the best match count too (the site uses the same rule)

# What each mood means, in English and Bengali, so a visitor's own words can be compared with it.
MOOD_TEXT = {
    "prem": "romantic love, being in love, tenderness and union with the beloved. প্রেম, ভালোবাসা, প্রিয়জনের সঙ্গে মিলন, অনুরাগ।",
    "viraha": "longing for someone far away, missing a loved one, waiting, separation, loneliness. বিরহ, দূরে থাকা প্রিয়জনের জন্য মন কেমন, অপেক্ষা, একাকীত্ব।",
    "bishad": "sorrow, grief, sadness, despair, a heavy heart, loss, tears. বিষাদ, দুঃখ, শোক, মন খারাপ, কান্না, হারানোর বেদনা।",
    "ananda": "joy, happiness, delight, exhilaration, feeling wonderful and alive. আনন্দ, খুশি, উল্লাস, প্রাণের আনন্দ।",
    "shanti": "peace, calm, rest, comfort and solace after tiredness or worry. শান্তি, স্থিরতা, বিশ্রাম, ক্লান্তির পরে সান্ত্বনা।",
    "bhakti": "devotion, prayer, surrender to God, faith and the divine. ভক্তি, প্রার্থনা, ঈশ্বরের কাছে আত্মসমর্পণ, বিশ্বাস।",
    "prakriti-bhava": "nature and the seasons: rain, clouds, spring flowers, the sky, wind and moonlight. প্রকৃতি, বর্ষা, মেঘ, বসন্ত, ফুল, আকাশ, হাওয়া, জ্যোৎস্না।",
    "utsav": "celebration, festival, wedding, birthday, a joyful ceremony together. উৎসব, বিয়ে, জন্মদিন, অনুষ্ঠান, সবাই মিলে আনন্দ।",
    "deshprem": "love of the motherland, the nation and its people, patriotism. দেশপ্রেম, স্বদেশ, মাতৃভূমির প্রতি ভালোবাসা।",
    "sahas": "courage, resolve, strength to face fear, walking on alone, awakening. সাহস, দৃঢ়তা, ভয় জয় করা, একলা চলা, জেগে ওঠা।",
    "smriti": "memory and nostalgia, remembering old days, childhood and people of the past. স্মৃতি, পুরানো দিনের কথা, ছেলেবেলা, মনে পড়া।",
    "kautuk": "playful, humorous, teasing, light-hearted fun. কৌতুক, মজা, দুষ্টুমি, হাসি-ঠাট্টা।",
}

EVAL = [
    "missing my mother on a rainy evening",
    "আজ মনটা খুব ভারী, কিছুই ভালো লাগছে না",
    "my heart feels heavy and I can't explain why",
    "I want to thank God for everything I have",
    "feeling restless, need some peace before sleeping",
    "we are celebrating my daughter's wedding",
    "I am scared about tomorrow but I must go on alone",
    "spring has come and everything is blooming",
    "old friends, school days, those afternoons",
    "I fell in love again after many years",
]


class Embedder:
    def __init__(self):
        self.tok = Tokenizer.from_file(str(MODEL / "tokenizer.json"))
        self.tok.enable_truncation(512)
        self.tok.enable_padding(pad_id=self.tok.token_to_id("<pad>") or 1, pad_token="<pad>")
        self.sess = ort.InferenceSession(str(MODEL / "onnx" / "model_quantized.onnx"), providers=["CPUExecutionProvider"])
        self.inputs = {i.name for i in self.sess.get_inputs()}

    def __call__(self, texts):
        enc = self.tok.encode_batch(texts)
        ids = np.array([e.ids for e in enc], dtype=np.int64)
        mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
        feed = {"input_ids": ids, "attention_mask": mask}
        if "token_type_ids" in self.inputs:
            feed["token_type_ids"] = np.zeros_like(ids)
        hidden = self.sess.run(None, feed)[0]
        m = mask[..., None].astype(np.float32)
        vec = (hidden * m).sum(1) / np.clip(m.sum(1), 1e-9, None)
        return vec / np.linalg.norm(vec, axis=1, keepdims=True)


def song_text(s):
    if s.get("lyrics"):
        lines = [l for l in s["lyrics"].split("\n") if l.strip()][:MAX_LINES]
        return "passage: " + "\n".join(lines), 1
    return "passage: " + (s.get("en") or s["id"].replace("-", " ")) + " (Rabindrasangeet)", 0


def main():
    songs = json.loads((ROOT / "docs" / "songs.json").read_text(encoding="utf-8"))["songs"]
    texts, has = zip(*(song_text(s) for s in songs))
    texts = list(texts) + ["passage: " + t for t in MOOD_TEXT.values()]
    emb = Embedder()
    order = sorted(range(len(texts)), key=lambda i: len(texts[i]))  # similar lengths per batch: less padding
    vecs = np.zeros((len(texts), 384), dtype=np.float32)
    t0 = time.time()
    for b in range(0, len(order), 32):
        idx = order[b:b + 32]
        vecs[idx] = emb([texts[i] for i in idx])
        if b % 640 == 0:
            print(f"  {b}/{len(texts)}  {time.time() - t0:.0f}s", flush=True)
    # The site only needs the mood vectors: tests showed the model reads a visitor's feeling well,
    # but matching it straight to poetic lyrics is unreliable, so curated mood tags pick the songs.
    n = len(songs)
    q = np.clip(np.round(vecs[n:] * SCALE), -127, 127).astype(np.int8)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "moods.json").write_text(json.dumps({
        "model": "Xenova/multilingual-e5-small", "dim": 384, "scale": SCALE, "margin": MARGIN,
        "moods": {m: q[i].tolist() for i, m in enumerate(MOOD_TEXT)},
    }, separators=(",", ":")), encoding="utf-8")
    print(f"{len(texts)} vectors in {time.time() - t0:.0f}s; moods.json {(OUT / 'moods.json').stat().st_size / 1e3:.0f} KB")

    if "--eval" in sys.argv:
        n = len(songs)
        sv, mv = vecs[:n], vecs[n:]
        by = {s["id"]: s for s in songs}
        qv = emb(["query: " + t for t in EVAL])
        for t, v in zip(EVAL, qv):
            ms = mv @ v
            top_m = sorted(zip(MOOD_TEXT, ms), key=lambda x: -x[1])[:3]
            picked = [m for m, sc in sorted(zip(MOOD_TEXT, ms), key=lambda x: -x[1]) if sc >= ms.max() - MARGIN]
            ss = (sv @ v) * np.array(has)
            top = np.argsort(-ss)[:4]
            print(f"\n{t}\n  moods: " + ", ".join(f"{m} {s:.3f}" for m, s in top_m) + f"   -> picked {picked}")
            for i in top:
                print(f"  {ss[i]:.2f} {songs[i].get('bn', '')[:40]}  [{', '.join(songs[i].get('moods', []))}]")


if __name__ == "__main__":
    main()
