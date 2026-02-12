# Time-to-default: Weibull hazard and comparison to exponential

## Weibull (default assumption)

- **Survival:** \( S(t) = \exp\bigl(-(t/\lambda)^k\bigr),\quad t\ge 0 \), with scale \(\lambda>0\), shape \(k>0\).
- **PDF:** \( f(t) = \frac{k}{\lambda}\bigl(\frac{t}{\lambda}\bigr)^{k-1} \exp\bigl(-(t/\lambda)^k\bigr) \).
- **Hazard rate (as function of time):**
  \[
  h(t) = \frac{f(t)}{S(t)} = \frac{k}{\lambda}\left(\frac{t}{\lambda}\right)^{k-1} = \frac{k}{\lambda^k}\, t^{k-1}.
  \]
- **Behavior:**  
  - \(k>1\): \(h(t)\) increases with \(t\) (aging / increasing default risk).  
  - \(k<1\): \(h(t)\) decreases with \(t\) (burn-in / decreasing risk).  
  - \(k=1\): Weibull = Exponential; \(h(t)=1/\lambda\) constant.

## Exponential

- **Hazard rate:** \( h(t) = \lambda \) (constant in \(t\)).
- **Survival:** \( S(t) = e^{-\lambda t} \), so “memoryless”: risk per unit time does not depend on how long the obligor has survived.

## Comparison

|                | Weibull \(h(t)\)     | Exponential \(h(t)\) |
|----------------|----------------------|------------------------|
| Formula        | \(\frac{k}{\lambda^k}t^{k-1}\) | \(\lambda\)            |
| Depends on \(t\)? | Yes (unless \(k=1\)) | No                     |
| Typical use    | Default risk that changes over time | Constant default intensity |

So: **Weibull** gives a time-varying hazard \(h(t) \propto t^{k-1}\); **exponential** is the special case \(k=1\) with constant hazard.
