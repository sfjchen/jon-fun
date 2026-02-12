# Time-to-Default: Weibull Hazard Rate (with steps)

## 1 Setup

Time to default \(T\) follows a **Weibull** distribution with scale \(\lambda>0\) and shape \(k>0\).

| Function | Definition |
|----------|-----------|
| CDF | \(F(t) = 1 - \exp\!\bigl(-(t/\lambda)^k\bigr)\) |
| Survival | \(S(t) = 1 - F(t) = \exp\!\bigl(-(t/\lambda)^k\bigr)\) |
| PDF | \(f(t) = F'(t) = \frac{k}{\lambda}\left(\frac{t}{\lambda}\right)^{k-1}\exp\!\bigl(-(t/\lambda)^k\bigr)\) |

---

## 2 Deriving the hazard rate (step-by-step)

The hazard (instantaneous default intensity) is defined as

\[
h(t) \;=\; \frac{f(t)}{S(t)}.
\]

**Step 1 — write the ratio:**

\[
h(t) = \frac{\dfrac{k}{\lambda}\!\left(\dfrac{t}{\lambda}\right)^{k-1}\exp\!\bigl(-(t/\lambda)^k\bigr)}{\exp\!\bigl(-(t/\lambda)^k\bigr)}.
\]

**Step 2 — cancel the exponential terms:**

\[
h(t) = \frac{k}{\lambda}\left(\frac{t}{\lambda}\right)^{k-1}.
\]

**Step 3 — simplify the power of \(\lambda\):**

\[
\boxed{\;h(t) = \frac{k}{\lambda^k}\,t^{\,k-1}\;}
\]

---

## 3 Hazard as \(f(\text{time})\), depending on parameters

Since \(h(t) = \frac{k}{\lambda^k}\,t^{k-1}\), the shape is governed entirely by \(k\):

| \(k\) | \(h(t)\) behavior | Interpretation |
|-------|-------------------|----------------|
| \(k > 1\) | **Increasing** in \(t\) (power-law growth) | Aging / deteriorating credit — default risk rises over time |
| \(k = 1\) | **Constant** \(= 1/\lambda\) | Memoryless — reduces to exponential |
| \(0 < k < 1\) | **Decreasing** in \(t\) | Burn-in / infant mortality — risk falls as obligor "survives" |

The scale \(\lambda\) shifts the overall level: larger \(\lambda\) → lower hazard at every \(t\).

---

## 4 Comparison: Weibull vs Exponential hazard

The **Exponential** distribution is Weibull with \(k=1\):

- Hazard: \(h_{\text{exp}}(t) = 1/\lambda\) (constant).
- Survival: \(S(t) = e^{-t/\lambda}\).

|  | **Weibull** | **Exponential** |
|--|-------------|-----------------|
| Hazard formula | \(\dfrac{k}{\lambda^k}\,t^{k-1}\) | \(1/\lambda\) |
| Depends on \(t\)? | Yes (unless \(k=1\)) | No |
| Shape parameter | \(k\) controls increasing/decreasing/constant | Fixed \(k=1\) |
| Key property | Time-varying default intensity | Memoryless (constant intensity) |
| When to use | Default risk that evolves with age of exposure | Flat hazard assumption / simple models |

**Bottom line:** Weibull generalises Exponential by letting hazard scale as \(t^{k-1}\). Setting \(k=1\) recovers the constant-hazard Exponential case.
