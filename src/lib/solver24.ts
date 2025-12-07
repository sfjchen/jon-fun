export class Solver24 {
  private static readonly OPERATORS = ['+', '-', '*', '/'] as const
  private static readonly TARGET = 24
  private static readonly EPSILON = 0.001
  private readonly hasSolutionCache = new Map<string, boolean>()
  private readonly solutionCache = new Map<string, string | null>()

  private getKey(numbers: number[]): string {
    return [...numbers].sort((a, b) => a - b).join(',')
  }

  hasSolution(numbers: number[]): boolean {
    if (numbers.length !== 4) return false

    const key = this.getKey(numbers)
    const cached = this.hasSolutionCache.get(key)
    if (cached !== undefined) return cached

    const permutations = this.getPermutations(numbers)

    for (const perm of permutations) {
      if (this.canMakeTarget(perm)) {
        this.hasSolutionCache.set(key, true)
        return true
      }
    }

    this.hasSolutionCache.set(key, false)
    return false
  }

  getSolution(numbers: number[]): string | null {
    if (numbers.length !== 4) return null

    const key = this.getKey(numbers)
    if (this.solutionCache.has(key)) {
      return this.solutionCache.get(key) ?? null
    }

    const permutations = this.getPermutations(numbers)

    for (const perm of permutations) {
      const solution = this.findSolution(perm)
      if (solution) {
        this.solutionCache.set(key, solution)
        return solution
      }
    }

    this.solutionCache.set(key, null)
    return null
  }

  private getPermutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr]
    
    const result: number[][] = []
    
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i]!
      const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)]
      const perms = this.getPermutations(remaining)
      
      for (const perm of perms) {
        result.push([current, ...perm])
      }
    }
    
    return result
  }

  private canMakeTarget(numbers: number[]): boolean {
    const expressions = [
      // ((a op b) op c) op d
      (a: number, b: number, c: number, d: number, op1: string, op2: string, op3: string) => {
        try {
          const step1 = this.applyOperator(a, b, op1)
          const step2 = this.applyOperator(step1, c, op2)
          const step3 = this.applyOperator(step2, d, op3)
          return Math.abs(step3 - Solver24.TARGET) < Solver24.EPSILON
        } catch {
          return false
        }
      },
      // (a op b) op (c op d)
      (a: number, b: number, c: number, d: number, op1: string, op2: string, op3: string) => {
        try {
          const step1 = this.applyOperator(a, b, op1)
          const step2 = this.applyOperator(c, d, op3)
          const step3 = this.applyOperator(step1, step2, op2)
          return Math.abs(step3 - Solver24.TARGET) < Solver24.EPSILON
        } catch {
          return false
        }
      }
    ]

    for (const op1 of Solver24.OPERATORS) {
      for (const op2 of Solver24.OPERATORS) {
        for (const op3 of Solver24.OPERATORS) {
          for (const expr of expressions) {
            if (expr(numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!, op1, op2, op3)) {
              return true
            }
          }
        }
      }
    }
    
    return false
  }

  private findSolution(numbers: number[]): string | null {
    const expressions = [
      // ((a op b) op c) op d
      (a: number, b: number, c: number, d: number, op1: string, op2: string, op3: string) => {
        try {
          const step1 = this.applyOperator(a, b, op1)
          const step2 = this.applyOperator(step1, c, op2)
          const step3 = this.applyOperator(step2, d, op3)
          if (Math.abs(step3 - Solver24.TARGET) < Solver24.EPSILON) {
            return `((${a} ${op1} ${b}) ${op2} ${c}) ${op3} ${d}`
          }
        } catch {
          return null
        }
        return null
      },
      // (a op b) op (c op d)
      (a: number, b: number, c: number, d: number, op1: string, op2: string, op3: string) => {
        try {
          const step1 = this.applyOperator(a, b, op1)
          const step2 = this.applyOperator(c, d, op3)
          const step3 = this.applyOperator(step1, step2, op2)
          if (Math.abs(step3 - Solver24.TARGET) < Solver24.EPSILON) {
            return `(${a} ${op1} ${b}) ${op2} (${c} ${op3} ${d})`
          }
        } catch {
          return null
        }
        return null
      }
    ]

    for (const op1 of Solver24.OPERATORS) {
      for (const op2 of Solver24.OPERATORS) {
        for (const op3 of Solver24.OPERATORS) {
          for (const expr of expressions) {
            const solution = expr(numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!, op1, op2, op3)
            if (solution) {
              return solution
            }
          }
        }
      }
    }
    
    return null
  }

  private applyOperator(a: number, b: number, op: string): number {
    switch (op) {
      case '+':
        return a + b
      case '-':
        return a - b
      case '*':
        return a * b
      case '/':
        if (b === 0) throw new Error('Division by zero')
        return a / b
      default:
        throw new Error(`Unknown operator: ${op}`)
    }
  }
}
