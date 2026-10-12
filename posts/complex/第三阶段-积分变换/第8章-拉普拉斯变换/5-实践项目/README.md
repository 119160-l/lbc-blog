# RLC 电路求解器 (RLC Circuit Solver)

## 项目目的

本项目通过拉普拉斯变换求解 RLC 串联电路，展示如何将微分方程转化为代数方程进行求解。通过传递函数、极零图和时域响应分析，深入理解电路系统的阻尼特性。

## 使用方法

### 环境要求
- Python 3.6+
- 依赖库：numpy, matplotlib, scipy

### 安装依赖
```bash
pip install numpy matplotlib scipy
```

### 运行程序
```bash
cd "第三阶段-积分变换/第8章-拉普拉斯变换/5-实践项目"
python3 rlc_solver.py
```

## 代码逻辑

### 1. 电路建模
RLC 串联电路的微分方程：
```
L·d²i/dt² + R·di/dt + i/C = v_in(t)
```
通过拉普拉斯变换得到传递函数：
```
H(s) = 1 / (L·s² + R·s + 1/C)
```

### 2. 求解方法
- **阶跃响应**：输入 V_in(s) = 1/s，输出 I(s) = H(s)/s
- **正弦响应**：输入 v_in(t) = sin(ωt)，使用 `scipy.signal.lsim` 求解
- **传递函数**：使用 `scipy.signal.TransferFunction` 表示

### 3. 阻尼分析
根据阻尼比 ζ 判断系统类型：
- ζ > 1：过阻尼 (Overdamped) — 无振荡，缓慢趋近稳态
- ζ = 1：临界阻尼 (Critically Damped) — 最快无振荡响应
- ζ < 1：欠阻尼 (Underdamped) — 振荡衰减趋近稳态

### 4. 极零图分析
- 极点位置决定系统稳定性和响应特性
- 实轴上极点 → 指数衰减
- 复平面上共轭极点 → 振荡衰减

## 结果分析

### 生成的可视化文件
| 文件名 | 说明 |
|--------|------|
| `fig1_step_response.png` | 阶跃响应曲线（R=2Ω, L=1H, C=1F） |
| `fig2_pole_zero_nominal.png` | 传递函数的极零图 |
| `fig3_sinusoidal_response.png` | 正弦响应（输入 v_in(t)=sin(2t)） |
| `fig4_pole_zero_R1~R4.png` | 不同 R 值下的极零图 |
| `fig5_damping_comparison.png` | 过阻尼/临界阻尼/欠阻尼对比 |

### 关键观察
1. **传递函数**：H(s) 的极点由 R、L、C 共同决定，极点在 s 平面上的位置直接反映系统响应特性
2. **阶跃响应**：电流从零开始，经过瞬态过程后达到稳态值 i(∞) = C·V_in
3. **阻尼效应**：R 值增大 → 阻尼比增大 → 系统从欠阻尼过渡到过阻尼
4. **临界阻尼**：当 R_crit = 2√(L/C) 时，系统达到临界阻尼，响应最快且无振荡
5. **拉普拉斯变换的优势**：将微分方程转化为代数方程，极大简化了求解过程