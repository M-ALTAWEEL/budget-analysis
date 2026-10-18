"""Train the expense categorizer: softmax regression with gradient descent, from scratch.

    python ml/train_categorizer.py            # evaluate on a held-out 20%, then train on all
    python ml/train_categorizer.py --check    # also compare with scikit-learn

C = 30 and character pieces of 3-5 letters were chosen by GridSearchCV (notebook, step 6).

Training needs numpy and scipy (and scikit-learn only for --check). The result is plain
JSON that the API reads with pure Python (backend/app/ml/logistic.py).

The maths (COE305 Week 2: gradient descent, Week 3: softmax, Week 9: L2):

    P   = softmax(X W + b)                     n x k probabilities
    J   = -mean(log P[true label]) + lam/2 * |W|^2
    dW  = X^T (P - Y) / n + lam * W            Y = one-hot true labels
    db  = mean(P - Y)                          the bias is not regularized
    W  -= lr * dW,  b -= lr * db               repeat

lam = 1 / (C * n) gives exactly the same model as scikit-learn's LogisticRegression(C).
"""

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.ml.logistic import SoftmaxRegression, TfidfVocabulary  # noqa: E402
from app.ml.text import normalize  # noqa: E402

DATA = ROOT / "ml" / "data" / "expenses.csv"
OUTPUT = ROOT / "backend" / "app" / "ml" / "artifacts" / "categorizer.json"


def load_data() -> pd.DataFrame:
    data = pd.read_csv(DATA)
    # The same expense written twice ("Taxi" / "taxi") would leak between train and test.
    data["normalized"] = data["description"].map(normalize)
    return data.drop_duplicates("normalized").reset_index(drop=True)


def to_matrix(vocabulary: TfidfVocabulary, texts) -> sparse.csr_matrix:
    """Uses the API's own TfidfVocabulary, so training and serving prepare text the same way."""
    column = {f: i for i, f in enumerate(vocabulary.idf)}
    rows, cols, values = [], [], []
    for r, text in enumerate(texts):
        for f, v in vocabulary.transform(text).items():
            rows.append(r)
            cols.append(column[f])
            values.append(v)
    shape = (len(texts), len(column))
    return sparse.csr_matrix((values, (rows, cols)), shape=shape)


def softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def gradient_descent(X, y, labels, C=30.0, lr=30.0, iterations=3000, every=0):
    """Returns W (features x labels), b (labels) and the loss history."""
    n, f = X.shape
    k = len(labels)
    y, labels = np.asarray(y, dtype=object), np.asarray(labels, dtype=object)
    Y = (y[:, None] == labels[None, :]).astype(float)  # one-hot: 1 in the true label's column
    lam = 1.0 / (C * n)
    W, b = np.zeros((f, k)), np.zeros(k)
    history = []
    for i in range(iterations):
        P = softmax(X @ W + b)
        if every and (i % every == 0 or i == iterations - 1):
            loss = -np.log(P[Y == 1]).mean() + lam / 2 * (W**2).sum()
            history.append((i, loss))
        W -= lr * (X.T @ (P - Y) / n + lam * W)
        b -= lr * (P - Y).mean(axis=0)
    return W, b, history


def fit(texts, y, C=30.0, lr=30.0, iterations=3000, every=0):
    texts = list(texts)
    labels = sorted(set(y))
    vocabulary = TfidfVocabulary().fit(texts)
    X = to_matrix(vocabulary, texts)
    W, b, history = gradient_descent(X, y, labels, C, lr, iterations, every)
    weights = {f: W[i].tolist() for i, f in enumerate(vocabulary.idf)}
    return SoftmaxRegression(labels, vocabulary, weights, b.tolist()), history


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--C", type=float, default=30.0, help="less regularization when larger")
    parser.add_argument("--lr", type=float, default=30.0, help="learning rate")
    parser.add_argument("--iterations", type=int, default=3000)
    parser.add_argument("--check", action="store_true", help="compare with scikit-learn")
    args = parser.parse_args()

    from sklearn.metrics import accuracy_score, f1_score
    from sklearn.model_selection import train_test_split

    data = load_data()
    train, test = train_test_split(data, test_size=0.2, stratify=data["category"], random_state=42)
    print(f"{len(data)} examples, {data['category'].nunique()} categories")

    start = time.time()
    model, history = fit(
        train["description"], train["category"], args.C, args.lr, args.iterations, every=500
    )
    losses = " -> ".join(f"{loss:.4f}" for _, loss in history)
    print(f"trained in {time.time() - start:.1f}s; loss {losses}")

    predicted = [model.predict(t).label for t in test["description"]]
    print(f"held-out accuracy {accuracy_score(test['category'], predicted):.3f}, "
          f"macro F1 {f1_score(test['category'], predicted, average='macro'):.3f}")

    if args.check:
        from sklearn.linear_model import LogisticRegression

        X_train = to_matrix(model.vocabulary, list(train["description"]))
        X_test = to_matrix(model.vocabulary, list(test["description"]))
        sk = LogisticRegression(C=args.C, max_iter=10000, tol=1e-10).fit(X_train, train["category"])
        ours = np.array(
            [[model.predict(t).probabilities[c] for c in sk.classes_] for t in test["description"]]
        )
        theirs = sk.predict_proba(X_test)
        print(f"vs scikit-learn: largest probability difference {np.abs(ours - theirs).max():.4f}, "
              f"same answer {np.mean(ours.argmax(1) == theirs.argmax(1)):.0%}")

    final, _ = fit(data["description"], data["category"], args.C, args.lr, args.iterations)
    final.save(OUTPUT)
    print(f"saved {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size / 1024:.0f} KB, "
          f"{len(final.weights)} features)")


if __name__ == "__main__":
    main()
