"""Quantise model.npz to int8 per layer and write the figure's weights.json.

Also writes training/parity.json: 200 test images with the logits numpy computes from the
same dequantised weights, so parity.mjs can prove the browser model matches.
"""

import base64
import json
import os

import numpy as np

from train import HERE, SIZES, accuracy, forward, load

OUT = os.path.join(HERE, "..", "landing", "components", "figures", "digit-net", "weights.json")


def main():
    raw = np.load(os.path.join(HERE, "model.npz"))
    params = [raw[f"arr_{i}"] for i in range(6)]
    xte, yte = load("test")
    x = xte.reshape(-1, 784)
    layers = []
    deq = []
    for i in range(3):
        w, b = params[2 * i], params[2 * i + 1]
        scale = float(np.abs(w).max() / 127)
        q = np.clip(np.round(w / scale), -127, 127).astype(np.int8)
        deq += [q.astype(np.float32) * np.float32(scale), b.astype(np.float32)]
        layers.append({
            "in": int(w.shape[0]),
            "out": int(w.shape[1]),
            "scale": scale,
            # Row-major [in][out], int8.
            "w": base64.b64encode(q.tobytes()).decode(),
            "b": [round(float(t), 6) for t in b],
        })
    full = accuracy(params, x, yte)
    quant = accuracy(deq, x, yte)
    print(f"float32 test {full * 100:.2f}%  int8 test {quant * 100:.2f}%")
    meta = {
        "sizes": SIZES,
        "params": int(sum(p.size for p in params)),
        "testAccuracy": round(quant, 4),
        "testCount": int(len(yte)),
        "layers": layers,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print(f"wrote {os.path.relpath(OUT)} ({os.path.getsize(OUT) / 1024:.1f} KB)")

    pick = np.arange(200) * 50
    logits = forward(deq, x[pick])[-1]
    with open(os.path.join(HERE, "parity.json"), "w") as f:
        json.dump({
            "images": [base64.b64encode((x[i] * 255).round().astype(np.uint8).tobytes()).decode() for i in pick],
            "labels": [int(yte[i]) for i in pick],
            "logits": logits.round(6).tolist(),
        }, f)


if __name__ == "__main__":
    main()
