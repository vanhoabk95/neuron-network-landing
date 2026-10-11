"""Train the 784-16-16-10 MLP the landing-page figure runs, with numpy only.

ReLU hidden layers, softmax output, Adam, and augmentation that makes MNIST look more like
digits written with a mouse or a finger (shift, rotate, scale, thicker or thinner strokes).
Writes training/model.npz and prints the true test accuracy.
"""

import gzip
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
SIZES = [784, 16, 16, 10]


def load(kind):
    prefix = "train" if kind == "train" else "t10k"
    with gzip.open(os.path.join(DATA, f"{prefix}-images-idx3-ubyte.gz")) as f:
        images = np.frombuffer(f.read(), np.uint8, offset=16).reshape(-1, 28, 28)
    with gzip.open(os.path.join(DATA, f"{prefix}-labels-idx1-ubyte.gz")) as f:
        labels = np.frombuffer(f.read(), np.uint8, offset=8)
    return images.astype(np.float32) / 255.0, labels.astype(np.int64)


def augment(images, rng):
    """Random affine warp (bilinear) plus a random dilation or erosion, per image."""
    n = len(images)
    angle = rng.uniform(-12, 12, n) * np.pi / 180
    scale = rng.uniform(0.85, 1.15, n)
    shear = rng.uniform(-0.12, 0.12, n)
    shift = rng.uniform(-2.5, 2.5, (n, 2))
    c, s = np.cos(angle), np.sin(angle)
    # Inverse map: output pixel -> source pixel, about the centre (13.5, 13.5).
    a = c / scale
    b = (s + shear) / scale
    d = -s / scale
    e = c / scale
    ys, xs = np.mgrid[0:28, 0:28].astype(np.float32)
    xs = xs[None] - 13.5 - shift[:, 0, None, None]
    ys = ys[None] - 13.5 - shift[:, 1, None, None]
    sx = a[:, None, None] * xs + b[:, None, None] * ys + 13.5
    sy = d[:, None, None] * xs + e[:, None, None] * ys + 13.5
    x0 = np.floor(sx).astype(np.int64)
    y0 = np.floor(sy).astype(np.int64)
    fx = sx - x0
    fy = sy - y0
    padded = np.pad(images, ((0, 0), (1, 2), (1, 2)))
    idx = np.arange(n)[:, None, None]

    def at(yy, xx):
        yy = np.clip(yy + 1, 0, 30)
        xx = np.clip(xx + 1, 0, 30)
        return padded[idx, yy, xx]

    out = (at(y0, x0) * (1 - fx) * (1 - fy) + at(y0, x0 + 1) * fx * (1 - fy)
           + at(y0 + 1, x0) * (1 - fx) * fy + at(y0 + 1, x0 + 1) * fx * fy)
    # Stroke weight: a third get a soft dilation, a sixth a soft erosion.
    pick = rng.uniform(0, 1, n)
    p = np.pad(out, ((0, 0), (1, 1), (1, 1)))
    neigh = np.stack([p[:, 1 + dy:29 + dy, 1 + dx:29 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
    grow = 0.5 * out + 0.5 * neigh.max(0)
    thin = 0.5 * out + 0.5 * neigh.min(0)
    out = np.where(pick[:, None, None] < 0.33, grow, out)
    out = np.where(pick[:, None, None] > 0.83, thin, out)
    return np.clip(out, 0, 1).astype(np.float32)


def init(rng):
    params = []
    for fan_in, fan_out in zip(SIZES[:-1], SIZES[1:]):
        params.append(rng.normal(0, np.sqrt(2 / fan_in), (fan_in, fan_out)).astype(np.float32))
        params.append(np.zeros(fan_out, np.float32))
    return params


def forward(params, x):
    w1, b1, w2, b2, w3, b3 = params
    z1 = x @ w1 + b1
    a1 = np.maximum(z1, 0)
    z2 = a1 @ w2 + b2
    a2 = np.maximum(z2, 0)
    z3 = a2 @ w3 + b3
    return z1, a1, z2, a2, z3


def accuracy(params, x, y):
    return float((forward(params, x)[-1].argmax(1) == y).mean())


def train(epochs=60, batch=64, lr=3e-3, seed=7):
    rng = np.random.default_rng(seed)
    xtr, ytr = load("train")
    xte, yte = load("test")
    params = init(rng)
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    step = 0
    for epoch in range(epochs):
        rate = lr * 0.5 * (1 + np.cos(np.pi * epoch / epochs))
        order = rng.permutation(len(xtr))
        if epoch < epochs - 3:
            images = np.concatenate([augment(xtr[order[i:i + 6000]], rng) for i in range(0, len(order), 6000)])
            keep = rng.uniform(0, 1, len(order)) < 0.5
            images[keep] = xtr[order][keep]
        else:
            images = xtr[order]
        x_all = images.reshape(len(images), 784)
        y_all = ytr[order]
        for start in range(0, len(x_all), batch):
            x = x_all[start:start + batch]
            y = y_all[start:start + batch]
            z1, a1, z2, a2, z3 = forward(params, x)
            p = np.exp(z3 - z3.max(1, keepdims=True))
            p /= p.sum(1, keepdims=True)
            p[np.arange(len(y)), y] -= 1
            d3 = p / len(y)
            d2 = (d3 @ params[4].T) * (z2 > 0)
            d1 = (d2 @ params[2].T) * (z1 > 0)
            grads = [x.T @ d1, d1.sum(0), a1.T @ d2, d2.sum(0), a2.T @ d3, d3.sum(0)]
            step += 1
            for i, g in enumerate(grads):
                if i % 2 == 0:
                    g = g + 1e-5 * params[i]
                m[i] = 0.9 * m[i] + 0.1 * g
                v[i] = 0.999 * v[i] + 0.001 * g * g
                mh = m[i] / (1 - 0.9 ** step)
                vh = v[i] / (1 - 0.999 ** step)
                params[i] -= (rate * mh / (np.sqrt(vh) + 1e-8)).astype(np.float32)
        acc = accuracy(params, xte.reshape(-1, 784), yte)
        print(f"epoch {epoch + 1:2d}  lr {rate:.5f}  test {acc * 100:.2f}%", flush=True)
    np.savez(os.path.join(HERE, "model.npz"), *params)
    return params


if __name__ == "__main__":
    train(epochs=int(sys.argv[1]) if len(sys.argv) > 1 else 60)
