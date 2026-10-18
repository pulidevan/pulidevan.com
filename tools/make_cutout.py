#!/usr/bin/env python3
"""
Turn any photo into a floating cutout + depth map for the scene.

  pip install rembg onnxruntime opencv-python pillow numpy
  python tools/make_cutout.py path/to/photo.jpg figure-c --fade 0.14

Writes public/assets/<name>.webp and public/assets/<name>-depth.png, then prints the
ASSETS line to paste into src/scene/createScene.js.

  --fade   fades the bottom N fraction of the cutout (use for busts cropped by the frame)
  --model  rembg model: isnet-general-use (default) | u2net  (try u2net if the background survives)
Depth model: Depth Anything V2 small (ONNX), downloaded once to ~/.cache/pulidevan-prabakaran/.
"""
import argparse, os, sys, urllib.request
import numpy as np, cv2, onnxruntime as ort
from PIL import Image
from rembg import remove, new_session

MODEL_URL = "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx"
CACHE = os.path.expanduser("~/.cache/pulidevan-prabakaran/depth_anything_v2_vits.onnx")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets")

def depth_model():
    if not os.path.exists(CACHE):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        print("downloading depth model (~100 MB)…"); urllib.request.urlretrieve(MODEL_URL, CACHE)
    return ort.InferenceSession(CACHE)

def depth(sess, rgb):
    h, w = rgb.shape[:2]
    x = cv2.resize(rgb, (518, 518), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255
    x = (x - [.485, .456, .406]) / [.229, .224, .225]
    d = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
    return cv2.resize(d, (w, h), interpolation=cv2.INTER_CUBIC)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("name")
    ap.add_argument("--fade", type=float, default=0.0)
    ap.add_argument("--model", default="isnet-general-use")
    ap.add_argument("--size", type=int, default=700, help="longest side in px")
    ap.add_argument("--detilt", action="store_true", help="remove left-right depth tilt (good for faces)")
    a = ap.parse_args()

    im = Image.open(a.image).convert("RGB"); rgb = np.array(im)
    cut = np.array(remove(im, session=new_session(a.model)))
    d = depth(depth_model(), rgb)
    al = cut[:, :, 3]
    ys, xs = np.where(al > 20)
    if len(xs) == 0: sys.exit("no subject found; try --model u2net")
    x0, x1 = max(xs.min() - 16, 0), min(xs.max() + 16, al.shape[1]); y0, y1 = max(ys.min() - 16, 0), min(ys.max() + 16, al.shape[0])
    cut, d = cut[y0:y1, x0:x1].copy(), d[y0:y1, x0:x1]
    alpha = cut[:, :, 3].astype(np.float32)
    alpha = np.clip((alpha - 40) / 215, 0, 1) * 255                  # kill faint background haze
    if a.fade > 0:
        h = alpha.shape[0]; ramp = np.clip((h - np.arange(h)) / (h * a.fade), 0, 1) ** 1.4; alpha *= ramp[:, None]
    cut[:, :, 3] = alpha.astype(np.uint8)
    m = alpha > 128
    lo, hi = np.percentile(d[m], 8), np.percentile(d[m], 99.7)
    dn = np.clip((d - lo) / (hi - lo), 0, 1)
    r = np.zeros_like(dn); v = dn[m]; r[m] = np.argsort(np.argsort(v)) / len(v)
    dn = np.where(m, .55 * dn + .45 * r, dn)                          # spread facial relief
    if a.detilt:
        yy, xx = np.where(m); A = np.c_[xx, yy, np.ones_like(xx)]; c = np.linalg.lstsq(A, dn[m], rcond=None)[0]
        X = np.meshgrid(np.arange(dn.shape[1]), np.arange(dn.shape[0]))[0]; dn = dn - c[0] * (X - xx.mean())
        dn = (dn - dn[m].min()) / (np.percentile(dn[m], 99.7) - dn[m].min())
    dn = cv2.inpaint((np.clip(dn, 0, 1) * 255).astype(np.uint8), (~m).astype(np.uint8), 5, cv2.INPAINT_TELEA).astype(np.float32) / 255
    dn = cv2.GaussianBlur(cv2.bilateralFilter(dn, 9, .1, 6), (0, 0), 2)
    H, W = cut.shape[:2]; s = a.size / max(H, W); size = (int(W * s), int(H * s))
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(cut).resize(size, Image.LANCZOS).save(os.path.join(OUT, f"{a.name}.webp"), "WEBP", quality=88, method=6)
    Image.fromarray((np.clip(dn, 0, 1) * 255).astype(np.uint8)).resize((size[0] // 2, size[1] // 2), Image.LANCZOS).save(os.path.join(OUT, f"{a.name}-depth.png"))
    key = "".join(p.capitalize() if i else p for i, p in enumerate(a.name.split("-")))
    print(f'\nAdd to ASSETS in src/scene/createScene.js:\n  {key}: {{ img: A + "{a.name}.webp", depth: A + "{a.name}-depth.png", w: {size[0]}, h: {size[1]} }},')

if __name__ == "__main__":
    main()
