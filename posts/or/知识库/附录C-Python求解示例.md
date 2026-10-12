# 附录C Python 求解示例

> **配套代码文件**：同目录下的 `附录C-配套代码-or_tools.py`（712 行，纯标准库，零依赖）
> **运行方式**：`python3 附录C-配套代码-or_tools.py`，直接输出 11 个模块的完整演示。

---

## 一、为什么用纯标准库

运筹学的作业和考试都是**手算**，代码的用处只有一个：**验证你手算的答案对不对**。

所以这里不引入 `numpy` / `scipy` / `pulp`，原因有三：

1. **零安装成本**：学校的机房、别人的电脑、手机上的 Python，到处都能跑
2. **有理数精确计算**：LP 用 `Fraction` 分数运算，不会出现 `0.30000000000000004` 这类浮点误差，结果和手算的 `2/3`、`14/5` 完全一致
3. **算法过程可见**：每一张单纯形表、每一轮位势法的检验数都能打印出来，**对着看比只看答案有用得多**

如果你需要更强大的求解器，附录末尾给了 `scipy` / `pulp` 的对照写法（需自行 `pip install`）。

---

## 二、模块速查

| # | 模块 | 函数 | 用途 |
|---|---|---|---|
| 1 | 通用 LP | `lp_solve(c, A, ops, b, maximize)` | 任意 LP（≤/≥/= 混用），两阶段单纯形法 |
| 2 | 单纯形表 | `simplex_table(c, A, b, basis)` | 打印逐表迭代过程，用于对照手算 |
| 3 | 运输问题 | `transport(cost, supply, demand)` | 伏格尔法 + 位势法 + 闭回路自动迭代 |
| 4 | 匈牙利法 | `hungarian(cost)` | 指派问题，返回指派方案与最优值 |
| 5 | 最短路 | `dijkstra(graph, src, dst)` | Dijkstra，返回最短距离、路径、全源距离 |
| 6 | 最大流 | `max_flow(cap, s, t)` | Edmonds-Karp，**同时返回最小割**用于交叉验证 |
| 7 | 网络计划 | `cpm(tasks)` | 六个时间参数 + 关键路线 |
| 8 | 排队论 | `mm1` / `mm1_N` / `mm1_m` / `mmc` / `pk_formula` | 五种模型的全部指标 |
| 9 | 存储论 | `eoq` / `eoq_shortage` / `eoq_production` / `newsvendor` | 四象限 + 报童模型 |
| 10 | 对策论 | `saddle_point` / `game2x2` / `game_lp` | 鞍点、2×2 公式、一般矩阵用 LP |
| 11 | AHP | `ahp(A)` / `ahp_full(...)` | 权重、λmax、CI、CR |

---

## 三、通用 LP 求解器（最有价值的工具）

### 3.1 调用约定

```python
from or_tools import lp_solve

# lp_solve(c, A, ops, b, maximize=True)
#   c   = [目标函数系数]
#   A   = [[第1个约束的系数], [第2个约束的系数], ...]
#   ops = ['<=', '>=', '=']  ← 每个约束的不等号
#   b   = [右端项]
#   返回 (最优值, x列表, 状态)
```

### 3.2 实测输出

```python
# 例：max z = 2x1 + 3x2
#     s.t. x1 + 2x2 ≤ 8,  4x1 ≤ 16,  4x2 ≤ 12
z, x, st = lp_solve([2, 3], [[1,2],[4,0],[0,4]], ['<=','<=','<='], [8,16,12])
print(z, x)
```
```
14 ['4', '2']
```

```python
# 例：min z = x1 + x2
#     s.t. x1 + 2x2 ≥ 4,  3x1 + x2 ≥ 6
z, x, st = lp_solve([1, 1], [[1,2],[3,1]], ['>=','>='], [4,6], maximize=False)
print(z, x)
```
```
14/5 ['8/5', '6/5']
```

> 注意结果是**分数**不是小数：`14/5` = 2.8，`8/5` = 1.6，`6/5` = 1.2。这正是手算该得到的形式。

### 3.3 完整源码

```python
from fractions import Fraction

def lp_solve(c, A, ops, b, maximize=True):
    """
    两阶段单纯形法求解 LP：
        max/min  z = c^T x
        s.t.     A[i]·x (ops[i]) b[i],  ops[i] ∈ {'<=','>=','='},  x >= 0
    返回 (最优值 Fraction, x 列表[str], 状态)
    """
    c = [Fraction(str(v)) for v in c]
    A = [[Fraction(str(v)) for v in row] for row in A]
    b = [Fraction(str(v)) for v in b]
    m, n = len(A), len(c)
    if not maximize:
        c = [-v for v in c]

    # ① 规范化：保证 b >= 0（整行取负并翻转不等号）
    flip = {'<=': '>=', '>=': '<=', '=': '='}
    for i in range(m):
        if b[i] < 0:
            A[i] = [-v for v in A[i]]
            b[i] = -b[i]
            ops[i] = flip[ops[i]]

    # ② 构造等式标准型：≤加松弛，≥减剩余+加人工，=加人工
    rows, art_idx, init_basis = [row[:] for row in A], [], []
    for i in range(m):
        def add_col(coefs):
            for k in range(m):
                rows[k].append(coefs[k])
            return len(rows[0]) - 1
        if ops[i] == '<=':
            init_basis.append(add_col([Fraction(1) if k == i else Fraction(0) for k in range(m)]))
        elif ops[i] == '>=':
            add_col([Fraction(-1) if k == i else Fraction(0) for k in range(m)])
            j = add_col([Fraction(1) if k == i else Fraction(0) for k in range(m)])
            art_idx.append(j); init_basis.append(j)
        else:
            j = add_col([Fraction(1) if k == i else Fraction(0) for k in range(m)])
            art_idx.append(j); init_basis.append(j)
    cols = len(rows[0])
    full_c = c + [Fraction(0)] * (cols - n)

    def run(cost, basis, forbid=frozenset()):
        it = 0
        while True:
            it += 1
            if it > 500:
                return basis, '迭代超限'
            cB = [cost[j] for j in basis]
            sigma = [Fraction(-10**12) if j in forbid
                     else cost[j] - sum(cB[i] * rows[i][j] for i in range(m))
                     for j in range(cols)]
            if all(s <= 0 for s in sigma):
                return basis, 'optimal'
            k = max(range(cols), key=lambda j: sigma[j])
            ratios = [(b[i] / rows[i][k], i) for i in range(m) if rows[i][k] > 0]
            if not ratios:
                return basis, 'unbounded'
            _, r = min(ratios)
            piv = rows[r][k]
            rows[r] = [v / piv for v in rows[r]]
            b[r] = b[r] / piv
            for i in range(m):
                if i != r and rows[i][k] != 0:
                    f = rows[i][k]
                    rows[i] = [rows[i][j] - f * rows[r][j] for j in range(cols)]
                    b[i] = b[i] - f * b[r]
            basis[r] = k

    if art_idx:
        # 第一阶段：max -Σ人工变量
        ph1 = [Fraction(-1) if j in art_idx else Fraction(0) for j in range(cols)]
        basis, st = run(ph1, init_basis[:])
        if sum(b[i] for i in range(m) if basis[i] in art_idx) != 0:
            return None, None, 'infeasible'          # 无可行解
        for i in range(m):                            # 把基中人工变量换出
            if basis[i] in art_idx:
                for j in range(cols):
                    if j not in art_idx and rows[i][j] != 0:
                        piv = rows[i][j]
                        rows[i] = [v / piv for v in rows[i]]
                        b[i] = b[i] / piv
                        for k2 in range(m):
                            if k2 != i and rows[k2][j] != 0:
                                f = rows[k2][j]
                                rows[k2] = [rows[k2][t] - f * rows[i][t] for t in range(cols)]
                                b[k2] = b[k2] - f * b[i]
                        basis[i] = j
                        break
        # 第二阶段：用原目标函数继续迭代，禁止人工变量入基
        basis, st = run(full_c, basis, forbid=set(art_idx))
    else:
        basis, st = run(full_c, init_basis[:])

    if st == 'unbounded':
        return None, None, 'unbounded'
    x = [Fraction(0)] * cols
    for i, j in enumerate(basis):
        x[j] = b[i]
    z = sum(c[j] * x[j] for j in range(n))
    if not maximize:
        z = -z
    return z, [str(v) for v in x[:n]], 'optimal'
```

**状态含义**：`optimal` 最优解 / `unbounded` 无界解 / `infeasible` 无可行解。

> ⚠️ 这个函数只处理 `x ≥ 0` 的标准情形。若题目中有 $x_j \le 0$ 或自由变量，**先用附录A 的变换表**转成非负变量再传进来。

---

## 四、各模块用法与实测输出

### 4.1 单纯形表迭代（对照手算）

```python
simplex_table([2, 3, 0, 0, 0],
              [[1, 2, 1, 0, 0], [4, 0, 0, 1, 0], [0, 4, 0, 0, 1]],
              [8, 16, 12], [2, 3, 4])
```
```
--- 第 1 表 ---  基 = [2, 3, 4]
  cB = ['0', '0', '0']   b = ['8', '16', '12']
  σ  = ['2', '3', '0', '0', '0']
  入基 x2，出基 x5，主元 = 4
--- 第 2 表 ---  基 = [2, 3, 1]
  cB = ['0', '0', '3']   b = ['2', '16', '3']
  σ  = ['2', '0', '0', '0', '-3/4']
  入基 x1，出基 x3，主元 = 1
--- 第 3 表 ---  基 = [0, 3, 1]
  cB = ['2', '0', '3']   b = ['2', '8', '3']
  σ  = ['0', '0', '-2', '0', '1/4']
  入基 x5，出基 x4，主元 = 2
--- 第 4 表 ---  基 = [0, 4, 1]
  cB = ['2', '0', '3']   b = ['4', '4', '2']
  σ  = ['0', '0', '-3/2', '-1/8', '0']
  ✔ 全部 σ ≤ 0，已达最优：z = 14, x = ['4', '2', '0', '0', '4']
```

**用法**：把自己的迭代过程与这个输出逐表对照，**哪一表开始不一致，错就在那一步**。

### 4.2 运输问题

```python
cost   = [[3, 11, 3, 10],
          [1,  9, 2,  8],
          [7,  4, 10, 5]]
supply = [7, 4, 9]
demand = [3, 6, 5, 6]
plan, tot = transport(cost, supply, demand)
```
```
第 1 轮：u = [0, -2, -5], v = [3, 9, 3, 10]
  σ = [[0, 2, 0, 0], [0, 2, 1, 0], [9, 0, 12, 0]]
  ✔ 全部 σ ≥ 0，已得最优方案
  [0, 0, 5, 2]
  [3, 0, 0, 1]
  [0, 6, 0, 3]
  最优总运费 = 85
  LP 交叉验证 = 85  →  与伏格尔法结果一致 ✔
```

> **亮点**：函数内部**同时**用伏格尔法（运筹学方法）和 LP（数学规划方法）求解，两者结果一致才输出"一致 ✔"。这是**最强的自检手段**——你手算出的 85 若与此不同，一定是手算错了。

### 4.3 匈牙利法

```python
hungarian([[4, 5, 6, 7],
           [8, 6, 5, 4],
           [3, 5, 7, 9],
           [6, 4, 3, 2]])
```
```
指派 = {2: 0, 0: 1, 1: 2, 3: 3}，最优值 = 15
```
读法：行索引 0=甲、1=乙、2=丙、3=丁；列索引 0=任务1……。即 **丙→任务1、甲→任务2、乙→任务3、丁→任务4**，最优值 15。

加 `verbose=True` 可打印每轮试指派与覆盖线。

### 4.4 Dijkstra 最短路

```python
graph = {1: [(2, 1), (3, 5), (4, 2)],
         2: [(3, 3), (5, 6)],
         3: [(4, 1), (5, 2)],
         4: [(5, 4)],
         5: []}
d, path, dist = dijkstra(graph, 1, 5)
```
```
1→5 最短距离 = 6，路径 = 1→4→5
各点最短路：{1: 0, 2: 1, 3: 4, 4: 2, 5: 6}
```
图的数据结构：`{节点: [(邻点, 边权), ...]}`。边权必须非负。

### 4.5 最大流（含最小割自检）

```python
cap = [[0]*6 for _ in range(6)]
for u, v, c in [(0,1,4),(0,2,3),(1,2,2),(1,3,3),
                (2,4,2),(3,4,2),(3,5,2),(4,5,4)]:
    cap[u][v] = c
mf, flow, S, cut = max_flow(cap, 0, 5)
```
```
最大流 v(f) = 5
最小割 S = [0, 1, 2]，割容量 = 5  →  最大流 = 最小割 ✔
```

> **考点直击**：最大流最小割定理说 $\max v(f) = \min C(S,\bar S)$。这个函数**一次调用同时给出两者**，可以直接验算定理，也能反查自己标号有没有走错。

### 4.6 网络计划 CPM

```python
tasks = {'A': (2, []),      'B': (3, ['A']), 'C': (4, ['A']),
         'D': (2, ['B']),   'E': (3, ['C']), 'F': (1, ['D', 'E'])}
T, ES, EF, LS, LF, TF, FF, order = cpm(tasks)
```
```
总工期 T = 10
工作   工期   ES  EF  LS  LF  TF  FF
A      2     0   2   0   2   0   0    ★关键
B      3     2   5   4   7   2   0
C      4     2   6   2   6   0   0    ★关键
D      2     5   7   7   9   2   2
E      3     6   9   6   9   0   0    ★关键
F      1     9   10  9   10  0   0    ★关键
关键路线 = A-C-E-F
```
参数格式：`{代号: (工期, [紧前工作])}`。返回顺序为 $T, ES, EF, LS, LF, TF, FF$。

### 4.7 排队论

```python
r = mm1(3, 5)            # M/M/1，λ=3/小时，μ=5/小时
r = mmc(8, 5, 2)         # M/M/c，c=2 个服务台
r = mm1_N(3, 5, 3)       # M/M/1/N，系统容量 N=3
r = mm1_m(3, 5, 5)       # M/M/1/m，顾客源 m=5 个
Lq = pk_formula(3, 5, 0.09)   # M/G/1 的 P-K 公式，σ²=0.09
```
```
M/M/1 (λ=3/时, μ=5/时)：ρ=0.6000, Ls=1.5000, Lq=0.9000, Ws=0.5000h=30.0min, Wq=18.0min
M/M/c (λ=8, μ=5, c=2)：ρ=0.8000, P0=0.1111, Ls=4.4444, Lq=2.8444, Wq=21.33min
M/M/1/3：P0=0.4596, Ls=0.9044, 拒绝率=0.0993
P-K 公式 (M/G/1, λ=3, μ=5, σ²=0.09)：Lq=1.4625
```

返回的是字典，可直接取用：`r['rho'], r['Ls'], r['Lq'], r['Ws'], r['Wq']`。
**注意时间单位**：$W_s, W_q$ 的单位与 $\lambda, \mu$ 一致（上面是"小时"），换分钟要乘 60。

### 4.8 存储论

```python
eoq(2400, 2, 600)                  # D=2400, C1=2, C3=600
eoq_shortage(2400, 2, 4, 600)      # 允许缺货，C2=4
eoq_production(2400, 4800, 2, 600) # 逐渐补充，P=4800
newsvendor(3, 2, table=[(1,0.10),(2,0.30),(3,0.60),(4,0.85),(5,1.00)])
```
```
EOQ：Q*=1200.00, t*=0.5000年, 年订货2.00次, C*=2400.00
  验算 订货费=1200.00, 存储费=1200.00 → 相等 ✔
逐渐补充 (P=4800)：Q*=1697.06  （比 EOQ 大 1.414 倍 = √(P/(P-D))=1.414）
报童：临界比 = 0.6，最优订货 Q* = 3
```

> `eoq` 返回值里**自带** `order_cost` 与 `hold_cost`，函数会提醒你"最优处两者相等"——这正好是复查 EOQ 题的快捷方法。

### 4.9 矩阵对策

```python
saddle_point([[3, 5], [6, 2]])   # 先找鞍点
game2x2([[3, 5], [6, 2]])        # 无鞍点时用 2×2 公式
game_lp([[5, 9, 4], [6, 3, 8], [7, 6, 2]])   # 一般矩阵用 LP
```
```
A=[[3, 5], [6, 2]]：下对策值=3, 上对策值=5 → 无鞍点，需混合策略
混合策略：v=4.0, x=[0.667, 0.333], y=[0.5, 0.5]
验算：Σxᵢaᵢⱼ = [4.0, 4.0]（应都 = v）
3×3 用 LP 解：v=246/43, x=['17/43','21/43','5/43'], y=['24/43','10/43','9/43']
```

**验算思路**：对局中人 I 的混合策略 $x$，无论 II 选哪个纯策略，I 的期望收益都必须**恰好等于 $v$**。上面 3×3 的结果逐个验算：
- 列1：$\frac{5\cdot17+6\cdot21+7\cdot5}{43} = \frac{246}{43}$ ✔
- 列2：$\frac{9\cdot17+3\cdot21+6\cdot5}{43} = \frac{246}{43}$ ✔
- 列3：$\frac{4\cdot17+8\cdot21+2\cdot5}{43} = \frac{246}{43}$ ✔

三个都相等 ⇒ 解正确。

### 4.10 AHP

```python
A = [[1, 3, 5],
     [1/3, 1, 2],
     [1/5, 1/2, 1]]
w, lam, CI, CR = ahp(A)
```
```
权重 w = [0.6483, 0.2297, 0.122]
λmax = 3.0037, CI = 0.0018, CR = 0.0032 → 通过一致性检验 ✔
```

多准则多层次时用 `ahp_full(criteria, alternatives)`，自动做加权汇总与总排序。

---

## 五、用代码自检作业的正确姿势

代码不是用来"抄答案"的，而是用来**定位错误**的。推荐流程：

```
第 1 步：完全手算，得到答案（不碰代码）
第 2 步：跑代码，对比答案
        ├─ 一致 → 过，进入下一题（顺带建立信心）
        └─ 不一致 → 第 3 步
第 3 步：让代码打印中间过程（simplex_table / verbose=True）
        逐表逐轮对照自己的草稿，找到第一个分歧点
第 4 步：定位错误类型 → 回附录B 的"易错点清单"对号入座
第 5 步：重做一遍，确认已掌握
```

### 交叉验证手段汇总

| 章节 | 代码内置的自检机制 |
|---|---|
| 线性规划 | 用 LP 求解器解同一问题，与单纯形表迭代结果比对 |
| 运输问题 | 伏格尔法结果 vs LP 结果（函数内自动比对并打印"一致 ✔"） |
| 最大流 | 最大流值 vs 最小割容量（定理保证必须相等） |
| 存储论 | 订货费 vs 存储费（EOQ 最优处必须相等） |
| 对策论 | 各纯策略下的期望收益是否都等于 $v$ |
| AHP | $CR < 0.1$ 才算通过 |
| 网络计划 | 关键路线上所有工作 $TF = 0$，且路线从起点连到终点 |

---

## 六、可选：安装第三方库的对照写法

如果愿意安装科学计算库（`pip install scipy pulp networkx`），写法会短很多：

```python
# ---- scipy：线性规划 ----
from scipy.optimize import linprog
# min c^T x  s.t. A_ub x <= b_ub
res = linprog(c=[-2, -3],                      # 注意 scipy 只做 min，max 取负
              A_ub=[[1, 2], [4, 0], [0, 4]],
              b_ub=[8, 16, 12], method='highs')
print(-res.fun, res.x)                         # 14.0 [4. 2.]

# ---- scipy：整数规划 ----
from scipy.optimize import milp, LinearConstraint, Bounds
res = milp(c=[-2, -3], constraints=LinearConstraint([[1,2],[4,0],[0,4]], -np.inf, [8,16,12]),
           bounds=Bounds(0, np.inf), integrality=[1, 1])

# ---- pulp：建模更直观（适合整数/0-1 规划） ----
import pulp
prob = pulp.LpProblem('demo', pulp.LpMaximize)
x1 = pulp.LpVariable('x1', lowBound=0)
x2 = pulp.LpVariable('x2', lowBound=0)
prob += 2 * x1 + 3 * x2
prob += x1 + 2 * x2 <= 8
prob += 4 * x1 <= 16
prob += 4 * x2 <= 12
prob.solve()
print(pulp.value(prob.objective), pulp.value(x1), pulp.value(x2))

# ---- networkx：图与网络 ----
import networkx as nx
G = nx.DiGraph()
G.add_weighted_edges_from([(1,2,1), (1,3,5), (1,4,2), (2,3,3),
                           (2,5,6), (3,4,1), (3,5,2), (4,5,4)])
print(nx.dijkstra_path(G, 1, 5), nx.dijkstra_path_length(G, 1, 5))
print(nx.maximum_flow(G, 1, 5)[0])             # 需先设 capacity
```

**代价**：`scipy` 首次安装包体较大（约 40 MB），且浮点结果会出现 `1.9999999999999998` 这类噪声。如果只是**核对作业答案**，本附录的纯标准库版本更省事。

---

## 七、常见报错与处理

| 报错 | 原因 | 处理 |
|---|---|---|
| `KeyError: 5`（Dijkstra） | 图里缺了这个节点 | 补上 `5: []`（终点也必须在字典里） |
| `ZeroDivisionError`（排队论） | $\rho = 1$，系统临界 | 题目不会这么出；检查 $\lambda, \mu$ 抄错没 |
| `mmc` 出现 `rho >= 1` | 服务台数不够 | 增加 $c$，或题目问的是"最少需几个服务台" |
| LP 返回 `infeasible` | 约束矛盾 | 检查约束符号方向抄反没 |
| LP 返回 `unbounded` | 漏了约束 | 常见于 min 问题漏写"≤ 上限" |
| 运输问题 `θ = 0` | 退化情形 | 正常现象，继续迭代即可 |
| `hungarian` 死循环 | 矩阵非方阵 | 补零行/列扩成方阵 |

---

> **相关文件**：`附录A-公式总表.md`（公式速查）、`附录B-题型套路与易错点.md`（流程与避坑）、`附录C-配套代码-or_tools.py`（完整可运行源码）。
